package main

import (
	"errors"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var tradeFriendshipLevels = map[int]string{
	1: "Good",
	2: "Great",
	3: "Ultra",
	4: "Best",
	5: "Forever",
}

type CreateTradeRequest struct {
	UsernameAccepting              string `json:"username_accepting"`
	PokemonInstanceIDUserProposed  string `json:"pokemon_instance_id_user_proposed"`
	PokemonInstanceIDUserAccepting string `json:"pokemon_instance_id_user_accepting"`
	IsSpecialTrade                 bool   `json:"is_special_trade"`
	IsRegisteredTrade              bool   `json:"is_registered_trade"`
	IsLuckyTrade                   bool   `json:"is_lucky_trade"`
	TradeDustCost                  int    `json:"trade_dust_cost"`
	TradeFriendshipLevel           int    `json:"trade_friendship_level"`
}

type TradeSatisfactionRequest struct {
	Satisfied bool `json:"satisfied"`
}

type TradeEnvelope struct {
	Trade             Trade                      `json:"trade"`
	AffectedInstances map[string]PokemonInstance `json:"affected_instances"`
}

type TradesEnvelope struct {
	Trades           []Trade                    `json:"trades"`
	RelatedInstances map[string]PokemonInstance `json:"related_instances"`
	NextCursor       string                     `json:"next_cursor,omitempty"`
}

type tradeCursor struct {
	LastUpdate int64  `json:"last_update"`
	TradeID    string `json:"trade_id"`
}

func tradeParticipant(trade Trade, userID string) bool {
	return trade.UserIDProposed == userID || trade.UserIDAccepting == userID
}

func tradeOtherUserID(trade Trade, userID string) string {
	if trade.UserIDProposed == userID {
		return trade.UserIDAccepting
	}
	return trade.UserIDProposed
}

func tradeEnvelope(trade Trade, instances ...PokemonInstance) TradeEnvelope {
	affected := make(map[string]PokemonInstance, len(instances))
	for _, instance := range instances {
		affected[instance.InstanceID] = instance
	}
	return TradeEnvelope{Trade: trade, AffectedInstances: affected}
}

func loadLockedTrade(tx *gorm.DB, tradeID string) (Trade, error) {
	var trade Trade
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("trade_id = ?", tradeID).First(&trade).Error
	return trade, err
}

func loadLockedInstance(tx *gorm.DB, instanceID string) (PokemonInstance, error) {
	var instance PokemonInstance
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("instance_id = ?", instanceID).First(&instance).Error
	return instance, err
}

func loadLockedTradeInstances(
	tx *gorm.DB,
	proposedID string,
	acceptingID string,
) (PokemonInstance, PokemonInstance, error) {
	firstID, secondID := proposedID, acceptingID
	reversed := false
	if secondID < firstID {
		firstID, secondID = secondID, firstID
		reversed = true
	}
	first, err := loadLockedInstance(tx, firstID)
	if err != nil {
		return PokemonInstance{}, PokemonInstance{}, err
	}
	second, err := loadLockedInstance(tx, secondID)
	if err != nil {
		return PokemonInstance{}, PokemonInstance{}, err
	}
	if reversed {
		return second, first, nil
	}
	return first, second, nil
}

func loadTradeForParticipant(c fiber.Ctx, tx *gorm.DB) (Trade, error) {
	trade, err := loadLockedTrade(tx, c.Params("trade_id"))
	if err != nil {
		return trade, err
	}
	if !tradeParticipant(trade, viewerID(c)) {
		return trade, errTradeForbidden
	}
	return trade, nil
}

var (
	errTradeForbidden     = errors.New("trade is not available to this user")
	errTradeConflict      = errors.New("trade state has changed")
	errPokemonNotForTrade = errors.New("one or more Pokémon are no longer marked For Trade")
	errPokemonTradeLocked = errors.New("lucky Pokémon cannot be traded again")
)

func validateTradeInstancePair(
	proposed PokemonInstance,
	accepting PokemonInstance,
	proposedUserID string,
	acceptingUserID string,
) error {
	if proposed.UserID != proposedUserID || accepting.UserID != acceptingUserID ||
		!proposed.IsCaught || !accepting.IsCaught || proposed.Disabled || accepting.Disabled {
		return errTradeForbidden
	}
	if !proposed.IsForTrade || !accepting.IsForTrade {
		return errPokemonNotForTrade
	}
	if proposed.Lucky || accepting.Lucky {
		return errPokemonTradeLocked
	}
	return nil
}

func tradeError(c fiber.Ctx, err error, fallback string) error {
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Trade not found"})
	case errors.Is(err, errTradeForbidden):
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"message": err.Error()})
	case errors.Is(err, errTradeConflict):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"message": err.Error()})
	case errors.Is(err, errPokemonNotForTrade):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"code":    "pokemon_not_for_trade",
			"message": err.Error(),
		})
	case errors.Is(err, errPokemonTradeLocked):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"code":    "pokemon_trade_locked",
			"message": err.Error(),
		})
	default:
		logrus.Errorf("%s: %v", fallback, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": fallback})
	}
}

