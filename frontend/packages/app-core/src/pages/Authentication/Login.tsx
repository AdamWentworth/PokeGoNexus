// src/components/Login.tsx

import React, { useCallback, useEffect, useRef, useState, FC } from 'react';
import { useSearchParams } from 'react-router';
import LoginForm from './FormComponents/LoginForm';
import SuccessMessage from './SuccessMessage';
import LoadingSpinner from '../../components/LoadingSpinner';
import useLoginForm from './hooks/useLoginForm';
import { loginUser, loadOAuthSession } from '@/services/authService';
import { fetchUserOverview } from '@/services/userService';
import './Login.css';
import { useAuth } from '@/contexts/AuthContext';
import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import { useTradeStore } from '@/features/trades/store/useTradeStore';
import { feedback as appFeedback } from '@/components/feedback';
import ResetPasswordOverlay from './ResetPasswordOverlay';
import { isApiError } from '../../utils/errors';
import { createScopedLogger } from '@/utils/logger';

// Centralised types
import type { LoginFormValues } from '../../types/auth';
import type { User, LoginResponse } from '../../types/auth';
import type { UserOverview } from '@/types/user';
import type { Trade as TradeStoreTrade, RelatedInstance } from '@/features/trades/store/useTradeStore';

const log = createScopedLogger('Login');

const Login: FC = () => {
  const [searchParams] = useSearchParams();
  /* -------------------------------- form state ------------------------- */
  const initialFormValues: LoginFormValues = { username: '', password: '' };
  const { values, errors, handleChange, handleSubmit } = useLoginForm(
    initialFormValues,
    onSubmit
  );

  /* -------------------------------- global stores ----------------------- */
  const { login } = useAuth();
  const setInstances = useInstancesStore((s) => s.setInstances);
  const setTradeData = useTradeStore((s) => s.setTradeData);
  const setRelatedInstances = useTradeStore((s) => s.setRelatedInstances);

  /* -------------------------------- local ui state ---------------------- */
  const [feedback, setFeedback] = useState<string>('');
  const [isSuccessful, setIsSuccessful] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState<boolean>(false);
  const handledOAuthStatus = useRef<string | null>(null);

  const hydrateUserOverview = useCallback(async (userId: string) => {
    const overview = (await fetchUserOverview(userId)) as UserOverview;

    log.debug('Fetched user overview:', overview);

    setInstances(overview.pokemon_instances);
    const normalizedTrades = Object.entries(overview.trades ?? {}).reduce<
      Record<string, TradeStoreTrade>
    >((acc, [tradeId, trade]) => {
      if (!trade) return acc;
      const parsedLastUpdate =
        typeof trade.last_update === 'number'
          ? trade.last_update
          : typeof trade.last_update === 'string'
          ? new Date(trade.last_update).getTime()
          : undefined;
      acc[tradeId] = {
        ...trade,
        trade_id: String(trade.trade_id ?? tradeId),
        trade_status: String(trade.trade_status ?? ''),
        last_update: Number.isFinite(parsedLastUpdate) ? parsedLastUpdate : undefined,
      };
      return acc;
    }, {});
    const normalizedRelatedInstances = Object.entries(
      overview.related_instances ?? {},
    ).reduce<Record<string, RelatedInstance>>((acc, [instanceId, instance]) => {
      if (!instance) return acc;
      acc[instanceId] = {
        ...instance,
        instance_id: String(instance.instance_id ?? instanceId),
      };
      return acc;
    }, {});

    setTradeData(normalizedTrades);
    setRelatedInstances(normalizedRelatedInstances);
  }, [setInstances, setRelatedInstances, setTradeData]);

  useEffect(() => {
    const oauthStatus = searchParams.get('oauth');
    if (!oauthStatus) return;
    if (handledOAuthStatus.current === oauthStatus) return;
    handledOAuthStatus.current = oauthStatus;
    if (oauthStatus === 'account-exists') {
      appFeedback.info('An account already exists for that email. Sign in with the provider or your password.');
      return;
    }
    if (oauthStatus === 'link-required') {
      appFeedback.info('That email already has a password account. Sign in normally before linking a provider.');
      return;
    }
    if (oauthStatus !== 'success') {
      appFeedback.error('Provider login could not be completed securely. Please try again.');
      return;
    }

    setIsLoading(true);
    loadOAuthSession()
      .then(async (response) => {
        login({
          user_id: response.user_id,
          username: response.username,
          email: response.email,
          pokemonGoName: response.pokemonGoName || '',
          trainerCode: response.trainerCode || '',
          allowLocation: response.allowLocation || false,
          location: response.location || '',
          coordinates: response.coordinates || null,
          accessTokenExpiry: response.accessTokenExpiry,
          refreshTokenExpiry: response.refreshTokenExpiry,
        });
        await hydrateUserOverview(response.user_id);
        setFeedback('Successfully logged in');
        setIsSuccessful(true);
      })
      .catch(() => appFeedback.error('Login succeeded, but your account data could not be loaded. Please try again.'))
      .finally(() => setIsLoading(false));
  }, [hydrateUserOverview, login, searchParams]);

  /* ---------------------------------------------------------------------- */
  /*  onSubmit                                                              */
  /* ---------------------------------------------------------------------- */
  async function onSubmit(formValues: LoginFormValues): Promise<void> {
    setIsLoading(true);
    try {
      /* ----------------------------- authenticate ----------------------- */
      const response: LoginResponse = await loginUser(formValues);
      const {
        email,
        username,
        pokemonGoName,
        trainerCode,
        user_id,
        token,
        allowLocation,
        location,
        coordinates,
        accessTokenExpiry,
        refreshTokenExpiry,
      } = response;

      const user: User = {
        email,
        username,
        pokemonGoName,
        trainerCode,
        user_id,
        allowLocation,
        location,
        coordinates,
        accessTokenExpiry,
        refreshTokenExpiry,
      };

      login({ ...user, token });

      await hydrateUserOverview(user.user_id);

      setIsSuccessful(true);
      setFeedback('Successfully Logged in');
    } catch (error: unknown) {
      let errorMessage = 'Please check your username/email and password and try again.';
      if (isApiError(error)) {
        errorMessage = error.response.data.message;
      }
      appFeedback.error('Login failed: ' + errorMessage);
      setIsSuccessful(false);
    } finally {
      setIsLoading(false);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  helpers                                                               */
  /* ---------------------------------------------------------------------- */
  const handleResetPassword = (): void => setIsResetPasswordOpen(true);
  const closeResetPassword = (): void => setIsResetPasswordOpen(false);

  /* ---------------------------------------------------------------------- */
  /*  render                                                                */
  /* ---------------------------------------------------------------------- */
  return (
    <div className="login-container">
      {isLoading ? (
        <LoadingSpinner />
      ) : isSuccessful ? (
        <SuccessMessage
          mainMessage={feedback}
          detailMessage="You are now successfully logged in!"
        />
      ) : (
        <LoginForm
          values={values}
          errors={errors}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onResetPassword={handleResetPassword}
        />
      )}

      {isResetPasswordOpen && <ResetPasswordOverlay onClose={closeResetPassword} />}
    </div>
  );
};

export default Login;
