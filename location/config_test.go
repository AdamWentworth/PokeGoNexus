package main

import "testing"

func TestLoadConfig_UsesPORTWhenSet(t *testing.T) {
	t.Setenv("PORT", "3999")
	t.Setenv("SERVER_PORT", "3007")
	t.Setenv("DB_USER", "u")
	t.Setenv("DB_HOST", "h")
	t.Setenv("DB_NAME", "d")
	t.Setenv("DB_PASSWORD", "p")
	t.Setenv("DB_PORT", "7777")

	cfg := LoadConfig()
	if cfg.ServerPort != "3999" {
		t.Fatalf("expected PORT to take precedence, got %q", cfg.ServerPort)
	}
}

func TestLoadConfig_DefaultPort(t *testing.T) {
	t.Setenv("PORT", "")
	t.Setenv("SERVER_PORT", "")
	t.Setenv("DB_USER", "u")
	t.Setenv("DB_HOST", "h")
	t.Setenv("DB_NAME", "d")
	t.Setenv("DB_PASSWORD", "p")

	cfg := LoadConfig()
	if cfg.ServerPort != "3007" {
		t.Fatalf("expected default port 3007, got %q", cfg.ServerPort)
	}
	if cfg.DBPort != "5432" {
		t.Fatalf("expected default DB port 5432, got %q", cfg.DBPort)
	}
}

func TestReadEnvIntWithDefault(t *testing.T) {
	t.Setenv("X_INT", "42")
	if got := readEnvIntWithDefault("X_INT", 9); got != 42 {
		t.Fatalf("expected 42, got %d", got)
	}

	t.Setenv("X_INT", "bad")
	if got := readEnvIntWithDefault("X_INT", 9); got != 9 {
		t.Fatalf("expected fallback 9, got %d", got)
	}
}

func TestReadEnvInt32WithDefault(t *testing.T) {
	t.Setenv("X_INT32", "42")
	if got := readEnvInt32WithDefault("X_INT32", 9); got != 42 {
		t.Fatalf("expected 42, got %d", got)
	}

	for _, invalid := range []string{"bad", "0", "-1", "2147483648"} {
		t.Setenv("X_INT32", invalid)
		if got := readEnvInt32WithDefault("X_INT32", 9); got != 9 {
			t.Fatalf("expected fallback for %q, got %d", invalid, got)
		}
	}
}
