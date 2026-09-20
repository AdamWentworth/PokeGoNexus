package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/gofiber/fiber/v3"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func setupMockDB(t *testing.T) (sqlmock.Sqlmock, func()) {
	t.Helper()

	sqlDB, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}

	gdb, err := gorm.Open(mysql.New(mysql.Config{
		Conn:                      sqlDB,
		SkipInitializeWithVersion: true,
	}), &gorm.Config{})
	if err != nil {
		_ = sqlDB.Close()
		t.Fatalf("failed to open gorm over sqlmock: %v", err)
	}

	prevDB := db
	db = gdb

	cleanup := func() {
		db = prevDB
		_ = sqlDB.Close()
	}

	return mock, cleanup
}

func newHandlerTestApp(authUserID string) *fiber.App {
	app := fiber.New(fiber.Config{ErrorHandler: errorHandler})

	app.Use(func(c fiber.Ctx) error {
		c.Locals("user_id", authUserID)
		return c.Next()
	})

	// Protected endpoints used in tests.
	app.Put("/api/users/:user_id", UpdateUserHandler)
	app.Delete("/api/users/:user_id", DeleteUserHandler)
	app.Put("/api/update-user/:user_id", UpdateUserHandler)
	app.Put("/api/users/update-user/:user_id", UpdateUserHandler)
	app.Get("/api/users/:user_id/overview", GetUserOverviewHandler)
	app.Get("/api/collection/summary", GetOwnCollectionSummaryHandler)
	app.Get("/api/instances/by-username/:username", GetInstancesByUsername)
	app.Get("/api/users/instances/by-username/:username", GetInstancesByUsername)
	app.Get("/api/profiles/:username", GetProfileHandler)
	app.Get("/api/profile", GetOwnProfileHandler)
	app.Put("/api/profile", UpdateProfileHandler)
	app.Get("/api/preferences", GetPreferencesHandler)
	app.Put("/api/preferences", UpdatePreferencesHandler)
	app.Get("/api/tags", GetTagsHandler)
	app.Post("/api/tags", CreateTagHandler)
	app.Put("/api/tags/order", UpdateTagOrderHandler)
	app.Put("/api/tags/:tag_id", UpdateTagHandler)
	app.Delete("/api/tags/:tag_id", DeleteTagHandler)
	app.Get("/api/autocomplete-trainers", AutocompleteTrainersHandler)
	app.Get("/api/friends", GetFriendsHandler)
	app.Post("/api/friends/requests", CreateFriendRequestHandler)
	app.Post("/api/friends/requests/:friendship_id/accept", AcceptFriendRequestHandler)
	app.Delete("/api/friends/requests/:friendship_id", DeleteFriendRequestHandler)
	app.Delete("/api/friends/:user_id", RemoveFriendHandler)
	app.Post("/api/friends/blocks", BlockUserHandler)
	app.Delete("/api/friends/blocks/:user_id", UnblockUserHandler)
	app.Get("/api/trades", GetTradesHandler)
	app.Post("/api/trades", CreateTradeHandler)
	app.Post("/api/trades/:trade_id/accept", AcceptTradeHandler)
	app.Post("/api/trades/:trade_id/deny", DenyTradeHandler)
	app.Post("/api/trades/:trade_id/cancel", CancelTradeHandler)
	app.Post("/api/trades/:trade_id/complete-confirmation", CompleteTradeHandler)
	app.Post("/api/trades/:trade_id/repropose", ReproposeTradeHandler)
	app.Put("/api/trades/:trade_id/satisfaction", UpdateTradeSatisfactionHandler)
	app.Delete("/api/trades/:trade_id", DeleteTradeHandler)
	app.Get("/api/trades/:trade_id/partner", RevealTradePartnerHandler)

	// Public endpoints used in tests.
	app.Get("/api/public/users/:username", GetPublicSnapshotByUsername)
	app.Get("/api/users/public/users/:username", GetPublicSnapshotByUsername)

	return app
}

func expectProfileInvalidationOutbox(mock sqlmock.Sqlmock, userID, username string) {
	mock.ExpectQuery("SELECT .* FROM `users` WHERE user_id = \\?").
		WithArgs(userID, 1).
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "username"}).AddRow(userID, username))
	mock.ExpectQuery("SELECT \\* FROM `friendships` WHERE status = \\? AND \\(user_id_low = \\? OR user_id_high = \\?\\)").
		WithArgs("accepted", userID, userID).
		WillReturnRows(sqlmock.NewRows([]string{"friendship_id", "user_id_low", "user_id_high", "status"}))
	mock.ExpectExec("INSERT INTO `application_outbox`").
		WillReturnResult(sqlmock.NewResult(1, 1))
}

