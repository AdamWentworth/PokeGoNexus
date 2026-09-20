package main

import (
	"encoding/json"
	"net/http"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/gofiber/fiber/v3"
)

func expectTradeTransitionWrite(mock sqlmock.Sqlmock) {
	mock.ExpectExec("UPDATE `trades` SET").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO `application_outbox`").
		WillReturnResult(sqlmock.NewResult(1, 1))
}

func executeTradeRequest(
	t *testing.T,
	app *fiber.App,
	method string,
	path string,
	body any,
) *http.Response {
	t.Helper()
	response, err := app.Test(
		makeJSONRequest(t, method, path, body),
		fiber.TestConfig{Timeout: 0},
	)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	return response
}

func TestTradeFriendshipLevels_IncludesForeverFriendsRemoteTrade(t *testing.T) {
	level, ok := tradeFriendshipLevels[5]
	if !ok {
		t.Fatal("friendship level 5 must be accepted for remote trades")
	}
	if level != "Forever" {
		t.Fatalf("unexpected level 5 label: got %q, want %q", level, "Forever")
	}
}

func TestRevealTradePartnerHandler_RequiresAcceptedActiveTrade(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	mock.ExpectQuery("SELECT \\* FROM `trades` WHERE trade_id = \\? AND \\(user_id_proposed = \\? OR user_id_accepting = \\?\\)").
		WithArgs("trade-1", "user-1", "user-1", 1).
		WillReturnRows(tradeMockRows("proposed", false, false))

	response := executeTradeRequest(
		t, newHandlerTestApp("user-1"), http.MethodGet,
		"/api/trades/trade-1/partner", nil,
	)
	if response.StatusCode != http.StatusConflict {
		t.Fatalf("unexpected status: got %d, want %d", response.StatusCode, http.StatusConflict)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet DB expectations: %v", err)
	}
}

func TestRevealTradePartnerHandler_RejectsBlockedParticipant(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	mock.ExpectQuery("SELECT \\* FROM `trades` WHERE trade_id = \\? AND \\(user_id_proposed = \\? OR user_id_accepting = \\?\\)").
		WithArgs("trade-1", "user-1", "user-1", 1).
		WillReturnRows(tradeMockRows("pending", false, false))
	mock.ExpectQuery("SELECT count\\(\\*\\) FROM `user_blocks`").
		WithArgs("user-1", "user-2", "user-2", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{"count(*)"}).AddRow(1))

	response := executeTradeRequest(
		t, newHandlerTestApp("user-1"), http.MethodGet,
		"/api/trades/trade-1/partner", nil,
	)
	if response.StatusCode != http.StatusForbidden {
		t.Fatalf("unexpected status: got %d, want %d", response.StatusCode, http.StatusForbidden)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet DB expectations: %v", err)
	}
}

func TestRevealTradePartnerHandler_ReturnsOptedInCoordinationWithoutCoordinates(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	mock.ExpectQuery("SELECT \\* FROM `trades` WHERE trade_id = \\? AND \\(user_id_proposed = \\? OR user_id_accepting = \\?\\)").
		WithArgs("trade-1", "user-1", "user-1", 1).
		WillReturnRows(tradeMockRows("pending", false, false))
	mock.ExpectQuery("SELECT count\\(\\*\\) FROM `user_blocks`").
		WithArgs("user-1", "user-2", "user-2", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{"count(*)"}).AddRow(0))
	mock.ExpectQuery("SELECT \\* FROM `users` WHERE user_id = \\?").
		WithArgs("user-2", 1).
		WillReturnRows(sqlmock.NewRows([]string{
			"user_id", "username", "pokemon_go_name", "trainer_code", "location", "latitude", "longitude",
		}).AddRow("user-2", "misty", "MistyGO", "123456789012", "Cerulean City", 47.6, -122.3))
	mock.ExpectQuery("SELECT \\* FROM `user_profiles` WHERE user_id = \\?").
		WithArgs("user-2", 1).
		WillReturnRows(sqlmock.NewRows([]string{
			"user_id", "coordination_method", "coordination_handle", "share_trade_contact", "show_location",
		}).AddRow("user-2", "campfire", "MistyCampfire", true, true))

	response := executeTradeRequest(
		t, newHandlerTestApp("user-1"), http.MethodGet,
		"/api/trades/trade-1/partner", nil,
	)
	if response.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want %d", response.StatusCode, http.StatusOK)
	}
	var body map[string]any
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["sharingEnabled"] != true ||
		body["trainerCode"] != "123456789012" ||
		body["pokemonGoName"] != "MistyGO" ||
		body["coordinationMethod"] != "campfire" ||
		body["coordinationHandle"] != "MistyCampfire" ||
		body["location"] != "Cerulean City" {
		t.Fatalf("unexpected coordination response: %#v", body)
	}
	if _, exists := body["coordinates"]; exists {
		t.Fatalf("precise coordinates leaked in response: %#v", body)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet DB expectations: %v", err)
	}
}

