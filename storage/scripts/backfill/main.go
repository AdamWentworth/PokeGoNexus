package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
)

type PokemonInstance struct {
	InstanceID string  `gorm:"column:instance_id;primaryKey"`
	UserID     string  `gorm:"column:user_id"`
	VariantID  *string `gorm:"column:variant_id"`

	IsCaught   bool `gorm:"column:is_caught"`
	IsForTrade bool `gorm:"column:is_for_trade"`
	IsWanted   bool `gorm:"column:is_wanted"`
	Registered bool `gorm:"column:registered"`
	MostWanted bool `gorm:"column:most_wanted"`

	CaughtTags string `gorm:"column:caught_tags"`
	TradeTags  string `gorm:"column:trade_tags"`
	WantedTags string `gorm:"column:wanted_tags"`
}

func (PokemonInstance) TableName() string { return "instances" }

type Registration struct {
	UserID    string `gorm:"column:user_id;primaryKey"`
	VariantID string `gorm:"column:variant_id;primaryKey"`
}

func (Registration) TableName() string { return "registrations" }

type InstanceTag struct {
	TagID      string `gorm:"column:tag_id;primaryKey"`
	InstanceID string `gorm:"column:instance_id;primaryKey"`
	UserID     string `gorm:"column:user_id"`
}

func (InstanceTag) TableName() string { return "instance_tags" }

type counters struct {
	Scanned                int64
	Deleted                int64
	Updated                int64
	NormalizedOwnership    int64
	TagRowsDeleted         int64
	TagRowsUpserted        int64
	RegistrationsRowsAdded int64
	DefaultTagsInserted    int64
	DefaultLinksInserted   int64
	DefaultLinksDeleted    int64
}

