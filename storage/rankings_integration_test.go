package main

import (
	"database/sql"
	"os"
	"testing"

	"storage/migrations"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func TestRankingsAggregationCountsDistinctUsers(t *testing.T) {
	dsn := os.Getenv("STORAGE_TEST_MYSQL_DSN")
	if dsn == "" {
		t.Skip("STORAGE_TEST_MYSQL_DSN is not configured")
	}

	sqlDB, err := sql.Open("mysql", dsn)
	if err != nil {
		t.Fatalf("open test MySQL: %v", err)
	}

	for _, statement := range []string{
		"DROP TABLE IF EXISTS pokemon_rankings_snapshot",
		"DROP TABLE IF EXISTS pokemon_variant_rankings",
		"DROP TABLE IF EXISTS storage_schema_migrations",
		"DROP TABLE IF EXISTS instances",
		`CREATE TABLE instances (
			instance_id VARCHAR(191) PRIMARY KEY,
			user_id VARCHAR(191) NOT NULL,
			variant_id VARCHAR(191) NULL,
			is_wanted BOOLEAN NOT NULL DEFAULT FALSE,
			most_wanted BOOLEAN NOT NULL DEFAULT FALSE,
			is_caught BOOLEAN NOT NULL DEFAULT FALSE,
			favorite BOOLEAN NOT NULL DEFAULT FALSE,
			is_for_trade BOOLEAN NOT NULL DEFAULT FALSE,
			registered BOOLEAN NOT NULL DEFAULT FALSE,
			disabled BOOLEAN NOT NULL DEFAULT FALSE
		) ENGINE=InnoDB`,
	} {
		if _, err := sqlDB.Exec(statement); err != nil {
			t.Fatalf("prepare test schema with %q: %v", statement, err)
		}
	}
	t.Cleanup(func() {
		for _, table := range []string{
			"pokemon_rankings_snapshot",
			"pokemon_variant_rankings",
			"storage_schema_migrations",
			"instances",
		} {
			_, _ = sqlDB.Exec("DROP TABLE IF EXISTS " + table)
		}
		_ = sqlDB.Close()
	})

	if err := migrations.Apply(dsn); err != nil {
		t.Fatalf("apply migrations: %v", err)
	}
	gormDB, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open GORM test connection: %v", err)
	}

	rows := []struct {
		instanceID string
		userID     string
		variantID  string
		wanted     bool
		mostWanted bool
		caught     bool
		registered bool
		disabled   bool
	}{
		{"a-1", "trainer-a", "pikachu-shiny", true, true, true, true, false},
		{"a-2", "trainer-a", "pikachu-shiny", true, true, true, true, false},
		{"b-1", "trainer-b", "pikachu-shiny", true, false, false, true, false},
		{"c-1", "trainer-c", "bulbasaur-default", true, false, true, true, false},
		{"d-1", "trainer-d", "bulbasaur-default", false, false, true, true, false},
		{"hidden", "trainer-e", "pikachu-shiny", true, true, true, true, true},
	}
	for _, row := range rows {
		if err := gormDB.Exec(
			`INSERT INTO instances
				(instance_id, user_id, variant_id, is_wanted, most_wanted, is_caught, registered, disabled)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			row.instanceID,
			row.userID,
			row.variantID,
			row.wanted,
			row.mostWanted,
			row.caught,
			row.registered,
			row.disabled,
		).Error; err != nil {
			t.Fatalf("insert %s: %v", row.instanceID, err)
		}
	}

	if err := refreshAllRankings(gormDB); err != nil {
		t.Fatalf("refreshAllRankings: %v", err)
	}

	var pikachu PokemonVariantRanking
	if err := gormDB.First(&pikachu, "variant_id = ?", "pikachu-shiny").Error; err != nil {
		t.Fatalf("load Pikachu aggregate: %v", err)
	}
	if pikachu.CaughtUserCount != 2 ||
		pikachu.WantedUserCount != 2 ||
		pikachu.MostWantedUserCount != 1 {
		t.Fatalf("Pikachu aggregate counts duplicate/disabled rows incorrectly: %#v", pikachu)
	}

	var bulbasaur PokemonVariantRanking
	if err := gormDB.First(&bulbasaur, "variant_id = ?", "bulbasaur-default").Error; err != nil {
		t.Fatalf("load Bulbasaur aggregate: %v", err)
	}
	if bulbasaur.CaughtUserCount != 2 || bulbasaur.WantedUserCount != 1 {
		t.Fatalf("unexpected Bulbasaur aggregate: %#v", bulbasaur)
	}

	var snapshot PokemonRankingsSnapshot
	if err := gormDB.First(&snapshot, "snapshot_key = 1").Error; err != nil {
		t.Fatalf("load rankings snapshot: %v", err)
	}
	if snapshot.CollectorUserCount != 4 || snapshot.WishlistUserCount != 3 {
		t.Fatalf(
			"snapshot should count caught or registered collectors and wanted users distinctly: %#v",
			snapshot,
		)
	}

	if err := gormDB.Exec(
		"UPDATE instances SET is_caught = FALSE, registered = FALSE, is_wanted = FALSE WHERE variant_id = ?",
		"bulbasaur-default",
	).Error; err != nil {
		t.Fatalf("clear Bulbasaur ownership: %v", err)
	}
	if err := refreshRankingsForVariants(gormDB, []string{"bulbasaur-default"}); err != nil {
		t.Fatalf("refreshRankingsForVariants: %v", err)
	}
	if err := gormDB.First(&bulbasaur, "variant_id = ?", "bulbasaur-default").Error; err != nil {
		t.Fatalf("load cleared Bulbasaur aggregate: %v", err)
	}
	if bulbasaur.CaughtUserCount != 0 || bulbasaur.WantedUserCount != 0 {
		t.Fatalf("stale incremental aggregate: %#v", bulbasaur)
	}
}