func GetTradesHandler(c fiber.Ctx) error {
	userID := viewerID(c)
	limit, paginated, err := requestedPageSize(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": err.Error()})
	}
	var trades []Trade
	query := db.Where(
		"trade_status <> ? AND (user_id_proposed = ? OR user_id_accepting = ?)",
		"deleted", userID, userID,
	).Order("COALESCE(last_update, 0) DESC, trade_id DESC")
	if rawCursor := c.Query("cursor"); rawCursor != "" {
		if !paginated {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "cursor requires limit"})
		}
		var cursor tradeCursor
		if decodeCursor(rawCursor, &cursor) != nil || cursor.TradeID == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid cursor"})
		}
		query = query.Where(
			"(COALESCE(last_update, 0) < ?) OR (COALESCE(last_update, 0) = ? AND trade_id < ?)",
			cursor.LastUpdate, cursor.LastUpdate, cursor.TradeID,
		)
	}
	if paginated {
		query = query.Limit(limit + 1)
	}
	if err := query.Find(&trades).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Could not load trades"})
	}
	nextCursor := ""
	if paginated && len(trades) > limit {
		trades = trades[:limit]
		last := trades[len(trades)-1]
		var lastUpdate int64
		if last.LastUpdate != nil {
			lastUpdate = *last.LastUpdate
		}
		nextCursor = encodeCursor(tradeCursor{LastUpdate: lastUpdate, TradeID: last.TradeID})
	}

	instanceIDs := make([]string, 0, len(trades)*2)
	for _, trade := range trades {
		instanceIDs = append(instanceIDs,
			trade.PokemonInstanceIDUserProposed,
			trade.PokemonInstanceIDUserAccepting,
		)
	}
	instances := []PokemonInstance{}
	if len(instanceIDs) > 0 {
		if err := db.Where("instance_id IN ?", instanceIDs).Find(&instances).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Could not load trade Pokémon"})
		}
	}
	related := make(map[string]PokemonInstance, len(instances))
	for _, instance := range instances {
		related[instance.InstanceID] = instance
	}
	return c.JSON(TradesEnvelope{
		Trades: trades, RelatedInstances: related, NextCursor: nextCursor,
	})
}

