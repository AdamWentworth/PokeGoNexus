// user_overview_handler.go
package main

import (
	"fmt"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/sirupsen/logrus"
)

/* -------------------------------------------------------------------------- */
/*  helpers                                                                   */
/* -------------------------------------------------------------------------- */

func instanceToMap(in PokemonInstance) map[string]interface{} {
	return map[string]interface{}{
		"variant_id": in.VariantID, "pokemon_id": in.PokemonID, "nickname": in.Nickname,
		"cp": in.CP, "attack_iv": in.AttackIV, "defense_iv": in.DefenseIV,
		"stamina_iv": in.StaminaIV, "level": in.Level, "weight": in.Weight,
		"height": in.Height, "gender": in.Gender,

		// Early-form flags
		"shiny": in.Shiny, "costume_id": in.CostumeID, "lucky": in.Lucky,
		"shadow": in.Shadow, "purified": in.Purified,

		// Moves
		"fast_move_id": in.FastMoveID, "charged_move1_id": in.ChargedMove1ID,
		"charged_move2_id": in.ChargedMove2ID,

		// Location & timestamps
		"pokeball": in.Pokeball, "location_card": in.LocationCard,
		"location_caught": in.LocationCaught, "date_caught": in.DateCaught,
		"date_added": in.DateAdded, "last_update": in.LastUpdate, "disabled": in.Disabled,

		// Trade provenance
		"is_traded": in.IsTraded, "traded_date": in.TradedDate,
		"original_trainer_id":   in.OriginalTrainerID,
		"original_trainer_name": in.OriginalTrainerName,

		// Mega / Dynamax / Crown
		"mega": in.Mega, "mega_form": in.MegaForm, "is_mega": in.IsMega,
		"dynamax": in.Dynamax, "gigantamax": in.Gigantamax, "crown": in.Crown,
		"max_attack": in.MaxAttack, "max_guard": in.MaxGuard, "max_spirit": in.MaxSpirit,

		// Other forms
		"is_fused": in.IsFused, "fusion": in.Fusion, "fusion_form": in.FusionForm,
		"fused_with": in.FusedWith,

		// Ownership & tags
		"is_caught": in.IsCaught, "is_for_trade": in.IsForTrade, "is_wanted": in.IsWanted,
		"most_wanted": in.MostWanted, "caught_tags": in.CaughtTags, "trade_tags": in.TradeTags,
		"wanted_tags": in.WantedTags, "not_trade_list": in.NotTradeList,
		"not_wanted_list": in.NotWantedList, "trade_filters": in.TradeFilters,
		"wanted_filters":          in.WantedFilters,
		"wanted_size_preferences": in.WantedSizes,

		// Misc
		"friendship_level": in.FriendshipLevel, "mirror": in.Mirror,
		"pref_lucky": in.PrefLucky, "registered": in.Registered, "favorite": in.Favorite,
	}
}

/* -------------------------------------------------------------------------- */
/*  GET /api/users/:user_id/overview  (protected)                              */
/* -------------------------------------------------------------------------- */