func TestDeleteUserHandler_DeletesAccountGraphInTransaction(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	mock.ExpectBegin()
	mock.ExpectExec("DELETE FROM `trades` WHERE user_id_proposed = \\? OR user_id_accepting = \\?").
		WithArgs("user-123", "user-123").WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectExec("DELETE FROM `friendships` WHERE user_id_low = \\? OR user_id_high = \\?").
		WithArgs("user-123", "user-123").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("DELETE FROM `user_blocks` WHERE blocker_user_id = \\? OR blocked_user_id = \\?").
		WithArgs("user-123", "user-123").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("DELETE FROM `instance_tags` WHERE user_id = \\?").
		WithArgs("user-123").WillReturnResult(sqlmock.NewResult(0, 4))
	mock.ExpectExec("DELETE FROM `tag_orders` WHERE user_id = \\?").
		WithArgs("user-123").WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectExec("DELETE FROM `tags` WHERE user_id = \\?").
		WithArgs("user-123").WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectExec("DELETE FROM `registrations` WHERE user_id = \\?").
		WithArgs("user-123").WillReturnResult(sqlmock.NewResult(0, 3))
	mock.ExpectExec("DELETE FROM `instances` WHERE user_id = \\?").
		WithArgs("user-123").WillReturnResult(sqlmock.NewResult(0, 4))
	mock.ExpectExec("DELETE FROM `user_profiles` WHERE user_id = \\?").
		WithArgs("user-123").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("DELETE FROM `users` WHERE user_id = \\?").
		WithArgs("user-123").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	app := newHandlerTestApp("user-123")
	resp, err := app.Test(
		makeJSONRequest(t, http.MethodDelete, "/api/users/user-123", nil),
		fiber.TestConfig{Timeout: 0},
	)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusOK)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet DB expectations: %v", err)
	}
}

func tradeMockRows(status string, proposedConfirmed, acceptingConfirmed bool) *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"trade_id", "user_id_proposed", "username_proposed",
		"user_id_accepting", "username_accepting",
		"pokemon_instance_id_user_proposed",
		"pokemon_instance_id_user_accepting", "trade_status",
		"user_proposed_completion_confirmed",
		"user_accepting_completion_confirmed", "last_update",
	}).AddRow(
		"trade-1", "user-1", "ash", "user-2", "misty",
		"instance-1", "instance-2", status,
		proposedConfirmed, acceptingConfirmed, int64(100),
	)
}

func instanceMockRows(instanceID, userID string) *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"instance_id", "user_id", "is_caught", "is_for_trade",
		"is_wanted", "disabled", "last_update",
	}).AddRow(instanceID, userID, true, true, false, false, int64(100))
}

func TestAcceptTradeHandler_RejectsNonAcceptingParticipant(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT \\* FROM `trades` WHERE trade_id = \\?").
		WithArgs("trade-1", 1).
		WillReturnRows(tradeMockRows("proposed", false, false))
	mock.ExpectRollback()

	app := newHandlerTestApp("user-1")
	resp, err := app.Test(
		makeJSONRequest(t, http.MethodPost, "/api/trades/trade-1/accept", nil),
		fiber.TestConfig{Timeout: 0},
	)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusForbidden)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet DB expectations: %v", err)
	}
}

func TestAcceptTradeHandler_RejectsDuplicateTransition(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT \\* FROM `trades` WHERE trade_id = \\?").
		WithArgs("trade-1", 1).
		WillReturnRows(tradeMockRows("pending", false, false))
	mock.ExpectRollback()

	app := newHandlerTestApp("user-2")
	resp, err := app.Test(
		makeJSONRequest(t, http.MethodPost, "/api/trades/trade-1/accept", nil),
		fiber.TestConfig{Timeout: 0},
	)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusConflict)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet DB expectations: %v", err)
	}
}

func TestCancelTradeHandler_AllowsProposerToWithdrawProposal(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT \\* FROM `trades` WHERE trade_id = \\?").
		WithArgs("trade-1", 1).
		WillReturnRows(tradeMockRows("proposed", false, false))
	mock.ExpectExec("UPDATE `trades` SET").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO `application_outbox`").
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	app := newHandlerTestApp("user-1")
	resp, err := app.Test(
		makeJSONRequest(t, http.MethodPost, "/api/trades/trade-1/cancel", nil),
		fiber.TestConfig{Timeout: 0},
	)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusOK)
	}
	var body TradeEnvelope
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Trade.TradeStatus != "cancelled" ||
		body.Trade.TradeCancelledBy == nil ||
		*body.Trade.TradeCancelledBy != "ash" {
		t.Fatalf("unexpected cancelled trade response: %#v", body)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet DB expectations: %v", err)
	}
}

