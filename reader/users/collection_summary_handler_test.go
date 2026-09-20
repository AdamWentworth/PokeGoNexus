package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/gofiber/fiber/v3"
)

func TestGetOwnCollectionSummaryHandler(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	app := newHandlerTestApp("user-123")
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT
			COALESCE(SUM(CASE WHEN is_caught = TRUE OR is_for_trade = TRUE THEN 1 ELSE 0 END), 0) AS collection_total,
			COALESCE(SUM(CASE WHEN is_caught = TRUE THEN 1 ELSE 0 END), 0) AS caught,
			COALESCE(SUM(CASE WHEN is_for_trade = TRUE THEN 1 ELSE 0 END), 0) AS for_trade,
			COALESCE(SUM(CASE WHEN is_wanted = TRUE THEN 1 ELSE 0 END), 0) AS wanted,
			COALESCE(SUM(CASE WHEN favorite = TRUE THEN 1 ELSE 0 END), 0) AS favorite,
			COALESCE(SUM(CASE WHEN most_wanted = TRUE THEN 1 ELSE 0 END), 0) AS most_wanted
		FROM instances
		WHERE user_id = ? AND disabled = FALSE`)).
		WithArgs("user-123").
		WillReturnRows(sqlmock.NewRows([]string{
			"collection_total", "caught", "for_trade", "wanted", "favorite", "most_wanted",
		}).AddRow(24, 20, 4, 7, 3, 2))

	response, err := app.Test(
		httptest.NewRequest(http.MethodGet, "/api/collection/summary", nil),
		fiber.TestConfig{Timeout: 0},
	)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if response.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want %d", response.StatusCode, http.StatusOK)
	}

	var body CollectionSummary
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body.CollectionTotal != 24 || body.Caught != 20 || body.ForTrade != 4 ||
		body.Wanted != 7 || body.Favorite != 3 || body.MostWanted != 2 {
		t.Fatalf("unexpected summary: %+v", body)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet database expectations: %v", err)
	}
}

func TestGetOwnCollectionSummaryHandlerRequiresUser(t *testing.T) {
	app := newHandlerTestApp("")
	response, err := app.Test(
		httptest.NewRequest(http.MethodGet, "/api/collection/summary", nil),
		fiber.TestConfig{Timeout: 0},
	)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if response.StatusCode != http.StatusUnauthorized {
		t.Fatalf("unexpected status: got %d, want %d", response.StatusCode, http.StatusUnauthorized)
	}
}
