package main

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"gorm.io/gorm"
)

var trainerCodePattern = regexp.MustCompile(`^\d{12}$`)

const maxTrainerTitles = 3

var allowedTrainerTitles = map[string]struct{}{
	"raid-regular":          {},
	"shadow-raider":         {},
	"super-mega-raider":     {},
	"max-battler":           {},
	"battle-league-trainer": {},
	"rocket-hunter":         {},
	"shiny-hunter":          {},
	"pokedex-collector":     {},
	"costume-collector":     {},
	"hundo-hunter":          {},
	"size-collector":        {},
	"lucky-trader":          {},
	"egg-hatcher":           {},
	"route-explorer":        {},
	"showcase-star":         {},
	"party-player":          {},
}

type ProfileStats struct {
	Caught     int64 `json:"caught" gorm:"column:caught"`
	ForTrade   int64 `json:"for_trade" gorm:"column:for_trade"`
	Wanted     int64 `json:"wanted" gorm:"column:wanted"`
	Favorites  int64 `json:"favorites" gorm:"column:favorites"`
	Registered int64 `json:"registered" gorm:"column:registered"`
}

type ProfileViewerState struct {
	Relationship      string  `json:"relationship"`
	FriendshipID      *string `json:"friendship_id,omitempty"`
	CanViewProfile    bool    `json:"can_view_profile"`
	CanViewCollection bool    `json:"can_view_collection"`
}

type ProfileResponse struct {
	User          PublicUser         `json:"user"`
	TrainerTitles TrainerTitleList   `json:"trainer_titles"`
	Location      *string            `json:"location,omitempty"`
	TrainerCode   *string            `json:"trainer_code,omitempty"`
	Stats         ProfileStats       `json:"stats"`
	Highlights    []PokemonInstance  `json:"highlights"`
	Preferences   *UserProfile       `json:"preferences,omitempty"`
	Viewer        ProfileViewerState `json:"viewer"`
}

func viewerID(c fiber.Ctx) string {
	value, _ := c.Locals("user_id").(string)
	return value
}

func findUserByUsername(username string) (User, error) {
	var user User
	err := db.Where("LOWER(username) = ?", strings.ToLower(strings.TrimSpace(username))).First(&user).Error
	return user, err
}

func findUserByID(userID string) (User, error) {
	var user User
	err := db.Where("user_id = ?", userID).First(&user).Error
	return user, err
}

func loadProfileStats(userID string) (ProfileStats, error) {
	var stats ProfileStats
	err := db.Table("instances").
		Select(`
			COUNT(DISTINCT CASE WHEN is_caught = 1 AND disabled = 0 THEN instance_id END) AS caught,
			COUNT(DISTINCT CASE WHEN is_for_trade = 1 AND disabled = 0 THEN instance_id END) AS for_trade,
			COUNT(DISTINCT CASE WHEN is_wanted = 1 AND disabled = 0 THEN instance_id END) AS wanted,
			COUNT(DISTINCT CASE WHEN favorite = 1 AND disabled = 0 THEN instance_id END) AS favorites`).
		Where("user_id = ?", userID).
		Scan(&stats).Error
	if err != nil {
		return stats, err
	}
	return stats, db.Table("registrations").Where("user_id = ?", userID).Count(&stats.Registered).Error
}

func profileHighlightIDs(user User) []string {
	raw := []*string{
		user.Highlight1InstanceID, user.Highlight2InstanceID, user.Highlight3InstanceID,
		user.Highlight4InstanceID, user.Highlight5InstanceID, user.Highlight6InstanceID,
	}
	ids := make([]string, 0, len(raw))
	for _, id := range raw {
		if id != nil && strings.TrimSpace(*id) != "" {
			ids = append(ids, *id)
		}
	}
	return ids
}

func loadHighlights(user User) ([]PokemonInstance, error) {
	ids := profileHighlightIDs(user)
	if len(ids) == 0 {
		return []PokemonInstance{}, nil
	}
	var instances []PokemonInstance
	if err := db.Where(
		"user_id = ? AND disabled = ? AND is_caught = ? AND instance_id IN ?",
		user.UserID, false, true, ids,
	).Find(&instances).Error; err != nil {
		return nil, err
	}
	byID := make(map[string]PokemonInstance, len(instances))
	for _, instance := range instances {
		byID[instance.InstanceID] = instance
	}
	ordered := make([]PokemonInstance, 0, len(instances))
	for _, id := range ids {
		if instance, ok := byID[id]; ok {
			ordered = append(ordered, instance)
		}
	}
	return ordered, nil
}