func TestCancelTradeHandler_RejectsAccepterWithdrawingProposal(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT \\* FROM `trades` WHERE trade_id = \\?").
		WithArgs("trade-1", 1).
		WillReturnRows(tradeMockRows("proposed", false, false))
	mock.ExpectRollback()

	app := newHandlerTestApp("user-2")
	resp, err := app.Test(
		makeJSONRequest(t, http.MethodPost, "/api/trades/trade-1/cancel", nil),
		fiber.TestConfig{Timeout: 0},
	)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusForbidden)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet DB expectations: %v", err)
	}
}

func TestCompleteTradeHandler_AtomicallyTransfersBothPokemon(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT \\* FROM `trades` WHERE trade_id = \\?").
		WithArgs("trade-1", 1).
		WillReturnRows(tradeMockRows("pending", false, true))
	mock.ExpectQuery("SELECT \\* FROM `instances` WHERE instance_id = \\?").
		WithArgs("instance-1", 1).
		WillReturnRows(instanceMockRows("instance-1", "user-1"))
	mock.ExpectQuery("SELECT \\* FROM `instances` WHERE instance_id = \\?").
		WithArgs("instance-2", 1).
		WillReturnRows(instanceMockRows("instance-2", "user-2"))
	mock.ExpectExec("UPDATE `instances` SET").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE `instances` SET").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE `trades` SET").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO `application_outbox`").
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	app := newHandlerTestApp("user-1")
	resp, err := app.Test(
		makeJSONRequest(t, http.MethodPost, "/api/trades/trade-1/complete-confirmation", nil),
		fiber.TestConfig{Timeout: 0},
	)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusOK)
	}
	var body TradeEnvelope
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Trade.TradeStatus != "completed" ||
		body.AffectedInstances["instance-1"].UserID != "user-2" ||
		body.AffectedInstances["instance-2"].UserID != "user-1" {
		t.Fatalf("unexpected completed trade response: %#v", body)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet DB expectations: %v", err)
	}
}

func TestCompleteTradeHandler_RollsBackWhenSecondPokemonUpdateFails(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT \\* FROM `trades` WHERE trade_id = \\?").
		WithArgs("trade-1", 1).
		WillReturnRows(tradeMockRows("pending", false, true))
	mock.ExpectQuery("SELECT \\* FROM `instances` WHERE instance_id = \\?").
		WithArgs("instance-1", 1).
		WillReturnRows(instanceMockRows("instance-1", "user-1"))
	mock.ExpectQuery("SELECT \\* FROM `instances` WHERE instance_id = \\?").
		WithArgs("instance-2", 1).
		WillReturnRows(instanceMockRows("instance-2", "user-2"))
	mock.ExpectExec("UPDATE `instances` SET").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE `instances` SET").
		WillReturnError(assertionError("forced second Pokémon update failure"))
	mock.ExpectRollback()

	app := newHandlerTestApp("user-1")
	resp, err := app.Test(
		makeJSONRequest(t, http.MethodPost, "/api/trades/trade-1/complete-confirmation", nil),
		fiber.TestConfig{Timeout: 0},
	)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusInternalServerError {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusInternalServerError)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet DB expectations: %v", err)
	}
}

type assertionError string

func (e assertionError) Error() string { return string(e) }

func TestCreateTradeHandler_RejectsMalformedProposalBeforeDatabaseWrite(t *testing.T) {
	_, cleanup := setupMockDB(t)
	defer cleanup()

	app := newHandlerTestApp("user-1")
	resp, err := app.Test(
		makeJSONRequest(t, http.MethodPost, "/api/trades", map[string]any{
			"username_accepting":     "",
			"trade_friendship_level": 9,
		}),
		fiber.TestConfig{Timeout: 0},
	)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusBadRequest)
	}
}

func makeJSONRequest(t *testing.T, method, path string, body any) *http.Request {
	t.Helper()
	var payload []byte
	switch v := body.(type) {
	case nil:
		payload = nil
	default:
		b, err := json.Marshal(v)
		if err != nil {
			t.Fatalf("failed to marshal request body: %v", err)
		}
		payload = b
	}

	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	return req
}

func TestUpdateUserHandler_ForbiddenWhenAuthUserMismatch(t *testing.T) {
	app := newHandlerTestApp("different-user")
	req := makeJSONRequest(t, http.MethodPut, "/api/update-user/user-123", map[string]any{
		"username": "adam",
	})

	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusForbidden)
	}
}

