package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v4"
)

func TestVerifyAccessToken_Success(t *testing.T) {
	jwtSecret = "test-secret"
	token := newAccessTokenForTest(t, jwt.SigningMethodHS256, AccessTokenClaims{
		UserID:   "user-1",
		Username: "ash",
		DeviceID: "device-1",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
		},
	})

	app := fiber.New()
	app.Get("/", func(c fiber.Ctx) error {
		userID, username, deviceID, err := verifyAccessToken(c)
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{
			"user_id":   userID,
			"username":  username,
			"device_id": deviceID,
		})
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(&http.Cookie{Name: "accessToken", Value: token})
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.StatusCode)
	}
}

func TestVerifyAccessToken_AcceptsAuthorizationHeader(t *testing.T) {
	jwtSecret = "test-secret"
	token := newAccessTokenForTest(t, jwt.SigningMethodHS256, AccessTokenClaims{
		UserID:   "user-mobile",
		Username: "misty",
		DeviceID: "device-mobile",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
		},
	})

	app := fiber.New()
	app.Get("/", func(c fiber.Ctx) error {
		userID, _, _, err := verifyAccessToken(c)
		if err != nil {
			return err
		}
		return c.SendString(userID)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.StatusCode)
	}
}

func TestVerifyAccessToken_RejectsWrongAlgorithm(t *testing.T) {
	jwtSecret = "test-secret"
	token := newAccessTokenForTest(t, jwt.SigningMethodHS512, AccessTokenClaims{
		UserID:   "user-1",
		Username: "ash",
		DeviceID: "device-1",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
		},
	})

	status := verifyTokenStatusForTest(t, token)
	if status != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", status)
	}
}

func TestVerifyAccessToken_RejectsMissingExpiry(t *testing.T) {
	jwtSecret = "test-secret"
	token := newAccessTokenForTest(t, jwt.SigningMethodHS256, AccessTokenClaims{
		UserID:   "user-1",
		Username: "ash",
		DeviceID: "device-1",
	})

	status := verifyTokenStatusForTest(t, token)
	if status != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", status)
	}
}

func TestVerifyAccessToken_RejectsMissingDeviceID(t *testing.T) {
	jwtSecret = "test-secret"
	token := newAccessTokenForTest(t, jwt.SigningMethodHS256, AccessTokenClaims{
		UserID:   "user-1",
		Username: "ash",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
		},
	})

	status := verifyTokenStatusForTest(t, token)
	if status != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", status)
	}
}

func verifyTokenStatusForTest(t *testing.T, token string) int {
	t.Helper()

	app := fiber.New()
	app.Get("/", func(c fiber.Ctx) error {
		_, _, _, err := verifyAccessToken(c)
		if err != nil {
			return err
		}
		return c.SendStatus(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(&http.Cookie{Name: "accessToken", Value: token})
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	return resp.StatusCode
}

func newAccessTokenForTest(t *testing.T, method jwt.SigningMethod, claims AccessTokenClaims) string {
	t.Helper()

	token := jwt.NewWithClaims(method, claims)
	signed, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		t.Fatalf("signed token: %v", err)
	}
	return signed
}