func CreateTradeHandler(c fiber.Ctx) error {
	var request CreateTradeRequest
	if err := c.Bind().Body(&request); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid trade proposal"})
	}
	request.UsernameAccepting = strings.TrimSpace(request.UsernameAccepting)
	request.PokemonInstanceIDUserProposed = strings.TrimSpace(request.PokemonInstanceIDUserProposed)
	request.PokemonInstanceIDUserAccepting = strings.TrimSpace(request.PokemonInstanceIDUserAccepting)
	friendshipLevel, validLevel := tradeFriendshipLevels[request.TradeFriendshipLevel]
	if request.UsernameAccepting == "" ||
		request.PokemonInstanceIDUserProposed == "" ||
		request.PokemonInstanceIDUserAccepting == "" ||
		!validLevel || request.TradeDustCost < 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid trade proposal"})
	}

	proposer, err := findUserByID(viewerID(c))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Current user not found"})
	}
	accepter, err := findUserByUsername(request.UsernameAccepting)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Trade partner not found"})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Could not load trade partner"})
	}
	if proposer.UserID == accepter.UserID {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "You cannot trade with yourself"})
	}
	canViewCollection, relationship, err := collectionAccessForUser(proposer.UserID, accepter.UserID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Could not validate trade partner privacy"})
	}
	if relationship == relationshipBlocked || !canViewCollection {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"message": "Trade unavailable"})
	}

	var created Trade
	var instances []PokemonInstance
	err = db.Transaction(func(tx *gorm.DB) error {
		proposed, accepting, lockErr := loadLockedTradeInstances(
			tx,
			request.PokemonInstanceIDUserProposed,
			request.PokemonInstanceIDUserAccepting,
		)
		if lockErr != nil {
			return lockErr
		}
		if validationErr := validateTradeInstancePair(
			proposed, accepting, proposer.UserID, accepter.UserID,
		); validationErr != nil {
			return validationErr
		}
		var active int64
		if countErr := tx.Model(&Trade{}).
			Where("trade_status IN ? AND (pokemon_instance_id_user_proposed IN ? OR pokemon_instance_id_user_accepting IN ?)",
				[]string{"proposed", "pending"},
				[]string{proposed.InstanceID, accepting.InstanceID},
				[]string{proposed.InstanceID, accepting.InstanceID}).
			Count(&active).Error; countErr != nil {
			return countErr
		}
		if active > 0 {
			return errTradeConflict
		}
		now := time.Now().UTC()
		lastUpdate := now.UnixMilli()
		dustCost := request.TradeDustCost
		created = Trade{
			TradeID:        uuid.NewString(),
			UserIDProposed: proposer.UserID, UsernameProposed: proposer.Username,
			UserIDAccepting: accepter.UserID, UsernameAccepting: accepter.Username,
			PokemonInstanceIDUserProposed:  proposed.InstanceID,
			PokemonInstanceIDUserAccepting: accepting.InstanceID,
			TradeStatus:                    "proposed", TradeProposalDate: &now,
			IsSpecialTrade:       request.IsSpecialTrade,
			IsRegisteredTrade:    request.IsRegisteredTrade,
			IsLuckyTrade:         request.IsLuckyTrade,
			TradeDustCost:        &dustCost,
			TradeFriendshipLevel: friendshipLevel,
			LastUpdate:           &lastUpdate,
		}
		if createErr := tx.Create(&created).Error; createErr != nil {
			return createErr
		}
		instances = []PokemonInstance{proposed, accepting}
		return enqueueTradeEvent(tx, c, created, instances...)
	})
	if err != nil {
		return tradeError(c, err, "Could not create trade")
	}
	return c.Status(fiber.StatusCreated).JSON(tradeEnvelope(created, instances...))
}

func AcceptTradeHandler(c fiber.Ctx) error {
	var updated Trade
	err := db.Transaction(func(tx *gorm.DB) error {
		trade, err := loadTradeForParticipant(c, tx)
		if err != nil {
			return err
		}
		if trade.UserIDAccepting != viewerID(c) {
			return errTradeForbidden
		}
		if trade.TradeStatus != "proposed" {
			return errTradeConflict
		}
		proposed, accepting, err := loadLockedTradeInstances(
			tx,
			trade.PokemonInstanceIDUserProposed,
			trade.PokemonInstanceIDUserAccepting,
		)
		if err != nil {
			return err
		}
		if validateTradeInstancePair(
			proposed, accepting, trade.UserIDProposed, trade.UserIDAccepting,
		) != nil {
			return errTradeConflict
		}
		var conflicts int64
		if err = tx.Model(&Trade{}).Where(
			"trade_id <> ? AND trade_status = ? AND (pokemon_instance_id_user_proposed IN ? OR pokemon_instance_id_user_accepting IN ?)",
			trade.TradeID, "pending",
			[]string{trade.PokemonInstanceIDUserProposed, trade.PokemonInstanceIDUserAccepting},
			[]string{trade.PokemonInstanceIDUserProposed, trade.PokemonInstanceIDUserAccepting},
		).Count(&conflicts).Error; err != nil {
			return err
		}
		if conflicts > 0 {
			return errTradeConflict
		}
		now := time.Now().UTC()
		lastUpdate := now.UnixMilli()
		trade.TradeStatus = "pending"
		trade.TradeAcceptedDate = &now
		trade.LastUpdate = &lastUpdate
		if err = tx.Save(&trade).Error; err != nil {
			return err
		}
		var retired []Trade
		if err = tx.Where(
			"trade_id <> ? AND trade_status = ? AND (pokemon_instance_id_user_proposed IN ? OR pokemon_instance_id_user_accepting IN ?)",
			trade.TradeID, "proposed",
			[]string{trade.PokemonInstanceIDUserProposed, trade.PokemonInstanceIDUserAccepting},
			[]string{trade.PokemonInstanceIDUserProposed, trade.PokemonInstanceIDUserAccepting},
		).Find(&retired).Error; err != nil {
			return err
		}
		if err = tx.Model(&Trade{}).
			Where(
				"trade_id <> ? AND trade_status = ? AND (pokemon_instance_id_user_proposed IN ? OR pokemon_instance_id_user_accepting IN ?)",
				trade.TradeID, "proposed",
				[]string{trade.PokemonInstanceIDUserProposed, trade.PokemonInstanceIDUserAccepting},
				[]string{trade.PokemonInstanceIDUserProposed, trade.PokemonInstanceIDUserAccepting},
			).
			Updates(map[string]interface{}{"trade_status": "deleted", "last_update": lastUpdate}).Error; err != nil {
			return err
		}
		for _, retiredTrade := range retired {
			retiredTrade.TradeStatus = "deleted"
			retiredTrade.LastUpdate = &lastUpdate
			if err = enqueueTradeEvent(tx, c, retiredTrade); err != nil {
				return err
			}
		}
		updated = trade
		return enqueueTradeEvent(tx, c, updated, proposed, accepting)
	})
	if err != nil {
		return tradeError(c, err, "Could not accept trade")
	}
	return c.JSON(tradeEnvelope(updated))
}

