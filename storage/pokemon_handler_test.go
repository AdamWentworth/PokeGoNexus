package main

import "testing"

func TestShouldApplyInstanceMutationUsesStrictlyNewerTimestamp(t *testing.T) {
	if shouldApplyInstanceMutation(20, 20) {
		t.Fatal("equal timestamp must be idempotently ignored")
	}
	if shouldApplyInstanceMutation(20, 19) {
		t.Fatal("stale mutation must be ignored")
	}
	if !shouldApplyInstanceMutation(20, 21) {
		t.Fatal("strictly newer mutation should be applied")
	}
}

func TestResolveTrackedVariantIDUsesIncomingVariant(t *testing.T) {
	incomingValue := "0025-default"

	resolvedPointer, registrationVariant, ok := resolveTrackedVariantID(&incomingValue, "0001-default")

	if !ok {
		t.Fatalf("expected incoming variant to resolve")
	}
	if resolvedPointer == nil || *resolvedPointer != "0025-default" {
		t.Fatalf("expected incoming variant pointer, got %#v", resolvedPointer)
	}
	if registrationVariant != "0025-default" {
		t.Fatalf("expected incoming variant for registration, got %q", registrationVariant)
	}
}

func TestResolveTrackedVariantIDFallsBackToExistingVariant(t *testing.T) {
	resolvedPointer, registrationVariant, ok := resolveTrackedVariantID(nil, "0001-default")

	if !ok {
		t.Fatalf("expected existing variant to resolve")
	}
	if resolvedPointer == nil || *resolvedPointer != "0001-default" {
		t.Fatalf("expected existing variant pointer, got %#v", resolvedPointer)
	}
	if registrationVariant != "0001-default" {
		t.Fatalf("expected existing variant for registration, got %q", registrationVariant)
	}
}

func TestResolveTrackedVariantIDRejectsMissingVariant(t *testing.T) {
	resolvedPointer, registrationVariant, ok := resolveTrackedVariantID(nil, "")

	if ok {
		t.Fatalf("expected missing variant to be rejected")
	}
	if resolvedPointer != nil {
		t.Fatalf("expected nil pointer, got %#v", resolvedPointer)
	}
	if registrationVariant != "" {
		t.Fatalf("expected empty registration variant, got %q", registrationVariant)
	}
}

func TestHasExplicitEmptyStringRejectsNullOrEmptyVariantID(t *testing.T) {
	if hasExplicitEmptyString(map[string]interface{}{}, "variant_id") {
		t.Fatalf("missing variant_id should be allowed as omission")
	}
	if !hasExplicitEmptyString(map[string]interface{}{"variant_id": nil}, "variant_id") {
		t.Fatalf("explicit null variant_id should be invalid")
	}
	if !hasExplicitEmptyString(map[string]interface{}{"variant_id": ""}, "variant_id") {
		t.Fatalf("empty variant_id should be invalid")
	}
	if hasExplicitEmptyString(map[string]interface{}{"variant_id": "0025-default"}, "variant_id") {
		t.Fatalf("non-empty variant_id should be valid")
	}
}

func TestAddOptionalJSONUpdatePreservesFieldsOmittedByOlderClients(t *testing.T) {
	updates := map[string]interface{}{}
	addOptionalJSONUpdate(updates, map[string]interface{}{}, "wanted_size_preferences")
	if _, exists := updates["wanted_size_preferences"]; exists {
		t.Fatal("omitted wanted size preferences must preserve the stored value")
	}

	addOptionalJSONUpdate(
		updates,
		map[string]interface{}{"wanted_size_preferences": nil},
		"wanted_size_preferences",
	)
	if got := updates["wanted_size_preferences"]; got != "{}" {
		t.Fatalf("explicit null should clear preferences to an empty object, got %#v", got)
	}
}
