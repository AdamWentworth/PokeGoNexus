package main

import "testing"

func TestExtractTagIDsFromJSON(t *testing.T) {
	got := extractTagIDsFromJSON(`["tag-a","tag-b","tag-a",""]`)
	if len(got) != 2 {
		t.Fatalf("expected 2 unique ids, got %d (%#v)", len(got), got)
	}
	if !containsString(got, "tag-a") || !containsString(got, "tag-b") {
		t.Fatalf("expected tag-a and tag-b in %#v", got)
	}
}

func TestExtractTagIDsFromJSONObjectShapes(t *testing.T) {
	got := extractTagIDsFromJSON(`[{"tag_id":"t1"},{"id":"t2"},{"value":"t3"},{"name":"ignored"}]`)
	if len(got) != 3 {
		t.Fatalf("expected 3 ids, got %d (%#v)", len(got), got)
	}
	for _, expect := range []string{"t1", "t2", "t3"} {
		if !containsString(got, expect) {
			t.Fatalf("expected %s in %#v", expect, got)
		}
	}
}

func TestMergeUniqueTagIDs(t *testing.T) {
	got := mergeUniqueTagIDs([]string{"a", "b"}, []string{"b", "c"}, []string{"", "  ", "c"})
	if len(got) != 3 {
		t.Fatalf("expected 3 unique ids, got %d (%#v)", len(got), got)
	}
	for _, expect := range []string{"a", "b", "c"} {
		if !containsString(got, expect) {
			t.Fatalf("expected %s in %#v", expect, got)
		}
	}
}

func TestBuiltInTagNamesAreExcludedFromClientMembershipArrays(t *testing.T) {
	testCases := map[string][]string{
		"caught": {"favorite"},
		"trade":  {"for trade"},
		"wanted": {"wanted", "most wanted"},
	}
	for parent, expected := range testCases {
		actual := builtInTagNamesForParent(parent)
		if len(actual) != len(expected) {
			t.Fatalf("%s built-ins = %#v, want %#v", parent, actual, expected)
		}
		for _, name := range expected {
			if !containsString(actual, name) {
				t.Fatalf("%s built-ins missing %q: %#v", parent, name, actual)
			}
		}
	}
	if actual := builtInTagNamesForParent("unknown"); actual != nil {
		t.Fatalf("unknown parent built-ins = %#v, want nil", actual)
	}
}

func containsString(values []string, target string) bool {
	for _, v := range values {
		if v == target {
			return true
		}
	}
	return false
}
