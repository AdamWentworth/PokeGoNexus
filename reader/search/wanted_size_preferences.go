package main

import (
	"encoding/json"
	"fmt"
)

type wantedSizeRange struct {
	Category     string   `json:"category"`
	Min          *float64 `json:"min"`
	Max          *float64 `json:"max"`
	MinInclusive bool     `json:"min_inclusive"`
	MaxInclusive bool     `json:"max_inclusive"`
}

type wantedSizePreferences struct {
	Weight *wantedSizeRange `json:"weight"`
	Height *wantedSizeRange `json:"height"`
}

func matchesWantedSizePreferences(wanted, offered PokemonInstance) (bool, string) {
	if len(wanted.WantedSizes) == 0 || string(wanted.WantedSizes) == "null" {
		return true, ""
	}

	var preferences wantedSizePreferences
	if err := json.Unmarshal(wanted.WantedSizes, &preferences); err != nil {
		return false, "Invalid wanted size preferences"
	}

	if matched, reason := matchesWantedSizeRange("Weight", offered.Weight, preferences.Weight); !matched {
		return false, reason
	}
	if matched, reason := matchesWantedSizeRange("Height", offered.Height, preferences.Height); !matched {
		return false, reason
	}
	return true, ""
}

func matchesWantedSizeRange(label string, value *float64, preference *wantedSizeRange) (bool, string) {
	if preference == nil {
		return true, ""
	}
	if preference.Min == nil && preference.Max == nil {
		return false, fmt.Sprintf("Invalid %s size preference", label)
	}
	if preference.Min != nil && preference.Max != nil && *preference.Min > *preference.Max {
		return false, fmt.Sprintf("Invalid %s size preference", label)
	}
	if value == nil {
		return false, fmt.Sprintf("%s is required for %s preference", label, preference.Category)
	}

	if preference.Min != nil {
		belowMinimum := *value < *preference.Min || (!preference.MinInclusive && *value == *preference.Min)
		if belowMinimum {
			return false, fmt.Sprintf("%s does not satisfy %s preference", label, preference.Category)
		}
	}
	if preference.Max != nil {
		aboveMaximum := *value > *preference.Max || (!preference.MaxInclusive && *value == *preference.Max)
		if aboveMaximum {
			return false, fmt.Sprintf("%s does not satisfy %s preference", label, preference.Category)
		}
	}
	return true, ""
}
