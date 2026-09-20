// config.go

package main

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
	"github.com/sirupsen/logrus"
)

type Config struct {
	DBUser     string
	DBHost     string
	DBName     string
	DBPassword string
	DBPort     string
	ServerPort string
}

func initEnv() {
	if err := godotenv.Load(".env"); err != nil {
		logrus.Infof("No .env file found at .env, relying on OS environment")
		return
	}
	logrus.Info("Environment variables loaded successfully.")
}

func readPort() string {
	serverPort := os.Getenv("PORT")
	if serverPort == "" {
		serverPort = os.Getenv("SERVER_PORT")
	}
	if serverPort == "" {
		serverPort = "3007"
	}
	return serverPort
}

func readEnvIntWithDefault(key string, fallback int) int {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}

func readEnvInt32WithDefault(key string, fallback int32) int32 {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	n, err := strconv.ParseInt(raw, 10, 32)
	if err != nil || n <= 0 {
		return fallback
	}
	return int32(n)
}

func LoadConfig() *Config {
	serverPort := readPort()

	config := &Config{
		DBUser:     os.Getenv("DB_USER"),
		DBHost:     os.Getenv("DB_HOST"),
		DBName:     os.Getenv("DB_NAME"),
		DBPassword: os.Getenv("DB_PASSWORD"),
		DBPort:     os.Getenv("DB_PORT"),
		ServerPort: serverPort,
	}

	if config.DBPort == "" {
		config.DBPort = "5432"
	}

	logrus.Infof("Configuration loaded: DBUser=%s DBHost=%s DBName=%s DBPort=%s ServerPort=%s",
		config.DBUser, config.DBHost, config.DBName, config.DBPort, config.ServerPort)
	return config
}

func (c *Config) GetDSN() string {
	dsn := fmt.Sprintf("postgres://%s:*****@%s:%s/%s",
		c.DBUser, c.DBHost, c.DBPort, c.DBName)
	// Masked password in logs
	logrus.Infof("Constructed DSN (password masked): %s", dsn)
	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s",
		c.DBUser, c.DBPassword, c.DBHost, c.DBPort, c.DBName)
}
