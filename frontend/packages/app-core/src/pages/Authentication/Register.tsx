// src/components/Register.tsx

import { useEffect, useState, FC } from 'react';
import { useSearchParams } from 'react-router';
import RegisterForm from './FormComponents/RegisterForm';
import SuccessMessage from './SuccessMessage';
import useRegisterForm from './hooks/useRegisterForm';
import {
  completeGoogleRegistration,
  completeDiscordRegistration,
  completeFacebookRegistration,
  getPendingGoogleRegistration,
  getPendingDiscordRegistration,
  getPendingFacebookRegistration,
  registerUser,
  loginUser,
  startGoogleAuthentication,
  startDiscordAuthentication,
  startFacebookAuthentication,
} from '../../services/authService';
import './Register.css';
import { useAuth } from '../../contexts/AuthContext';
import { feedback as appFeedback } from '@/components/feedback';
import LoadingSpinner from '../../components/LoadingSpinner';
import { isApiError } from '../../utils/errors';
import { updateUserInSecondaryDB } from "@/services/authService";
import { createScopedLogger } from '@/utils/logger';

// Import centralized types.
import type { RegisterFormValues, User, LoginResponse } from '../../types/auth';

const log = createScopedLogger('Register');

const Register: FC = () => {
  const [searchParams] = useSearchParams();
  const oauthStatus = searchParams.get('oauth');
  const isGoogleReturn = oauthStatus === 'google';
  const isDiscordReturn = oauthStatus === 'discord';
  const isFacebookReturn = oauthStatus === 'facebook';
  const oauthProvider = isGoogleReturn
    ? 'google'
    : isDiscordReturn
      ? 'discord'
      : isFacebookReturn
        ? 'facebook'
        : null;
  const [oauthEmail, setOauthEmail] = useState('');
  const [oauthLoading, setOauthLoading] = useState(Boolean(oauthProvider));
  // useRegisterForm provides all the state and handlers for our register form.
  const {
    values, 
    errors, 
    handleSubmit, 
    validateFields,
    handleInputChange,
    handleCheckboxChange,
    handleAllowLocationChange,
    handleCoordinatesSelect,
    handleLocationInputFocus,
    handleLocationInputBlur,
    selectSuggestion,
    handleLocationUpdate,
    handleOverlayLocationSelect,
    isMapVisible,
    setIsMapVisible,
    selectedCoordinates,
    showLocationWarning,
    suggestions,
    showOptionsOverlay,
    setShowOptionsOverlay,
    locationOptions,
    setErrors
  } = useRegisterForm(onSubmit, { oauthEmail: oauthEmail || undefined });

  const [feedback, setFeedback] = useState<string>('');
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { login } = useAuth();

  useEffect(() => {
    if (oauthStatus === 'account-not-found') {
      appFeedback.info('No account exists for that provider email yet. Choose a sign-up method to register.');
    }
  }, [oauthStatus]);

  useEffect(() => {
    if (!oauthProvider) return;
    const getPending = oauthProvider === 'google'
      ? getPendingGoogleRegistration
      : oauthProvider === 'discord'
        ? getPendingDiscordRegistration
        : getPendingFacebookRegistration;
    getPending()
      .then((pending) => setOauthEmail(pending.email))
      .catch(() => appFeedback.error(
        `${oauthProvider === 'google' ? 'Google' : oauthProvider === 'discord' ? 'Discord' : 'Facebook'} registration expired. Please try again.`,
      ))
      .finally(() => setOauthLoading(false));
  }, [oauthProvider]);

  const finishLogin = (loginResponse: LoginResponse, formValues: RegisterFormValues) => {
    const user: User = {
      user_id: loginResponse.user_id,
      email: loginResponse.email,
      username: loginResponse.username,
      pokemonGoName: loginResponse.pokemonGoName,
      trainerCode: loginResponse.trainerCode,
      allowLocation: loginResponse.allowLocation,
      location: loginResponse.location,
      coordinates: loginResponse.coordinates,
      accessTokenExpiry: loginResponse.accessTokenExpiry,
      refreshTokenExpiry: loginResponse.refreshTokenExpiry,
    };
    login(user);
    const coords = formValues.coordinates;
    void updateUserInSecondaryDB(user.user_id, {
      username: user.username,
      ...(coords && { latitude: coords.latitude, longitude: coords.longitude }),
      ...(formValues.pokemonGoName && { pokemonGoName: formValues.pokemonGoName }),
    });
    setIsRegistered(true);
    setFeedback('Successfully Registered and Logged in');
  };

  // The onSubmit callback invoked when the registration form is submitted.
  async function onSubmit(formValues: RegisterFormValues): Promise<void> {
    log.debug('Form values submitted.', { username: formValues.username });
    
    // Sanitize form values.
    const sanitizedFormValues: RegisterFormValues = {
      ...formValues,
      username: formValues.username.trim(),
      trainerCode: formValues.trainerCode.replace(/\s+/g, ''),
    };

    // Set loading to true when submission starts.
    setIsLoading(true);

    try {
      if (oauthEmail && oauthProvider) {
        const completeRegistration = oauthProvider === 'google'
          ? completeGoogleRegistration
          : oauthProvider === 'discord'
            ? completeDiscordRegistration
            : completeFacebookRegistration;
        const response = await completeRegistration(sanitizedFormValues);
        finishLogin(response, sanitizedFormValues);
        setIsLoading(false);
        return;
      }

      // Register the user.
      await registerUser(sanitizedFormValues);
      log.info('Registration successful.');

      // Wait for 2 seconds before attempting login.
      setTimeout(async () => {
        try {
          // Login using the provided username and password.
          const loginResponse: LoginResponse = await loginUser({
            username: formValues.username,
            password: formValues.password,
          });
          log.info('Login successful.');

          finishLogin(loginResponse, sanitizedFormValues);
        } catch (loginError) {
          log.error('Login error:', loginError);
          appFeedback.error('Registration successful, but login failed. Please try to log in.');
        } finally {
          // Set loading to false after login attempt.
          setIsLoading(false);
        }
      }, 2000);
    } catch (error: unknown) {
      log.error('Registration error:', error);
    
      if (isApiError(error)) {
        const message = error.response.data.message;
    
        setErrors({
          username: message.includes('Username') ? 'This username is already taken.' : '',
          email: message.includes('Email') ? 'This email is already in use.' : '',
          pokemonGoName: message.includes('Pokémon Go name') ? 'This Pokémon Go name is already taken.' : '',
          trainerCode: message.includes('Trainer Code') ? 'This Trainer Code is already in use.' : ''
        });
    
        appFeedback.error('Registration failed: ' + message);
      } else {
        appFeedback.error('Registration failed: Please check your input and try again.');
      }
    
      setIsLoading(false);
    }    
  }  

  return (
    <div>
      {isLoading || oauthLoading ? (
        <LoadingSpinner />
      ) : isRegistered ? (
        <SuccessMessage 
          mainMessage={feedback} 
          detailMessage="You are now successfully registered and logged in!" 
        />
      ) : (
        <RegisterForm 
          onSubmit={handleSubmit} 
          errors={errors} 
          values={values}
          validateFields={validateFields}
          handleInputChange={handleInputChange}
          handleCheckboxChange={handleCheckboxChange}
          handleAllowLocationChange={handleAllowLocationChange}
          handleCoordinatesSelect={handleCoordinatesSelect}
          handleLocationInputFocus={handleLocationInputFocus}
          handleLocationInputBlur={handleLocationInputBlur}
          selectSuggestion={selectSuggestion}
          handleLocationUpdate={handleLocationUpdate}
          handleOverlayLocationSelect={handleOverlayLocationSelect}
          isMapVisible={isMapVisible}
          setIsMapVisible={setIsMapVisible}
          selectedCoordinates={selectedCoordinates}
          showLocationWarning={showLocationWarning}
          suggestions={suggestions}
          showOptionsOverlay={showOptionsOverlay}
          setShowOptionsOverlay={setShowOptionsOverlay}
          locationOptions={locationOptions}
          oauthProvider={oauthEmail && oauthProvider ? oauthProvider : undefined}
          onGoogleClick={() => startGoogleAuthentication('register')}
          onDiscordClick={() => startDiscordAuthentication('register')}
          onFacebookClick={() => startFacebookAuthentication('register')}
        />
      )}
    </div>
  );
};

export default Register;
