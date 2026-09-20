package main

import (
	"errors"
	"testing"
)

func tradeableInstance(instanceID, userID string) PokemonInstance {
	return PokemonInstance{
		InstanceID: instanceID,
		UserID:     userID,
		IsCaught:   true,
		IsForTrade: true,
	}
}

func TestValidateTradeInstancePair(t *testing.T) {
	proposed := tradeableInstance("proposed", "user-1")
	accepting := tradeableInstance("accepting", "user-2")

	if err := validateTradeInstancePair(proposed, accepting, "user-1", "user-2"); err != nil {
		t.Fatalf("expected valid pair, got %v", err)
	}

	proposed.IsForTrade = false
	if err := validateTradeInstancePair(proposed, accepting, "user-1", "user-2"); !errors.Is(err, errPokemonNotForTrade) {
		t.Fatalf("expected not-for-trade error, got %v", err)
	}

	proposed.IsForTrade = true
	proposed.Lucky = true
	if err := validateTradeInstancePair(proposed, accepting, "user-1", "user-2"); !errors.Is(err, errPokemonTradeLocked) {
		t.Fatalf("expected lucky Pokémon trade-lock error, got %v", err)
	}

	proposed.Lucky = false
	accepting.UserID = "other-user"
	if err := validateTradeInstancePair(proposed, accepting, "user-1", "user-2"); !errors.Is(err, errTradeForbidden) {
		t.Fatalf("expected forbidden error, got %v", err)
	}
}
