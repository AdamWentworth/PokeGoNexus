package main

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v4"
)

func signAccessToken(t *testing.T, secret []byte, method jwt.SigningMethod, claims AccessTokenClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(method, claims)
	signed, err := token.SignedString(secret)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return signed
}

func TestVerifyJWT_OK(t *testing.T) {
	jwtSecret = []byte("test-secret")
	app := fiber.New()
	app.Get("/ok", verifyJWT, func(c fiber.Ctx) error {
		return c.SendString(c.Locals("user_id").(string))
	})

	token := signAccessToken(t, jwtSecret, jwt.SigningMethodHS256, AccessTokenClaims{
		UserID: "u1",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
		},
	})
	req := httptest.NewRequest("GET", "/ok", nil)
	req.Header.Set("Cookie", "accessToken="+token)

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}

func TestVerifyJWT_AcceptsAuthorizationHeader(t *testing.T) {
	jwtSecret = []byte("test-secret")
	app := fiber.New()
	app.Get("/ok", verifyJWT, func(c fiber.Ctx) error {
		return c.SendString(c.Locals("user_id").(string))
	})

	token := signAccessToken(t, jwtSecret, jwt.SigningMethodHS256, AccessTokenClaims{
		UserID: "mobile-user",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
		},
	})
	req := httptest.NewRequest("GET", "/ok", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}

func TestVerifyJWT_MissingCookie(t *testing.T) {
	jwtSecret = []byte("test-secret")
	app := fiber.New()
	app.Get("/ok", verifyJWT, func(c fiber.Ctx) error { return c.SendStatus(fiber.StatusOK) })

	req := httptest.NewRequest("GET", "/ok", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != fiber.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
}

func TestVerifyJWT_InvalidAlg(t *testing.T) {
	jwtSecret = []byte("test-secret")
	app := fiber.New()
	app.Get("/ok", verifyJWT, func(c fiber.Ctx) error { return c.SendStatus(fiber.StatusOK) })

	token := signAccessToken(t, jwtSecret, jwt.SigningMethodHS512, AccessTokenClaims{
		UserID: "u1",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
		},
	})

	req := httptest.NewRequest("GET", "/ok", nil)
	req.Header.Set("Cookie", "accessToken="+token)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != fiber.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
}

func TestVerifyJWT_Expired(t *testing.T) {
	jwtSecret = []byte("test-secret")
	app := fiber.New()
	app.Get("/ok", verifyJWT, func(c fiber.Ctx) error { return c.SendStatus(fiber.StatusOK) })

	token := signAccessToken(t, jwtSecret, jwt.SigningMethodHS256, AccessTokenClaims{
		UserID: "u1",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Minute)),
		},
	})
	req := httptest.NewRequest("GET", "/ok", nil)
	req.Header.Set("Cookie", "accessToken="+token)

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != fiber.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
}

func TestVerifyJWT_MissingUserID(t *testing.T) {
	jwtSecret = []byte("test-secret")
	app := fiber.New()
	app.Get("/ok", verifyJWT, func(c fiber.Ctx) error { return c.SendStatus(fiber.StatusOK) })

	token := signAccessToken(t, jwtSecret, jwt.SigningMethodHS256, AccessTokenClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
		},
	})
	req := httptest.NewRequest("GET", "/ok", nil)
	req.Header.Set("Cookie", "accessToken="+token)

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != fiber.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
}
