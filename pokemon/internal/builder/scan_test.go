package builder

import (
	"strconv"
	"testing"
)

func TestLegacyScalarWireValue(t *testing.T) {
	t.Parallel()

	if got, ok := legacyScalarWireValue("apex", "1"); !ok || got != int(1) {
		t.Fatalf("legacyScalarWireValue(apex, 1) = %#v, %v", got, ok)
	}
	overflow := strconv.FormatUint(^uint64(0), 10) + "0"
	if got, ok := legacyScalarWireValue("apex", overflow); !ok || got != overflow {
		t.Fatalf("legacyScalarWireValue(apex, overflow) = %#v, %v", got, ok)
	}
	if got, ok := legacyScalarWireValue("apex", ""); !ok || got != "" {
		t.Fatalf("legacyScalarWireValue(apex, empty) = %#v, %v", got, ok)
	}
	if got, ok := legacyScalarWireValue("name", "1"); ok || got != nil {
		t.Fatalf("legacyScalarWireValue(name, 1) = %#v, %v", got, ok)
	}
}