func TestRevealTradePartnerHandler_HidesDetailsWhenSharingDisabled(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	mock.ExpectQuery("SELECT \\* FROM `trades` WHERE trade_id = \\? AND \\(user_id_proposed = \\? OR user_id_accepting = \\?\\)").
		WithArgs("trade-1", "user-1", "user-1", 1).
		WillReturnRows(tradeMockRows("pending", false, false))
	mock.ExpectQuery("SELECT count\\(\\*\\) FROM `user_blocks`").
		WithArgs("user-1", "user-2", "user-2", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{"count(*)"}).AddRow(0))
	mock.ExpectQuery("SELECT \\* FROM `users` WHERE user_id = \\?").
		WithArgs("user-2", 1).
		WillReturnRows(sqlmock.NewRows([]string{
			"user_id", "username", "pokemon_go_name", "trainer_code", "location",
		}).AddRow("user-2", "misty", "MistyGO", "123456789012", "Cerulean City"))
	mock.ExpectQuery("SELECT \\* FROM `user_profiles` WHERE user_id = \\?").
		WithArgs("user-2", 1).
		WillReturnRows(sqlmock.NewRows([]string{
			"user_id", "coordination_method", "coordination_handle", "share_trade_contact", "show_location",
		}).AddRow("user-2", "discord", "misty", false, true))

	response := executeTradeRequest(
		t, newHandlerTestApp("user-1"), http.MethodGet,
		"/api/trades/trade-1/partner", nil,
	)
	if response.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want %d", response.StatusCode, http.StatusOK)
	}
	var body map[string]any
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["sharingEnabled"] != false || body["trainerCode"] != nil ||
		body["pokemonGoName"] != nil || body["coordinationHandle"] != nil ||
		body["location"] != nil || body["coordinationMethod"] != "none" {
		t.Fatalf("private coordination details leaked: %#v", body)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet DB expectations: %v", err)
	}
}

func TestDenyTradeHandler_AccepterCanDenyProposal(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT \\* FROM `trades` WHERE trade_id = \\?").
		WithArgs("trade-1", 1).
		WillReturnRows(tradeMockRows("proposed", false, false))
	expectTradeTransitionWrite(mock)
	mock.ExpectCommit()

	response := executeTradeRequest(
		t, newHandlerTestApp("user-2"), http.MethodPost,
		"/api/trades/trade-1/deny", nil,
	)
	if response.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want %d", response.StatusCode, http.StatusOK)
	}
	var envelope TradeEnvelope
	if err := json.NewDecoder(response.Body).Decode(&envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if envelope.Trade.TradeStatus != "denied" {
		t.Fatalf("unexpected trade status: %s", envelope.Trade.TradeStatus)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet DB expectations: %v", err)
	}
}

