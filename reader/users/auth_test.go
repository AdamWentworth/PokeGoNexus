package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v4"
)

func makeAccessToken(t *testing.T, secret []byte, claims AccessTokenClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(secret)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}
	return signed
}

func newProtectedApp() *fiber.App {
	app := fiber.New(fiber.Config{
		ReadBufferSize: 16384,
	})
	app.Get("/protected", verifyJWT, func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"user_id":   c.Locals("user_id"),
			"username":  c.Locals("username"),
			"device_id": c.Locals("device_id"),
		})
	})
	return app
}

func TestVerifyJWT_NoSecret(t *testing.T) {
	jwtSecret = nil
	app := newProtectedApp()

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Cookie", "accessToken=anything")
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusInternalServerError {
		t.Fatalf("unexpected status: got %d, want 500", resp.StatusCode)
	}
}

func TestVerifyJWT_MissingCookie(t *testing.T) {
	jwtSecret = []byte("test-secret")
	app := newProtectedApp()

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("unexpected status: got %d, want 403", resp.StatusCode)
	}
}

func TestVerifyJWT_TooLargeCookie(t *testing.T) {
	jwtSecret = []byte("test-secret")
	app := newProtectedApp()

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Cookie", "accessToken="+strings.Repeat("a", 9000))
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("unexpected status: got %d, want 403", resp.StatusCode)
	}
}

func TestVerifyJWT_InvalidSignature(t *testing.T) {
	jwtSecret = []byte("server-secret")
	app := newProtectedApp()

	token := makeAccessToken(t, []byte("wrong-secret"), AccessTokenClaims{
		UserID:   "user-1",
		Username: "adam",
		DeviceID: "device-1",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * time.Minute)),
		},
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Cookie", "accessToken="+token)
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("unexpected status: got %d, want 403", resp.StatusCode)
	}
}

func TestVerifyJWT_ExpiredToken(t *testing.T) {
	jwtSecret = []byte("server-secret")
	app := newProtectedApp()

	token := makeAccessToken(t, jwtSecret, AccessTokenClaims{
		UserID:   "user-1",
		Username: "adam",
		DeviceID: "device-1",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Minute)),
		},
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Cookie", "accessToken="+token)
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("unexpected status: got %d, want 403", resp.StatusCode)
	}
}

func TestVerifyJWT_MissingUserIDClaim(t *testing.T) {
	jwtSecret = []byte("server-secret")
	app := newProtectedApp()

	token := makeAccessToken(t, jwtSecret, AccessTokenClaims{
		Username: "adam",
		DeviceID: "device-1",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * time.Minute)),
		},
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Cookie", "accessToken="+token)
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("unexpected status: got %d, want 403", resp.StatusCode)
	}
}

func TestVerifyJWT_ValidToken(t *testing.T) {
	jwtSecret = []byte("server-secret")
	app := newProtectedApp()

	token := makeAccessToken(t, jwtSecret, AccessTokenClaims{
		UserID:   "user-1",
		Username: "adam",
		DeviceID: "device-1",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * time.Minute)),
		},
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Cookie", "accessToken="+token)
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want 200", resp.StatusCode)
	}

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if body["user_id"] != "user-1" {
		t.Fatalf("unexpected user_id: got %q", body["user_id"])
	}
	if body["username"] != "adam" {
		t.Fatalf("unexpected username: got %q", body["username"])
	}
	if body["device_id"] != "device-1" {
		t.Fatalf("unexpected device_id: got %q", body["device_id"])
	}
}

func TestVerifyJWT_ValidAuthorizationHeader(t *testing.T) {
	jwtSecret = []byte("test-secret")
	app := newProtectedApp()

	token := makeAccessToken(t, jwtSecret, AccessTokenClaims{
		UserID:   "user-mobile",
		Username: "misty",
		DeviceID: "device-mobile",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * time.Minute)),
		},
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want 200", resp.StatusCode)
	}
}
