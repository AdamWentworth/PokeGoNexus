// pokemon_handler.go
package main

import (
	"errors"
	"sort"
	"time"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// ---------------------
// POKEMON
// ---------------------

func shouldApplyInstanceMutation(existingLastUpdate, incomingLastUpdate int64) bool {
	return incomingLastUpdate > existingLastUpdate
}

func parseAndUpsertPokemon(
	data map[string]interface{},
	userID string,
	messageTraceID string,
) (
	createdCount int,
	updatedCount int,
	deletedCount int,
	affectedVariantIDs []string,
	err error,
) {
	affectedVariants := make(map[string]struct{})
	addAffectedVariant := func(variantID string) {
		if normalized := normalizeOptionalString(&variantID); normalized != "" {
			affectedVariants[normalized] = struct{}{}
		}
	}
	defer func() {
		affectedVariantIDs = make([]string, 0, len(affectedVariants))
		for variantID := range affectedVariants {
			affectedVariantIDs = append(affectedVariantIDs, variantID)
		}
		sort.Strings(affectedVariantIDs)
	}()

	pokemonUpdates, _ := data["pokemonUpdates"].([]interface{})
	for _, p := range pokemonUpdates {
		pm, ok := p.(map[string]interface{})
		if !ok {
			logrus.Warn("Invalid Pokémon update format; skipping.")
			continue
		}

		instanceID := firstNonEmptyString(pm, "instance_id", "key")
		if instanceID == "" {
			logrus.Warn("Received Pokémon update with empty instance_id; skipping.")
			continue
		}

		if hasExplicitEmptyString(pm, "variant_id") {
			logrus.Warnf("Invalid empty variant_id for instance %s; omit variant_id for patch/delete semantics or send a non-empty string.", instanceID)
			continue
		}
		variantID := parseNullableString(pm["variant_id"])
		variantForRegistration := normalizeOptionalString(variantID)

		rawIsCaught, hasIsCaught := pm["is_caught"]
		if !hasIsCaught || rawIsCaught == nil {
			logrus.Warnf("Missing required is_caught for instance %s; skipping.", instanceID)
			continue
		}
		isCaught := parseOptionalBool(rawIsCaught)
		isWanted := parseOptionalBool(pm["is_wanted"])
		isForTrade := parseOptionalBool(pm["is_for_trade"])
		registered := parseOptionalBool(pm["registered"])
		mostWanted := parseOptionalBool(pm["most_wanted"])
		favorite := parseOptionalBool(pm["favorite"])

		origIsCaught := isCaught
		origIsWanted := isWanted
		origIsForTrade := isForTrade
		origRegistered := registered
		origMostWanted := mostWanted

		isCaught, isWanted, isForTrade, registered, mostWanted = normalizeVariantOwnershipState(
			normalizeOptionalString(variantID),
			isCaught,
			isWanted,
			isForTrade,
			registered,
			mostWanted,
		)
		if origIsCaught != isCaught ||
			origIsWanted != isWanted ||
			origIsForTrade != isForTrade ||
			origRegistered != registered ||
			origMostWanted != mostWanted {
			logrus.Warnf(
				"Normalized ownership flags for instance %s: caught %t->%t, wanted %t->%t, for_trade %t->%t, registered %t->%t, most_wanted %t->%t",
				instanceID,
				origIsCaught, isCaught,
				origIsWanted, isWanted,
				origIsForTrade, isForTrade,
				origRegistered, registered,
				origMostWanted, mostWanted,
			)
		}

		// Canonical deletion path: explicitly uncaught, and not tracked for trade/wanted.
		if !isCaught && !isWanted && !isForTrade {
			msgLastUpdate := int64(safeFloat(pm["last_update"], 0))
			var existing PokemonInstance
			lookup := DB.Where("instance_id = ?", instanceID).First(&existing)
			if lookup.Error == nil {
				if existing.UserID != userID {
					instanceMutationsTotal.WithLabelValues("unauthorized").Inc()
					logrus.Warnf("Unauthorized delete attempt by user %s for instance %s owned by %s",
						userID, instanceID, existing.UserID)
					continue
				}
				if !shouldApplyInstanceMutation(existing.LastUpdate, msgLastUpdate) {
					instanceMutationsTotal.WithLabelValues("stale").Inc()
					logrus.Infof("Ignored older or same deletion for instance %s", instanceID)
					continue
				}
			} else if errors.Is(lookup.Error, gorm.ErrRecordNotFound) {
				// Replayed deletion of an already absent instance is idempotent.
				continue
			} else {
				logrus.Warnf("Failed to check deletion conflict for instance %s: %v", instanceID, lookup.Error)
				continue
			}
			if variantForRegistration == "" {
				variantForRegistration = normalizeOptionalString(existing.VariantID)
			}
			deleteResult := DB.Where(
				"instance_id = ? AND user_id = ? AND last_update < ?",
				instanceID, userID, msgLastUpdate,
			).Delete(&PokemonInstance{})
			if errDel := deleteResult.Error; errDel != nil {
				logrus.Warnf("Failed to delete instance_id %s: %v", instanceID, errDel)
			} else if deleteResult.RowsAffected == 1 {
				instanceMutationsTotal.WithLabelValues("deleted").Inc()
				deletedCount++
				addAffectedVariant(variantForRegistration)
				if errRel := cleanupInstanceTags(DB, instanceID); errRel != nil {
					logrus.Warnf("Failed to clean instance_tags for deleted instance %s: %v", instanceID, errRel)
				}
				if errReg := syncRegistrationForVariant(DB, userID, variantForRegistration); errReg != nil {
					logrus.Warnf("Failed to sync registration after delete for user %s variant %s: %v", userID, variantForRegistration, errReg)
				}
			} else {
				logrus.Infof("Deletion lost a concurrent update race for instance %s", instanceID)
			}
			continue
		}

		var existingInstance PokemonInstance
		tx := DB.Where("instance_id = ?", instanceID).First(&existingInstance)
		existingVariantID := ""

		// Compare last_update
		msgLastUpdate := int64(safeFloat(pm["last_update"], 0))
		if tx.Error == nil {
			if existingInstance.UserID != userID {
				instanceMutationsTotal.WithLabelValues("unauthorized").Inc()
				logrus.Warnf("Unauthorized attempt by user %s to modify instance %s owned by %s",
					userID, instanceID, existingInstance.UserID)
				continue
			}
			if !shouldApplyInstanceMutation(existingInstance.LastUpdate, msgLastUpdate) {
				instanceMutationsTotal.WithLabelValues("stale").Inc()
				logrus.Infof("Ignored older or same update for instance %s", instanceID)
				continue
			}
			existingVariantID = normalizeOptionalString(existingInstance.VariantID)
		} else if !errors.Is(tx.Error, gorm.ErrRecordNotFound) {
			logrus.Errorf("Error finding instance %s: %v", instanceID, tx.Error)
			continue
		}

		originalFavorite := favorite
		originalForTrade := isForTrade
		favorite, isForTrade = normalizeFavoriteTradeState(
			favorite,
			isForTrade,
			tx.Error == nil,
			existingInstance.Favorite,
			existingInstance.IsForTrade,
		)
		if originalFavorite != favorite || originalForTrade != isForTrade {
			logrus.Warnf(
				"Normalized mutually exclusive Favorite/For Trade flags for instance %s: favorite %t->%t, for_trade %t->%t",
				instanceID,
				originalFavorite, favorite,
				originalForTrade, isForTrade,
			)
		}

		var resolvedVariant bool
		variantID, variantForRegistration, resolvedVariant = resolveTrackedVariantID(
			variantID,
			existingVariantID,
		)
		if !resolvedVariant {
			logrus.Warnf("Missing required variant_id for tracked instance %s; skipping.", instanceID)
			continue
		}

		// Parse required int
		pokemonID, errReq := parseRequiredInt(pm["pokemon_id"])
		if errReq != nil {
			logrus.Warnf("Invalid or missing pokemon_id for instance %s: %v", instanceID, errReq)
			continue
		}

		// Optional identity/provenance
		pokeball := parseNullableString(pm["pokeball"])
		originalTrainerName := parseNullableString(pm["original_trainer_name"])
		originalTrainerID := parseNullableString(pm["original_trainer_id"])

		// Booleans
		shiny := parseOptionalBool(pm["shiny"])
		lucky := parseOptionalBool(pm["lucky"])
		shadow := parseOptionalBool(pm["shadow"])
		purified := parseOptionalBool(pm["purified"])
		mirror := parseOptionalBool(pm["mirror"])
		prefLucky := parseOptionalBool(pm["pref_lucky"])
		isMega := parseOptionalBool(pm["is_mega"])
		mega := parseOptionalBool(pm["mega"])
		isFused := parseOptionalBool(pm["is_fused"])
		disabled := parseOptionalBool(pm["disabled"])
		dynamax := parseOptionalBool(pm["dynamax"])
		gigantamax := parseOptionalBool(pm["gigantamax"])
		crown := parseOptionalBool(pm["crown"])
		isTraded := parseOptionalBool(pm["is_traded"])

		// Nullable ints/floats
		cp := parseNullableInt(pm["cp"])
		attackIV := parseNullableInt(pm["attack_iv"])
		defenseIV := parseNullableInt(pm["defense_iv"])
		staminaIV := parseNullableInt(pm["stamina_iv"])
		costumeID := parseNullableInt(pm["costume_id"])
		fastMoveID := parseNullableInt(pm["fast_move_id"])
		chargedMove1ID := parseNullableInt(pm["charged_move1_id"])
		chargedMove2ID := parseNullableInt(pm["charged_move2_id"])
		weight := parseNullableFloat(pm["weight"])
		height := parseNullableFloat(pm["height"])
		friendshipLevel := parseNullableInt(pm["friendship_level"])
		level := parseNullableFloat(pm["level"])

		// Nullable strings (empty => nil)
		nickname := parseNullableString(pm["nickname"])
		gender := parseNullableString(pm["gender"])
		locationCard := parseNullableString(pm["location_card"])
		locationCaught := parseNullableString(pm["location_caught"])
		megaForm := parseNullableString(pm["mega_form"])
		fusionForm := parseNullableString(pm["fusion_form"])
		fusedWith := parseNullableString(pm["fused_with"])

		maxAttack := parseNullableString(pm["max_attack"])
		maxGuard := parseNullableString(pm["max_guard"])
		maxSpirit := parseNullableString(pm["max_spirit"])

		// Date
		dateCaught := parseOptionalDate(pm["date_caught"])
		tradedDate := parseOptionalDate(pm["traded_date"])

		// JSON => "{}" if missing/empty
		notTradeList := safeJSON(pm["not_trade_list"])
		notWantedList := safeJSON(pm["not_wanted_list"])
		tradeFilters := safeJSON(pm["trade_filters"])
		wantedFilters := safeJSON(pm["wanted_filters"])
		fusionJSON := safeJSON(pm["fusion"])
		caughtTags := safeJSONArray(pm["caught_tags"])
		tradeTags := safeJSONArray(pm["trade_tags"])
		wantedTags := safeJSONArray(pm["wanted_tags"])

		// Prepare a map for updates
		updates := map[string]interface{}{
			"variant_id":            variantID,
			"pokemon_id":            pokemonID,
			"nickname":              nickname,
			"cp":                    cp,
			"attack_iv":             attackIV,
			"defense_iv":            defenseIV,
			"stamina_iv":            staminaIV,
			"shiny":                 shiny,
			"costume_id":            costumeID,
			"lucky":                 lucky,
			"shadow":                shadow,
			"purified":              purified,
			"fast_move_id":          fastMoveID,
			"charged_move1_id":      chargedMove1ID,
			"charged_move2_id":      chargedMove2ID,
			"pokeball":              pokeball,
			"weight":                weight,
			"height":                height,
			"gender":                gender,
			"mirror":                mirror,
			"pref_lucky":            prefLucky,
			"registered":            registered,
			"favorite":              favorite,
			"location_card":         locationCard,
			"location_caught":       locationCaught,
			"friendship_level":      friendshipLevel,
			"date_caught":           dateCaught,
			"is_traded":             isTraded,
			"traded_date":           tradedDate,
			"original_trainer_name": originalTrainerName,
			"last_update":           msgLastUpdate,
			"is_for_trade":          isForTrade,
			"is_wanted":             isWanted,
			"most_wanted":           mostWanted,
			"caught_tags":           *caughtTags,
			"trade_tags":            *tradeTags,
			"wanted_tags":           *wantedTags,
			"not_trade_list":        *notTradeList,
			"not_wanted_list":       *notWantedList,
			"trade_filters":         tradeFilters,
			"wanted_filters":        wantedFilters,
			"trace_id":              messageTraceID,
			"mega":                  mega,
			"mega_form":             megaForm,
			"is_mega":               isMega,
			"level":                 level,
			"is_fused":              isFused,
			"fusion":                *fusionJSON,
			"fusion_form":           fusionForm,
			"fused_with":            fusedWith,
			"disabled":              disabled,
			"dynamax":               dynamax,
			"gigantamax":            gigantamax,
			"crown":                 crown,
			"max_attack":            maxAttack,
			"max_guard":             maxGuard,
			"max_spirit":            maxSpirit,
		}
		addOptionalJSONUpdate(updates, pm, "wanted_size_preferences")
		if originalTrainerID != nil && *originalTrainerID != "" {
			updates["original_trainer_id"] = originalTrainerID
		}
		updates["is_caught"] = isCaught
		updates = filterInstanceColumns(updates)

		if errors.Is(tx.Error, gorm.ErrRecordNotFound) {
			createFields := make(map[string]interface{}, len(updates))
			for k, v := range updates {
				createFields[k] = v
			}
			createFields["instance_id"] = instanceID
			createFields["user_id"] = userID
			createFields["date_added"] = time.Now()
			createFields = filterInstanceColumns(createFields)

			if errCreate := DB.Table((PokemonInstance{}).TableName()).Create(createFields).Error; errCreate != nil {
				logrus.Warnf("Failed to create instance %s for user %s: %v", instanceID, userID, errCreate)
				continue
			}
			createdCount++
			instanceMutationsTotal.WithLabelValues("created").Inc()
			addAffectedVariant(variantForRegistration)
		} else if tx.Error == nil {
			// UPDATE using map to include zero values
			if errUpdate := DB.Model(&existingInstance).Updates(updates).Error; errUpdate != nil {
				logrus.Warnf("Failed to update instance %s: %v", instanceID, errUpdate)
				continue
			}
			updatedCount++
			instanceMutationsTotal.WithLabelValues("updated").Inc()
			addAffectedVariant(existingVariantID)
			addAffectedVariant(variantForRegistration)
		}

		if errReg := syncRegistrationForVariant(DB, userID, variantForRegistration); errReg != nil {
			logrus.Warnf("Failed to sync registrations for user %s variant %s: %v", userID, variantForRegistration, errReg)
		}
		if errTags := syncInstanceTagsForInstance(
			DB,
			userID,
			instanceID,
			*caughtTags,
			*tradeTags,
			*wantedTags,
			isCaught,
			favorite,
			isForTrade,
			isWanted,
			mostWanted,
		); errTags != nil {
			logrus.Warnf("Failed to sync instance_tags for instance %s: %v", instanceID, errTags)
		}
	}
	return
}