func TestAcceptTradeHandler_AcceptsValidProposalAndRetiresConflicts(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT \\* FROM `trades` WHERE trade_id = \\?").
		WithArgs("trade-1", 1).
		WillReturnRows(tradeMockRows("proposed", false, false))
	mock.ExpectQuery("SELECT \\* FROM `instances` WHERE instance_id = \\?").
		WithArgs("instance-1", 1).
		WillReturnRows(instanceMockRows("instance-1", "user-1"))
	mock.ExpectQuery("SELECT \\* FROM `instances` WHERE instance_id = \\?").
		WithArgs("instance-2", 1).
		WillReturnRows(instanceMockRows("instance-2", "user-2"))
	mock.ExpectQuery("SELECT count\\(\\*\\) FROM `trades`").
		WillReturnRows(sqlmock.NewRows([]string{"count(*)"}).AddRow(0))
	mock.ExpectExec("UPDATE `trades` SET").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT \\* FROM `trades` WHERE trade_id <> \\?").
		WillReturnRows(sqlmock.NewRows([]string{"trade_id", "trade_status"}))
	mock.ExpectExec("UPDATE `trades` SET").
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec("INSERT INTO `application_outbox`").
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	response := executeTradeRequest(
		t, newHandlerTestApp("user-2"), http.MethodPost,
		"/api/trades/trade-1/accept", nil,
	)
	if response.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want %d", response.StatusCode, http.StatusOK)
	}
	var envelope TradeEnvelope
	if err := json.NewDecoder(response.Body).Decode(&envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if envelope.Trade.TradeStatus != "pending" ||
		envelope.Trade.TradeAcceptedDate == nil {
		t.Fatalf("unexpected accepted trade: %#v", envelope.Trade)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet DB expectations: %v", err)
	}
}

func TestAcceptTradeHandler_RejectsPokemonAlreadyInPendingTrade(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT \\* FROM `trades` WHERE trade_id = \\?").
		WithArgs("trade-1", 1).
		WillReturnRows(tradeMockRows("proposed", false, false))
	mock.ExpectQuery("SELECT \\* FROM `instances` WHERE instance_id = \\?").
		WithArgs("instance-1", 1).
		WillReturnRows(instanceMockRows("instance-1", "user-1"))
	mock.ExpectQuery("SELECT \\* FROM `instances` WHERE instance_id = \\?").
		WithArgs("instance-2", 1).
		WillReturnRows(instanceMockRows("instance-2", "user-2"))
	mock.ExpectQuery("SELECT count\\(\\*\\) FROM `trades`").
		WillReturnRows(sqlmock.NewRows([]string{"count(*)"}).AddRow(1))
	mock.ExpectRollback()

	response := executeTradeRequest(
		t, newHandlerTestApp("user-2"), http.MethodPost,
		"/api/trades/trade-1/accept", nil,
	)
	if response.StatusCode != http.StatusConflict {
		t.Fatalf("unexpected status: got %d, want %d", response.StatusCode, http.StatusConflict)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet DB expectations: %v", err)
	}
}

func TestCreateTradeHandler_RejectsBlockedTradePartnerBeforeInstanceLocks(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	mock.ExpectQuery("SELECT \\* FROM `users` WHERE user_id = \\?").
		WithArgs("user-1", 1).
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "username"}).
			AddRow("user-1", "ash"))
	mock.ExpectQuery("SELECT \\* FROM `users` WHERE LOWER\\(username\\) = \\?").
		WithArgs("misty", 1).
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "username"}).
			AddRow("user-2", "misty"))
	mock.ExpectQuery("SELECT count\\(\\*\\) FROM `user_blocks`").
		WillReturnRows(sqlmock.NewRows([]string{"count(*)"}).AddRow(1))
	mock.ExpectQuery("SELECT \\* FROM `user_profiles` WHERE user_id = \\?").
		WithArgs("user-2", 1).
		WillReturnRows(sqlmock.NewRows([]string{
			"user_id", "collection_visibility",
		}).AddRow("user-2", "public"))

	response := executeTradeRequest(
		t, newHandlerTestApp("user-1"), http.MethodPost,
		"/api/trades", map[string]any{
			"username_accepting":                 "misty",
			"pokemon_instance_id_user_proposed":  "instance-1",
			"pokemon_instance_id_user_accepting": "instance-2",
			"trade_friendship_level":             2,
			"trade_dust_cost":                    100,
			"is_special_trade":                   false,
			"is_registered_trade":                true,
			"is_lucky_trade":                     false,
		},
	)
	if response.StatusCode != http.StatusForbidden {
		t.Fatalf("unexpected status: got %d, want %d", response.StatusCode, http.StatusForbidden)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet DB expectations: %v", err)
	}
}

