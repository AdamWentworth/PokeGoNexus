package main

import (
	"sort"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var rankingsRefreshMu sync.Mutex

type PokemonVariantRanking struct {
	VariantID           string    `gorm:"column:variant_id;primaryKey"`
	WantedUserCount     uint64    `gorm:"column:wanted_user_count"`
	MostWantedUserCount uint64    `gorm:"column:most_wanted_user_count"`
	CaughtUserCount     uint64    `gorm:"column:caught_user_count"`
	UpdatedAt           time.Time `gorm:"column:updated_at"`
}

func (PokemonVariantRanking) TableName() string {
	return "pokemon_variant_rankings"
}

type PokemonRankingsSnapshot struct {
	SnapshotKey        uint8     `gorm:"column:snapshot_key;primaryKey"`
	CollectorUserCount uint64    `gorm:"column:collector_user_count"`
	WishlistUserCount  uint64    `gorm:"column:wishlist_user_count"`
	UpdatedAt          time.Time `gorm:"column:updated_at"`
}

func (PokemonRankingsSnapshot) TableName() string {
	return "pokemon_rankings_snapshot"
}

func normalizeRankingVariantIDs(variantIDs []string) []string {
	set := make(map[string]struct{}, len(variantIDs))
	for _, variantID := range variantIDs {
		normalized := strings.TrimSpace(variantID)
		if normalized != "" {
			set[normalized] = struct{}{}
		}
	}

	out := make([]string, 0, len(set))
	for variantID := range set {
		out = append(out, variantID)
	}
	sort.Strings(out)
	return out
}

func refreshRankingsForVariants(db *gorm.DB, variantIDs []string) error {
	normalized := normalizeRankingVariantIDs(variantIDs)
	if len(normalized) == 0 {
		return nil
	}
	return refreshPokemonRankings(db, normalized)
}

func refreshAllRankings(db *gorm.DB) error {
	return refreshPokemonRankings(db, nil)
}

func refreshPokemonRankings(db *gorm.DB, variantIDs []string) error {
	rankingsRefreshMu.Lock()
	defer rankingsRefreshMu.Unlock()

	now := time.Now().UTC()
	return db.Transaction(func(tx *gorm.DB) error {
		query := tx.
			Table((PokemonInstance{}).TableName()).
			Select(`
variant_id,
COUNT(DISTINCT CASE WHEN is_wanted = 1 AND LOWER(variant_id) NOT LIKE '%shadow%' THEN user_id END) AS wanted_user_count,
COUNT(DISTINCT CASE WHEN is_wanted = 1 AND most_wanted = 1 AND LOWER(variant_id) NOT LIKE '%shadow%' THEN user_id END) AS most_wanted_user_count,
COUNT(DISTINCT CASE WHEN is_caught = 1 OR registered = 1 THEN user_id END) AS caught_user_count`).
			Where("variant_id IS NOT NULL AND variant_id <> '' AND disabled = 0")
		if len(variantIDs) > 0 {
			query = query.Where("variant_id IN ?", variantIDs)
		}

		var rows []PokemonVariantRanking
		if err := query.Group("variant_id").Find(&rows).Error; err != nil {
			return err
		}
		for index := range rows {
			rows[index].UpdatedAt = now
		}

		deleteQuery := tx.Model(&PokemonVariantRanking{})
		if len(variantIDs) > 0 {
			deleteQuery = deleteQuery.Where("variant_id IN ?", variantIDs)
		} else {
			deleteQuery = deleteQuery.Session(&gorm.Session{AllowGlobalUpdate: true})
		}
		if err := deleteQuery.Delete(&PokemonVariantRanking{}).Error; err != nil {
			return err
		}
		if len(rows) > 0 {
			if err := tx.
				Clauses(clause.OnConflict{UpdateAll: true}).
				CreateInBatches(&rows, 250).
				Error; err != nil {
				return err
			}
		}

		var population struct {
			CollectorUserCount uint64 `gorm:"column:collector_user_count"`
			WishlistUserCount  uint64 `gorm:"column:wishlist_user_count"`
		}
		if err := tx.
			Table((PokemonInstance{}).TableName()).
			Select(`
COUNT(DISTINCT CASE WHEN (is_caught = 1 OR registered = 1) AND disabled = 0 THEN user_id END) AS collector_user_count,
COUNT(DISTINCT CASE WHEN is_wanted = 1 AND disabled = 0 AND LOWER(variant_id) NOT LIKE '%shadow%' THEN user_id END) AS wishlist_user_count`).
			Scan(&population).
			Error; err != nil {
			return err
		}

		snapshot := PokemonRankingsSnapshot{
			SnapshotKey:        1,
			CollectorUserCount: population.CollectorUserCount,
			WishlistUserCount:  population.WishlistUserCount,
			UpdatedAt:          now,
		}
		return tx.Clauses(clause.OnConflict{UpdateAll: true}).Create(&snapshot).Error
	})
}