func TestUpdateUserHandler_UpdatesExistingUser(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	app := newHandlerTestApp("user-123")

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `users` WHERE username = ? AND user_id <> ? ORDER BY `users`.`user_id` LIMIT ?")).
		WithArgs("adam", "user-123", 1).
		WillReturnRows(sqlmock.NewRows([]string{"user_id"}))

	mock.ExpectBegin()
	mock.ExpectExec("INSERT INTO `users` .* ON DUPLICATE KEY UPDATE").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `users` WHERE user_id = ? ORDER BY `users`.`user_id` LIMIT ?")).
		WithArgs("user-123", 1).
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "username", "allow_location", "app_joined_at"}).
			AddRow("user-123", "adam", false, time.Now()))

	req := makeJSONRequest(t, http.MethodPut, "/api/users/user-123", map[string]any{
		"username": "adam",
	})

	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusOK)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sqlmock expectations: %v", err)
	}
}

func TestUpdateUserHandler_InsertsWhenNoExistingRow(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	app := newHandlerTestApp("user-999")

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `users` WHERE username = ? AND user_id <> ? ORDER BY `users`.`user_id` LIMIT ?")).
		WithArgs("new_user", "user-999", 1).
		WillReturnRows(sqlmock.NewRows([]string{"user_id"}))

	mock.ExpectBegin()
	mock.ExpectExec("INSERT INTO `users` .* ON DUPLICATE KEY UPDATE").
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `users` WHERE user_id = ? ORDER BY `users`.`user_id` LIMIT ?")).
		WithArgs("user-999", 1).
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "username", "allow_location", "app_joined_at"}).
			AddRow("user-999", "new_user", false, time.Now()))

	req := makeJSONRequest(t, http.MethodPut, "/api/users/update-user/user-999", map[string]any{
		"username": "new_user",
	})

	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusOK)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sqlmock expectations: %v", err)
	}
}

func TestUpdateUserHandler_SucceedsWhenUpsertChangesNoValues(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	app := newHandlerTestApp("user-123")

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `users` WHERE username = ? AND user_id <> ? ORDER BY `users`.`user_id` LIMIT ?")).
		WithArgs("adam", "user-123", 1).
		WillReturnRows(sqlmock.NewRows([]string{"user_id"}))

	mock.ExpectBegin()
	mock.ExpectExec("INSERT INTO `users` .* ON DUPLICATE KEY UPDATE").
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectCommit()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `users` WHERE user_id = ? ORDER BY `users`.`user_id` LIMIT ?")).
		WithArgs("user-123", 1).
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "username", "allow_location", "app_joined_at"}).
			AddRow("user-123", "adam", false, time.Now()))

	req := makeJSONRequest(t, http.MethodPut, "/api/users/update-user/user-123", map[string]any{
		"username":  "adam",
		"latitude":  49.2327643,
		"longitude": -123.0092935,
	})

	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusOK)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sqlmock expectations: %v", err)
	}
}

func TestUpdateUserHandler_UsernameConflict(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	app := newHandlerTestApp("user-123")

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `users` WHERE username = ? AND user_id <> ? ORDER BY `users`.`user_id` LIMIT ?")).
		WithArgs("taken_name", "user-123", 1).
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "username"}).AddRow("other-user", "taken_name"))

	req := makeJSONRequest(t, http.MethodPut, "/api/update-user/user-123", map[string]any{
		"username": "taken_name",
	})

	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusConflict)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sqlmock expectations: %v", err)
	}
}

func TestGetPublicSnapshotByUsername_UsesUserIDForInstanceLookup(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	app := newHandlerTestApp("")

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `users` WHERE LOWER(username)=? ORDER BY `users`.`user_id` LIMIT ?")).
		WithArgs("adam", 1).
		WillReturnRows(sqlmock.NewRows([]string{
			"user_id", "username", "pokemon_go_name", "team", "trainer_level", "total_xp",
			"pogo_started_on", "app_joined_at",
			"highlight1_instance_id", "highlight2_instance_id", "highlight3_instance_id",
			"highlight4_instance_id", "highlight5_instance_id", "highlight6_instance_id",
		}).AddRow("user-abc", "Adam", nil, nil, nil, nil, nil, time.Now(), nil, nil, nil, nil, nil, nil))

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `user_profiles` WHERE user_id = ? ORDER BY `user_profiles`.`user_id` LIMIT ?")).
		WithArgs("user-abc", 1).
		WillReturnRows(sqlmock.NewRows([]string{"user_id"}))

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `instances` WHERE user_id = ?")).
		WithArgs("user-abc").
		WillReturnRows(sqlmock.NewRows([]string{"instance_id", "user_id", "pokemon_id", "shiny", "lucky", "shadow", "purified", "date_added", "last_update", "disabled", "is_traded", "mega", "dynamax", "gigantamax", "crown", "is_fused", "is_caught", "is_for_trade", "is_wanted", "most_wanted", "mirror", "pref_lucky", "registered", "favorite"}))

	req := makeJSONRequest(t, http.MethodGet, "/api/public/users/adam", nil)
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusOK)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sqlmock expectations: %v", err)
	}
}