func publicUserFromUser(user User, profile UserProfile, relationship string) PublicUser {
	out := PublicUser{
		UserID: user.UserID, Username: user.Username, Team: user.Team,
		TrainerLevel: user.TrainerLevel, TotalXP: user.TotalXP,
		PogoStartedOn: user.PogoStartedOn, AppJoinedAt: user.AppJoinedAt,
		Highlight1: user.Highlight1InstanceID, Highlight2: user.Highlight2InstanceID,
		Highlight3: user.Highlight3InstanceID, Highlight4: user.Highlight4InstanceID,
		Highlight5: user.Highlight5InstanceID, Highlight6: user.Highlight6InstanceID,
	}
	if profile.ShowPokemonGoName || relationship == relationshipSelf {
		out.PokemonGoName = user.PokemonGoName
	}
	return out
}

func sendProfileResponse(
	c fiber.Ctx,
	user User,
	relationship string,
	friendship *Friendship,
) error {
	profile, err := loadUserProfile(user.UserID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Could not load profile settings"})
	}
	canViewProfile := visibilityAllows(profile.ProfileVisibility, relationship)
	canViewCollection := visibilityAllows(profile.CollectionVisibility, relationship)
	if !canViewProfile {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"message": "This trainer's profile is private"})
	}

	stats, err := loadProfileStats(user.UserID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Could not load profile stats"})
	}
	highlights, err := loadHighlights(user)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Could not load profile highlights"})
	}

	var friendshipID *string
	if friendship != nil {
		value := friendship.FriendshipID
		friendshipID = &value
	}
	response := ProfileResponse{
		User:          publicUserFromUser(user, profile, relationship),
		TrainerTitles: profile.TrainerTitles,
		Stats:         stats,
		Highlights:    highlights,
		Viewer: ProfileViewerState{
			Relationship: relationship, FriendshipID: friendshipID,
			CanViewProfile: canViewProfile, CanViewCollection: canViewCollection,
		},
	}
	if relationship == relationshipSelf {
		response.Preferences = &profile
	}
	if profile.ShowLocation || relationship == relationshipSelf {
		response.Location = user.Location
	}
	if relationship == relationshipSelf ||
		(profile.TrainerCodeVisibility == "friends" && relationship == relationshipFriend) ||
		profile.TrainerCodeVisibility == "public" {
		response.TrainerCode = user.TrainerCode
	}
	return c.JSON(response)
}

func GetProfileHandler(c fiber.Ctx) error {
	user, err := findUserByUsername(c.Params("username"))
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Trainer not found"})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Could not load profile"})
	}

	relationship, friendship, err := relationshipForUsers(viewerID(c), user.UserID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Could not load relationship"})
	}
	return sendProfileResponse(c, user, relationship, friendship)
}

func GetOwnProfileHandler(c fiber.Ctx) error {
	user, err := findUserByID(viewerID(c))
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"message": "Your trainer account has not finished syncing. Please sign out and back in.",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Could not load your profile"})
	}
	return sendProfileResponse(c, user, relationshipSelf, nil)
}

func normalizeHighlightIDs(values []string) ([]string, bool) {
	normalized := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		id := strings.TrimSpace(value)
		if id == "" {
			continue
		}
		if _, exists := seen[id]; exists {
			return nil, false
		}
		seen[id] = struct{}{}
		normalized = append(normalized, id)
	}
	return normalized, len(normalized) <= 6
}

func normalizeTrainerTitles(values []string) (TrainerTitleList, bool) {
	if len(values) > maxTrainerTitles {
		return nil, false
	}
	normalized := make(TrainerTitleList, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		title := strings.TrimSpace(value)
		if _, allowed := allowedTrainerTitles[title]; !allowed {
			return nil, false
		}
		if _, duplicate := seen[title]; duplicate {
			return nil, false
		}
		seen[title] = struct{}{}
		normalized = append(normalized, title)
	}
	return normalized, true
}

