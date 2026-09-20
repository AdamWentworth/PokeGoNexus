package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v3"
)

func TestProtectedSocialRoutesExposeCanonicalAndPrefixedPaths(t *testing.T) {
	previousSecret := jwtSecret
	jwtSecret = []byte("route-test-secret")
	defer func() {
		jwtSecret = previousSecret
	}()

	app := fiber.New()
	passthrough := func(c fiber.Ctx) error {
		return c.Next()
	}
	registerProtectedSocialRoutes(app, "/api", passthrough)
	registerProtectedSocialRoutes(app, "/api/users", passthrough)
	registerProtectedAccountRoutes(app, passthrough)

	requests := []struct {
		method string
		path   string
	}{
		{method: http.MethodGet, path: "/api/profile"},
		{method: http.MethodGet, path: "/api/tags"},
		{method: http.MethodPost, path: "/api/tags"},
		{method: http.MethodPut, path: "/api/tags/order"},
		{method: http.MethodPut, path: "/api/tags/tag-1"},
		{method: http.MethodDelete, path: "/api/tags/tag-1"},
		{method: http.MethodPut, path: "/api/profile"},
		{method: http.MethodGet, path: "/api/friends"},
		{method: http.MethodGet, path: "/api/preferences"},
		{method: http.MethodGet, path: "/api/users/profile"},
		{method: http.MethodGet, path: "/api/users/tags"},
		{method: http.MethodPut, path: "/api/users/tags/order"},
		{method: http.MethodPut, path: "/api/users/profile"},
		{method: http.MethodGet, path: "/api/users/friends"},
		{method: http.MethodGet, path: "/api/users/preferences"},
		{method: http.MethodGet, path: "/api/trades"},
		{method: http.MethodPost, path: "/api/trades/trade-1/accept"},
		{method: http.MethodGet, path: "/api/users/trades"},
		{method: http.MethodPost, path: "/api/users/trades/trade-1/complete-confirmation"},
		{method: http.MethodPut, path: "/api/users/user-1"},
		{method: http.MethodDelete, path: "/api/users/user-1"},
		{method: http.MethodGet, path: "/api/user-1/overview"},
		{method: http.MethodPut, path: "/api/user-1"},
		{method: http.MethodDelete, path: "/api/user-1"},
	}

	for _, request := range requests {
		t.Run(request.method+" "+request.path, func(t *testing.T) {
			req := httptest.NewRequest(request.method, request.path, nil)
			resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
			if err != nil {
				t.Fatalf("request failed: %v", err)
			}
			if resp.StatusCode != http.StatusForbidden {
				t.Fatalf(
					"route was not matched by auth-protected social handler: got %d, want %d",
					resp.StatusCode,
					http.StatusForbidden,
				)
			}
		})
	}
}