func TestGetUserOverviewHandler_RejectsMissingDeviceID(t *testing.T) {
	app := newHandlerTestApp("user-1")
	req := makeJSONRequest(t, http.MethodGet, "/api/users/user-1/overview", nil)

	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusBadRequest)
	}
}

func TestGetUserOverviewHandler_RejectsUserMismatch(t *testing.T) {
	app := newHandlerTestApp("user-auth")
	req := makeJSONRequest(t, http.MethodGet, "/api/users/user-other/overview?device_id=dev-1", nil)

	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusForbidden)
	}
}

func TestGetInstancesByUsername_Found_CaseInsensitive(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	app := newHandlerTestApp("user-42")

	mock.ExpectQuery(regexp.QuoteMeta("SELECT user_id, username FROM `users` WHERE LOWER(username)=? ORDER BY `users`.`user_id` LIMIT ?")).
		WithArgs("fakeuser0632", 1).
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "username"}).AddRow("user-42", "fakeUser0632"))

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `user_profiles` WHERE user_id = ? ORDER BY `user_profiles`.`user_id` LIMIT ?")).
		WithArgs("user-42", 1).
		WillReturnRows(sqlmock.NewRows([]string{"user_id"}))

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `instances` WHERE user_id = ?")).
		WithArgs("user-42").
		WillReturnRows(sqlmock.NewRows([]string{
			"instance_id", "user_id", "variant_id", "pokemon_id", "shiny", "lucky", "shadow", "purified",
			"date_added", "last_update", "disabled", "is_traded", "mega", "dynamax", "gigantamax", "crown",
			"is_fused", "is_caught", "is_for_trade", "is_wanted", "most_wanted", "mirror", "pref_lucky",
			"registered", "favorite",
		}).AddRow(
			"inst-1", "user-42", "0001-default", 1, false, false, false, false,
			time.Now(), int64(1770686000000), false, false, false, false, false, false,
			false, true, false, false, false, false, false, true, false,
		))

	req := makeJSONRequest(t, http.MethodGet, "/api/users/instances/by-username/FakeUser0632", nil)
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusOK)
	}

	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode body failed: %v", err)
	}
	if got := body["username"]; got != "fakeUser0632" {
		t.Fatalf("unexpected canonical username: got %v, want %q", got, "fakeUser0632")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sqlmock expectations: %v", err)
	}
}

func TestGetProfileHandler_ReturnsPublicTrainerCardWithDefaultPrivacy(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	app := newHandlerTestApp("")
	joinedAt := time.Now().UTC()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `users` WHERE LOWER(username) = ? ORDER BY `users`.`user_id` LIMIT ?")).
		WithArgs("misty", 1).
		WillReturnRows(sqlmock.NewRows([]string{
			"user_id", "username", "pokemon_go_name", "team", "trainer_level",
			"total_xp", "app_joined_at",
		}).AddRow("user-misty", "Misty", "CeruleanLeader", "Mystic", 50, 1000000, joinedAt))

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `user_profiles` WHERE user_id = ? ORDER BY `user_profiles`.`user_id` LIMIT ?")).
		WithArgs("user-misty", 1).
		WillReturnRows(sqlmock.NewRows([]string{
			"user_id", "trainer_titles",
		}).AddRow("user-misty", `["raid-regular","egg-hatcher"]`))

	mock.ExpectQuery("(?s)SELECT.*AS caught.*FROM `instances` WHERE user_id = \\?").
		WithArgs("user-misty").
		WillReturnRows(sqlmock.NewRows([]string{"caught", "for_trade", "wanted", "favorites"}).
			AddRow(12, 3, 4, 5))

	mock.ExpectQuery(regexp.QuoteMeta("SELECT count(*) FROM `registrations` WHERE user_id = ?")).
		WithArgs("user-misty").
		WillReturnRows(sqlmock.NewRows([]string{"count(*)"}).AddRow(10))

	req := makeJSONRequest(t, http.MethodGet, "/api/profiles/misty", nil)
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusOK)
	}

	var body ProfileResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode body failed: %v", err)
	}
	if body.User.Username != "Misty" || body.Stats.Caught != 12 {
		t.Fatalf("unexpected profile response: %#v", body)
	}
	if len(body.TrainerTitles) != 2 ||
		body.TrainerTitles[0] != "raid-regular" ||
		body.TrainerTitles[1] != "egg-hatcher" {
		t.Fatalf("unexpected trainer titles: %#v", body.TrainerTitles)
	}
	if body.Preferences != nil {
		t.Fatalf("public profile must not expose private preference record")
	}
	if !body.Viewer.CanViewProfile || !body.Viewer.CanViewCollection {
		t.Fatalf("default public profile should be visible: %#v", body.Viewer)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sqlmock expectations: %v", err)
	}
}

