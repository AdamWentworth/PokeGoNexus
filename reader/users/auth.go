// auth.go

package main

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v4"
	"github.com/sirupsen/logrus"
)

type AccessTokenClaims struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	DeviceID string `json:"device_id"`
	jwt.RegisteredClaims
}

func readAccessToken(c fiber.Ctx) string {
	if token := strings.TrimSpace(c.Cookies("accessToken")); token != "" {
		return token
	}

	authorization := strings.TrimSpace(c.Get("Authorization"))
	parts := strings.SplitN(authorization, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

func accessTokenClaims(c fiber.Ctx) (*AccessTokenClaims, bool) {
	if len(jwtSecret) == 0 {
		return nil, false
	}

	tokenString := readAccessToken(c)
	if tokenString == "" || len(tokenString) > 8192 {
		return nil, false
	}

	claims := &AccessTokenClaims{}
	parser := jwt.NewParser(jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	token, err := parser.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return nil, false
	}

	if claims.ExpiresAt == nil || claims.ExpiresAt.Time.Before(time.Now()) || claims.UserID == "" {
		return nil, false
	}

	return claims, true
}

func bindClaims(c fiber.Ctx, claims *AccessTokenClaims) {
	c.Locals("user_id", claims.UserID)
	if claims.Username != "" {
		c.Locals("username", claims.Username)
	}
	if claims.DeviceID != "" {
		c.Locals("device_id", claims.DeviceID)
	}
}

// Middleware to verify the JWT.
func verifyJWT(c fiber.Ctx) error {
	if len(jwtSecret) == 0 {
		logrus.Error("JWT secret is not initialized")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Server configuration error"})
	}
	claims, ok := accessTokenClaims(c)
	if !ok {
		logrus.Warn("Authentication failed: missing, invalid, or expired JWT")
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Authentication failed"})
	}
	bindClaims(c, claims)
	return c.Next()
}

// optionalJWT adds viewer identity when a valid session is present while still
// allowing genuinely public profile and collection requests.
func optionalJWT(c fiber.Ctx) error {
	if claims, ok := accessTokenClaims(c); ok {
		bindClaims(c, claims)
	}
	return c.Next()
}