func GetUserOverviewHandler(c fiber.Ctx) error {
	userID := c.Params("user_id")

	if tokenID, _ := c.Locals("user_id").(string); tokenID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "User mismatch"})
	}

	deviceID := c.Query("device_id")
	if deviceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Missing device_id"})
	}

	/* ---------------------------------------------------------------- user */
	var user User
	if err := db.First(&user, "user_id = ?", userID).Error; err != nil {
		logrus.Infof("User %s not found", userID)
		return c.Status(fiber.StatusOK).JSON(fiber.Map{})
	}

	/* ------------------------------------------------------------ instances */
	var instances []PokemonInstance
	if err := db.Where("user_id = ?", userID).Find(&instances).Error; err != nil {
		logrus.Errorf("Failed to retrieve instances for user %s: %v", userID, err) // <-- new
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve instances"})
	}

	/* -------------------------------------------------------------- trades */
	var trades []Trade
	if err := db.Where("user_id_proposed = ? OR user_id_accepting = ?", userID, userID).
		Find(&trades).Error; err != nil {
		logrus.Errorf("Failed to retrieve trades for user %s: %v", userID, err) // <-- new
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve trades"})
	}

	/* --------------------------------------------------------- registrations */
	var regs []Registration
	if err := db.Where("user_id = ?", userID).Find(&regs).Error; err != nil {
		logrus.Errorf("Failed to retrieve registrations for user %s: %v", userID, err) // <-- new
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve registrations"})
	}
	regMap := make(map[string]bool, len(regs))
	for _, r := range regs {
		regMap[r.VariantID] = true
	}

	/* ----------------------------------------------------- assemble payload */
	respInst := make(map[string]interface{}, len(instances))
	var latest time.Time
	for _, in := range instances {
		respInst[in.InstanceID] = instanceToMap(in)
		if t := lastUpdateToTime(in.LastUpdate); t.After(latest) {
			latest = t
		}
	}

	relatedIDs := make(map[string]struct{}, len(trades)*2)
	for _, t := range trades {
		if t.UserIDProposed == userID && t.PokemonInstanceIDUserAccepting != "" {
			relatedIDs[t.PokemonInstanceIDUserAccepting] = struct{}{}
		}
		if t.UserIDAccepting == userID && t.PokemonInstanceIDUserProposed != "" {
			relatedIDs[t.PokemonInstanceIDUserProposed] = struct{}{}
		}
	}
	var related []PokemonInstance
	if len(relatedIDs) > 0 {
		ids := make([]string, 0, len(relatedIDs))
		for id := range relatedIDs {
			ids = append(ids, id)
		}
		_ = db.Where("instance_id IN ?", ids).Find(&related).Error
	}
	relatedMap := make(map[string]interface{}, len(related))
	for _, in := range related {
		relatedMap[in.InstanceID] = instanceToMap(in)
		if t := lastUpdateToTime(in.LastUpdate); t.After(latest) {
			latest = t
		}
	}

	tradeMap := make(map[string]interface{}, len(trades))
	for _, t := range trades {
		tradeMap[t.TradeID] = map[string]interface{}{
			"is_special_trade": t.IsSpecialTrade, "is_registered_trade": t.IsRegisteredTrade,
			"is_lucky_trade": t.IsLuckyTrade, "trade_status": t.TradeStatus,
			"pokemon_instance_id_user_proposed":  t.PokemonInstanceIDUserProposed,
			"pokemon_instance_id_user_accepting": t.PokemonInstanceIDUserAccepting,
			"trade_proposal_date":                t.TradeProposalDate, "trade_accepted_date": t.TradeAcceptedDate,
			"trade_completed_date": t.TradeCompletedDate, "trade_cancelled_date": t.TradeCancelledDate,
			"trade_cancelled_by": t.TradeCancelledBy, "trade_dust_cost": t.TradeDustCost,
			"trade_friendship_level":    t.TradeFriendshipLevel,
			"user_1_trade_satisfaction": t.User1TradeSatisfaction,
			"user_2_trade_satisfaction": t.User2TradeSatisfaction,
		}
		if t.LastUpdate != nil {
			if ut := lastUpdateToTime(*t.LastUpdate); ut.After(latest) {
				latest = ut
			}
		}
	}

	/* ------------------------------------------------------------- caching */
	etag := "0"
	if !latest.IsZero() {
		etag = fmt.Sprintf("%d", latest.UnixNano())
	}
	if c.Get("If-None-Match") == etag {
		return c.Status(fiber.StatusNotModified).Send(nil)
	}
	c.Set("ETag", etag)

	/* ----------------------------------------------------------- response */
	return c.JSON(fiber.Map{
		"user":              user,
		"pokemon_instances": respInst,
		"trades":            tradeMap,
		"related_instances": relatedMap,
		"registrations":     regMap,
	})
}