func TestGetOwnProfileHandler_ReturnsEditableDefaultsBeforeFirstSave(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	app := newHandlerTestApp("user-adam")
	joinedAt := time.Now().UTC()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `users` WHERE user_id = ? ORDER BY `users`.`user_id` LIMIT ?")).
		WithArgs("user-adam", 1).
		WillReturnRows(sqlmock.NewRows([]string{
			"user_id", "username", "app_joined_at",
		}).AddRow("user-adam", "Adam", joinedAt))
	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `user_profiles` WHERE user_id = ? ORDER BY `user_profiles`.`user_id` LIMIT ?")).
		WithArgs("user-adam", 1).
		WillReturnRows(sqlmock.NewRows([]string{"user_id"}))
	mock.ExpectQuery("(?s)SELECT.*AS caught.*FROM `instances` WHERE user_id = \\?").
		WithArgs("user-adam").
		WillReturnRows(sqlmock.NewRows([]string{"caught", "for_trade", "wanted", "favorites"}).
			AddRow(0, 0, 0, 0))
	mock.ExpectQuery(regexp.QuoteMeta("SELECT count(*) FROM `registrations` WHERE user_id = ?")).
		WithArgs("user-adam").
		WillReturnRows(sqlmock.NewRows([]string{"count(*)"}).AddRow(0))

	req := makeJSONRequest(t, http.MethodGet, "/api/profile", nil)
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusOK)
	}

	var body ProfileResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode body failed: %v", err)
	}
	if body.User.Username != "Adam" || body.Viewer.Relationship != relationshipSelf {
		t.Fatalf("unexpected own profile response: %#v", body)
	}
	if body.Preferences == nil ||
		body.Preferences.ProfileVisibility != "public" ||
		body.Preferences.CollectionVisibility != "public" {
		t.Fatalf("first-use profile should include editable defaults: %#v", body.Preferences)
	}
	if body.Highlights == nil || len(body.Highlights) != 0 {
		t.Fatalf("first-use highlights should be an empty array: %#v", body.Highlights)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sqlmock expectations: %v", err)
	}
}

func TestGetFriendsHandler_ReturnsEmptyArraysBeforeFirstFriend(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	app := newHandlerTestApp("user-adam")
	mock.ExpectQuery("SELECT \\* FROM `friendships` WHERE user_id_low = \\? OR user_id_high = \\? ORDER BY updated_at DESC").
		WithArgs("user-adam", "user-adam").
		WillReturnRows(sqlmock.NewRows([]string{
			"friendship_id", "user_id_low", "user_id_high", "requested_by_user_id", "status",
		}))
	mock.ExpectQuery("SELECT \\* FROM `user_blocks` WHERE blocker_user_id = \\?").
		WithArgs("user-adam").
		WillReturnRows(sqlmock.NewRows([]string{"blocker_user_id", "blocked_user_id"}))

	req := makeJSONRequest(t, http.MethodGet, "/api/friends", nil)
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusOK)
	}

	var body FriendsResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode body failed: %v", err)
	}
	if body.Friends == nil || body.Incoming == nil || body.Outgoing == nil || body.Blocked == nil {
		t.Fatalf("first-use friends response must use empty arrays: %#v", body)
	}
	if len(body.Friends)+len(body.Incoming)+len(body.Outgoing)+len(body.Blocked) != 0 {
		t.Fatalf("unexpected first-use friends: %#v", body)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sqlmock expectations: %v", err)
	}
}

func TestUpdateProfileHandler_RejectsNonNumericTrainerCode(t *testing.T) {
	app := newHandlerTestApp("user-1")
	req := makeJSONRequest(t, http.MethodPut, "/api/profile", map[string]any{
		"trainer_code": "1234 ABCD 9012",
	})

	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusBadRequest)
	}
}

func TestUpdateProfileHandler_RejectsInvalidTrainerTitles(t *testing.T) {
	app := newHandlerTestApp("user-1")
	testCases := []struct {
		name   string
		titles []string
	}{
		{
			name:   "unknown title",
			titles: []string{"explicit-free-text"},
		},
		{
			name: "more than three",
			titles: []string{
				"raid-regular",
				"egg-hatcher",
				"route-explorer",
				"party-player",
			},
		},
		{
			name:   "duplicate",
			titles: []string{"raid-regular", "raid-regular"},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			req := makeJSONRequest(t, http.MethodPut, "/api/profile", map[string]any{
				"trainer_titles": testCase.titles,
			})
			resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
			if err != nil {
				t.Fatalf("request failed: %v", err)
			}
			if resp.StatusCode != http.StatusBadRequest {
				t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusBadRequest)
			}
		})
	}
}

