// pokemon_handlers.go

package main

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"

	"github.com/gofiber/fiber/v3"
	"github.com/sirupsen/logrus"
)

// Haversine function to calculate the distance between two latitude/longitude pairs
func haversine(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371 // Earth radius in kilometers
	lat1Rad := lat1 * (math.Pi / 180)
	lat2Rad := lat2 * (math.Pi / 180)
	deltaLat := (lat2 - lat1) * (math.Pi / 180)
	deltaLon := (lon2 - lon1) * (math.Pi / 180)

	a := math.Sin(deltaLat/2)*math.Sin(deltaLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*
			math.Sin(deltaLon/2)*math.Sin(deltaLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return R * c
}

func SearchPokemonInstances(c fiber.Ctx) error {
	// Extract query parameters
	pokemonIDStr := c.Query("pokemon_id")
	shinyStr := c.Query("shiny")
	shadowStr := c.Query("shadow")
	costumeIDStr := c.Query("costume_id")
	ownership := c.Query("ownership")
	limitStr := c.Query("limit")
	rangeKMStr := c.Query("range_km")
	latitudeStr := c.Query("latitude")
	longitudeStr := c.Query("longitude")
	fastMoveIDStr := c.Query("fast_move_id")
	chargedMove1IDStr := c.Query("charged_move_1_id")
	chargedMove2IDStr := c.Query("charged_move_2_id")
	genderStr := c.Query("gender")
	alreadyRegisteredStr := c.Query("already_registered")
	attackIVStr := c.Query("attack_iv")
	defenseIVStr := c.Query("defense_iv")
	staminaIVStr := c.Query("stamina_iv")
	backgroundIDStr := c.Query("background_id")
	prefLuckyStr := c.Query("pref_lucky")
	friendshipLevelStr := c.Query("friendship_level")
	onlyMatchingTradesStr := c.Query("only_matching_trades")
	tradeInWantedListStr := c.Query("trade_in_wanted_list")
	dynamaxStr := c.Query("dynamax")
	gigantamaxStr := c.Query("gigantamax")

	logrus.Infof("Received search query with params: pokemon_id=%s, shiny=%s, shadow=%s, costume_id=%s, ownership=%s, limit=%s, range_km=%s, latitude=%s, longitude=%s, fast_move_id=%s, charged_move_1_id=%s, charged_move_2_id=%s, gender=%s, already_registered=%s, attack_iv=%s, defense_iv=%s, stamina_iv=%s, background_id=%s, pref_lucky=%s, friendship_level=%s, only_matching_trades=%s, trade_in_wanted_list=%s, dynamax=%s, gigantamax=%s",
		pokemonIDStr, shinyStr, shadowStr, costumeIDStr, ownership, limitStr, rangeKMStr, latitudeStr, longitudeStr, fastMoveIDStr, chargedMove1IDStr, chargedMove2IDStr, genderStr, alreadyRegisteredStr, attackIVStr, defenseIVStr, staminaIVStr, backgroundIDStr, prefLuckyStr, friendshipLevelStr, onlyMatchingTradesStr, tradeInWantedListStr, dynamaxStr, gigantamaxStr)

	// Parse parameters into appropriate types
	var pokemonID, fastMoveID, chargedMove1ID, chargedMove2ID int
	var err error

	// Parse individual parameters
	if pokemonIDStr != "" {
		pokemonID, err = strconv.Atoi(pokemonIDStr)
		if err != nil {
			logrus.Error("Invalid pokemon_id: ", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid pokemon_id"})
		}
	}

	if fastMoveIDStr != "" {
		fastMoveID, err = strconv.Atoi(fastMoveIDStr)
		if err != nil {
			logrus.Error("Invalid fast_move_id: ", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid fast_move_id"})
		}
	}

	if chargedMove1IDStr != "" {
		chargedMove1ID, err = strconv.Atoi(chargedMove1IDStr)
		if err != nil {
			logrus.Error("Invalid charged_move_1_id: ", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid charged_move_1_id"})
		}
	}

	if chargedMove2IDStr != "" {
		chargedMove2ID, err = strconv.Atoi(chargedMove2IDStr)
		if err != nil {
			logrus.Error("Invalid charged_move_2_id: ", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid charged_move_2_id"})
		}
	}

	var shiny, shadow bool
	if shinyStr != "" {
		shiny, err = strconv.ParseBool(shinyStr)
		if err != nil {
			logrus.Error("Invalid shiny value: ", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid shiny value"})
		}
	}

	if shadowStr != "" {
		shadow, err = strconv.ParseBool(shadowStr)
		if err != nil {
			logrus.Error("Invalid shadow value: ", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid shadow value"})
		}
	}

	var dynamax, gigantamax bool
	if dynamaxStr != "" {
		dynamax, err = strconv.ParseBool(dynamaxStr)
		if err != nil {
			logrus.Error("Invalid dynamax value: ", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid dynamax value"})
		}
	}

	if gigantamaxStr != "" {
		gigantamax, err = strconv.ParseBool(gigantamaxStr)
		if err != nil {
			logrus.Error("Invalid gigantamax value: ", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid gigantamax value"})
		}
	}

	// Handle attack_iv, defense_iv, and stamina_iv parameters
	var attackIV, defenseIV, staminaIV *int
	if attackIVStr != "" {
		iv, err := strconv.Atoi(attackIVStr)
		if err != nil {
			logrus.Error("Invalid attack_iv value: ", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid attack_iv value"})
		}
		attackIV = &iv
	}

	if defenseIVStr != "" {
		iv, err := strconv.Atoi(defenseIVStr)
		if err != nil {
			logrus.Error("Invalid defense_iv value: ", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid defense_iv value"})
		}
		defenseIV = &iv
	}

	if staminaIVStr != "" {
		iv, err := strconv.Atoi(staminaIVStr)
		if err != nil {
			logrus.Error("Invalid stamina_iv value: ", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid stamina_iv value"})
		}
		staminaIV = &iv
	}

	// Determine the value of costumeID based on the input
	var costumeID *int
	if costumeIDStr != "" && costumeIDStr != "null" {
		cid, err := strconv.Atoi(costumeIDStr)
		if err != nil {
			logrus.Error("Invalid costume_id: ", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid costume_id"})
		}
		costumeID = &cid
	}

	// Determine the value of gender based on the input
	var gender *string
	if genderStr != "" && genderStr != "null" {
		// Only filter when a specific gender ("Male" or "Female") is provided.
		if genderStr != "Any" && genderStr != "Genderless" {
			validGenders := []string{"Male", "Female"}
			isValid := false
			for _, g := range validGenders {
				if genderStr == g {
					isValid = true
					break
				}
			}
			if !isValid {
				logrus.Error("Invalid gender value: ", genderStr)
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid gender value"})
			}
			gender = &genderStr
		}
	}

	// Parse already_registered parameter
	var alreadyRegistered *bool
	if alreadyRegisteredStr != "" {
		ar, err := strconv.ParseBool(alreadyRegisteredStr)
		if err != nil {
			logrus.Error("Invalid already_registered value: ", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid already_registered value"})
		}
		alreadyRegistered = &ar
	}

	// Parse background_id
	var backgroundID *int
	if backgroundIDStr != "" {
		bid, err := strconv.Atoi(backgroundIDStr)
		if err != nil {
			logrus.Error("Invalid background_id value: ", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid background_id value"})
		}
		backgroundID = &bid
	}

	// Parse pref_lucky parameter
	var prefLucky *bool
	if prefLuckyStr != "" {
		pl, err := strconv.ParseBool(prefLuckyStr)
		if err != nil {
			logrus.Error("Invalid pref_lucky value: ", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid pref_lucky value"})
		}
		prefLucky = &pl
	}

	var limit int = 25 // Default limit
	if limitStr != "" {
		limit, err = strconv.Atoi(limitStr)
		if err != nil {
			logrus.Error("Invalid limit value: ", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid limit"})
		}
	}

	var rangeKM float64 = 5 // Default range in km
	if rangeKMStr != "" {
		rangeKM, err = strconv.ParseFloat(rangeKMStr, 64)
		if err != nil {
			logrus.Error("Invalid range_km: ", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid range_km"})
		}
	}

	var latitude, longitude float64
	if latitudeStr != "" && longitudeStr != "" {
		latitude, err = strconv.ParseFloat(latitudeStr, 64)
		if err != nil {
			logrus.Error("Invalid latitude: ", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid latitude"})
		}
		longitude, err = strconv.ParseFloat(longitudeStr, 64)
		if err != nil {
			logrus.Error("Invalid longitude: ", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid longitude"})
		}
	}

	var friendshipLevel *int
	if friendshipLevelStr != "" {
		fl, err := strconv.Atoi(friendshipLevelStr)
		if err != nil {
			logrus.Error("Invalid friendship_level value: ", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid friendship_level value"})
		}
		if fl >= 1 && fl <= 5 {
			friendshipLevel = &fl
		} else if fl == 0 {
			// Treat as null (do not filter)
			friendshipLevel = nil
		} else {
			logrus.Error("Invalid friendship_level value: ", fl)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid friendship_level value"})
		}
	}

	// Parse the only_matching_trades parameter
	var onlyMatchingTrades bool
	if onlyMatchingTradesStr != "" {
		onlyMatchingTrades, err = strconv.ParseBool(onlyMatchingTradesStr)
		if err != nil {
			logrus.Error("Invalid only_matching_trades value: ", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid only_matching_trades value"})
		}
	} else {
		onlyMatchingTrades = false // Default value
	}

	// Parse the trade_in_wanted_list parameter
	var tradeInWantedList bool
	if tradeInWantedListStr != "" {
		tradeInWantedList, err = strconv.ParseBool(tradeInWantedListStr)
		if err != nil {
			logrus.Error("Invalid trade_in_wanted_list value: ", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid trade_in_wanted_list value"})
		}
	} else {
		tradeInWantedList = false // Default value
	}

	// Extract the user_id from the context (from the JWT token)
	userIDInterface := c.Locals("user_id")
	var userID string
	if userIDInterface != nil {
		userID = userIDInterface.(string)
	} else {
		userID = ""
	}

	// Start building the query
	query := db.Preload("User").Model(&PokemonInstance{})

	// Exclude current user's own instances if ownership is "trade" and only_matching_trades is true
	if ownership == "trade" && onlyMatchingTrades {
		query = query.Where("instances.user_id != ?", userID)
	}

	// Exclude current user's own instances if ownership is "wanted" and trade_in_wanted_list is true
	if ownership == "wanted" && tradeInWantedList {
		query = query.Where("instances.user_id != ?", userID)
	}

	// Apply filters based on parameters
	if pokemonIDStr != "" {
		query = query.Where("pokemon_id = ?", pokemonID)
	}

	if shinyStr != "" {
		query = query.Where("shiny = ?", shiny)
	}

	if shadowStr != "" {
		query = query.Where("shadow = ?", shadow)
	}

	if dynamaxStr != "" {
		query = query.Where("dynamax = ?", dynamax)
	}

	if gigantamaxStr != "" {
		query = query.Where("gigantamax = ?", gigantamax)
	}

	// Apply costume_id filtering logic
	if costumeIDStr == "" || costumeIDStr == "null" {
		query = query.Where("costume_id IS NULL")
	} else if costumeID != nil {
		query = query.Where("costume_id = ?", *costumeID)
	}

	// Apply gender filtering logic
	if gender != nil {
		query = query.Where("gender = ?", *gender)
	}

	// Apply already_registered logic
	if alreadyRegistered != nil {
		query = query.Where("registered = ?", *alreadyRegistered)
	}

	// Apply attack_iv, defense_iv, and stamina_iv filters
	if attackIV != nil {
		query = query.Where("attack_iv = ?", *attackIV)
	}

	if defenseIV != nil {
		query = query.Where("defense_iv = ?", *defenseIV)
	}

	if staminaIV != nil {
		query = query.Where("stamina_iv = ?", *staminaIV)
	}

	// Apply background_id filter
	if backgroundID != nil {
		query = query.Where("location_card = ?", *backgroundID)
	}

	// Apply pref_lucky logic
	if prefLucky != nil {
		query = query.Where("pref_lucky = ?", *prefLucky)
	}

	// Apply ownership status
	if ownership != "" {
		switch ownership {
		case "trade":
			query = query.Where("is_for_trade = ?", true)
		case "caught":
			query = query.Where("is_caught = ?", true)
		case "wanted":
			query = query.Where("is_wanted = ?", true)
		default:
			logrus.Error("Invalid ownership value")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ownership value"})
		}
	}

	// Apply fast_move_id filter if present
	if fastMoveIDStr != "" {
		query = query.Where("fast_move_id = ?", fastMoveID)
	}

	// Apply charged_move filtering logic
	if chargedMove1IDStr != "" || chargedMove2IDStr != "" {
		var chargedMoveQuery string
		var chargedMoveArgs []interface{}

		if chargedMove1IDStr != "" && chargedMove2IDStr != "" {
			chargedMoveQuery = "(charged_move1_id = ? AND charged_move2_id = ?) OR (charged_move1_id = ? AND charged_move2_id = ?)"
			chargedMoveArgs = append(chargedMoveArgs, chargedMove1ID, chargedMove2ID, chargedMove2ID, chargedMove1ID)
		} else if chargedMove1IDStr != "" {
			chargedMoveQuery = "charged_move1_id = ? OR charged_move2_id = ?"
			chargedMoveArgs = append(chargedMoveArgs, chargedMove1ID, chargedMove1ID)
		} else if chargedMove2IDStr != "" {
			chargedMoveQuery = "charged_move1_id = ? OR charged_move2_id = ?"
			chargedMoveArgs = append(chargedMoveArgs, chargedMove2ID, chargedMove2ID)
		}

		query = query.Where(chargedMoveQuery, chargedMoveArgs...)
	}

	// Handle location and range filtering
	if latitudeStr != "" && longitudeStr != "" {
		query = query.Joins("User").
			Where("User.latitude IS NOT NULL AND User.longitude IS NOT NULL").
			Where(`
				6371 * 2 * ASIN(
					SQRT(
						POWER(SIN(RADIANS(User.latitude - ?) / 2), 2) +
						COS(RADIANS(?)) * COS(RADIANS(User.latitude)) *
						POWER(SIN(RADIANS(User.longitude - ?) / 2), 2)
					)
				) < ?`, latitude, latitude, longitude, rangeKM)
	}

	if friendshipLevel != nil {
		query = query.Where("friendship_level = ?", *friendshipLevel)
	}

	// Apply the limit
	query = query.Limit(limit)

	// Execute the query
	var instances []PokemonInstance
	if err := query.Find(&instances).Error; err != nil {
		logrus.Error("Error retrieving instances: ", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to retrieve instances"})
	}

	// Check if no instances were found
	if len(instances) == 0 {
		logrus.Info("No Pokemon instances found for the given parameters")
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "No Pokemon instances found"})
	}

	logrus.Infof("Found %d Pokemon instances", len(instances))

	// Retrieve current user's 'for trade' instances if needed
	var currentUserTradeInstances []PokemonInstance
	if ownership == "trade" && onlyMatchingTrades && userID != "" {
		err := db.Model(&PokemonInstance{}).
			Where("user_id = ? AND is_for_trade = ?", userID, true).
			Find(&currentUserTradeInstances).Error
		if err != nil {
			logrus.Error("Error retrieving current user's trade instances: ", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to retrieve current user's trade instances"})
		}
	}

	// Retrieve current user's 'wanted' instances if needed
	var currentUserWantedInstances []PokemonInstance
	if ownership == "wanted" && tradeInWantedList && userID != "" {
		err := db.Model(&PokemonInstance{}).
			Where("user_id = ? AND is_wanted = ?", userID, true).
			Find(&currentUserWantedInstances).Error
		if err != nil {
			logrus.Error("Error retrieving current user's wanted instances: ", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to retrieve current user's wanted instances"})
		}
	}

	// Search results commonly contain several listings from the same trainer. Load
	// each trainer's related collection once instead of querying it again for every
	// result row. Besides avoiding an N+1 query pattern, these maps also let the
	// matching and response-building paths share the exact same snapshot.
	resultUserIDs := uniqueInstanceUserIDs(instances)
	wantedInstancesByUser := make(map[string][]PokemonInstance)
	tradeInstancesByUser := make(map[string][]PokemonInstance)
	if ownership == "trade" && len(resultUserIDs) > 0 {
		var wantedInstances []PokemonInstance
		if err := db.Model(&PokemonInstance{}).
			Where("user_id IN ? AND is_wanted = ?", resultUserIDs, true).
			Find(&wantedInstances).Error; err != nil {
			logrus.Error("Error retrieving wanted instances for search result users: ", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to retrieve wanted instances"})
		}
		wantedInstancesByUser = groupInstancesByUser(wantedInstances)
	}
	if ownership == "wanted" && len(resultUserIDs) > 0 {
		var tradeInstances []PokemonInstance
		if err := db.Model(&PokemonInstance{}).
			Where("user_id IN ? AND is_for_trade = ?", resultUserIDs, true).
			Find(&tradeInstances).Error; err != nil {
			logrus.Error("Error retrieving trade instances for search result users: ", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to retrieve trade instances"})
		}
		tradeInstancesByUser = groupInstancesByUser(tradeInstances)
	}

	// Prepare the response data
	responseData := make(map[string]interface{})
	for _, instance := range instances {
		var userDistance float64
		var instanceUserID, username string
		var userLatitude, userLongitude *float64
		if instance.User != nil {
			instanceUserID = instance.User.UserID
			username = instance.User.Username
			userLatitude = instance.User.Latitude
			userLongitude = instance.User.Longitude
			if instance.User.Latitude != nil && instance.User.Longitude != nil && latitudeStr != "" && longitudeStr != "" {
				userDistance = haversine(latitude, longitude, *instance.User.Latitude, *instance.User.Longitude)
			} else {
				logrus.Warnf("User %s has missing latitude/longitude data, skipping distance calculation", instance.User.UserID)
			}
		} else {
			logrus.Warnf("Instance %s has no associated user, skipping user and distance information", instance.InstanceID)
		}

		// New logic for ownership == "trade" and only_matching_trades == true
		if ownership == "trade" && onlyMatchingTrades && userID != "" {
			wantedInstances := wantedInstancesByUser[instanceUserID]

			// Compare current user's 'for trade' instances with the wanted instances
			matchFound := false
			mismatchReasons := []string{}
			for _, currentTradeInstance := range currentUserTradeInstances {
				for _, wantedInstance := range wantedInstances {
					matched, reason := instancesMatch(currentTradeInstance, wantedInstance)
					if matched {
						// Check if the wantedInstance is in the instance's not_wanted_list
						var notWantedList map[string]bool
						if len(instance.NotWantedList) > 0 {
							err := json.Unmarshal(instance.NotWantedList, &notWantedList)
							if err != nil {
								logrus.Warnf("Failed to parse not_wanted_list for instance %s: %v", instance.InstanceID, err)
							}
						}

						if notWantedList != nil {
							if _, exists := notWantedList[wantedInstance.InstanceID]; exists {
								logrus.Infof("Matched wanted instance %s is in instance %s's not_wanted_list; skipping this match.", wantedInstance.InstanceID, instance.InstanceID)
								continue
							}
						}

						logrus.Infof("Match found: Current user's trade instance %s matches user's wanted instance %s", currentTradeInstance.InstanceID, wantedInstance.InstanceID)
						matchFound = true
						break
					} else if reason != "" {
						mismatchReasons = append(mismatchReasons, fmt.Sprintf(
							"Trade instance %s and wanted instance %s do not match: %s",
							currentTradeInstance.InstanceID, wantedInstance.InstanceID, reason))
					}
				}
				if matchFound {
					break
				}
			}

			// If no match is found, skip this instance
			if !matchFound {
				logrus.Infof("No matching trade found for instance %s belonging to user %s; skipping instance.", instance.InstanceID, instanceUserID)
				for _, reason := range mismatchReasons {
					logrus.Info(reason)
				}
				continue
			}
		}

		// New logic for ownership == "wanted" and trade_in_wanted_list == true
		if ownership == "wanted" && tradeInWantedList && userID != "" {
			tradeInstances := tradeInstancesByUser[instanceUserID]

			// Compare current user's 'wanted' instances with the trade instances
			matchFound := false
			mismatchReasons := []string{}
			for _, currentWantedInstance := range currentUserWantedInstances {
				for _, tradeInstance := range tradeInstances {
					matched, reason := instancesMatch(currentWantedInstance, tradeInstance)
					if matched {
						// Check if the tradeInstance is in the instance's not_trade_list
						var notTradeList map[string]bool
						if len(instance.NotTradeList) > 0 {
							err := json.Unmarshal(instance.NotTradeList, &notTradeList)
							if err != nil {
								logrus.Warnf("Failed to parse not_trade_list for instance %s: %v", instance.InstanceID, err)
							}
						}

						if notTradeList != nil {
							if _, exists := notTradeList[tradeInstance.InstanceID]; exists {
								logrus.Infof("Matched trade instance %s is in instance %s's not_trade_list; skipping this match.", tradeInstance.InstanceID, instance.InstanceID)
								continue
							}
						}

						logrus.Infof("Match found: Current user's wanted instance %s matches user's trade instance %s", currentWantedInstance.InstanceID, tradeInstance.InstanceID)
						matchFound = true
						break
					} else if reason != "" {
						mismatchReasons = append(mismatchReasons, fmt.Sprintf(
							"Wanted instance %s and trade instance %s do not match: %s",
							currentWantedInstance.InstanceID, tradeInstance.InstanceID, reason))
					}
				}
				if matchFound {
					break
				}
			}

			// If no match is found, skip this instance
			if !matchFound {
				logrus.Infof("No matching trade found in trade_list for instance %s belonging to user %s; skipping instance.", instance.InstanceID, instanceUserID)
				for _, reason := range mismatchReasons {
					logrus.Info(reason)
				}
				continue
			}
		}

		instanceData := map[string]interface{}{
			"instance_id":      instance.InstanceID,
			"variant_id":       instance.VariantID,
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
			"mirror":           instance.Mirror,
			"pref_lucky":       instance.PrefLucky,
			"registered":       instance.Registered,
			"favorite":         instance.Favorite,
			"is_caught":        instance.IsCaught,
			"is_for_trade":     instance.IsForTrade,
			"is_wanted":        instance.IsWanted,
			"most_wanted":      instance.MostWanted,
			"location_caught":  instance.LocationCaught,
			"location_card":    instance.LocationCard,
			"friendship_level": instance.FriendshipLevel,
			"last_update":      instance.LastUpdate,
			"date_caught":      instance.DateCaught,
			"date_added":       instance.DateAdded,
			"wanted_filters":   instance.WantedFilters,
			"trade_filters":    instance.TradeFilters,
			"distance":         userDistance,
			"dynamax":          instance.Dynamax,
			"gigantamax":       instance.Gigantamax,
		}
		instanceData["wanted_size_preferences"] = instance.WantedSizes

		if instanceUserID != "" && username != "" {
			instanceData["user_id"] = instanceUserID
			instanceData["username"] = username
			if userLatitude != nil && userLongitude != nil {
				instanceData["latitude"] = *userLatitude
				instanceData["longitude"] = *userLongitude
			}
		}

		// New logic to add trade_list when ownership is "wanted"
		if ownership == "wanted" {
			if instanceUserID != "" {
				tradeInstances := tradeInstancesByUser[instanceUserID]

				// Parse the not_trade_list
				notTradeList := make(map[string]bool)
				if len(instance.NotTradeList) > 0 {
					err := json.Unmarshal(instance.NotTradeList, &notTradeList)
					if err != nil {
						logrus.Warnf("Failed to parse not_trade_list for instance %s: %v", instance.InstanceID, err)
					}
				}

				// Exclude instances in the not_trade_list and where Mirror is true
				filteredTradeInstances := []PokemonInstance{}
				for _, tradeInstance := range tradeInstances {
					if _, exists := notTradeList[tradeInstance.InstanceID]; !exists && !tradeInstance.Mirror {
						filteredTradeInstances = append(filteredTradeInstances, tradeInstance)
					}
				}

				// Build the trade_list
				tradeListData := make(map[string]interface{})
				for _, tradeInstance := range filteredTradeInstances {
					tradeInstanceData := map[string]interface{}{
						"instance_id":      tradeInstance.InstanceID,
						"variant_id":       tradeInstance.VariantID,
						"pokemon_id":       tradeInstance.PokemonID,
						"nickname":         tradeInstance.Nickname,
						"cp":               tradeInstance.CP,
						"attack_iv":        tradeInstance.AttackIV,
						"defense_iv":       tradeInstance.DefenseIV,
						"stamina_iv":       tradeInstance.StaminaIV,
						"shiny":            tradeInstance.Shiny,
						"costume_id":       tradeInstance.CostumeID,
						"lucky":            tradeInstance.Lucky,
						"shadow":           tradeInstance.Shadow,
						"purified":         tradeInstance.Purified,
						"fast_move_id":     tradeInstance.FastMoveID,
						"charged_move1_id": tradeInstance.ChargedMove1ID,
						"charged_move2_id": tradeInstance.ChargedMove2ID,
						"weight":           tradeInstance.Weight,
						"height":           tradeInstance.Height,
						"gender":           tradeInstance.Gender,
						"mirror":           tradeInstance.Mirror,
						"pref_lucky":       tradeInstance.PrefLucky,
						"registered":       tradeInstance.Registered,
						"favorite":         tradeInstance.Favorite,
						"is_caught":        tradeInstance.IsCaught,
						"is_for_trade":     tradeInstance.IsForTrade,
						"is_wanted":        tradeInstance.IsWanted,
						"most_wanted":      tradeInstance.MostWanted,
						"location_caught":  tradeInstance.LocationCaught,
						"location_card":    tradeInstance.LocationCard,
						"friendship_level": tradeInstance.FriendshipLevel,
						"last_update":      tradeInstance.LastUpdate,
						"date_caught":      tradeInstance.DateCaught,
						"date_added":       tradeInstance.DateAdded,
						"wanted_filters":   tradeInstance.WantedFilters,
						"trade_filters":    tradeInstance.TradeFilters,
						"dynamax":          tradeInstance.Dynamax,
						"gigantamax":       tradeInstance.Gigantamax,
					}
					tradeInstanceData["wanted_size_preferences"] = tradeInstance.WantedSizes
					// Add 'match' field based on tradeInWantedList
					if tradeInWantedList && userID != "" {
						// Determine if any of the user's 'wanted' instances match this tradeInstance
						matchFound := false
						for _, currentWantedInstance := range currentUserWantedInstances {
							matched, _ := instancesMatch(currentWantedInstance, tradeInstance)
							if matched {
								matchFound = true
								break
							}
						}
						tradeInstanceData["match"] = matchFound
					} else {
						// Set match to null (nil in Go)
						tradeInstanceData["match"] = nil
					}

					tradeListData[tradeInstance.InstanceID] = tradeInstanceData
				}

				instanceData["trade_list"] = tradeListData
			}
		}

		// New logic for ownership == "trade"
		if ownership == "trade" {
			if instanceUserID != "" {
				wantedInstances := wantedInstancesByUser[instanceUserID]

				// Parse the not_wanted_list
				notWantedList := make(map[string]bool)
				if len(instance.NotWantedList) > 0 {
					err := json.Unmarshal(instance.NotWantedList, &notWantedList)
					if err != nil {
						logrus.Warnf("Failed to parse not_wanted_list for instance %s: %v", instance.InstanceID, err)
					}
				}

				// Exclude instances in the not_wanted_list
				filteredWantedInstances := []PokemonInstance{}
				for _, wantedInstance := range wantedInstances {
					if _, exists := notWantedList[wantedInstance.InstanceID]; !exists {
						filteredWantedInstances = append(filteredWantedInstances, wantedInstance)
					}
				}

				// If instance.Mirror is true, filter wantedInstances to only include those with the same pokemon_id
				if instance.Mirror {
					tempFilteredWantedInstances := []PokemonInstance{}
					for _, wantedInstance := range filteredWantedInstances {
						if wantedInstance.PokemonID == instance.PokemonID {
							tempFilteredWantedInstances = append(tempFilteredWantedInstances, wantedInstance)
						}
					}
					filteredWantedInstances = tempFilteredWantedInstances
				}

				// Build the wanted_list
				wantedListData := make(map[string]interface{})
				for _, wantedInstance := range filteredWantedInstances {
					wantedInstanceData := map[string]interface{}{
						"instance_id":      wantedInstance.InstanceID,
						"variant_id":       wantedInstance.VariantID,
						"pokemon_id":       wantedInstance.PokemonID,
						"nickname":         wantedInstance.Nickname,
						"cp":               wantedInstance.CP,
						"attack_iv":        wantedInstance.AttackIV,
						"defense_iv":       wantedInstance.DefenseIV,
						"stamina_iv":       wantedInstance.StaminaIV,
						"shiny":            wantedInstance.Shiny,
						"costume_id":       wantedInstance.CostumeID,
						"lucky":            wantedInstance.Lucky,
						"shadow":           wantedInstance.Shadow,
						"purified":         wantedInstance.Purified,
						"fast_move_id":     wantedInstance.FastMoveID,
						"charged_move1_id": wantedInstance.ChargedMove1ID,
						"charged_move2_id": wantedInstance.ChargedMove2ID,
						"weight":           wantedInstance.Weight,
						"height":           wantedInstance.Height,
						"gender":           wantedInstance.Gender,
						"mirror":           wantedInstance.Mirror,
						"pref_lucky":       wantedInstance.PrefLucky,
						"registered":       wantedInstance.Registered,
						"favorite":         wantedInstance.Favorite,
						"is_caught":        wantedInstance.IsCaught,
						"is_for_trade":     wantedInstance.IsForTrade,
						"is_wanted":        wantedInstance.IsWanted,
						"most_wanted":      wantedInstance.MostWanted,
						"location_caught":  wantedInstance.LocationCaught,
						"location_card":    wantedInstance.LocationCard,
						"friendship_level": wantedInstance.FriendshipLevel,
						"last_update":      wantedInstance.LastUpdate,
						"date_added":       wantedInstance.DateAdded,
						"wanted_filters":   wantedInstance.WantedFilters,
						"trade_filters":    wantedInstance.TradeFilters,
						"dynamax":          wantedInstance.Dynamax,
						"gigantamax":       wantedInstance.Gigantamax,
					}
					wantedInstanceData["wanted_size_preferences"] = wantedInstance.WantedSizes

					// Add 'match' field based on onlyMatchingTrades
					if onlyMatchingTrades && userID != "" {
						// Determine if any of the user's 'for trade' instances match this wantedInstance
						matchFound := false
						for _, currentTradeInstance := range currentUserTradeInstances {
							matched, _ := instancesMatch(currentTradeInstance, wantedInstance)
							if matched {
								matchFound = true
								break
							}
						}
						wantedInstanceData["match"] = matchFound
					} else {
						// Set match to null (nil in Go)
						wantedInstanceData["match"] = nil
					}

					wantedListData[wantedInstance.InstanceID] = wantedInstanceData
				}

				instanceData["wanted_list"] = wantedListData
			}
		}

		responseData[instance.InstanceID] = instanceData
	}

	logrus.Infof("Returning %d Pokemon instances", len(responseData))
	return c.Status(fiber.StatusOK).JSON(responseData)
}

func uniqueInstanceUserIDs(instances []PokemonInstance) []string {
	seen := make(map[string]struct{}, len(instances))
	userIDs := make([]string, 0, len(instances))
	for _, instance := range instances {
		if instance.UserID == "" {
			continue
		}
		if _, exists := seen[instance.UserID]; exists {
			continue
		}
		seen[instance.UserID] = struct{}{}
		userIDs = append(userIDs, instance.UserID)
	}
	return userIDs
}

func groupInstancesByUser(instances []PokemonInstance) map[string][]PokemonInstance {
	grouped := make(map[string][]PokemonInstance)
	for _, instance := range instances {
		if instance.UserID == "" {
			continue
		}
		grouped[instance.UserID] = append(grouped[instance.UserID], instance)
	}
	return grouped
}

// Helper function to compare two PokemonInstances based on specified criteria
func instancesMatch(a, b PokemonInstance) (bool, string) {
	// PokemonID, Shiny, and Shadow checks
	if a.PokemonID != b.PokemonID || a.Shiny != b.Shiny || a.Shadow != b.Shadow {
		return false, ""
	}

	// CostumeID check with detailed logging
	if (a.CostumeID == nil && b.CostumeID != nil) || (a.CostumeID != nil && b.CostumeID == nil) {
		return false, "CostumeID presence mismatch"
	}
	if a.CostumeID != nil && b.CostumeID != nil && *a.CostumeID != *b.CostumeID {
		return false, "CostumeID value mismatch"
	}

	// Gender check
	if a.Gender != nil && b.Gender != nil && *a.Gender != *b.Gender {
		return false, "Gender mismatch"
	}

	// LocationCard check
	if a.LocationCard != b.LocationCard {
		return false, "LocationCard mismatch"
	}

	// Dynamax check
	if a.Dynamax != b.Dynamax {
		return false, "Dynamax mismatch"
	}

	// Gigantamax check
	if a.Gigantamax != b.Gigantamax {
		return false, "Gigantamax mismatch"
	}

	// FastMoveID check
	if a.FastMoveID != nil && b.FastMoveID != nil && *a.FastMoveID != *b.FastMoveID {
		return false, "FastMoveID mismatch"
	}

	// ChargedMoveID check
	chargedMovesMatch := false
	if a.ChargedMove1ID != nil && a.ChargedMove2ID != nil && b.ChargedMove1ID != nil && b.ChargedMove2ID != nil {
		chargedMovesMatch = (*a.ChargedMove1ID == *b.ChargedMove1ID && *a.ChargedMove2ID == *b.ChargedMove2ID) ||
			(*a.ChargedMove1ID == *b.ChargedMove2ID && *a.ChargedMove2ID == *b.ChargedMove1ID)
	} else {
		// If any of the ChargedMoveIDs are nil, consider them matching
		chargedMovesMatch = true
	}

	if !chargedMovesMatch {
		return false, "ChargedMoveID mismatch"
	}

	if a.IsWanted && !b.IsWanted {
		if matched, reason := matchesWantedSizePreferences(a, b); !matched {
			return false, reason
		}
	}
	if b.IsWanted && !a.IsWanted {
		if matched, reason := matchesWantedSizePreferences(b, a); !matched {
			return false, reason
		}
	}

	return true, ""
}
