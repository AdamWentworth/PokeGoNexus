package main

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/gofiber/fiber/v3"
)

func TestValidateTagName(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		expected  string
		wantError bool
	}{
		{name: "normalizes whitespace", input: "  Community   Day  ", expected: "Community Day"},
		{name: "rejects blank", input: "   ", wantError: true},
		{name: "rejects reserved built in", input: "most WANTED", wantError: true},
		{name: "rejects over forty runes", input: "12345678901234567890123456789012345678901", wantError: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, message := validateTagName(test.input)
			if test.wantError && message == "" {
				t.Fatalf("expected validation error, got %q", got)
			}
			if !test.wantError && (message != "" || got != test.expected) {
				t.Fatalf("got (%q, %q), want (%q, no error)", got, message, test.expected)
			}
		})
	}
}

func TestValidateTagColor(t *testing.T) {
	if got, message := validateTagColor(" #1a2b3c "); got != "#1A2B3C" || message != "" {
		t.Fatalf("unexpected normalized color: %q, %q", got, message)
	}
	for _, invalid := range []string{"red", "#123", "#12345G", "123456"} {
		if _, message := validateTagColor(invalid); message == "" {
			t.Fatalf("expected %q to be rejected", invalid)
		}
	}
}

func TestBuiltInTagsCannotBeTreatedAsCustom(t *testing.T) {
	builtIns := []PokemonTag{
		{Parent: "caught", Name: "Favorite"},
		{Parent: "trade", Name: "For Trade"},
		{Parent: "wanted", Name: "Wanted"},
		{Parent: "wanted", Name: "Most Wanted"},
	}
	for _, tag := range builtIns {
		if !isBuiltInTag(tag) {
			t.Fatalf("expected %#v to be built in", tag)
		}
	}
	if isBuiltInTag(PokemonTag{Parent: "caught", Name: "Raid team"}) {
		t.Fatal("custom tag was classified as built in")
	}
}

func TestCustomTagParentsExcludeTrade(t *testing.T) {
	if !validCustomTagParent("caught") || !validCustomTagParent("wanted") {
		t.Fatal("expected caught and wanted to be valid custom tag parents")
	}
	if validCustomTagParent("trade") {
		t.Fatal("trade is a built-in state, not a custom tag parent")
	}
}

func TestNormalizeTagOrderPreservesInterleavingAndRepairsStaleKeys(t *testing.T) {
	tags := []PokemonTag{
		{TagID: "tag-shadow", Parent: "caught", Name: "Shadow Shinies"},
		{TagID: "tag-raids", Parent: "caught", Name: "Raid team"},
	}
	stored := []string{
		"custom:tag-shadow",
		"system:favorites",
		"custom:deleted",
		"system:caught",
		"system:trade",
		"system:favorites",
	}

	got := normalizeTagOrder("caught", stored, tags)
	want := []string{
		"custom:tag-shadow",
		"system:favorites",
		"system:caught",
		"system:trade",
		"custom:tag-raids",
	}
	if len(got) != len(want) {
		t.Fatalf("unexpected normalized order: %#v", got)
	}
	for index := range want {
		if got[index] != want[index] {
			t.Fatalf("order[%d] = %q, want %q; full order %#v", index, got[index], want[index], got)
		}
	}
}

func TestGetTagsHandlerReturnsOnlyCustomDefinitions(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	mock.ExpectQuery("SELECT .* FROM `tags` WHERE user_id = \\? AND parent IN \\(.+\\) AND deleted_at IS NULL ORDER BY").
		WithArgs("user-1", "caught", "wanted").
		WillReturnRows(sqlmock.NewRows([]string{
			"tag_id", "user_id", "parent", "name", "color", "sort", "created_at",
		}).
			AddRow("builtin-favorite", "user-1", "caught", "Favorite", "#FACC15", 10, time.Now()).
			AddRow("custom-raids", "user-1", "caught", "Raid team", "#2563EB", 20, time.Now()))
	mock.ExpectQuery("SELECT .* FROM `tag_orders` WHERE user_id = \\? AND parent IN \\(.+\\)").
		WithArgs("user-1", "caught", "wanted").
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "parent", "tag_keys", "updated_at"}).
			AddRow("user-1", "caught", `["custom:custom-raids","system:caught","system:favorites","system:trade"]`, time.Now()))

	app := newHandlerTestApp("user-1")
	response, err := app.Test(makeJSONRequest(t, http.MethodGet, "/api/tags", nil), fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if response.StatusCode != http.StatusOK {
		var errorBody map[string]interface{}
		_ = json.NewDecoder(response.Body).Decode(&errorBody)
		t.Fatalf("unexpected status: got %d, want %d; body %#v", response.StatusCode, http.StatusOK, errorBody)
	}
	var body struct {
		Tags   []PokemonTag      `json:"tags"`
		Orders tagOrdersResponse `json:"orders"`
	}
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(body.Tags) != 1 || body.Tags[0].TagID != "custom-raids" {
		t.Fatalf("unexpected custom tags response: %#v", body.Tags)
	}
	if len(body.Orders.Caught) != 4 || body.Orders.Caught[0] != "custom:custom-raids" {
		t.Fatalf("unexpected caught tag order: %#v", body.Orders.Caught)
	}
	if len(body.Orders.Wanted) != 2 || body.Orders.Wanted[0] != "system:wanted" {
		t.Fatalf("unexpected wanted tag order: %#v", body.Orders.Wanted)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet DB expectations: %v", err)
	}
}

