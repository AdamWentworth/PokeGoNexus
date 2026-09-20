package main

import (
	"strings"
	"testing"
)

func TestBuildAutocompleteTSQueryPreservesPlaceNames(t *testing.T) {
	tests := []struct {
		name       string
		input      string
		wantQuery  string
		wantFirst  string
		wantUsable bool
	}{
		{
			name:       "city and province",
			input:      "Burnaby, British Columbia",
			wantQuery:  "Burnaby:* & British:* & Columbia:*",
			wantFirst:  "burnaby",
			wantUsable: true,
		},
		{
			name:       "punctuation in place name",
			input:      "O'Fallon",
			wantQuery:  "O:* & Fallon:*",
			wantFirst:  "o",
			wantUsable: true,
		},
		{
			name:       "punctuation only",
			input:      "---",
			wantUsable: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			query, first, usable := buildAutocompleteTSQuery(tt.input)
			if usable != tt.wantUsable {
				t.Fatalf("expected usable=%v, got %v", tt.wantUsable, usable)
			}
			if query != tt.wantQuery {
				t.Fatalf("expected query %q, got %q", tt.wantQuery, query)
			}
			if first != tt.wantFirst {
				t.Fatalf("expected first token %q, got %q", tt.wantFirst, first)
			}
		})
	}
}

func TestAutocompleteSQLUsesSameDictionaryAsSearchIndex(t *testing.T) {
	if count := strings.Count(autocompleteSQL, "to_tsquery('simple', $1)"); count != 2 {
		t.Fatalf("expected ranking and filtering to use the simple dictionary, found %d occurrences", count)
	}
	if strings.Contains(autocompleteSQL, "to_tsquery($1)") {
		t.Fatal("autocomplete query must not use PostgreSQL's default stemming dictionary")
	}
}
