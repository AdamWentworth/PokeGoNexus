package main

import "testing"

func TestRequiredMissingInstanceColumns(t *testing.T) {
	prevColumns := instanceColumns
	t.Cleanup(func() { instanceColumns = prevColumns })

	instanceColumns = map[string]bool{
		"instance_id":     true,
		"user_id":         true,
		"pokemon_id":      true,
		"variant_id":      true,
		"registered":      true,
		"is_caught":       true,
		"is_for_trade":    true,
		"is_wanted":       true,
		"most_wanted":     true,
		"caught_tags":     true,
		"trade_tags":      true,
		"wanted_tags":     true,
		"not_trade_list":  true,
		"not_wanted_list": true,
		"trade_filters":   true,
		"wanted_filters":  true,
		"fusion":          true,
		"disabled":        true,
		"last_update":     true,
		"date_added":      true,
	}
	instanceColumns["wanted_size_preferences"] = true

	missing := requiredMissingInstanceColumns()
	if len(missing) != 0 {
		t.Fatalf("expected no missing columns, got %#v", missing)
	}
}

func TestFilterInstanceColumns(t *testing.T) {
	prevColumns := instanceColumns
	t.Cleanup(func() { instanceColumns = prevColumns })

	instanceColumns = map[string]bool{
		"instance_id": true,
		"is_caught":   true,
	}

	in := map[string]interface{}{
		"instance_id": "abc",
		"is_caught":   true,
		"legacy_flag": true,
	}
	out := filterInstanceColumns(in)

	if len(out) != 2 {
		t.Fatalf("expected 2 filtered columns, got %d (%#v)", len(out), out)
	}
	if _, ok := out["legacy_flag"]; ok {
		t.Fatalf("did not expect unknown column legacy_flag in output: %#v", out)
	}
}

func TestRequiredMissingInstanceColumnsDetectsIsCaught(t *testing.T) {
	prevColumns := instanceColumns
	t.Cleanup(func() { instanceColumns = prevColumns })

	instanceColumns = map[string]bool{
		"instance_id": true,
		"user_id":     true,
		"pokemon_id":  true,
		"variant_id":  true,
		"registered":  true,
		// intentionally missing is_caught
		"is_for_trade":    true,
		"is_wanted":       true,
		"most_wanted":     true,
		"caught_tags":     true,
		"trade_tags":      true,
		"wanted_tags":     true,
		"not_trade_list":  true,
		"not_wanted_list": true,
		"trade_filters":   true,
		"wanted_filters":  true,
		"fusion":          true,
		"disabled":        true,
		"last_update":     true,
		"date_added":      true,
	}
	instanceColumns["wanted_size_preferences"] = true

	missing := requiredMissingInstanceColumns()
	found := false
	for _, col := range missing {
		if col == "is_caught" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected is_caught to be reported missing, got %#v", missing)
	}
}
