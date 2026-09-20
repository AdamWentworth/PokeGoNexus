import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchPublicUserByUsername,
  fetchTrainerAutocomplete,
  type TrainerAutocompleteResult,
} from '@/services/userSearchService';

type UseTrainerLookupFieldArgs = {
  editMode: boolean;
  obtainedInTrade: boolean;
  originalTrainerName: string | null;
  rawOriginalTrainerName: string;
  onOriginalTrainerNameChange: (value: string) => void;
  onOriginalTrainerIdChange: (value: string | null) => void;
  autocompleteDelayMs?: number;
  suggestionClearDelayMs?: number;
};

export const useTrainerLookupField = ({
  editMode,
  obtainedInTrade,
  originalTrainerName,
  rawOriginalTrainerName,
  onOriginalTrainerNameChange,
  onOriginalTrainerIdChange,
  autocompleteDelayMs = 250,
  suggestionClearDelayMs = 120,
}: UseTrainerLookupFieldArgs) => {
  const [trainerQuery, setTrainerQuery] = useState<string>(
    (originalTrainerName ?? rawOriginalTrainerName ?? '').trim(),
  );
  const [trainerSuggestions, setTrainerSuggestions] = useState<TrainerAutocompleteResult[]>([]);
  const [trainerLookupBusy, setTrainerLookupBusy] = useState<boolean>(false);
  const [trainerLookupError, setTrainerLookupError] = useState<string | null>(null);
  const [trainerHasFocus, setTrainerHasFocus] = useState<boolean>(false);
  const trainerLookupRequestRef = useRef(0);
  const suggestionClearTimeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      trainerLookupRequestRef.current += 1;
      if (suggestionClearTimeoutRef.current !== null) {
        window.clearTimeout(suggestionClearTimeoutRef.current);
        suggestionClearTimeoutRef.current = null;
      }
    },
    [],
  );

  const showTrainerSuggestions = useMemo(
    () =>
      editMode &&
      obtainedInTrade &&
      trainerHasFocus &&
      trainerSuggestions.length > 0 &&
      trainerQuery.trim().length >= 2,
    [editMode, obtainedInTrade, trainerHasFocus, trainerSuggestions.length, trainerQuery],
  );

  useEffect(() => {
    if (trainerHasFocus) return;
    setTrainerQuery((originalTrainerName ?? rawOriginalTrainerName ?? '').trim());
  }, [originalTrainerName, rawOriginalTrainerName, trainerHasFocus]);

  useEffect(() => {
    if (!editMode || !obtainedInTrade) {
      setTrainerSuggestions([]);
      setTrainerLookupError(null);
      return;
    }

    const term = trainerQuery.trim();
    if (term.length < 2) {
      setTrainerSuggestions([]);
      setTrainerLookupError(null);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setTrainerLookupBusy(true);
      const outcome = await fetchTrainerAutocomplete(term);
      if (cancelled) return;

      if (outcome.type === 'success') {
        setTrainerSuggestions(outcome.results);
        setTrainerLookupError(null);
      } else {
        setTrainerSuggestions([]);
        setTrainerLookupError(outcome.message);
      }
      setTrainerLookupBusy(false);
    }, autocompleteDelayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [autocompleteDelayMs, editMode, obtainedInTrade, trainerQuery]);

  const resolveTrainerByUsername = useCallback(
    async (usernameInput: string): Promise<void> => {
      const username = usernameInput.trim();
      const requestId = ++trainerLookupRequestRef.current;
      if (!username) {
        onOriginalTrainerNameChange('');
        setTrainerQuery('');
        onOriginalTrainerIdChange(null);
        setTrainerLookupError(null);
        return;
      }

      setTrainerLookupBusy(true);
      let outcome;
      try {
        outcome = await fetchPublicUserByUsername(username);
      } catch {
        if (requestId !== trainerLookupRequestRef.current) return;
        setTrainerLookupBusy(false);
        onOriginalTrainerIdChange(null);
        setTrainerLookupError('Unable to verify trainer right now.');
        return;
      }
      if (requestId !== trainerLookupRequestRef.current) return;
      setTrainerLookupBusy(false);

      if (outcome.type === 'success') {
        onOriginalTrainerIdChange(outcome.userId);
        setTrainerLookupError(null);
        return;
      }

      if (outcome.type === 'notFound') {
        onOriginalTrainerIdChange(null);
        setTrainerLookupError(null);
        return;
      }

      onOriginalTrainerIdChange(null);
      setTrainerLookupError(outcome.message);
    },
    [onOriginalTrainerIdChange, onOriginalTrainerNameChange],
  );

  const handleTrainerNameChange = useCallback(
    (next: string) => {
      setTrainerQuery(next);
      onOriginalTrainerNameChange(next);
      onOriginalTrainerIdChange(null);
    },
    [onOriginalTrainerIdChange, onOriginalTrainerNameChange],
  );

  const handleTrainerNameFocus = useCallback(() => {
    if (suggestionClearTimeoutRef.current !== null) {
      window.clearTimeout(suggestionClearTimeoutRef.current);
      suggestionClearTimeoutRef.current = null;
    }
    setTrainerHasFocus(true);
  }, []);

  const handleTrainerNameBlur = useCallback(() => {
    const committedName = trainerQuery.trim();
    setTrainerHasFocus(false);
    setTrainerQuery(committedName);
    onOriginalTrainerNameChange(committedName);
    onOriginalTrainerIdChange(null);
    void resolveTrainerByUsername(committedName);
    if (suggestionClearTimeoutRef.current !== null) {
      window.clearTimeout(suggestionClearTimeoutRef.current);
    }
    suggestionClearTimeoutRef.current = window.setTimeout(() => {
      setTrainerSuggestions([]);
      suggestionClearTimeoutRef.current = null;
    }, suggestionClearDelayMs);
  }, [
    onOriginalTrainerIdChange,
    onOriginalTrainerNameChange,
    resolveTrainerByUsername,
    suggestionClearDelayMs,
    trainerQuery,
  ]);

  const handleTrainerSuggestionSelect = useCallback(
    (candidate: TrainerAutocompleteResult) => {
      onOriginalTrainerNameChange(candidate.username);
      setTrainerQuery(candidate.username);
      setTrainerSuggestions([]);
      setTrainerHasFocus(false);
      void resolveTrainerByUsername(candidate.username);
    },
    [onOriginalTrainerNameChange, resolveTrainerByUsername],
  );

  return {
    trainerQuery,
    trainerSuggestions,
    trainerLookupBusy,
    trainerLookupError,
    showTrainerSuggestions,
    handleTrainerNameChange,
    handleTrainerNameFocus,
    handleTrainerNameBlur,
    handleTrainerSuggestionSelect,
  };
};