func TestUpdateTagOrderHandlerAllowsSystemAndCustomTagsToInterleave(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	mock.ExpectQuery("SELECT .* FROM `tags` WHERE user_id = \\? AND parent = \\? AND deleted_at IS NULL ORDER BY").
		WithArgs("user-1", "caught").
		WillReturnRows(sqlmock.NewRows([]string{
			"tag_id", "user_id", "parent", "name", "color", "sort", "created_at",
		}).AddRow("tag-shadow", "user-1", "caught", "Shadow Shinies", "#7C3AED", 10, time.Now()))
	mock.ExpectBegin()
	mock.ExpectExec("INSERT INTO `tag_orders`").
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	requested := []string{
		"custom:tag-shadow",
		"system:favorites",
		"system:caught",
		"system:trade",
	}
	app := newHandlerTestApp("user-1")
	response, err := app.Test(makeJSONRequest(t, http.MethodPut, "/api/tags/order", map[string]interface{}{
		"parent": "caught", "tag_keys": requested,
	}), fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if response.StatusCode != http.StatusOK {
		var errorBody map[string]interface{}
		_ = json.NewDecoder(response.Body).Decode(&errorBody)
		t.Fatalf("unexpected status: got %d, want %d; body %#v", response.StatusCode, http.StatusOK, errorBody)
	}
	var body struct {
		Parent  string   `json:"parent"`
		TagKeys []string `json:"tag_keys"`
	}
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Parent != "caught" || len(body.TagKeys) != len(requested) || body.TagKeys[0] != requested[0] {
		t.Fatalf("unexpected order response: %#v", body)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet DB expectations: %v", err)
	}
}

func TestUpdateTagOrderHandlerRejectsMissingOrCrossParentKeys(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	mock.ExpectQuery("SELECT .* FROM `tags` WHERE user_id = \\? AND parent = \\? AND deleted_at IS NULL ORDER BY").
		WithArgs("user-1", "wanted").
		WillReturnRows(sqlmock.NewRows([]string{
			"tag_id", "user_id", "parent", "name", "color", "sort", "created_at",
		}).AddRow("tag-priority", "user-1", "wanted", "Priority", "#DC2626", 10, time.Now()))

	app := newHandlerTestApp("user-1")
	response, err := app.Test(makeJSONRequest(t, http.MethodPut, "/api/tags/order", map[string]interface{}{
		"parent":   "wanted",
		"tag_keys": []string{"system:wanted", "system:trade", "custom:tag-priority"},
	}), fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if response.StatusCode != http.StatusBadRequest {
		t.Fatalf("unexpected status: got %d, want %d", response.StatusCode, http.StatusBadRequest)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet DB expectations: %v", err)
	}
}

func TestCreateTagHandlerRejectsReservedNameBeforeWriting(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	app := newHandlerTestApp("user-1")
	response, err := app.Test(makeJSONRequest(t, http.MethodPost, "/api/tags", map[string]interface{}{
		"parent": "caught",
		"name":   "Favorites",
		"color":  "#2563EB",
	}), fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if response.StatusCode != http.StatusBadRequest {
		t.Fatalf("unexpected status: got %d, want %d", response.StatusCode, http.StatusBadRequest)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected DB access: %v", err)
	}
}

func TestDeleteTagHandlerCannotAccessAnotherUsersTag(t *testing.T) {
	mock, cleanup := setupMockDB(t)
	defer cleanup()

	mock.ExpectQuery("SELECT .* FROM `tags` WHERE tag_id = \\? AND user_id = \\? AND deleted_at IS NULL ORDER BY .* LIMIT \\?").
		WithArgs("tag-other", "user-1", 1).
		WillReturnRows(sqlmock.NewRows([]string{"tag_id", "user_id", "parent", "name"}))

	app := newHandlerTestApp("user-1")
	response, err := app.Test(makeJSONRequest(t, http.MethodDelete, "/api/tags/tag-other", nil), fiber.TestConfig{Timeout: 0})
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if response.StatusCode != http.StatusNotFound {
		t.Fatalf("unexpected status: got %d, want %d", response.StatusCode, http.StatusNotFound)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet DB expectations: %v", err)
	}
}
