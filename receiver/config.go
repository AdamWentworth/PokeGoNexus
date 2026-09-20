// config.go
package main

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"
	"gopkg.in/yaml.v2"
)

type KafkaConfig struct {
	Hostname      string `yaml:"hostname"`
	Port          string `yaml:"port"`
	Topic         string `yaml:"topic"`
	MaxRetries    int    `yaml:"max_retries"`
	RetryInterval int    `yaml:"retry_interval"` // in seconds
}

type AppConfig struct {
	Events KafkaConfig `yaml:"events"`
}

var kafkaConfig KafkaConfig
var jwtSecret string
var serverPort string
var allowedOrigins []string

var defaultAllowedOrigins = []string{
	"http://localhost:3000",
	"http://127.0.0.1:3000",
	"https://pokegonexus.com",
	"https://www.pokegonexus.com",
}

// Load environment variables (JWT_SECRET, HOST_IP)
func loadEnv() error {
	err := godotenv.Load(".env")
	if err != nil {
		logger.Warnf("Error loading .env: %v", err)
	}

	jwtSecret = strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if jwtSecret == "" {
		return fmt.Errorf("missing required environment variable: JWT_SECRET")
	}

	serverPort = strings.TrimSpace(os.Getenv("PORT"))
	if serverPort == "" {
		serverPort = "3003"
	}

	allowedOrigins = parseCSV(os.Getenv("ALLOWED_ORIGINS"))
	if len(allowedOrigins) == 0 {
		allowedOrigins = append([]string(nil), defaultAllowedOrigins...)
	}
	return nil
}

// Load Kafka configuration from app_conf.yml
func loadConfigFile(filePath string) error {
	data, err := os.ReadFile(filePath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			logger.Warnf("Config file not found at %s, using defaults", filePath)
			kafkaConfig = KafkaConfig{}
			applyKafkaDefaults()
			return nil
		}
		return fmt.Errorf("failed to read configuration file: %v", err)
	}

	// Unmarshal YAML into AppConfig struct
	var appConfig AppConfig
	err = yaml.Unmarshal(data, &appConfig)
	if err != nil {
		return fmt.Errorf("failed to unmarshal configuration file: %v", err)
	}

	kafkaConfig = appConfig.Events
	applyKafkaDefaults()
	return nil
}

func applyKafkaDefaults() {
	hostIP := strings.TrimSpace(os.Getenv("HOST_IP"))
	if hostIP != "" {
		kafkaConfig.Hostname = hostIP
	}

	if strings.TrimSpace(kafkaConfig.Hostname) == "" {
		kafkaConfig.Hostname = "kafka"
	}
	if strings.TrimSpace(kafkaConfig.Port) == "" {
		kafkaConfig.Port = "9092"
	}
	if strings.TrimSpace(kafkaConfig.Topic) == "" {
		kafkaConfig.Topic = "batchedUpdates"
	}
	if kafkaConfig.MaxRetries <= 0 {
		kafkaConfig.MaxRetries = 5
	}
	if kafkaConfig.RetryInterval <= 0 {
		kafkaConfig.RetryInterval = 3
	}
}

func parseCSV(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}

	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	seen := make(map[string]struct{}, len(parts))

	for _, p := range parts {
		v := strings.TrimSpace(p)
		if v == "" {
			continue
		}
		if _, exists := seen[v]; exists {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	return out
}
