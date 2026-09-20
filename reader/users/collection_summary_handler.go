package main

import (
	"github.com/gofiber/fiber/v3"
	"github.com/sirupsen/logrus"
)

type CollectionSummary struct {
	CollectionTotal int64 `json:"collection_total" gorm:"column:collection_total"`
	Caught          int64 `json:"caught" gorm:"column:caught"`
	ForTrade        int64 `json:"for_trade" gorm:"column:for_trade"`
	Wanted          int64 `json:"wanted" gorm:"column:wanted"`
	Favorite        int64 `json:"favorite" gorm:"column:favorite"`
	MostWanted      int64 `json:"most_wanted" gorm:"column:most_wanted"`
}

// GetOwnCollectionSummaryHandler returns the small collection aggregate used
// by dashboards. Full instance state remains available through /instances/sync.
func GetOwnCollectionSummaryHandler(c fiber.Ctx) error {
	userID, _ := c.Locals("user_id").(string)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var summary CollectionSummary
	err := db.Raw(`
		SELECT
			COALESCE(SUM(CASE WHEN is_caught = TRUE OR is_for_trade = TRUE THEN 1 ELSE 0 END), 0) AS collection_total,
			COALESCE(SUM(CASE WHEN is_caught = TRUE THEN 1 ELSE 0 END), 0) AS caught,
			COALESCE(SUM(CASE WHEN is_for_trade = TRUE THEN 1 ELSE 0 END), 0) AS for_trade,
			COALESCE(SUM(CASE WHEN is_wanted = TRUE THEN 1 ELSE 0 END), 0) AS wanted,
			COALESCE(SUM(CASE WHEN favorite = TRUE THEN 1 ELSE 0 END), 0) AS favorite,
			COALESCE(SUM(CASE WHEN most_wanted = TRUE THEN 1 ELSE 0 END), 0) AS most_wanted
		FROM instances
		WHERE user_id = ? AND disabled = FALSE
	`, userID).Scan(&summary).Error
	if err != nil {
		logrus.Errorf("Failed to summarize collection for user %s: %v", userID, err)
		return c.Status(fiber.StatusInternalServerError).
			JSON(fiber.Map{"error": "Failed to retrieve collection summary"})
	}

	return c.JSON(summary)
}