func TestDenyTradeHandler_RejectsProposerAndDuplicateDenial(t *testing.T) {
	tests := []struct {
		name       string
		viewerID   string
		status     string
		wantStatus int
	}{
		{name: "proposer", viewerID: "user-1", status: "proposed", wantStatus: http.StatusForbidden},
		{name: "duplicate", viewerID: "user-2", status: "denied", wantStatus: http.StatusConflict},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			mock, cleanup := setupMockDB(t)
			defer cleanup()

			mock.ExpectBegin()
			mock.ExpectQuery("SELECT \\* FROM `trades` WHERE trade_id = \\?").
				WithArgs("trade-1", 1).
				WillReturnRows(tradeMockRows(test.status, false, false))
			mock.ExpectRollback()

			response := executeTradeRequest(
				t, newHandlerTestApp(test.viewerID), http.MethodPost,
				"/api/trades/trade-1/deny", nil,
			)
			if response.StatusCode != test.wantStatus {
				t.Fatalf("unexpected status: got %d, want %d", response.StatusCode, test.wantStatus)
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatalf("unmet DB expectations: %v", err)
			}
		})
	}
}

func TestCancelTradeHandler_EitherParticipantCanCancelPendingTrade(t *testing.T) {
	for _, viewerID := range []string{"user-1", "user-2"} {
		t.Run(viewerID, func(t *testing.T) {
			mock, cleanup := setupMockDB(t)
			defer cleanup()

			mock.ExpectBegin()
			mock.ExpectQuery("SELECT \\* FROM `trades` WHERE trade_id = \\?").
				WithArgs("trade-1", 1).
				WillReturnRows(tradeMockRows("pending", false, false))
			expectTradeTransitionWrite(mock)
			mock.ExpectCommit()

			response := executeTradeRequest(
				t, newHandlerTestApp(viewerID), http.MethodPost,
				"/api/trades/trade-1/cancel", nil,
			)
			if response.StatusCode != http.StatusOK {
				t.Fatalf("unexpected status: got %d, want %d", response.StatusCode, http.StatusOK)
			}
			var envelope TradeEnvelope
			if err := json.NewDecoder(response.Body).Decode(&envelope); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			wantUsername := "ash"
			if viewerID == "user-2" {
				wantUsername = "misty"
			}
			if envelope.Trade.TradeStatus != "cancelled" ||
				envelope.Trade.TradeCancelledBy == nil ||
				*envelope.Trade.TradeCancelledBy != wantUsername {
				t.Fatalf("unexpected cancelled trade: %#v", envelope.Trade)
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatalf("unmet DB expectations: %v", err)
			}
		})
	}
}

func TestCompleteTradeHandler_RejectsDuplicateConfirmationBeforeTransfer(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT \\* FROM `trades` WHERE trade_id = \\?").
		WithArgs("trade-1", 1).
		WillReturnRows(tradeMockRows("pending", true, false))
	mock.ExpectQuery("SELECT \\* FROM `instances` WHERE instance_id = \\?").
		WithArgs("instance-1", 1).
		WillReturnRows(instanceMockRows("instance-1", "user-1"))
	mock.ExpectQuery("SELECT \\* FROM `instances` WHERE instance_id = \\?").
		WithArgs("instance-2", 1).
		WillReturnRows(instanceMockRows("instance-2", "user-2"))
	mock.ExpectRollback()

	response := executeTradeRequest(
		t, newHandlerTestApp("user-1"), http.MethodPost,
		"/api/trades/trade-1/complete-confirmation", nil,
	)
	if response.StatusCode != http.StatusConflict {
		t.Fatalf("unexpected status: got %d, want %d", response.StatusCode, http.StatusConflict)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet DB expectations: %v", err)
	}
}