func TestUpdateProfileHandler_SavesTrainerTitles(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	app := newHandlerTestApp("user-1")
	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `user_profiles` WHERE user_id = ? AND `user_profiles`.`user_id` = ? ORDER BY `user_profiles`.`user_id` LIMIT ?")).
		WithArgs("user-1", "user-1", 1).
		WillReturnRows(sqlmock.NewRows([]string{
			"user_id", "trainer_titles",
		}).AddRow("user-1", `["raid-regular"]`))
	mock.ExpectExec("UPDATE `user_profiles` SET `trainer_titles`=\\?,`updated_at`=\\? WHERE user_id = \\? AND `user_id` = \\?").
		WithArgs(
			`["raid-regular","egg-hatcher","route-explorer"]`,
			sqlmock.AnyArg(),
			"user-1",
			"user-1",
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	expectProfileInvalidationOutbox(mock, "user-1", "adam")
	mock.ExpectCommit()

	req := makeJSONRequest(t, http.MethodPut, "/api/profile", map[string]any{
		"trainer_titles": []string{
			"raid-regular",
			"egg-hatcher",
			"route-explorer",
		},
	})
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusOK)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sqlmock expectations: %v", err)
	}
}

func TestUpdateProfileHandler_ClearsTrainerTitles(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	app := newHandlerTestApp("user-1")
	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `user_profiles` WHERE user_id = ? AND `user_profiles`.`user_id` = ? ORDER BY `user_profiles`.`user_id` LIMIT ?")).
		WithArgs("user-1", "user-1", 1).
		WillReturnRows(sqlmock.NewRows([]string{
			"user_id", "trainer_titles",
		}).AddRow("user-1", `["raid-regular"]`))
	mock.ExpectExec("UPDATE `user_profiles` SET `trainer_titles`=\\?,`updated_at`=\\? WHERE user_id = \\? AND `user_id` = \\?").
		WithArgs(
			"[]",
			sqlmock.AnyArg(),
			"user-1",
			"user-1",
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	expectProfileInvalidationOutbox(mock, "user-1", "adam")
	mock.ExpectCommit()

	req := makeJSONRequest(t, http.MethodPut, "/api/profile", map[string]any{
		"trainer_titles": []string{},
	})
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusOK)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sqlmock expectations: %v", err)
	}
}

func TestUpdateProfileHandler_RejectsHighlightThatIsNotCaught(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	app := newHandlerTestApp("user-1")
	mock.ExpectQuery("SELECT count\\(\\*\\) FROM `instances` WHERE user_id = \\? AND disabled = \\? AND is_caught = \\? AND instance_id IN \\(\\?\\)").
		WithArgs("user-1", false, true, "wanted-instance").
		WillReturnRows(sqlmock.NewRows([]string{"count(*)"}).AddRow(0))

	req := makeJSONRequest(t, http.MethodPut, "/api/profile", map[string]any{
		"highlight_instance_ids": []string{"wanted-instance"},
	})
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusBadRequest)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sqlmock expectations: %v", err)
	}
}

func TestAutocompleteTrainersHandler_HidesBlockedUsersAndPrivateDetails(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	app := newHandlerTestApp("viewer-user")
	mock.ExpectQuery("(?s)SELECT.*FROM `users` LEFT JOIN user_profiles.*NOT EXISTS.*ORDER BY users.username LIMIT \\?").
		WithArgs("mi%", "mi%", "viewer-user", "viewer-user", "viewer-user", 10).
		WillReturnRows(sqlmock.NewRows([]string{
			"username", "pokemon_go_name", "team", "trainer_level",
		}).AddRow("Misty", nil, nil, nil))

	req := makeJSONRequest(t, http.MethodGet, "/api/autocomplete-trainers?q=mi", nil)
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusOK)
	}

	var body []TrainerSuggestion
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode body failed: %v", err)
	}
	if len(body) != 1 || body[0].Username != "Misty" ||
		body[0].PokemonGoName != nil || body[0].Team != nil || body[0].TrainerLevel != nil {
		t.Fatalf("private trainer details leaked through autocomplete: %#v", body)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sqlmock expectations: %v", err)
	}
}

func TestGetPreferencesHandler_ReturnsStableDefaultsBeforeFirstSave(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	app := newHandlerTestApp("user-1")
	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `user_profiles` WHERE user_id = ? ORDER BY `user_profiles`.`user_id` LIMIT ?")).
		WithArgs("user-1", 1).
		WillReturnRows(sqlmock.NewRows([]string{"user_id"}))

	req := makeJSONRequest(t, http.MethodGet, "/api/preferences", nil)
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusOK)
	}
	var body UserProfile
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode body failed: %v", err)
	}
	if body.ProfileVisibility != "public" ||
		body.CollectionVisibility != "public" ||
		body.TrainerCodeVisibility != "friends" ||
		body.CoordinationMethod != "campfire" ||
		!body.ShareTradeContact {
		t.Fatalf("unexpected defaults: %#v", body)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sqlmock expectations: %v", err)
	}
}

