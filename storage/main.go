// main.go

package main

import (
	"context"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/sirupsen/logrus"
)

func main() {
	// 1) Init the logger
	if err := InitLogger(); err != nil {
		panic(err)
	}

	// 2) Load environment + app configs
	if err := LoadAppConfig(".env"); err != nil {
		logrus.Fatalf("Failed to load config: %v", err)
	}

	// 3) Initialize DB
	if err := InitDB(); err != nil {
		logrus.Fatalf("Failed to initialize db: %v", err)
	}
	if err := resolveInstanceSchema(); err != nil {
		logrus.Fatalf("Failed to validate instances schema: %v", err)
	}

	// 4) Start observability server + Kafka Consumer
	ctx, cancel := context.WithCancel(context.Background())
	go startObservabilityServer(ctx)
	go StartConsumer(ctx)
	go func() {
		logrus.Info("Initial Pokemon rankings reconciliation started in the background.")
		if err := refreshAllRankings(DB); err != nil {
			logrus.Errorf("Failed to build Pokemon rankings read model: %v", err)
			return
		}
		logrus.Info("Initial Pokemon rankings reconciliation completed.")
	}()

	// 5) Scheduler
	var err error // Declare err in function scope
	c := cron.New(cron.WithLogger(cron.PrintfLogger(logrus.StandardLogger())))
	// Daily DB backups are enabled by default.
	// Set RUN_APP_BACKUPS=false to disable and delegate to host cron.
	if appBackupsEnabled() {
		_, err = c.AddFunc("0 0 * * *", CreateBackup)
		if err != nil {
			logrus.Fatalf("Failed to schedule CreateBackup: %v", err)
		}
		logrus.Info("App-owned backups are ENABLED (daily at midnight local container time).")
	} else {
		logrus.Info("App-owned backups are DISABLED via RUN_APP_BACKUPS=false. Host cron is the source of truth.")
	}
	// Schedule ReprocessFailedMessages every 5 minutes
	_, err = c.AddFunc("@every 5m", ReprocessFailedMessages)
	if err != nil {
		logrus.Fatalf("Failed to schedule ReprocessFailedMessages: %v", err)
	}
	_, err = c.AddFunc("@every 1h", func() {
		if refreshErr := refreshAllRankings(DB); refreshErr != nil {
			logrus.Errorf("Failed to reconcile Pokemon rankings read model: %v", refreshErr)
		}
	})
	if err != nil {
		logrus.Fatalf("Failed to schedule Pokemon rankings reconciliation: %v", err)
	}
	_, err = c.AddFunc("30 0 * * *", func() {
		cutoff := time.Now().UTC().Add(-30 * 24 * time.Hour)
		if cleanupErr := DB.Where("processed_at < ?", cutoff).
			Delete(&ProcessedSyncBatch{}).Error; cleanupErr != nil {
			logrus.Errorf("Failed to prune processed sync batches: %v", cleanupErr)
		}
	})
	if err != nil {
		logrus.Fatalf("Failed to schedule processed sync batch cleanup: %v", err)
	}
	c.Start()

	logrus.Info("Backup scheduler started. Scheduled jobs are running.")

	// 6) Graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	<-sigChan

	logrus.Info("Shutdown signal received...")
	cancel()
	c.Stop()
	logrus.Info("All background services stopped. Exiting now.")
}

func appBackupsEnabled() bool {
	raw := strings.TrimSpace(strings.ToLower(os.Getenv("RUN_APP_BACKUPS")))
	switch raw {
	case "false", "0", "no", "off":
		return false
	default:
		return true
	}
}