type UpdateProfileRequest struct {
	PokemonGoName *string  `json:"pokemonGoName"`
	TrainerCode   *string  `json:"trainer_code"`
	Team          *string  `json:"team"`
	TrainerLevel  *uint8   `json:"trainer_level"`
	TotalXP       *uint64  `json:"total_xp"`
	PogoStartedOn *string  `json:"pogo_started_on"`
	Location      *string  `json:"location"`
	Latitude      *float64 `json:"latitude"`
	Longitude     *float64 `json:"longitude"`
	TrainerTitles []string `json:"trainer_titles"`
	HighlightIDs  []string `json:"highlight_instance_ids"`
}

func UpdateProfileHandler(c fiber.Ctx) error {
	userID := viewerID(c)
	var request UpdateProfileRequest
	if err := c.Bind().Body(&request); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid profile"})
	}
	if request.Team != nil && *request.Team != "" && *request.Team != "Mystic" && *request.Team != "Valor" && *request.Team != "Instinct" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid team"})
	}
	if request.TrainerLevel != nil && (*request.TrainerLevel < 1 || *request.TrainerLevel > 80) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid trainer level"})
	}
	highlightIDs, validHighlights := normalizeHighlightIDs(request.HighlightIDs)
	if !validHighlights {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Choose up to six unique highlights"})
	}
	trainerTitles, validTrainerTitles := normalizeTrainerTitles(request.TrainerTitles)
	if request.TrainerTitles != nil && !validTrainerTitles {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Choose up to three valid trainer titles"})
	}
	if request.HighlightIDs != nil && len(highlightIDs) > 0 {
		var ownedCount int64
		if err := db.Model(&PokemonInstance{}).
			Where(
				"user_id = ? AND disabled = ? AND is_caught = ? AND instance_id IN ?",
				userID, false, true, highlightIDs,
			).
			Count(&ownedCount).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Could not verify profile highlights"})
		}
		if ownedCount != int64(len(highlightIDs)) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Profile highlights must be your caught Pokemon"})
		}
	}

	updates := map[string]interface{}{}
	if request.PokemonGoName != nil {
		updates["pokemon_go_name"] = strings.TrimSpace(*request.PokemonGoName)
	}
	if request.TrainerCode != nil {
		code := strings.ReplaceAll(strings.TrimSpace(*request.TrainerCode), " ", "")
		if code != "" && !trainerCodePattern.MatchString(code) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Trainer code must contain 12 digits"})
		}
		updates["trainer_code"] = code
	}
	if request.Team != nil {
		updates["team"] = request.Team
	}
	if request.TrainerLevel != nil {
		updates["trainer_level"] = request.TrainerLevel
	}
	if request.TotalXP != nil {
		updates["total_xp"] = request.TotalXP
	}
	if request.PogoStartedOn != nil && *request.PogoStartedOn != "" {
		value, parseErr := time.Parse("2006-01-02", *request.PogoStartedOn)
		if parseErr != nil {
			value, parseErr = time.Parse(time.RFC3339, *request.PogoStartedOn)
		}
		if parseErr != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid start date"})
		}
		updates["pogo_started_on"] = value
	}
	if request.Location != nil {
		updates["location"] = strings.TrimSpace(*request.Location)
	}
	if request.Latitude != nil {
		updates["latitude"] = request.Latitude
	}
	if request.Longitude != nil {
		updates["longitude"] = request.Longitude
	}
	for index := 1; index <= 6; index++ {
		column := fmt.Sprintf("highlight%d_instance_id", index)
		if index <= len(highlightIDs) {
			updates[column] = highlightIDs[index-1]
		} else if request.HighlightIDs != nil {
			updates[column] = nil
		}
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		if len(updates) > 0 {
			if err := tx.Model(&User{}).Where("user_id = ?", userID).Updates(updates).Error; err != nil {
				return err
			}
		}
		if request.TrainerTitles != nil {
			profile := defaultUserProfile(userID)
			profile.TrainerTitles = trainerTitles
			if err := tx.Where("user_id = ?", userID).
				Assign(map[string]interface{}{"trainer_titles": trainerTitles}).
				FirstOrCreate(&profile).Error; err != nil {
				return err
			}
		}
		var user User
		if err := tx.Select("user_id", "username").Where("user_id = ?", userID).First(&user).Error; err != nil {
			return err
		}
		recipients, err := profileEventRecipients(tx, userID)
		if err != nil {
			return err
		}
		return enqueueSocialInvalidation(
			tx, c, "profile", userID, "profile.updated", recipients,
			[]ClientInvalidation{
				{Type: "profile", Username: user.Username},
				{Type: "preferences"},
			},
		)
	}); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Could not save profile"})
	}
	return c.JSON(fiber.Map{"success": true})
}