func DenyTradeHandler(c fiber.Ctx) error {
	return transitionTrade(c, "proposed", "denied", true)
}

func CancelTradeHandler(c fiber.Ctx) error {
	var updated Trade
	err := db.Transaction(func(tx *gorm.DB) error {
		trade, err := loadTradeForParticipant(c, tx)
		if err != nil {
			return err
		}
		// A proposal may only be withdrawn by the trainer who created it.
		// Once accepted, either participant may cancel the active trade.
		if trade.TradeStatus == "proposed" && trade.UserIDProposed != viewerID(c) {
			return errTradeForbidden
		}
		if trade.TradeStatus != "proposed" && trade.TradeStatus != "pending" {
			return errTradeConflict
		}
		now := time.Now().UTC()
		lastUpdate := now.UnixMilli()
		cancelledBy := trade.UsernameProposed
		if viewerID(c) == trade.UserIDAccepting {
			cancelledBy = trade.UsernameAccepting
		}
		trade.TradeStatus = "cancelled"
		trade.TradeCancelledDate = &now
		trade.TradeCancelledBy = &cancelledBy
		trade.LastUpdate = &lastUpdate
		if err = tx.Save(&trade).Error; err != nil {
			return err
		}
		updated = trade
		return enqueueTradeEvent(tx, c, updated)
	})
	if err != nil {
		return tradeError(c, err, "Could not cancel trade")
	}
	return c.JSON(tradeEnvelope(updated))
}

func transitionTrade(c fiber.Ctx, from, to string, accepterOnly bool) error {
	var updated Trade
	err := db.Transaction(func(tx *gorm.DB) error {
		trade, err := loadTradeForParticipant(c, tx)
		if err != nil {
			return err
		}
		if accepterOnly && trade.UserIDAccepting != viewerID(c) {
			return errTradeForbidden
		}
		if trade.TradeStatus != from {
			return errTradeConflict
		}
		now := time.Now().UTC()
		lastUpdate := now.UnixMilli()
		trade.TradeStatus = to
		trade.LastUpdate = &lastUpdate
		if to == "cancelled" {
			trade.TradeCancelledDate = &now
			cancelledBy := trade.UsernameProposed
			if viewerID(c) == trade.UserIDAccepting {
				cancelledBy = trade.UsernameAccepting
			}
			trade.TradeCancelledBy = &cancelledBy
		}
		if err = tx.Save(&trade).Error; err != nil {
			return err
		}
		updated = trade
		return enqueueTradeEvent(tx, c, updated)
	})
	if err != nil {
		return tradeError(c, err, "Could not update trade")
	}
	return c.JSON(tradeEnvelope(updated))
}

