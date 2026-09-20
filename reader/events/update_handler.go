// update_handler.go

package main

import (
	"strconv"

	"github.com/gofiber/fiber/v3"
	"github.com/sirupsen/logrus"
)

func getUsernameByUserID(userID string) (string, error) {
	var username string
	if err := db.Table("users").Where("user_id = ?", userID).Select("username").Scan(&username).Error; err != nil {
		return "", err
	}
	return username, nil
}

func buildPokemonInstancePayload(instance PokemonInstance) map[string]interface{} {
	payload := map[string]interface{}{
		"pokemon_id":       instance.PokemonID,
		"nickname":         instance.Nickname,
		"cp":               instance.CP,
		"attack_iv":        instance.AttackIV,
		"defense_iv":       instance.DefenseIV,
		"stamina_iv":       instance.StaminaIV,
		"shiny":            instance.Shiny,
		"costume_id":       instance.CostumeID,
		"lucky":            instance.Lucky,
		"shadow":           instance.Shadow,
		"purified":         instance.Purified,
		"fast_move_id":     instance.FastMoveID,
		"charged_move1_id": instance.ChargedMove1ID,
		"charged_move2_id": instance.ChargedMove2ID,
		"weight":           instance.Weight,
		"height":           instance.Height,
		"gender":           instance.Gender,
		"level":            instance.Level,
		"mirror":           instance.Mirror,
		"pref_lucky":       instance.PrefLucky,
		"registered":       instance.Registered,
		"favorite":         instance.Favorite,
		"is_caught":        instance.IsCaught,
		"is_for_trade":     instance.IsForTrade,
		"is_wanted":        instance.IsWanted,
		"most_wanted":      instance.MostWanted,
		"caught_tags":      instance.CaughtTags,
		"trade_tags":       instance.TradeTags,
		"wanted_tags":      instance.WantedTags,
		"not_trade_list":   instance.NotTradeList,
		"not_wanted_list":  instance.NotWantedList,
		"location_caught":  instance.LocationCaught,
		"location_card":    instance.LocationCard,
		"date_added":       instance.DateAdded,
		"date_caught":      instance.DateCaught,
		"friendship_level": instance.FriendshipLevel,
		"last_update":      instance.LastUpdate,
		"wanted_filters":   instance.WantedFilters,
		"trade_filters":    instance.TradeFilters,
		"mega":             instance.Mega,
		"mega_form":        instance.MegaForm,
		"is_mega":          instance.IsMega,
		"is_fused":         instance.IsFused,
		"fusion":           instance.Fusion,
		"fusion_form":      instance.FusionForm,
		"fused_with":       instance.FusedWith,
		"disabled":         instance.Disabled,
		"dynamax":          instance.Dynamax,
		"gigantamax":       instance.Gigantamax,
		"crown":            instance.Crown,
		"max_attack":       instance.MaxAttack,
		"max_guard":        instance.MaxGuard,
		"max_spirit":       instance.MaxSpirit,
	}
	payload["wanted_size_preferences"] = instance.WantedSizes
	return payload
}

func GetUpdates(c fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		logrus.Error("Authentication failed: user_id missing")
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	deviceID := c.Query("device_id")
	if deviceID == "" {
		logrus.Warn("device_id is missing in request")
	}

	timestampStr := c.Query("timestamp")
	if timestampStr == "" {
		logrus.Error("timestamp is missing in request")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Missing timestamp"})
	}

	timestampInt, err := strconv.ParseInt(timestampStr, 10, 64)
	if err != nil {
		logrus.Errorf("Invalid timestamp format: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid timestamp format"})
	}

	logrus.Infof("Fetching updates for username %s since %d", c.Locals("username"), timestampInt)

	var instances []PokemonInstance
	if err := db.Where("user_id = ? AND last_update > ?", userID, timestampInt).Find(&instances).Error; err != nil {
		logrus.Errorf("Error retrieving Pokemon updates: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to retrieve updates"})
	}

	pokemonData := make(map[string]interface{})
	for _, instance := range instances {
		pokemonData[instance.InstanceID] = buildPokemonInstancePayload(instance)
	}

	var tradesList []Trade
	if err := db.Where("((user_id_proposed = ? OR user_id_accepting = ?) AND last_update > ?)", userID, userID, timestampInt).
		Find(&tradesList).Error; err != nil {
		logrus.Errorf("Error retrieving trades: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to retrieve trade updates"})
	}

	tradeMap := make(map[string]interface{})
	for _, trade := range tradesList {
		tradeMap[trade.TradeID] = map[string]interface{}{
			"is_special_trade":                    trade.IsSpecialTrade,
			"is_registered_trade":                 trade.IsRegisteredTrade,
			"is_lucky_trade":                      trade.IsLuckyTrade,
			"pokemon_instance_id_user_proposed":   trade.PokemonInstanceIDUserProposed,
			"pokemon_instance_id_user_accepting":  trade.PokemonInstanceIDUserAccepting,
			"trade_accepted_date":                 trade.TradeAcceptedDate,
			"trade_cancelled_by":                  trade.TradeCancelledBy,
			"trade_cancelled_date":                trade.TradeCancelledDate,
			"trade_completed_date":                trade.TradeCompletedDate,
			"trade_dust_cost":                     trade.TradeDustCost,
			"trade_friendship_level":              trade.TradeFriendshipLevel,
			"trade_id":                            trade.TradeID,
			"trade_proposal_date":                 trade.TradeProposalDate,
			"trade_status":                        trade.TradeStatus,
			"username_proposed":                   trade.UsernameProposed,
			"username_accepting":                  trade.UsernameAccepting,
			"user_1_trade_satisfaction":           trade.User1TradeSatisfaction,
			"user_2_trade_satisfaction":           trade.User2TradeSatisfaction,
			"user_proposed_completion_confirmed":  trade.UserProposedCompletionConfirmed,
			"user_accepting_completion_confirmed": trade.UserAcceptingCompletionConfirmed,
			"last_update":                         trade.LastUpdate,
		}
	}

	relatedInstances := make(map[string]interface{})
	for _, trade := range tradesList {
		if trade.UserIDProposed != userID && trade.PokemonInstanceIDUserProposed != "" {
			var instance PokemonInstance
			if err := db.Where("instance_id = ?", trade.PokemonInstanceIDUserProposed).First(&instance).Error; err == nil {
				relatedInstances[instance.InstanceID] = buildPokemonInstancePayload(instance)
			}
		}
		if trade.UserIDAccepting != userID && trade.PokemonInstanceIDUserAccepting != "" {
			var instance PokemonInstance
			if err := db.Where("instance_id = ?", trade.PokemonInstanceIDUserAccepting).First(&instance).Error; err == nil {
				relatedInstances[instance.InstanceID] = buildPokemonInstancePayload(instance)
			}
		}
	}

	response := map[string]interface{}{
		"pokemon":         pokemonData,
		"trade":           tradeMap,
		"relatedInstance": relatedInstances,
	}

	logrus.Infof("User %s retrieved %d Pokemon updates, %d trades, and %d related instances",
		c.Locals("username"), len(pokemonData), len(tradeMap), len(relatedInstances))
	return c.Status(fiber.StatusOK).JSON(response)
}
