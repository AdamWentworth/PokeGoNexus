// autocomplete.go

package main

import (
	"context"
	"math"
	"regexp"
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sirupsen/logrus"
)

var autocompleteTokenPattern = regexp.MustCompile(`[\p{L}\p{N}]+`)

const autocompleteSQL = `
            SELECT p.id,
                   p.name,
                   p.state_or_province,
                   c.name AS country,
                   p.population,
                   p.latitude,
                   p.longitude,
                   ST_AsText(p.boundary) AS boundary,
                   p.admin_level,
                   ts_rank_cd(p.search_tsv, to_tsquery('simple', $1), 32) +
                   CASE
                       WHEN lower(p.name) = lower($2) THEN 5.0
                       WHEN lower(split_part(p.name, ' ', 1)) = lower($4) THEN 4.0
                       WHEN lower(p.name) LIKE lower($3) THEN 2.0
                       ELSE -1.0
                   END +
                   COALESCE(p.population / 1000000.0, 0) AS rank
            FROM places p
            LEFT JOIN countries c ON p.country_id = c.id
            WHERE p.search_tsv @@ to_tsquery('simple', $1)
            ORDER BY rank DESC,
                     p.population DESC NULLS LAST,
                     p.admin_level ASC,
                     p.osm_id ASC
            LIMIT 5;
        `

func buildAutocompleteTSQuery(query string) (string, string, bool) {
	tokens := autocompleteTokenPattern.FindAllString(query, -1)
	if len(tokens) == 0 {
		return "", "", false
	}

	prefixedTokens := make([]string, 0, len(tokens))
	for _, token := range tokens {
		prefixedTokens = append(prefixedTokens, token+":*")
	}

	return strings.Join(prefixedTokens, " & "), strings.ToLower(tokens[0]), true
}

func AutocompleteHandler(db *pgxpool.Pool) fiber.Handler {
	return func(c fiber.Ctx) error {
		queryParam := c.Query("query", "")
		logrus.Infof("Autocomplete request received with query: %s", queryParam)

		if len(queryParam) < 3 {
			logrus.Warn("Query parameter must be at least 3 characters")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "query parameter must be at least 3 characters",
			})
		}
		if len(queryParam) > 128 {
			logrus.Warn("Query parameter exceeds maximum length")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "query parameter must be 128 characters or fewer",
			})
		}
		if db == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "database unavailable",
			})
		}

		// search_tsv is built with PostgreSQL's "simple" dictionary. The query must
		// use the same dictionary or names such as Burnaby are stemmed to "burnabi"
		// and can never match the stored "burnaby" lexeme.
		tsQuery, firstToken, ok := buildAutocompleteTSQuery(queryParam)
		if !ok {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "query parameter must contain letters or numbers",
			})
		}

		// Create exact and partial match strings
		exactMatch := queryParam
		partialMatch := "%" + queryParam + "%"

		rows, err := db.Query(context.Background(), autocompleteSQL, tsQuery, exactMatch, partialMatch, firstToken)
		if err != nil {
			logrus.Errorf("Error querying database for autocomplete: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		defer rows.Close()

		results := make([]map[string]interface{}, 0)
		for rows.Next() {
			var id int64
			var name, state, country, boundary *string
			var population *int64
			var latitude, longitude *float64
			var adminLevel *int
			var rank float64

			if err := rows.Scan(&id, &name, &state, &country, &population, &latitude, &longitude, &boundary, &adminLevel, &rank); err != nil {
				logrus.Errorf("Error scanning row: %v", err)
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
			}

			// Handle NaN values
			if math.IsNaN(rank) {
				rank = 0 // or any default value
			}
			if latitude != nil && math.IsNaN(*latitude) {
				*latitude = 0 // or any default value
			}
			if longitude != nil && math.IsNaN(*longitude) {
				*longitude = 0 // or any default value
			}

			result := map[string]interface{}{
				"id":                id,
				"name":              name,
				"state_or_province": state,
				"country":           country,
				"population":        population,
				"latitude":          latitude,
				"longitude":         longitude,
				"boundary":          boundary,
				"admin_level":       adminLevel,
				"rank":              rank,
			}
			results = append(results, result)
		}

		if err := rows.Err(); err != nil {
			logrus.Errorf("Error iterating over rows: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}

		logrus.Infof("Autocomplete found %d results for query '%s'", len(results), queryParam)
		return c.JSON(results)
	}
}