func CompleteTradeHandler(c fiber.Ctx) error {
	var updated Trade
	var instances []PokemonInstance
	err := db.Transaction(func(tx *gorm.DB) error {
		trade, err := loadTradeForParticipant(c, tx)
		if err != nil {
			return err
		}
		if trade.TradeStatus != "pending" {
			return errTradeConflict
		}
		proposed, accepting, err := loadLockedTradeInstances(
			tx,
			trade.PokemonInstanceIDUserProposed,
			trade.PokemonInstanceIDUserAccepting,
		)
		if err != nil {
			return err
		}
		if validateTradeInstancePair(
			proposed, accepting, trade.UserIDProposed, trade.UserIDAccepting,
		) != nil {
			return errTradeConflict
		}
		if viewerID(c) == trade.UserIDProposed {
			if trade.UserProposedCompletionConfirmed {
				return errTradeConflict
			}
			trade.UserProposedCompletionConfirmed = true
		} else {
			if trade.UserAcceptingCompletionConfirmed {
				return errTradeConflict
			}
			trade.UserAcceptingCompletionConfirmed = true
		}
		now := time.Now().UTC()
		lastUpdate := now.UnixMilli()
		trade.LastUpdate = &lastUpdate
		if trade.UserProposedCompletionConfirmed && trade.UserAcceptingCompletionConfirmed {
			trade.TradeStatus = "completed"
			trade.TradeCompletedDate = &now
			proposed.UserID = trade.UserIDAccepting
			accepting.UserID = trade.UserIDProposed
			proposed.IsCaught, proposed.IsForTrade, proposed.IsWanted = true, false, false
			accepting.IsCaught, accepting.IsForTrade, accepting.IsWanted = true, false, false
			proposed.LastUpdate, accepting.LastUpdate = lastUpdate, lastUpdate
			if err = tx.Save(&proposed).Error; err != nil {
				return err
			}
			if err = tx.Save(&accepting).Error; err != nil {
				return err
			}
			instances = []PokemonInstance{proposed, accepting}
		}
		if err = tx.Save(&trade).Error; err != nil {
			return err
		}
		updated = trade
		return enqueueTradeEventWithAffected(tx, c, updated, instances, instances)
	})
	if err != nil {
		return tradeError(c, err, "Could not confirm trade completion")
	}
	return c.JSON(tradeEnvelope(updated, instances...))
}

func ReproposeTradeHandler(c fiber.Ctx) error {
	var updated Trade
	err := db.Transaction(func(tx *gorm.DB) error {
		trade, err := loadTradeForParticipant(c, tx)
		if err != nil {
			return err
		}
		if trade.TradeStatus != "cancelled" && trade.TradeStatus != "denied" {
			return errTradeConflict
		}
		proposed, accepting, err := loadLockedTradeInstances(
			tx,
			trade.PokemonInstanceIDUserProposed,
			trade.PokemonInstanceIDUserAccepting,
		)
		if err != nil {
			return err
		}
		if proposed.UserID != trade.UserIDProposed || accepting.UserID != trade.UserIDAccepting ||
			!proposed.IsCaught || !accepting.IsCaught || proposed.Disabled || accepting.Disabled {
			return errTradeConflict
		}
		var conflicts int64
		if err = tx.Model(&Trade{}).
			Where(
				"trade_id <> ? AND trade_status IN ? AND (pokemon_instance_id_user_proposed IN ? OR pokemon_instance_id_user_accepting IN ?)",
				trade.TradeID, []string{"proposed", "pending"},
				[]string{trade.PokemonInstanceIDUserProposed, trade.PokemonInstanceIDUserAccepting},
				[]string{trade.PokemonInstanceIDUserProposed, trade.PokemonInstanceIDUserAccepting},
			).Count(&conflicts).Error; err != nil {
			return err
		}
		if conflicts > 0 {
			return errTradeConflict
		}
		if trade.UserIDAccepting == viewerID(c) {
			trade.UserIDProposed, trade.UserIDAccepting = trade.UserIDAccepting, trade.UserIDProposed
			trade.UsernameProposed, trade.UsernameAccepting = trade.UsernameAccepting, trade.UsernameProposed
			trade.PokemonInstanceIDUserProposed, trade.PokemonInstanceIDUserAccepting =
				trade.PokemonInstanceIDUserAccepting, trade.PokemonInstanceIDUserProposed
		}
		now := time.Now().UTC()
		lastUpdate := now.UnixMilli()
		trade.TradeStatus = "proposed"
		trade.TradeProposalDate = &now
		trade.TradeAcceptedDate = nil
		trade.TradeCancelledDate = nil
		trade.TradeCancelledBy = nil
		trade.TradeCompletedDate = nil
		trade.UserProposedCompletionConfirmed = false
		trade.UserAcceptingCompletionConfirmed = false
		trade.LastUpdate = &lastUpdate
		if err = tx.Save(&trade).Error; err != nil {
			return err
		}
		updated = trade
		return enqueueTradeEvent(tx, c, updated, proposed, accepting)
	})
	if err != nil {
		return tradeError(c, err, "Could not repropose trade")
	}
	return c.JSON(tradeEnvelope(updated))
}

