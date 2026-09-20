package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type systemTagDef struct {
	Parent string
	Name   string
	Color  string
	Sort   int
}

var defaultSystemTagDefs = []systemTagDef{
	{Parent: "caught", Name: "Favorite", Color: "#facc15", Sort: 10},
	{Parent: "trade", Name: "For Trade", Color: "#22c55e", Sort: 20},
	{Parent: "wanted", Name: "Wanted", Color: "#3b82f6", Sort: 30},
	{Parent: "wanted", Name: "Most Wanted", Color: "#ef4444", Sort: 40},
}

func normalizeOptionalString(v *string) string {
	if v == nil {
		return ""
	}
	return strings.TrimSpace(*v)
}

func lookupInstanceVariantID(db *gorm.DB, instanceID string) (string, error) {
	instanceID = strings.TrimSpace(instanceID)
	if instanceID == "" {
		return "", nil
	}

	var row struct {
		VariantID *string `gorm:"column:variant_id"`
	}
	err := db.
		Table((PokemonInstance{}).TableName()).
		Select("variant_id").
		Where("instance_id = ?", instanceID).
		Take(&row).
		Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", nil
		}
		return "", err
	}
	return normalizeOptionalString(row.VariantID), nil
}

func syncRegistrationForVariant(db *gorm.DB, userID, variantID string) error {
	userID = strings.TrimSpace(userID)
	variantID = strings.TrimSpace(variantID)
	if userID == "" || variantID == "" {
		return nil
	}

	var count int64
	if err := db.
		Model(&PokemonInstance{}).
		Where("user_id = ? AND variant_id = ? AND (is_caught = ? OR registered = ?)", userID, variantID, true, true).
		Count(&count).
		Error; err != nil {
		return err
	}

	if count > 0 {
		reg := Registration{UserID: userID, VariantID: variantID}
		return db.
			Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "user_id"}, {Name: "variant_id"}},
				DoNothing: true,
			}).
			Create(&reg).
			Error
	}

	// Keep historical registration rows. Registrations act like a Pokedex-style
	// "ever registered" ledger and should not be deleted automatically.
	return nil
}

func extractTagIDsFromJSON(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "null" {
		return nil
	}

	var arr []interface{}
	if err := json.Unmarshal([]byte(raw), &arr); err != nil {
		return nil
	}

	set := make(map[string]struct{}, len(arr))
	for _, item := range arr {
		switch v := item.(type) {
		case string:
			id := strings.TrimSpace(v)
			if id != "" {
				set[id] = struct{}{}
			}
		case map[string]interface{}:
			if id, ok := extractTagIDFromObject(v); ok {
				set[id] = struct{}{}
			}
		default:
			// Ignore unknown shapes.
		}
	}

	out := make([]string, 0, len(set))
	for id := range set {
		out = append(out, id)
	}
	return out
}

func extractTagIDFromObject(obj map[string]interface{}) (string, bool) {
	for _, key := range []string{"tag_id", "id", "value"} {
		if raw, ok := obj[key]; ok {
			id := strings.TrimSpace(fmt.Sprintf("%v", raw))
			if id != "" && id != "<nil>" {
				return id, true
			}
		}
	}
	return "", false
}

func mergeUniqueTagIDs(tagSets ...[]string) []string {
	set := make(map[string]struct{})
	for _, tags := range tagSets {
		for _, tagID := range tags {
			id := strings.TrimSpace(tagID)
			if id == "" {
				continue
			}
			set[id] = struct{}{}
		}
	}

	out := make([]string, 0, len(set))
	for id := range set {
		out = append(out, id)
	}
	return out
}

func builtInTagNamesForParent(parent string) []string {
	switch parent {
	case "caught":
		return []string{"favorite"}
	case "trade":
		return []string{"for trade"}
	case "wanted":
		return []string{"wanted", "most wanted"}
	default:
		return nil
	}
}

func filterValidUserTagIDsForParent(db *gorm.DB, userID, parent string, tagIDs []string) ([]string, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" || len(tagIDs) == 0 {
		return nil, nil
	}

	var valid []string
	query := db.
		Table("tags").
		Where("user_id = ? AND parent = ? AND deleted_at IS NULL AND tag_id IN ?", userID, parent, tagIDs)
	if builtIns := builtInTagNamesForParent(parent); len(builtIns) > 0 {
		query = query.Where("LOWER(name) NOT IN ?", builtIns)
	}
	if err := query.
		Pluck("tag_id", &valid).
		Error; err != nil {
		return nil, err
	}
	return valid, nil
}

func cleanupInstanceTags(db *gorm.DB, instanceID string) error {
	instanceID = strings.TrimSpace(instanceID)
	if instanceID == "" {
		return nil
	}
	return db.Where("instance_id = ?", instanceID).Delete(&InstanceTag{}).Error
}

