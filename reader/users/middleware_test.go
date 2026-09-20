package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gofiber/fiber/v3"
)

func TestInitAllowedOrigins_FromEnv(t *testing.T) {
	t.Setenv("ALLOWED_ORIGINS", "https://a.example.com, https://b.example.com")
	initAllowedOrigins()

	if _, ok := allowedOrigins["https://a.example.com"]; !ok {
		t.Fatalf("expected https://a.example.com in allow list")
	}
	if _, ok := allowedOrigins["https://b.example.com"]; !ok {
		t.Fatalf("expected https://b.example.com in allow list")
	}
	if _, ok := allowedOrigins["https://pokegonexus.com"]; ok {
		t.Fatalf("unexpected canonical default origin present when ALLOWED_ORIGINS is set")
	}
	if _, ok := allowedOrigins["https://pokemongonexus.com"]; ok {
		t.Fatalf("unexpected legacy default origin present when ALLOWED_ORIGINS is set")
	}
}

func TestInitAllowedOrigins_DefaultsWhenUnset(t *testing.T) {
	_ = os.Unsetenv("ALLOWED_ORIGINS")
	initAllowedOrigins()

	defaults := []string{
		"http://localhost:3000",
		"http://127.0.0.1:3000",
		"https://pokegonexus.com",
		"https://www.pokegonexus.com",
	}

	for _, origin := range defaults {
		if _, ok := allowedOrigins[origin]; !ok {
			t.Fatalf("expected default origin %s in allow list", origin)
		}
	}
	if _, ok := allowedOrigins["https://pokemongonexus.com"]; ok {
		t.Fatal("legacy origin must not be enabled by default")
	}
}

func TestCORSMiddleware_AllowedOrigin(t *testing.T) {
	t.Setenv("ALLOWED_ORIGINS", "https://app.example.com")
	initAllowedOrigins()

	app := fiber.New()
	app.Use(corsMiddleware)
	app.Get("/ping", func(c fiber.Ctx) error { return c.SendStatus(fiber.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	req.Header.Set("Origin", "https://app.example.com")

	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want 200", resp.StatusCode)
	}
	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "https://app.example.com" {
		t.Fatalf("unexpected ACAO header: got %q", got)
	}
}

func TestCORSMiddleware_DisallowedOrigin(t *testing.T) {
	t.Setenv("ALLOWED_ORIGINS", "https://app.example.com")
	initAllowedOrigins()

	app := fiber.New()
	app.Use(corsMiddleware)
	app.Get("/ping", func(c fiber.Ctx) error { return c.SendStatus(fiber.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	req.Header.Set("Origin", "https://evil.example.com")

	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want 200", resp.StatusCode)
	}
	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("expected empty ACAO header for disallowed origin, got %q", got)
	}
}

func TestCORSMiddleware_OPTIONSShortCircuit(t *testing.T) {
	t.Setenv("ALLOWED_ORIGINS", "https://app.example.com")
	initAllowedOrigins()

	app := fiber.New()
	app.Use(corsMiddleware)
	app.Get("/ping", func(c fiber.Ctx) error { return c.SendStatus(fiber.StatusOK) })

	req := httptest.NewRequest(http.MethodOptions, "/ping", nil)
	req.Header.Set("Origin", "https://app.example.com")

	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("unexpected status: got %d, want 204", resp.StatusCode)
	}
}
