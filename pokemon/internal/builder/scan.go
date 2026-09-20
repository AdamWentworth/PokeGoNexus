package builder

import (
	"database/sql"
	"strconv"
)

func scanRowsToMaps(rows *sql.Rows) ([]map[string]any, error) {
	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	colTypes, _ := rows.ColumnTypes()

	out := make([]map[string]any, 0)
	for rows.Next() {
		// Create scan targets
		vals := make([]any, len(cols))
		ptrs := make([]any, len(cols))
		for i := range vals {
			ptrs[i] = &vals[i]
		}

		if err := rows.Scan(ptrs...); err != nil {
			return nil, err
		}

		m := make(map[string]any, len(cols))
		for i, c := range cols {
			v := vals[i]
			// PostgreSQL exposes actual booleans while the browser payload
			// exposed 0/1. Preserve the established JSON wire contract until
			// a deliberate client schema revision says otherwise.
			if b, ok := v.(bool); ok {
				if b {
					m[c] = int64(1)
				} else {
					m[c] = int64(0)
				}
				continue
			}
			if normalized, ok := legacyScalarWireValue(c, v); ok {
				m[c] = normalized
				continue
			}
			// Normalize []byte to string for text-ish types.
			if b, ok := v.([]byte); ok {
				// Keep bytes for blobs; otherwise convert to string
				if len(colTypes) > i && colTypes[i] != nil {
					if isTextType(colTypes[i].DatabaseTypeName()) {
						m[c] = string(b)
						continue
					}
				}
				m[c] = string(b)
				continue
			}
			m[c] = v
		}
		out = append(out, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func legacyScalarWireValue(column string, value any) (any, bool) {
	switch column {
	case "shiny_available", "apex", "primal", "trade_discount", "shadow_shiny_available", "shadow_apex":
		// PostgreSQL stores a small set of historically heterogeneous fields as
		// text to retain exact legacy meanings. Convert numeric strings back to
		// the established JSON number representation, while preserving blanks/None.
		switch typed := value.(type) {
		case string:
			if integer, err := strconv.Atoi(typed); err == nil {
				return integer, true
			}
			return typed, true
		case []byte:
			return legacyScalarWireValue(column, string(typed))
		}
	}
	return nil, false
}

func isTextType(dbType string) bool {
	switch dbType {
	case "TEXT", "VARCHAR", "CHAR", "NVARCHAR":
		return true
	default:
		return false
	}
}