func ensureDefaultSystemTagsForUser(db *gorm.DB, userID string) error {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil
	}

	for _, def := range defaultSystemTagDefs {
		if err := db.Exec(`
INSERT INTO tags (tag_id, user_id, parent, name, color, sort, created_at)
SELECT UUID(), ?, ?, ?, ?, ?, NOW(6)
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1
  FROM tags
  WHERE user_id = ?
    AND parent = ?
    AND name = ?
    AND deleted_at IS NULL
)`,
			userID,
			def.Parent,
			def.Name,
			def.Color,
			def.Sort,
			userID,
			def.Parent,
			def.Name,
		).Error; err != nil {
			return err
		}
	}

	return nil
}

func resolveSystemTagIDs(
	db *gorm.DB,
	userID string,
	favorite bool,
	isForTrade bool,
	isWanted bool,
	mostWanted bool,
) ([]string, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, nil
	}

	if !favorite && !isForTrade && !isWanted && !mostWanted {
		return nil, nil
	}

	if err := ensureDefaultSystemTagsForUser(db, userID); err != nil {
		return nil, err
	}

	var rows []struct {
		TagID  string `gorm:"column:tag_id"`
		Parent string `gorm:"column:parent"`
		Name   string `gorm:"column:name"`
	}
	if err := db.
		Table("tags").
		Select("tag_id, parent, name").
		Where("user_id = ? AND deleted_at IS NULL", userID).
		Where(`(parent = 'caught' AND name = 'Favorite')
			OR (parent = 'trade' AND name = 'For Trade')
			OR (parent = 'wanted' AND name = 'Wanted')
			OR (parent = 'wanted' AND name = 'Most Wanted')`).
		Find(&rows).
		Error; err != nil {
		return nil, err
	}

	set := make(map[string]struct{}, 4)
	for _, row := range rows {
		switch {
		case favorite && row.Parent == "caught" && row.Name == "Favorite":
			set[row.TagID] = struct{}{}
		case isForTrade && row.Parent == "trade" && row.Name == "For Trade":
			set[row.TagID] = struct{}{}
		case isWanted && row.Parent == "wanted" && row.Name == "Wanted":
			set[row.TagID] = struct{}{}
		case mostWanted && row.Parent == "wanted" && row.Name == "Most Wanted":
			set[row.TagID] = struct{}{}
		}
	}

	out := make([]string, 0, len(set))
	for tagID := range set {
		out = append(out, tagID)
	}
	return out, nil
}

func syncInstanceTagsForInstance(
	db *gorm.DB,
	userID string,
	instanceID string,
	caughtTagsJSON string,
	tradeTagsJSON string,
	wantedTagsJSON string,
	isCaught bool,
	favorite bool,
	isForTrade bool,
	isWanted bool,
	mostWanted bool,
) error {
	instanceID = strings.TrimSpace(instanceID)
	userID = strings.TrimSpace(userID)
	if instanceID == "" {
		return nil
	}

	systemTagIDs, err := resolveSystemTagIDs(
		db,
		userID,
		favorite && isCaught,
		isForTrade && isCaught,
		isWanted,
		mostWanted && isWanted,
	)
	if err != nil {
		return err
	}

	validTagIDs := append([]string{}, systemTagIDs...)
	parentInputs := []struct {
		parent  string
		enabled bool
		raw     string
	}{
		{parent: "caught", enabled: isCaught, raw: caughtTagsJSON},
		{parent: "trade", enabled: isForTrade, raw: tradeTagsJSON},
		{parent: "wanted", enabled: isWanted, raw: wantedTagsJSON},
	}
	for _, input := range parentInputs {
		if !input.enabled {
			continue
		}
		validForParent, filterErr := filterValidUserTagIDsForParent(
			db,
			userID,
			input.parent,
			extractTagIDsFromJSON(input.raw),
		)
		if filterErr != nil {
			return filterErr
		}
		validTagIDs = mergeUniqueTagIDs(validTagIDs, validForParent)
	}
	if len(validTagIDs) == 0 {
		return cleanupInstanceTags(db, instanceID)
	}

	if err := db.
		Where("instance_id = ? AND tag_id NOT IN ?", instanceID, validTagIDs).
		Delete(&InstanceTag{}).
		Error; err != nil {
		return err
	}

	rows := make([]InstanceTag, 0, len(validTagIDs))
	for _, tagID := range validTagIDs {
		rows = append(rows, InstanceTag{
			TagID:      tagID,
			InstanceID: instanceID,
			UserID:     userID,
		})
	}

	if err := db.
		Clauses(clause.OnConflict{
			Columns: []clause.Column{
				{Name: "tag_id"},
				{Name: "instance_id"},
			},
			DoUpdates: clause.Assignments(map[string]interface{}{
				"user_id": userID,
			}),
		}).
		Create(&rows).
		Error; err != nil {
		return err
	}

	return nil
}
