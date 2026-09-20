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

// Middleware to verify the JWT
func verifyJWT(c fiber.Ctx) error {
	if len(jwtSecret) == 0 {
		logrus.Error("JWT secret is not initialized")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Server configuration error"})
	}

	tokenString := readAccessToken(c)
	if tokenString == "" {
		logrus.Warn("Authentication failed: access token missing")
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Authentication failed"})
	}
	if len(tokenString) > 8192 {
		logrus.Warn("Authentication failed: accessToken cookie too large")
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Authentication failed"})
	}

	claims := &AccessTokenClaims{}
	parser := jwt.NewParser(jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	token, err := parser.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})
	if err != nil || !token.Valid {
		logrus.Warnf("Authentication failed: invalid JWT (%v)", err)
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Authentication failed"})
	}

	if claims.ExpiresAt == nil || claims.ExpiresAt.Time.Before(time.Now()) {
		logrus.Warn("Authentication failed: JWT expired or missing exp")
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Authentication failed"})
	}
	if claims.UserID == "" {
		logrus.Warn("Authentication failed: JWT missing user_id")
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Authentication failed"})
	}

	c.Locals("user_id", claims.UserID)
	if claims.Username != "" {
		c.Locals("username", claims.Username)
	}
	if claims.DeviceID != "" {
		c.Locals("device_id", claims.DeviceID)
	}

	return c.Next()
}
