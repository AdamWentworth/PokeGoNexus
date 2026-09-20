package builder

import (
	"math"
	"reflect"
	"testing"

	"pokemon_data/internal/orderedjson"
)

func TestPayloadHelpersPreserveLegacyConversions(t *testing.T) {
	t.Parallel()

	integerCases := []struct {
		value any
		want  int
		ok    bool
	}{
		{value: 7, want: 7, ok: true},
		{value: int64(8), want: 8, ok: true},
		{value: float64(9), want: 9, ok: true},
		{value: []byte("10"), want: 10, ok: true},
		{value: "11", want: 11, ok: true},
		{value: "bad", want: 0, ok: false},
		{value: math.MaxFloat64, want: 0, ok: false},
		{value: math.NaN(), want: 0, ok: false},
		{value: float64(9.5), want: 0, ok: false},
		{value: nil, want: 0, ok: false},
	}
	for _, testCase := range integerCases {
		got, ok := asIntOK(testCase.value)
		if got != testCase.want || ok != testCase.ok {
			t.Fatalf("asIntOK(%#v) = %d, %v; want %d, %v", testCase.value, got, ok, testCase.want, testCase.ok)
		}
	}

	if got, ok := asStringOK([]byte("Bulbasaur")); !ok || got != "Bulbasaur" {
		t.Fatalf("asStringOK bytes = %q, %v", got, ok)
	}
	if got, ok := asStringOK(1); ok || got != "" {
		t.Fatalf("asStringOK integer = %q, %v", got, ok)
	}
	if got := asString("Ivysaur"); got != "Ivysaur" {
		t.Fatalf("asString = %q", got)
	}
	if got := asInt("12"); got != 12 {
		t.Fatalf("asInt = %d", got)
	}

	if got := lower("Mega-X"); got != "mega-x" {
		t.Fatalf("lower = %q", got)
	}
	if got := iconPath(""); got != nil {
		t.Fatalf("iconPath empty = %#v", got)
	}
	if got := iconPath("Fire"); got != "/images/types/fire.png" {
		t.Fatalf("iconPath Fire = %#v", got)
	}
	if got := nullIfEmpty(1); got != nil {
		t.Fatalf("nullIfEmpty non-string = %#v", got)
	}
	if got := nullIfEmpty("value"); got != "value" {
		t.Fatalf("nullIfEmpty value = %#v", got)
	}
	if got := nullIfZero("bad"); got != nil {
		t.Fatalf("nullIfZero invalid = %#v", got)
	}
	if got := nullIfZero(4); got != 4 {
		t.Fatalf("nullIfZero value = %#v", got)
	}
}

func TestPayloadCollectionHelpersHandleMissingAndOrderedData(t *testing.T) {
	t.Parallel()

	appendTo(nil, "moves", "ignored")
	payload := map[string]any{}
	appendTo(payload, "moves", "Tackle")
	appendTo(payload, "moves", "Vine Whip")
	if got := payload["moves"]; !reflect.DeepEqual(got, []any{"Tackle", "Vine Whip"}) {
		t.Fatalf("appendTo moves = %#v", got)
	}

	original := map[string]any{"pokemon_id": 1}
	copy := cloneMap(original)
	copy["pokemon_id"] = 2
	if original["pokemon_id"] != 1 {
		t.Fatalf("cloneMap mutated original: %#v", original)
	}

	if got := nonNilSlice(nil); len(got) != 0 {
		t.Fatalf("nonNilSlice nil = %#v", got)
	}
	items := []any{"one"}
	if got := nonNilSlice(items); !reflect.DeepEqual(got, items) {
		t.Fatalf("nonNilSlice items = %#v", got)
	}

	ordered := orderedjson.Map{M: map[string]any{"fusion_id": 3}}
	if got, ok := unwrapOrderedMap(ordered); !ok || got["fusion_id"] != 3 {
		t.Fatalf("unwrapOrderedMap ordered = %#v, %v", got, ok)
	}
	plain := map[string]any{"id": 4}
	if got, ok := unwrapOrderedMap(plain); !ok || got["id"] != 4 {
		t.Fatalf("unwrapOrderedMap plain = %#v, %v", got, ok)
	}
	if got, ok := unwrapOrderedMap("invalid"); ok || got != nil {
		t.Fatalf("unwrapOrderedMap invalid = %#v, %v", got, ok)
	}
}