func main() {
	_ = godotenv.Load(".env")
	tagsOnly := hasArg("--tags-only")

	db, dsnUsed, err := openDBWithFallbackHosts()
	if err != nil {
		fmt.Fprintf(os.Stderr, "backfill failed to connect to DB: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("connected to DB using DSN host from: %s\n", dsnUsed)
	start := time.Now()

	stats := counters{}
	const batchSize = 500

	if !tagsOnly {
		err = db.Model(&PokemonInstance{}).FindInBatches(&[]PokemonInstance{}, batchSize, func(tx *gorm.DB, batch int) error {
			var rows []PokemonInstance
			if err := tx.Find(&rows).Error; err != nil {
				return err
			}

			for i := range rows {
				row := rows[i]
				stats.Scanned++

				origCaught := row.IsCaught
				origWanted := row.IsWanted
				origTrade := row.IsForTrade
				origRegistered := row.Registered
				origMostWanted := row.MostWanted

				row.IsCaught, row.IsWanted, row.IsForTrade, row.Registered, row.MostWanted =
					normalizeOwnershipState(row.IsCaught, row.IsWanted, row.IsForTrade, row.Registered, row.MostWanted)

				ownershipChanged := origCaught != row.IsCaught ||
					origWanted != row.IsWanted ||
					origTrade != row.IsForTrade ||
					origRegistered != row.Registered ||
					origMostWanted != row.MostWanted
				if ownershipChanged {
					stats.NormalizedOwnership++
				}

				deleteCandidate := !row.IsCaught && !row.IsWanted && !row.IsForTrade
				if deleteCandidate {
					delResult := db.Where("instance_id = ?", row.InstanceID).Delete(&PokemonInstance{})
					if delResult.Error != nil {
						return delResult.Error
					}
					if delResult.RowsAffected > 0 {
						stats.Deleted += delResult.RowsAffected
					}

					cleanResult := db.Where("instance_id = ?", row.InstanceID).Delete(&InstanceTag{})
					if cleanResult.Error != nil {
						return cleanResult.Error
					}
					if cleanResult.RowsAffected > 0 {
						stats.TagRowsDeleted += cleanResult.RowsAffected
					}

					continue
				}

				if ownershipChanged {
					updateResult := db.Model(&PokemonInstance{}).
						Where("instance_id = ?", row.InstanceID).
						Updates(map[string]interface{}{
							"is_caught":    row.IsCaught,
							"is_wanted":    row.IsWanted,
							"is_for_trade": row.IsForTrade,
							"registered":   row.Registered,
							"most_wanted":  row.MostWanted,
						})
					if updateResult.Error != nil {
						return updateResult.Error
					}
					if updateResult.RowsAffected > 0 {
						stats.Updated += updateResult.RowsAffected
					}
				}

				deletedTags, upsertedTags, err := syncInstanceTagsForInstance(
					db,
					row.UserID,
					row.InstanceID,
					row.CaughtTags,
					row.TradeTags,
					row.WantedTags,
				)
				if err != nil {
					return err
				}
				stats.TagRowsDeleted += deletedTags
				stats.TagRowsUpserted += upsertedTags
			}

			if batch%25 == 0 {
				fmt.Printf(
					"progress: batch=%d scanned=%d normalized=%d updated=%d deleted=%d elapsed=%s\n",
					batch,
					stats.Scanned,
					stats.NormalizedOwnership,
					stats.Updated,
					stats.Deleted,
					time.Since(start).Round(time.Second),
				)
			}

			return nil
		}).Error
		if err != nil {
			fmt.Fprintf(os.Stderr, "backfill failed during instance pass: %v\n", err)
			os.Exit(1)
		}
	}

	res := db.Exec(`
INSERT IGNORE INTO registrations (user_id, variant_id)
SELECT DISTINCT user_id, variant_id
FROM instances
WHERE variant_id IS NOT NULL
  AND variant_id <> ''
  AND (is_caught = 1 OR registered = 1)
`)
	if res.Error != nil {
		fmt.Fprintf(os.Stderr, "backfill failed during registration sync: %v\n", res.Error)
		os.Exit(1)
	}
	stats.RegistrationsRowsAdded = res.RowsAffected

	insertedTags, err := ensureDefaultTags(db)
	if err != nil {
		fmt.Fprintf(os.Stderr, "backfill failed during default tags creation: %v\n", err)
		os.Exit(1)
	}
	stats.DefaultTagsInserted = insertedTags

	deletedLinks, insertedLinks, err := backfillDefaultInstanceTagLinks(db)
	if err != nil {
		fmt.Fprintf(os.Stderr, "backfill failed during default instance_tags sync: %v\n", err)
		os.Exit(1)
	}
	stats.DefaultLinksDeleted = deletedLinks
	stats.DefaultLinksInserted = insertedLinks

	fmt.Printf("backfill complete in %s\n", time.Since(start).Round(time.Millisecond))
	fmt.Printf("instances scanned: %d\n", stats.Scanned)
	fmt.Printf("ownership normalized: %d\n", stats.NormalizedOwnership)
	fmt.Printf("instances updated: %d\n", stats.Updated)
	fmt.Printf("instances deleted (0/0/0): %d\n", stats.Deleted)
	fmt.Printf("instance_tags deleted: %d\n", stats.TagRowsDeleted)
	fmt.Printf("instance_tags upserted: %d\n", stats.TagRowsUpserted)
	fmt.Printf("registrations inserted: %d\n", stats.RegistrationsRowsAdded)
	fmt.Printf("default tags inserted: %d\n", stats.DefaultTagsInserted)
	fmt.Printf("default instance_tags deleted: %d\n", stats.DefaultLinksDeleted)
	fmt.Printf("default instance_tags inserted: %d\n", stats.DefaultLinksInserted)
}

func openDBWithFallbackHosts() (*gorm.DB, string, error) {
	user := strings.TrimSpace(os.Getenv("DB_USER"))
	pass := os.Getenv("DB_PASSWORD")
	host := strings.TrimSpace(os.Getenv("DB_HOSTNAME"))
	port := strings.TrimSpace(os.Getenv("DB_PORT"))
	name := strings.TrimSpace(os.Getenv("DB_NAME"))

	if user == "" || pass == "" || port == "" || name == "" {
		return nil, "", fmt.Errorf("missing one or more required env vars: DB_USER, DB_PASSWORD, DB_PORT, DB_NAME")
	}

	hostCandidates := []string{}
	if host != "" {
		hostCandidates = append(hostCandidates, host)
	}
	for _, fallback := range []string{"127.0.0.1", "localhost"} {
		if !contains(hostCandidates, fallback) {
			hostCandidates = append(hostCandidates, fallback)
		}
	}

	var lastErr error
	for _, candidate := range hostCandidates {
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
			user, pass, candidate, port, name)
		db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
			Logger: logger.Default.LogMode(logger.Silent),
		})
		if err != nil {
			lastErr = err
			continue
		}
		sqlDB, err := db.DB()
		if err != nil {
			lastErr = err
			continue
		}
		if err := sqlDB.Ping(); err != nil {
			lastErr = err
			continue
		}
		return db, candidate, nil
	}

	return nil, "", lastErr
}

func contains(values []string, v string) bool {
	for _, x := range values {
		if x == v {
			return true
		}
	}
	return false
}

func hasArg(arg string) bool {
	for _, a := range os.Args[1:] {
		if strings.EqualFold(strings.TrimSpace(a), arg) {
			return true
		}
	}
	return false
}

func ensureDefaultTags(db *gorm.DB) (int64, error) {
	type defaultTag struct {
		Parent string
		Name   string
		Color  string
		Sort   int
	}

	defs := []defaultTag{
		{Parent: "caught", Name: "Favorite", Color: "#facc15", Sort: 10},
		{Parent: "trade", Name: "For Trade", Color: "#22c55e", Sort: 20},
		{Parent: "wanted", Name: "Wanted", Color: "#3b82f6", Sort: 30},
		{Parent: "wanted", Name: "Most Wanted", Color: "#ef4444", Sort: 40},
	}

	var total int64
	for _, def := range defs {
		res := db.Exec(`
INSERT INTO tags (tag_id, user_id, parent, name, color, sort, created_at)
SELECT UUID(), u.user_id, ?, ?, ?, ?, NOW(6)
FROM (SELECT DISTINCT user_id FROM instances) u
LEFT JOIN tags t
  ON t.user_id = u.user_id
 AND t.parent = ?
 AND t.name = ?
WHERE t.tag_id IS NULL
`, def.Parent, def.Name, def.Color, def.Sort, def.Parent, def.Name)
		if res.Error != nil {
			return total, res.Error
		}
		total += res.RowsAffected
	}
	return total, nil
}