func TestCompleteTradeHandler_FirstConfirmationDoesNotTransferPokemon(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT \\* FROM `trades` WHERE trade_id = \\?").
		WithArgs("trade-1", 1).
		WillReturnRows(tradeMockRows("pending", false, false))
	mock.ExpectQuery("SELECT \\* FROM `instances` WHERE instance_id = \\?").
		WithArgs("instance-1", 1).
		WillReturnRows(instanceMockRows("instance-1", "user-1"))
	mock.ExpectQuery("SELECT \\* FROM `instances` WHERE instance_id = \\?").
		WithArgs("instance-2", 1).
		WillReturnRows(instanceMockRows("instance-2", "user-2"))
	expectTradeTransitionWrite(mock)
	mock.ExpectCommit()

	response := executeTradeRequest(
		t, newHandlerTestApp("user-1"), http.MethodPost,
		"/api/trades/trade-1/complete-confirmation", nil,
	)
	if response.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: got %d, want %d", response.StatusCode, http.StatusOK)
	}
	var envelope TradeEnvelope
	if err := json.NewDecoder(response.Body).Decode(&envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if envelope.Trade.TradeStatus != "pending" ||
		!envelope.Trade.UserProposedCompletionConfirmed ||
		len(envelope.AffectedInstances) != 0 {
		t.Fatalf("first confirmation transferred state prematurely: %#v", envelope)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet DB expectations: %v", err)
	}
}

func TestUpdateTradeSatisfactionHandler_RequiresCompletedParticipant(t *testing.T) {
	tests := []struct {
		name       string
		viewerID   string
		status     string
		wantStatus int
	}{
		{name: "active trade", viewerID: "user-1", status: "pending", wantStatus: http.StatusConflict},
		{name: "outsider", viewerID: "user-3", status: "completed", wantStatus: http.StatusForbidden},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			mock, cleanup := setupMockDB(t)
			defer cleanup()

			mock.ExpectBegin()
			mock.ExpectQuery("SELECT \\* FROM `trades` WHERE trade_id = \\?").
				WithArgs("trade-1", 1).
				WillReturnRows(tradeMockRows(test.status, true, true))
			mock.ExpectRollback()

			response := executeTradeRequest(
				t, newHandlerTestApp(test.viewerID), http.MethodPut,
				"/api/trades/trade-1/satisfaction", map[string]any{"satisfied": true},
			)
			if response.StatusCode != test.wantStatus {
				t.Fatalf("unexpected status: got %d, want %d", response.StatusCode, test.wantStatus)
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatalf("unmet DB expectations: %v", err)
			}
		})
	}
}

func TestUpdateTradeSatisfactionHandler_UpdatesOnlyCurrentParticipant(t *testing.T) {
	for _, test := range []struct {
		viewerID string
		proposer bool
	}{
		{viewerID: "user-1", proposer: true},
		{viewerID: "user-2", proposer: false},
	} {
		t.Run(test.viewerID, func(t *testing.T) {
			mock, cleanup := setupMockDB(t)
			defer cleanup()

			mock.ExpectBegin()
			mock.ExpectQuery("SELECT \\* FROM `trades` WHERE trade_id = \\?").
				WithArgs("trade-1", 1).
				WillReturnRows(tradeMockRows("completed", true, true))
			expectTradeTransitionWrite(mock)
			mock.ExpectCommit()

			response := executeTradeRequest(
				t, newHandlerTestApp(test.viewerID), http.MethodPut,
				"/api/trades/trade-1/satisfaction", map[string]any{"satisfied": true},
			)
			if response.StatusCode != http.StatusOK {
				t.Fatalf("unexpected status: got %d, want %d", response.StatusCode, http.StatusOK)
			}
			var envelope TradeEnvelope
			if err := json.NewDecoder(response.Body).Decode(&envelope); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			if test.proposer {
				if envelope.Trade.User1TradeSatisfaction == nil ||
					!*envelope.Trade.User1TradeSatisfaction ||
					envelope.Trade.User2TradeSatisfaction != nil {
					t.Fatalf("unexpected proposer satisfaction: %#v", envelope.Trade)
				}
			} else if envelope.Trade.User2TradeSatisfaction == nil ||
				!*envelope.Trade.User2TradeSatisfaction ||
				envelope.Trade.User1TradeSatisfaction != nil {
				t.Fatalf("unexpected accepter satisfaction: %#v", envelope.Trade)
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatalf("unmet DB expectations: %v", err)
			}
		})
	}
}

