package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"pokemon_data/migrations"
)

func main() {
	if err := run(); err != nil {
		log.Print(err)
		os.Exit(1)
	}
}

func run() error {
	var databaseURL string
	flag.StringVar(&databaseURL, "database-url", "", "PostgreSQL catalog database URL")
	flag.Parse()

	databaseURL = configuredDatabaseURL(databaseURL)
	if strings.TrimSpace(databaseURL) == "" {
		return fmt.Errorf("--database-url or CATALOG_PUBLISHER_DATABASE_URL is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	if err := migrations.Apply(ctx, databaseURL); err != nil {
		return err
	}
	if _, err := fmt.Fprintln(os.Stdout, "Pokemon catalog schema migrations are current."); err != nil {
		return fmt.Errorf("write migration result: %w", err)
	}
	return nil
}

func configuredDatabaseURL(flagValue string) string {
	if value := strings.TrimSpace(flagValue); value != "" {
		return value
	}
	return strings.TrimSpace(os.Getenv("CATALOG_PUBLISHER_DATABASE_URL"))
}