func GetPreferencesHandler(c fiber.Ctx) error {
	profile, err := loadUserProfile(viewerID(c))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Could not load settings"})
	}
	return c.JSON(profile)
}

type UpdatePreferencesRequest struct {
	ProfileVisibility       string  `json:"profile_visibility"`
	CollectionVisibility    string  `json:"collection_visibility"`
	FriendRequestPermission string  `json:"friend_request_permission"`
	TrainerCodeVisibility   string  `json:"trainer_code_visibility"`
	CoordinationMethod      string  `json:"coordination_method"`
	CoordinationHandle      *string `json:"coordination_handle"`
	ShareTradeContact       bool    `json:"share_trade_contact"`
	ShowLocation            bool    `json:"show_location"`
	ShowPokemonGoName       bool    `json:"show_pokemon_go_name"`
}

func oneOf(value string, allowed ...string) bool {
	for _, candidate := range allowed {
		if value == candidate {
			return true
		}
	}
	return false
}

func UpdatePreferencesHandler(c fiber.Ctx) error {
	var request UpdatePreferencesRequest
	if err := c.Bind().Body(&request); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid settings"})
	}
	if !oneOf(request.ProfileVisibility, "public", "friends", "private") ||
		!oneOf(request.CollectionVisibility, "public", "friends", "private") ||
		!oneOf(request.FriendRequestPermission, "everyone", "nobody") ||
		!oneOf(request.TrainerCodeVisibility, "public", "friends", "private") ||
		!oneOf(request.CoordinationMethod, "campfire", "discord", "other", "none") {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid privacy setting"})
	}
	var coordinationHandle *string
	if request.CoordinationHandle != nil {
		handle := strings.TrimSpace(*request.CoordinationHandle)
		handle = strings.TrimPrefix(handle, "@")
		if len(handle) > 80 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Coordination handle must be 80 characters or fewer"})
		}
		if handle != "" {
			coordinationHandle = &handle
		}
	}
	if request.CoordinationMethod == "none" {
		coordinationHandle = nil
		request.ShareTradeContact = false
	}
	if coordinationHandle != nil && (strings.Contains(*coordinationHandle, "://") || strings.Contains(*coordinationHandle, "@")) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Use a platform username, not an email address or link"})
	}
	if request.ShareTradeContact &&
		(request.CoordinationMethod == "discord" || request.CoordinationMethod == "other") &&
		coordinationHandle == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Add a coordination handle or choose Campfire"})
	}
	profile := defaultUserProfile(viewerID(c))
	profile.ProfileVisibility = request.ProfileVisibility
	profile.CollectionVisibility = request.CollectionVisibility
	profile.FriendRequestPermission = request.FriendRequestPermission
	profile.TrainerCodeVisibility = request.TrainerCodeVisibility
	profile.CoordinationMethod = request.CoordinationMethod
	profile.CoordinationHandle = coordinationHandle
	profile.ShareTradeContact = request.ShareTradeContact
	profile.ShowLocation = request.ShowLocation
	profile.ShowPokemonGoName = request.ShowPokemonGoName
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ?", profile.UserID).
			Assign(profile).
			FirstOrCreate(&profile).Error; err != nil {
			return err
		}
		var user User
		if err := tx.Select("user_id", "username").Where("user_id = ?", profile.UserID).
			First(&user).Error; err != nil {
			return err
		}
		recipients, err := profileEventRecipients(tx, profile.UserID)
		if err != nil {
			return err
		}
		return enqueueSocialInvalidation(
			tx, c, "profile", profile.UserID, "profile.preferences_updated", recipients,
			[]ClientInvalidation{
				{Type: "profile", Username: user.Username},
				{Type: "preferences"},
				{Type: "friends"},
			},
		)
	}); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Could not save settings"})
	}
	return c.JSON(profile)
}