func backfillDefaultInstanceTagLinks(db *gorm.DB) (deleted int64, inserted int64, err error) {
	type linkDef struct {
		Parent    string
		Name      string
		Condition string
	}

	defs := []linkDef{
		{Parent: "caught", Name: "Favorite", Condition: "i.favorite = 1"},
		{Parent: "trade", Name: "For Trade", Condition: "i.is_for_trade = 1"},
		{Parent: "wanted", Name: "Wanted", Condition: "i.is_wanted = 1"},
		{Parent: "wanted", Name: "Most Wanted", Condition: "i.most_wanted = 1"},
	}

	for _, def := range defs {
		delRes := db.Exec(`
DELETE it
FROM instance_tags it
JOIN tags t
  ON t.tag_id = it.tag_id
JOIN instances i
  ON i.instance_id = it.instance_id
WHERE t.parent = ?
  AND t.name = ?
  AND NOT (`+def.Condition+`)
`, def.Parent, def.Name)
		if delRes.Error != nil {
			return deleted, inserted, delRes.Error
		}
		deleted += delRes.RowsAffected

		insRes := db.Exec(`
INSERT IGNORE INTO instance_tags (tag_id, instance_id, user_id, created_at)
SELECT t.tag_id, i.instance_id, i.user_id, NOW(6)
FROM instances i
JOIN tags t
  ON t.user_id = i.user_id
 AND t.parent = ?
 AND t.name = ?
WHERE `+def.Condition, def.Parent, def.Name)
		if insRes.Error != nil {
			return deleted, inserted, insRes.Error
		}
		inserted += insRes.RowsAffected
	}

	return deleted, inserted, nil
}

func normalizeOwnershipState(
	isCaught bool,
	isWanted bool,
	isForTrade bool,
	registered bool,
	mostWanted bool,
) (bool, bool, bool, bool, bool) {
	if !isCaught && isForTrade {
		isForTrade = false
	}
	if isCaught && isWanted && !isForTrade {
		isCaught = false
		registered = true
	}
	if isCaught && isForTrade && isWanted {
		isWanted = false
	}
	if isCaught && !registered {
		registered = true
	}
	if mostWanted && !isWanted {
		mostWanted = false
	}
	return isCaught, isWanted, isForTrade, registered, mostWanted
}

func syncInstanceTagsForInstance(
	db *gorm.DB,
	userID string,
	instanceID string,
	caughtTagsJSON string,
	tradeTagsJSON string,
	wantedTagsJSON string,
) (deletedRows int64, upsertedRows int64, err error) {
	instanceID = strings.TrimSpace(instanceID)
	userID = strings.TrimSpace(userID)
	if instanceID == "" {
		return 0, 0, nil
	}

	tagIDs := mergeUniqueTagIDs(
		extractTagIDsFromJSON(caughtTagsJSON),
		extractTagIDsFromJSON(tradeTagsJSON),
		extractTagIDsFromJSON(wantedTagsJSON),
	)

	if len(tagIDs) == 0 {
		res := db.Where("instance_id = ?", instanceID).Delete(&InstanceTag{})
		return res.RowsAffected, 0, res.Error
	}

	validTagIDs, err := filterValidUserTagIDs(db, userID, tagIDs)
	if err != nil {
		return 0, 0, err
	}
	if len(validTagIDs) == 0 {
		res := db.Where("instance_id = ?", instanceID).Delete(&InstanceTag{})
		return res.RowsAffected, 0, res.Error
	}

	delRes := db.
		Where("instance_id = ? AND tag_id NOT IN ?", instanceID, validTagIDs).
		Delete(&InstanceTag{})
	if delRes.Error != nil {
		return 0, 0, delRes.Error
	}

	rows := make([]InstanceTag, 0, len(validTagIDs))
	for _, tagID := range validTagIDs {
		rows = append(rows, InstanceTag{
			TagID:      tagID,
			InstanceID: instanceID,
			UserID:     userID,
		})
	}

	upRes := db.
		Clauses(clause.OnConflict{
			Columns: []clause.Column{
				{Name: "tag_id"},
				{Name: "instance_id"},
			},
			DoUpdates: clause.Assignments(map[string]interface{}{
				"user_id": userID,
			}),
		}).
		Create(&rows)
	if upRes.Error != nil {
		return delRes.RowsAffected, 0, upRes.Error
	}

	return delRes.RowsAffected, upRes.RowsAffected, nil
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

func filterValidUserTagIDs(db *gorm.DB, userID string, tagIDs []string) ([]string, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" || len(tagIDs) == 0 {
		return nil, nil
	}

	var valid []string
	if err := db.
		Table("tags").
		Where("user_id = ? AND deleted_at IS NULL AND tag_id IN ?", userID, tagIDs).
		Pluck("tag_id", &valid).
		Error; err != nil {
		return nil, err
	}
	return valid, nil
}
