package builder

import (
	"math"
	"strconv"
)

const maxIntValue = int(^uint(0) >> 1)
const minIntValue = -maxIntValue - 1

// --- helpers ---

func appendTo(p map[string]any, key string, v any) {
	if p == nil {
		return
	}
	if arr, ok := p[key].([]any); ok {
		p[key] = append(arr, v)
		return
	}
	// If it's missing or the wrong type, replace it (matches Node's overwrite-by-spread behavior).
	p[key] = []any{v}
}

// asIntOK converts common DB scan types to int and reports whether the conversion succeeded.
// This avoids silently treating malformed values as 0.
func asIntOK(v any) (int, bool) {
	switch t := v.(type) {
	case int:
		return t, true
	case int64:
		if t < int64(minIntValue) || t > int64(maxIntValue) {
			return 0, false
		}
		return int(t), true
	case float64:
		if math.IsNaN(t) || math.IsInf(t, 0) || math.Trunc(t) != t {
			return 0, false
		}
		i, err := strconv.Atoi(strconv.FormatFloat(t, 'f', -1, 64))
		if err != nil {
			return 0, false
		}
		return i, true
	case []byte:
		i, err := strconv.Atoi(string(t))
		return i, err == nil
	case string:
		i, err := strconv.Atoi(t)
		return i, err == nil
	default:
		return 0, false
	}
}

// asInt keeps the original signature for compatibility, but now delegates to asIntOK.
func asInt(v any) int {
	i, _ := asIntOK(v)
	return i
}

// asStringOK converts common DB scan types to string and reports whether the conversion succeeded.
func asStringOK(v any) (string, bool) {
	switch t := v.(type) {
	case string:
		return t, true
	case []byte:
		return string(t), true
	default:
		return "", false
	}
}

// asString keeps the original signature for compatibility, but now delegates to asStringOK.
func asString(v any) string {
	s, _ := asStringOK(v)
	return s
}

func lower(s string) string {
	out := []rune(s)
	for i, r := range out {
		if r >= 'A' && r <= 'Z' {
			out[i] = r + 32
		}
	}
	return string(out)
}

func iconPath(typeName string) any {
	if typeName == "" {
		return nil
	}
	return "/images/types/" + lower(typeName) + ".png"
}

func nullIfEmpty(v any) any {
	s, ok := asStringOK(v)
	if !ok || s == "" {
		return nil
	}
	return v
}

func nullIfZero(v any) any {
	i, ok := asIntOK(v)
	if !ok || i == 0 {
		return nil
	}
	return v
}

func cloneMap(m map[string]any) map[string]any {
	out := make(map[string]any, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}