func TestDeleteTradeHandler_OnlyDeletesTerminalTrades(t *testing.T) {
	for _, status := range []string{"proposed", "pending"} {
		t.Run(status, func(t *testing.T) {
			mock, cleanup := setupMockDB(t)
			defer cleanup()

			mock.ExpectBegin()
			mock.ExpectQuery("SELECT \\* FROM `trades` WHERE trade_id = \\?").
				WithArgs("trade-1", 1).
				WillReturnRows(tradeMockRows(status, false, false))
			mock.ExpectRollback()

			response := executeTradeRequest(
				t, newHandlerTestApp("user-1"), http.MethodDelete,
				"/api/trades/trade-1", nil,
			)
			if response.StatusCode != http.StatusConflict {
				t.Fatalf("unexpected status: got %d, want %d", response.StatusCode, http.StatusConflict)
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatalf("unmet DB expectations: %v", err)
			}
		})
	}
}

func TestReproposeTradeHandler_AllowsEitherTerminalProposalOutcome(t *testing.T) {
	for _, status := range []string{"cancelled", "denied"} {
		t.Run(status, func(t *testing.T) {
			mock, cleanup := setupMockDB(t)
			defer cleanup()

			mock.ExpectBegin()
			mock.ExpectQuery("SELECT \\* FROM `trades` WHERE trade_id = \\?").
				WithArgs("trade-1", 1).
				WillReturnRows(tradeMockRows(status, false, false))
			mock.ExpectQuery("SELECT \\* FROM `instances` WHERE instance_id = \\?").
				WithArgs("instance-1", 1).
				WillReturnRows(instanceMockRows("instance-1", "user-1"))
			mock.ExpectQuery("SELECT \\* FROM `instances` WHERE instance_id = \\?").
				WithArgs("instance-2", 1).
				WillReturnRows(instanceMockRows("instance-2", "user-2"))
			mock.ExpectQuery("SELECT count\\(\\*\\) FROM `trades`").
				WillReturnRows(sqlmock.NewRows([]string{"count(*)"}).AddRow(0))
			expectTradeTransitionWrite(mock)
			mock.ExpectCommit()

			response := executeTradeRequest(
				t, newHandlerTestApp("user-1"), http.MethodPost,
				"/api/trades/trade-1/repropose", nil,
			)
			if response.StatusCode != http.StatusOK {
				t.Fatalf("unexpected status: got %d, want %d", response.StatusCode, http.StatusOK)
			}
			var envelope TradeEnvelope
			if err := json.NewDecoder(response.Body).Decode(&envelope); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			if envelope.Trade.TradeStatus != "proposed" ||
				envelope.Trade.UserProposedCompletionConfirmed ||
				envelope.Trade.UserAcceptingCompletionConfirmed {
				t.Fatalf("unexpected re-proposed trade: %#v", envelope.Trade)
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatalf("unmet DB expectations: %v", err)
			}
		})
	}
}

func TestReproposeTradeHandler_RejectsConflictingActiveTrade(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT \\* FROM `trades` WHERE trade_id = \\?").
		WithArgs("trade-1", 1).
		WillReturnRows(tradeMockRows("cancelled", false, false))
	mock.ExpectQuery("SELECT \\* FROM `instances` WHERE instance_id = \\?").
		WithArgs("instance-1", 1).
		WillReturnRows(instanceMockRows("instance-1", "user-1"))
	mock.ExpectQuery("SELECT \\* FROM `instances` WHERE instance_id = \\?").
		WithArgs("instance-2", 1).
		WillReturnRows(instanceMockRows("instance-2", "user-2"))
	mock.ExpectQuery("SELECT count\\(\\*\\) FROM `trades`").
		WillReturnRows(sqlmock.NewRows([]string{"count(*)"}).AddRow(1))
	mock.ExpectRollback()

	response := executeTradeRequest(
		t, newHandlerTestApp("user-1"), http.MethodPost,
		"/api/trades/trade-1/repropose", nil,
	)
	if response.StatusCode != http.StatusConflict {
		t.Fatalf("unexpected status: got %d, want %d", response.StatusCode, http.StatusConflict)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet DB expectations: %v", err)
	}
}