func TestUpdatePreferencesHandler_RejectsUnsafeOrMissingCoordinationHandle(t *testing.T) {
	tests := []struct {
		name   string
		method string
		handle any
	}{
		{name: "email address", method: "discord", handle: "trainer@example.com"},
		{name: "external link", method: "other", handle: "https://example.com/trainer"},
		{name: "missing discord username", method: "discord", handle: nil},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, cleanup := setupMockDB(t)
			defer cleanup()

			response := executeTradeRequest(
				t, newHandlerTestApp("user-1"), http.MethodPut,
				"/api/preferences", map[string]any{
					"profile_visibility":        "public",
					"collection_visibility":     "public",
					"friend_request_permission": "everyone",
					"trainer_code_visibility":   "friends",
					"coordination_method":       test.method,
					"coordination_handle":       test.handle,
					"share_trade_contact":       true,
					"show_location":             false,
					"show_pokemon_go_name":      true,
				},
			)
			if response.StatusCode != http.StatusBadRequest {
				t.Fatalf("unexpected status: got %d, want %d", response.StatusCode, http.StatusBadRequest)
			}
		})
	}
}

func TestUpdatePreferencesHandler_SavesNormalizedTradeCoordination(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `user_profiles` WHERE user_id = ? AND `user_profiles`.`user_id` = ? ORDER BY `user_profiles`.`user_id` LIMIT ?")).
		WithArgs("user-1", "user-1", 1).
		WillReturnRows(sqlmock.NewRows([]string{"user_id"}))
	mock.ExpectExec("INSERT INTO `user_profiles`").
		WillReturnResult(sqlmock.NewResult(1, 1))
	expectProfileInvalidationOutbox(mock, "user-1", "ash")
	mock.ExpectCommit()

	response := executeTradeRequest(
		t, newHandlerTestApp("user-1"), http.MethodPut,
		"/api/preferences", map[string]any{
			"profile_visibility":        "public",
			"collection_visibility":     "friends",
			"friend_request_permission": "everyone",
			"trainer_code_visibility":   "friends",
			"coordination_method":       "discord",
			"coordination_handle":       "  @MistyTrades  ",
			"share_trade_contact":       true,
			"show_location":             false,
			"show_pokemon_go_name":      true,
		},
	)
	if response.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want %d", response.StatusCode, http.StatusOK)
	}
	var body UserProfile
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.CoordinationMethod != "discord" || body.CoordinationHandle == nil ||
		*body.CoordinationHandle != "MistyTrades" || !body.ShareTradeContact {
		t.Fatalf("unexpected saved coordination preferences: %#v", body)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet DB expectations: %v", err)
	}
}

func TestGetInstancesByUsername_RespectsPrivateCollection(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	app := newHandlerTestApp("")
	mock.ExpectQuery(regexp.QuoteMeta("SELECT user_id, username FROM `users` WHERE LOWER(username)=? ORDER BY `users`.`user_id` LIMIT ?")).
		WithArgs("privateuser", 1).
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "username"}).
			AddRow("user-private", "PrivateUser"))

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `user_profiles` WHERE user_id = ? ORDER BY `user_profiles`.`user_id` LIMIT ?")).
		WithArgs("user-private", 1).
		WillReturnRows(sqlmock.NewRows([]string{
			"user_id", "profile_visibility", "collection_visibility",
			"friend_request_permission", "trainer_code_visibility",
			"show_location", "show_pokemon_go_name", "updated_at",
		}).AddRow(
			"user-private", "public", "private", "everyone", "friends",
			false, true, time.Now(),
		))

	req := makeJSONRequest(t, http.MethodGet, "/api/instances/by-username/privateuser", nil)
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusForbidden)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sqlmock expectations: %v", err)
	}
}

func TestGetInstancesByUsername_NotFound(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	app := newHandlerTestApp("auth-user")

	mock.ExpectQuery(regexp.QuoteMeta("SELECT user_id, username FROM `users` WHERE LOWER(username)=? ORDER BY `users`.`user_id` LIMIT ?")).
		WithArgs("missinguser", 1).
		WillReturnError(gorm.ErrRecordNotFound)

	req := makeJSONRequest(t, http.MethodGet, "/api/instances/by-username/missinguser", nil)
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("unexpected status: got %d, want %d", resp.StatusCode, http.StatusNotFound)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sqlmock expectations: %v", err)
	}
}
