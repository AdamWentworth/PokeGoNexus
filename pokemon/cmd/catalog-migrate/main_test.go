package main

import "testing"

func TestConfiguredDatabaseURLPrefersFlag(t *testing.T) {
	t.Setenv("CATALOG_PUBLISHER_DATABASE_URL", "postgres://environment")

	if got := configuredDatabaseURL("  postgres://flag  "); got != "postgres://flag" {
		t.Fatalf("configuredDatabaseURL() = %q, want flag value", got)
	}
}

func TestConfiguredDatabaseURLFallsBackToEnvironment(t *testing.T) {
	t.Setenv("CATALOG_PUBLISHER_DATABASE_URL", "  postgres://environment  ")

	if got := configuredDatabaseURL(""); got != "postgres://environment" {
		t.Fatalf("configuredDatabaseURL() = %q, want environment value", got)
	}
}

func TestConfiguredDatabaseURLCanRemainEmpty(t *testing.T) {
	t.Setenv("CATALOG_PUBLISHER_DATABASE_URL", "")

	if got := configuredDatabaseURL("   "); got != "" {
		t.Fatalf("configuredDatabaseURL() = %q, want empty value", got)
	}
}
