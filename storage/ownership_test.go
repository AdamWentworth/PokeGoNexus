package main

import "testing"

func TestNormalizeOwnershipState_DropsTradeOnlyIntent(t *testing.T) {
	isCaught, isWanted, isForTrade, registered, mostWanted := normalizeOwnershipState(
		false, false, true, false, false,
	)
	if isCaught || isWanted || isForTrade || registered || mostWanted {
		t.Fatalf(
			"expected 0/0/0 and no registration/mostWanted, got caught=%t wanted=%t trade=%t registered=%t mostWanted=%t",
			isCaught, isWanted, isForTrade, registered, mostWanted,
		)
	}
}

func TestNormalizeOwnershipState_NormalizesWantedTradeWithoutOwnership(t *testing.T) {
	isCaught, isWanted, isForTrade, registered, mostWanted := normalizeOwnershipState(
		false, true, true, false, true,
	)
	if isCaught {
		t.Fatalf("expected is_caught=false")
	}
	if !isWanted {
		t.Fatalf("expected is_wanted=true")
	}
	if isForTrade {
		t.Fatalf("expected is_for_trade=false")
	}
	if registered {
		t.Fatalf("expected registered=false")
	}
	if !mostWanted {
		t.Fatalf("expected most_wanted=true")
	}
}

func TestNormalizeOwnershipState_CaughtAndWantedWithoutTradeBecomesWantedRegistered(t *testing.T) {
	isCaught, isWanted, isForTrade, registered, mostWanted := normalizeOwnershipState(
		true, true, false, false, true,
	)
	if isCaught {
		t.Fatalf("expected is_caught=false")
	}
	if !isWanted {
		t.Fatalf("expected is_wanted=true")
	}
	if isForTrade {
		t.Fatalf("expected is_for_trade=false")
	}
	if !registered {
		t.Fatalf("expected registered=true")
	}
	if !mostWanted {
		t.Fatalf("expected most_wanted=true")
	}
}

func TestNormalizeOwnershipState_CaughtTradeWantedDropsWanted(t *testing.T) {
	isCaught, isWanted, isForTrade, registered, mostWanted := normalizeOwnershipState(
		true, true, true, false, true,
	)
	if !isCaught {
		t.Fatalf("expected is_caught=true")
	}
	if isWanted {
		t.Fatalf("expected is_wanted=false")
	}
	if !isForTrade {
		t.Fatalf("expected is_for_trade=true")
	}
	if !registered {
		t.Fatalf("expected registered=true")
	}
	if mostWanted {
		t.Fatalf("expected most_wanted=false")
	}
}

func TestNormalizeOwnershipState_MostWantedRequiresWanted(t *testing.T) {
	_, isWanted, _, _, mostWanted := normalizeOwnershipState(
		false, false, false, false, true,
	)
	if isWanted {
		t.Fatalf("expected is_wanted=false")
	}
	if mostWanted {
		t.Fatalf("expected most_wanted=false when is_wanted=false")
	}
}

func TestNormalizeVariantOwnershipState_ShadowCannotBeWantedOrTraded(t *testing.T) {
	isCaught, isWanted, isForTrade, registered, mostWanted := normalizeVariantOwnershipState(
		"0243-shiny_shadow",
		true, true, true, true, true,
	)
	if !isCaught || !registered {
		t.Fatalf("expected caught shadow registration to be preserved")
	}
	if isWanted || isForTrade || mostWanted {
		t.Fatalf(
			"expected shadow trade intent removed, got wanted=%t trade=%t mostWanted=%t",
			isWanted, isForTrade, mostWanted,
		)
	}
}

func TestNormalizeFavoriteTradeStatePreservesExistingFavorite(t *testing.T) {
	favorite, forTrade := normalizeFavoriteTradeState(true, true, true, true, false)
	if !favorite || forTrade {
		t.Fatalf("expected existing Favorite to win, got favorite=%t forTrade=%t", favorite, forTrade)
	}
}

func TestNormalizeFavoriteTradeStatePreservesExistingTradeListing(t *testing.T) {
	favorite, forTrade := normalizeFavoriteTradeState(true, true, true, false, true)
	if favorite || !forTrade {
		t.Fatalf("expected existing For Trade state to win, got favorite=%t forTrade=%t", favorite, forTrade)
	}
}

func TestNormalizeFavoriteTradeStateClearsAmbiguousNewSnapshot(t *testing.T) {
	favorite, forTrade := normalizeFavoriteTradeState(true, true, false, false, false)
	if favorite || forTrade {
		t.Fatalf("expected ambiguous new snapshot to clear both flags, got favorite=%t forTrade=%t", favorite, forTrade)
	}
}
