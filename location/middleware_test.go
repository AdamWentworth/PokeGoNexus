package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gofiber/fiber/v3"
)

func TestInitAllowedOrigins_Defaults(t *testing.T) {
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
			t.Fatalf("expected default origin %q", origin)
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
	app.Get("/ok", func(c fiber.Ctx) error { return c.SendStatus(fiber.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/ok", nil)
	req.Header.Set("Origin", "https://app.example.com")
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "https://app.example.com" {
		t.Fatalf("unexpected ACAO header: %q", got)
	}
}

func TestCORSMiddleware_DisallowedOrigin(t *testing.T) {
	t.Setenv("ALLOWED_ORIGINS", "https://app.example.com")
	initAllowedOrigins()

	app := fiber.New()
	app.Use(corsMiddleware)
	app.Get("/ok", func(c fiber.Ctx) error { return c.SendStatus(fiber.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/ok", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("expected empty ACAO header, got %q", got)
	}
}
