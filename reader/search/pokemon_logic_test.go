package main

import (
	"math"
	"testing"
)

func intPtr(v int) *int           { return &v }
func strPtr(v string) *string     { return &v }
func floatPtr(v float64) *float64 { return &v }

func TestHaversine(t *testing.T) {
	if got := haversine(0, 0, 0, 0); got != 0 {
		t.Fatalf("expected 0, got %f", got)
	}

	sfToLA := haversine(37.7749, -122.4194, 34.0522, -118.2437)
	if math.Abs(sfToLA-559) > 20 {
		t.Fatalf("unexpected haversine distance: got %.2fkm", sfToLA)
	}
}

func TestSearchRelatedInstancesAreGroupedByUniqueUser(t *testing.T) {
	instances := []PokemonInstance{
		{InstanceID: "one", UserID: "user-a"},
		{InstanceID: "two", UserID: "user-a"},
		{InstanceID: "three", UserID: "user-b"},
		{InstanceID: "orphan"},
	}

	userIDs := uniqueInstanceUserIDs(instances)
	if len(userIDs) != 2 || userIDs[0] != "user-a" || userIDs[1] != "user-b" {
		t.Fatalf("unexpected unique user ids: %#v", userIDs)
	}

	grouped := groupInstancesByUser(instances)
	if len(grouped) != 2 || len(grouped["user-a"]) != 2 || len(grouped["user-b"]) != 1 {
		t.Fatalf("unexpected grouped instances: %#v", grouped)
	}
}

func TestInstancesMatchEnforcesWantedSizePreferences(t *testing.T) {
	wanted := PokemonInstance{
		PokemonID: 1,
		IsWanted:  true,
		WantedSizes: RawJSON(`{
			"weight":{"category":"XS","min":4,"max":5,"min_inclusive":true,"max_inclusive":false},
			"height":{"category":"XXL","min":0.9,"max":null,"min_inclusive":false,"max_inclusive":false}
		}`),
	}
	offered := PokemonInstance{
		PokemonID:  1,
		IsForTrade: true,
		Weight:     floatPtr(4.5),
		Height:     floatPtr(1.0),
	}

	matched, reason := instancesMatch(wanted, offered)
	if !matched || reason != "" {
		t.Fatalf("expected wanted size preferences to match, got matched=%v reason=%q", matched, reason)
	}

	offered.Weight = floatPtr(5)
	matched, reason = instancesMatch(offered, wanted)
	if matched || reason != "Weight does not satisfy XS preference" {
		t.Fatalf("expected exclusive XS maximum mismatch, got matched=%v reason=%q", matched, reason)
	}

	offered.Weight = floatPtr(4.5)
	offered.Height = nil
	matched, reason = instancesMatch(wanted, offered)
	if matched || reason != "Height is required for XXL preference" {
		t.Fatalf("expected missing height mismatch, got matched=%v reason=%q", matched, reason)
	}
}

func TestInstancesMatchIgnoresAbsentWantedSizePreferences(t *testing.T) {
	wanted := PokemonInstance{PokemonID: 1, IsWanted: true}
	offered := PokemonInstance{PokemonID: 1, IsForTrade: true}

	matched, reason := instancesMatch(wanted, offered)
	if !matched || reason != "" {
		t.Fatalf("expected absent size preferences not to restrict matching, got matched=%v reason=%q", matched, reason)
	}
}

func TestMatchesWantedSizeRangeHonorsEveryCategoryBoundary(t *testing.T) {
	testCases := []struct {
		name       string
		preference wantedSizeRange
		value      float64
		wantMatch  bool
	}{
		{"XXS below maximum", wantedSizeRange{Category: "XXS", Max: floatPtr(4)}, 3.9, true},
		{"XXS excludes maximum", wantedSizeRange{Category: "XXS", Max: floatPtr(4)}, 4, false},
		{"XS includes minimum", wantedSizeRange{Category: "XS", Min: floatPtr(4), Max: floatPtr(5), MinInclusive: true}, 4, true},
		{"XS excludes maximum", wantedSizeRange{Category: "XS", Min: floatPtr(4), Max: floatPtr(5), MinInclusive: true}, 5, false},
		{"XL excludes minimum", wantedSizeRange{Category: "XL", Min: floatPtr(8), Max: floatPtr(9), MaxInclusive: true}, 8, false},
		{"XL includes maximum", wantedSizeRange{Category: "XL", Min: floatPtr(8), Max: floatPtr(9), MaxInclusive: true}, 9, true},
		{"XXL excludes minimum", wantedSizeRange{Category: "XXL", Min: floatPtr(9)}, 9, false},
		{"XXL above minimum", wantedSizeRange{Category: "XXL", Min: floatPtr(9)}, 9.1, true},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			matched, _ := matchesWantedSizeRange("Weight", floatPtr(testCase.value), &testCase.preference)
			if matched != testCase.wantMatch {
				t.Fatalf("matchesWantedSizeRange() = %v, want %v", matched, testCase.wantMatch)
			}
		})
	}
}

func TestInstancesMatch(t *testing.T) {
	base := PokemonInstance{
		PokemonID:      25,
		Shiny:          true,
		Shadow:         false,
		CostumeID:      intPtr(1),
		Gender:         strPtr("Female"),
		LocationCard:   strPtr("11"),
		Dynamax:        true,
		Gigantamax:     false,
		FastMoveID:     intPtr(10),
		ChargedMove1ID: intPtr(20),
		ChargedMove2ID: intPtr(30),
	}

	sameDifferentMoveOrder := base
	sameDifferentMoveOrder.ChargedMove1ID = intPtr(30)
	sameDifferentMoveOrder.ChargedMove2ID = intPtr(20)

	matched, reason := instancesMatch(base, sameDifferentMoveOrder)
	if !matched || reason != "" {
		t.Fatalf("expected match with swapped charged moves, got matched=%v reason=%q", matched, reason)
	}

	diff := base
	diff.PokemonID = 26
	matched, _ = instancesMatch(base, diff)
	if matched {
		t.Fatalf("expected mismatch for different pokemon_id")
	}

	diffCard := base
	diffCard.LocationCard = strPtr("12")
	matched, reason = instancesMatch(base, diffCard)
	if matched || reason != "LocationCard mismatch" {
		t.Fatalf("expected location mismatch, got matched=%v reason=%q", matched, reason)
	}
}