func UpdateTradeSatisfactionHandler(c fiber.Ctx) error {
	var request TradeSatisfactionRequest
	if err := c.Bind().Body(&request); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid satisfaction value"})
	}
	var updated Trade
	err := db.Transaction(func(tx *gorm.DB) error {
		trade, err := loadTradeForParticipant(c, tx)
		if err != nil {
			return err
		}
		if trade.TradeStatus != "completed" {
			return errTradeConflict
		}
		value := request.Satisfied
		if viewerID(c) == trade.UserIDProposed {
			trade.User1TradeSatisfaction = &value
		} else {
			trade.User2TradeSatisfaction = &value
		}
		now := time.Now().UnixMilli()
		trade.LastUpdate = &now
		if err = tx.Save(&trade).Error; err != nil {
			return err
		}
		updated = trade
		return enqueueTradeEvent(tx, c, updated)
	})
	if err != nil {
		return tradeError(c, err, "Could not update satisfaction")
	}
	return c.JSON(tradeEnvelope(updated))
}

func DeleteTradeHandler(c fiber.Ctx) error {
	err := db.Transaction(func(tx *gorm.DB) error {
		trade, err := loadTradeForParticipant(c, tx)
		if err != nil {
			return err
		}
		if trade.TradeStatus != "denied" && trade.TradeStatus != "cancelled" && trade.TradeStatus != "completed" {
			return errTradeConflict
		}
		now := time.Now().UnixMilli()
		trade.TradeStatus = "deleted"
		trade.LastUpdate = &now
		if err = enqueueTradeEvent(tx, c, trade); err != nil {
			return err
		}
		return tx.Delete(&trade).Error
	})
	if err != nil {
		return tradeError(c, err, "Could not delete trade")
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func RevealTradePartnerHandler(c fiber.Ctx) error {
	var trade Trade
	userID := viewerID(c)
	if err := db.Where("trade_id = ? AND (user_id_proposed = ? OR user_id_accepting = ?)",
		c.Params("trade_id"), userID, userID).First(&trade).Error; err != nil {
		return tradeError(c, err, "Could not load trade")
	}
	if trade.TradeStatus != "pending" {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"message": "Coordination details are available only after a trade is accepted and while it remains active",
		})
	}
	partnerID := tradeOtherUserID(trade, userID)
	blocked, err := usersAreBlocked(userID, partnerID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Could not validate partner access"})
	}
	if blocked {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"message": "Coordination details are unavailable for a blocked trainer"})
	}
	var partner User
	if err := db.Where("user_id = ?", partnerID).First(&partner).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Trade partner not found"})
	}
	profile, err := loadUserProfile(partnerID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Could not load partner privacy"})
	}
	response := fiber.Map{
		"sharingEnabled":     profile.ShareTradeContact,
		"trainerCode":        nil,
		"pokemonGoName":      nil,
		"coordinationMethod": "none",
		"coordinationHandle": nil,
		"location":           nil,
	}
	if !profile.ShareTradeContact {
		return c.JSON(response)
	}
	response["trainerCode"] = partner.TrainerCode
	response["pokemonGoName"] = partner.PokemonGoName
	response["coordinationMethod"] = profile.CoordinationMethod
	response["coordinationHandle"] = profile.CoordinationHandle
	if profile.ShowLocation {
		response["location"] = partner.Location
	}
	return c.JSON(response)
}
