// middleware.go

package main

import (
	"os"
	"strings"

	"github.com/gofiber/fiber/v3"
)

var allowedOrigins map[string]struct{}

func initAllowedOrigins() {
	originsCSV := strings.TrimSpace(os.Getenv("ALLOWED_ORIGINS"))
	if originsCSV == "" {
		originsCSV = "http://localhost:3000,http://127.0.0.1:3000,https://pokegonexus.com,https://www.pokegonexus.com"
	}

	allowedOrigins = make(map[string]struct{})
	for _, origin := range strings.Split(originsCSV, ",") {
		o := strings.TrimSpace(origin)
		if o != "" {
			allowedOrigins[o] = struct{}{}
		}
	}
}

func corsMiddleware(c fiber.Ctx) error {
	origin := c.Get("Origin")
	if origin != "" {
		if _, ok := allowedOrigins[origin]; ok {
			c.Set("Access-Control-Allow-Origin", origin)
		}
	}

	c.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	c.Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, Cache-Control")
	c.Set("Access-Control-Allow-Credentials", "true")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")

	if c.Method() == fiber.MethodOptions {
		return c.SendStatus(fiber.StatusNoContent)
	}

	return c.Next()
}
