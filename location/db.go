// db.go

package main

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sirupsen/logrus"
)

func ConnectDB(dsn string) *pgxpool.Pool {
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		logrus.Fatalf("Unable to parse database DSN: %v", err)
	}

	config.MaxConns = readEnvInt32WithDefault("DB_MAX_OPEN_CONNS", 25)
	config.MinConns = readEnvInt32WithDefault("DB_MIN_IDLE_CONNS", 2)
	config.MaxConnIdleTime = time.Duration(readEnvIntWithDefault("DB_CONN_MAX_IDLE_MIN", 10)) * time.Minute
	config.MaxConnLifetime = time.Duration(readEnvIntWithDefault("DB_CONN_MAX_LIFETIME_MIN", 60)) * time.Minute
	config.HealthCheckPeriod = 30 * time.Second
	config.ConnConfig.ConnectTimeout = time.Duration(readEnvIntWithDefault("DB_CONNECT_TIMEOUT_SEC", 5)) * time.Second

	logrus.Info("Attempting to connect to the database...")
	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		logrus.Fatalf("Unable to connect to database: %v\n", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := pool.Ping(ctx); err != nil {
		logrus.Fatalf("Database ping failed: %v", err)
	}
	logrus.Info("Successfully connected to the database.")
	return pool
}
