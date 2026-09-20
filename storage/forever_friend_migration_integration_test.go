package main

import (
	"database/sql"
	"os"
	"strings"
	"testing"

	"storage/migrations"
)

func TestMigrationsAllowForeverFriendTrades(t *testing.T) {
	dsn := os.Getenv("STORAGE_TEST_MYSQL_DSN")
	if dsn == "" {
		t.Skip("STORAGE_TEST_MYSQL_DSN is not configured")
	}

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		t.Fatalf("open test MySQL: %v", err)
	}

	tables := []string{
		"DROP TABLE IF EXISTS storage_schema_migrations",
		"DROP TABLE IF EXISTS pokemon_rankings_snapshot",
		"DROP TABLE IF EXISTS pokemon_variant_rankings",
		"DROP TABLE IF EXISTS trades",
		"DROP TABLE IF EXISTS instances",
		"DROP TABLE IF EXISTS processed_sync_batches",
		"DROP TABLE IF EXISTS application_outbox",
		"DROP TABLE IF EXISTS user_blocks",
		"DROP TABLE IF EXISTS friendships",
		"DROP TABLE IF EXISTS user_preferences",
		"DROP TABLE IF EXISTS user_profiles",
	}
	for _, statement := range append(tables, []string{
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
		`CREATE TABLE trades (
			trade_id VARCHAR(191) PRIMARY KEY,
			user_id_proposed VARCHAR(191) NOT NULL,
			user_id_accepting VARCHAR(191) NOT NULL,
			last_update BIGINT NULL,
			trade_friendship_level ENUM('Good', 'Great', 'Ultra', 'Best')
				NOT NULL DEFAULT 'Good'
		) ENGINE=InnoDB`,
	}...) {
		if _, err := db.Exec(statement); err != nil {
			t.Fatalf("prepare test schema with %q: %v", statement, err)
		}
	}
	t.Cleanup(func() {
		for _, statement := range tables {
			_, _ = db.Exec(statement)
		}
		_ = db.Close()
	})

	if err := migrations.Apply(dsn); err != nil {
		t.Fatalf("apply migrations: %v", err)
	}

	var columnType string
	if err := db.QueryRow(`
		SELECT column_type
		FROM information_schema.columns
		WHERE table_schema = DATABASE()
		  AND table_name = 'trades'
		  AND column_name = 'trade_friendship_level'
	`).Scan(&columnType); err != nil {
		t.Fatalf("read migrated friendship column: %v", err)
	}
	if !strings.Contains(columnType, "'Forever'") {
		t.Fatalf("Forever friendship label missing after migration: %s", columnType)
	}

	if _, err := db.Exec(
		"INSERT INTO trades (trade_id, user_id_proposed, user_id_accepting, trade_friendship_level) VALUES (?, ?, ?, ?)",
		"forever-trade",
		"trainer-one",
		"trainer-two",
		"Forever",
	); err != nil {
		t.Fatalf("insert Forever Friend trade after migration: %v", err)
	}
}
