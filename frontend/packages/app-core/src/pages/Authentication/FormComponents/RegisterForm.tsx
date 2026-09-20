import React, { FC, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  FaArrowLeft,
  FaArrowRight,
  FaCheck,
  FaEnvelope,
  FaDiscord,
  FaFacebookF,
  FaGamepad,
  FaLock,
  FaMapMarkerAlt,
  FaPen,
  FaShieldAlt,
  FaUser,
} from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';

import CoordinateSelector from '../CoordinateSelector';
import LocationOptionsOverlay from '../LocationOptionsOverlay';
import './RegisterForm.css';
import type { RegisterFormValues, RegisterFormErrors } from '../../../types/auth';
import type { LocationSuggestion } from '../../../types/location';

interface RegisterFormProps {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  errors: RegisterFormErrors;
  values: RegisterFormValues;
  validateFields: (fieldNames: Array<keyof RegisterFormValues>) => boolean;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCheckboxChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAllowLocationChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCoordinatesSelect: (coordinates: { latitude: number; longitude: number }) => void;
  handleLocationInputFocus: () => void;
  handleLocationInputBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  selectSuggestion: (suggestion: LocationSuggestion) => void;
  handleLocationUpdate: (location: LocationSuggestion) => void;
  handleOverlayLocationSelect: (location: LocationSuggestion) => void;
  isMapVisible: boolean;
  setIsMapVisible: (visible: boolean) => void;
  selectedCoordinates: { latitude: number; longitude: number } | null;
  showLocationWarning: boolean;
  suggestions: LocationSuggestion[];
  showOptionsOverlay: boolean;
  setShowOptionsOverlay: (show: boolean) => void;
  locationOptions: LocationSuggestion[];
  oauthProvider?: 'google' | 'discord' | 'facebook';
  onGoogleClick?: () => void;
  onDiscordClick?: () => void;
  onFacebookClick?: () => void;
}

const emailSteps = [
  { label: 'Account', icon: FaUser },
  { label: 'Security', icon: FaLock },
  { label: 'Trainer', icon: FaGamepad },
  { label: 'Location', icon: FaMapMarkerAlt },
  { label: 'Review', icon: FaCheck },
] as const;

const googleSteps = emailSteps.filter((step) => step.label !== 'Security');

const RegisterForm: FC<RegisterFormProps> = ({
  onSubmit,
  errors,
  values,
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
  oauthProvider,
  onGoogleClick,
  onDiscordClick,
  onFacebookClick,
}) => {
  const [step, setStep] = useState(0);
  const [authMethod, setAuthMethod] = useState<
    'email' | 'google' | 'discord' | 'facebook' | null
  >(
    oauthProvider || null,
  );
  const steps = oauthProvider ? googleSteps : emailSteps;
  const stepLabel = (optional = false) =>
    `STEP ${step + 1} OF ${steps.length}${optional ? ' · OPTIONAL' : ''}`;
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const trainerName = values.pokemonGoNameDisabled
    ? values.username
    : values.pokemonGoName.trim();
  const cleanTrainerCode = values.trainerCode.replace(/\s+/g, '');
  const locationSummary = values.locationInput.trim()
    || (selectedCoordinates
      ? `${selectedCoordinates.latitude.toFixed(3)}, ${selectedCoordinates.longitude.toFixed(3)}`
      : 'Not shared');

  const passwordRules = useMemo(() => [
    { label: '8+ characters', met: values.password.length >= 8 },
    { label: 'Upper and lowercase', met: /[A-Z]/.test(values.password) && /[a-z]/.test(values.password) },
    { label: 'Number', met: /\d/.test(values.password) },
    { label: 'Special character', met: /[!@#$%^&*(),.?":{}|<>]/.test(values.password) },
  ], [values.password]);

  const moveForward = () => {
    if (step === 0 && !validateFields(['username', 'email'])) return;
    if (!oauthProvider && step === 1) {
      if (!validateFields(['password'])) return;
      if (confirmPassword !== values.password) {
        setConfirmPasswordError('Passwords do not match');
        return;
      }
      setConfirmPasswordError('');
    }
    const trainerStep = oauthProvider ? 1 : 2;
    if (step === trainerStep && !validateFields(['pokemonGoName', 'trainerCode'])) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step < steps.length - 1) {
      moveForward();
      return;
    }
    onSubmit(event);
  };

  return (
    <main className="register-page">
      <section
        className={`register-form ${!authMethod ? 'register-form--method' : ''}`}
        aria-labelledby="register-title"
      >
        <header className="register-header">
          <div className="register-header-copy">
            <span className="register-eyebrow">TRAINER REGISTRATION</span>
            <h1 id="register-title">Create your account</h1>
            <p>
              {!authMethod
                ? 'Choose a trusted provider or continue with your email address.'
                : step < steps.length - 1
                  ? 'A few quick steps, then your trainer journey begins.'
                  : 'Make sure everything looks right.'}
            </p>
          </div>
          <div className="register-login-prompt">
            <span>Already have an account?</span>
            <Link to="/login" className="register-login-link">Sign in</Link>
          </div>
        </header>

        {authMethod && <ol className="register-progress" aria-label="Registration progress">
          {steps.map((item, index) => {
            const Icon = item.icon;
            const isActive = index === step;
            const isComplete = index < step;
            return (
              <li
                key={item.label}
                className={`${isActive ? 'is-active' : ''} ${isComplete ? 'is-complete' : ''}`}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className="register-progress-icon">
                  {isComplete ? <FaCheck /> : <Icon />}
                </span>
                <span>{item.label}</span>
              </li>
            );
          })}
        </ol>}

        <form onSubmit={handleFormSubmit} noValidate>
          <div className="register-step" key={step}>
            {!authMethod && (
              <>
                <div className="register-method-grid" role="group" aria-label="Choose a sign-up method">
                  <button type="button" className="google-auth-button" onClick={onGoogleClick}>
                    <FcGoogle aria-hidden="true" />
                    Sign up with Google
                  </button>
                  <button type="button" className="discord-auth-button" onClick={onDiscordClick}>
                    <FaDiscord aria-hidden="true" />
                    Sign up with Discord
                  </button>
                  <button type="button" className="facebook-auth-button" onClick={onFacebookClick}>
                    <FaFacebookF aria-hidden="true" />
                    Sign up with Facebook
                  </button>
                  <button
                    type="button"
                    className="register-email-method"
                    onClick={() => setAuthMethod('email')}
                  >
                    <FaEnvelope aria-hidden="true" />
                    Continue with email
                  </button>
                </div>
                <p className="register-method-note">
                  Your provider verifies your email. You will still choose a Pokémon Go Nexus username.
                </p>
              </>
            )}
            {authMethod && step === 0 && (
              <>
                <div className="register-step-heading">
                  <FaUser />
                  <div>
                    <span>{stepLabel()}</span>
                    <h2>Your account</h2>
                    <p>Choose how other trainers will know you here.</p>
                  </div>
                </div>
                <div className="register-field">
                  <label htmlFor="register-username">Username</label>
                  <div className="register-input-shell">
                    <FaUser />
                    <input
                      id="register-username"
                      autoFocus
                      autoComplete="username"
                      type="text"
                      name="username"
                      value={values.username}
                      onChange={handleInputChange}
                      placeholder="Choose a unique username"
                      aria-invalid={Boolean(errors.username)}
                    />
                  </div>
                  <small>3-15 letters, numbers, or underscores.</small>
                  {errors.username && <strong className="register-error">{errors.username}</strong>}
                </div>
                <div className="register-field">
                  <label htmlFor="register-email">Email</label>
                  <div className="register-input-shell">
                    <FaEnvelope />
                    <input
                      id="register-email"
                      autoComplete="email"
                      type="email"
                      name="email"
                      value={values.email}
                      onChange={handleInputChange}
                      disabled={Boolean(oauthProvider)}
                      placeholder="you@example.com"
                      aria-invalid={Boolean(errors.email)}
                    />
                  </div>
                  {errors.email && <strong className="register-error">{errors.email}</strong>}
                </div>
              </>
            )}

            {!oauthProvider && step === 1 && (
              <>
                <div className="register-step-heading">
                  <FaShieldAlt />
                  <div>
                    <span>{stepLabel()}</span>
                    <h2>Protect your account</h2>
                    <p>Use a strong password you do not use elsewhere.</p>
                  </div>
                </div>
                <div className="register-field">
                  <label htmlFor="register-password">Password</label>
                  <div className="register-input-shell">
                    <FaLock />
                    <input
                      id="register-password"
                      autoFocus
                      autoComplete="new-password"
                      type="password"
                      name="password"
                      value={values.password}
                      onChange={handleInputChange}
                      placeholder="Create a password"
                      aria-invalid={Boolean(errors.password)}
                    />
                  </div>
                  {errors.password && <strong className="register-error">{errors.password}</strong>}
                </div>
                <div className="register-field">
                  <label htmlFor="register-confirm-password">Confirm password</label>
                  <div className="register-input-shell">
                    <FaLock />
                    <input
                      id="register-confirm-password"
                      autoComplete="new-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => {
                        setConfirmPassword(event.target.value);
                        setConfirmPasswordError('');
                      }}
                      placeholder="Enter it again"
                      aria-invalid={Boolean(confirmPasswordError)}
                    />
                  </div>
                  {confirmPasswordError && <strong className="register-error">{confirmPasswordError}</strong>}
                </div>
                <div className="password-requirements" aria-label="Password requirements">
                  {passwordRules.map((rule) => (
                    <span key={rule.label} className={rule.met ? 'is-met' : ''}>
                      <FaCheck /> {rule.label}
                    </span>
                  ))}
                </div>
              </>
            )}

            {step === (oauthProvider ? 1 : 2) && (
              <>
                <div className="register-step-heading">
                  <FaGamepad />
                  <div>
                    <span>{stepLabel(true)}</span>
                    <h2>Your Pokémon GO identity</h2>
                    <p>Help friends recognize you. You can change this later.</p>
                  </div>
                </div>
                <label className="register-choice">
                  <input
                    type="checkbox"
                    name="pokemonGoNameDisabled"
                    checked={values.pokemonGoNameDisabled}
                    onChange={handleCheckboxChange}
                  />
                  <span>
                    <strong>Use {values.username || 'my username'} as my Pokémon GO name</strong>
                    <small>One name across Pokémon Go Nexus and Pokémon GO.</small>
                  </span>
                </label>
                <div className="register-field">
                  <label htmlFor="register-pokemon-go-name">Pokémon GO name</label>
                  <input
                    id="register-pokemon-go-name"
                    autoFocus={!values.pokemonGoNameDisabled}
                    type="text"
                    name="pokemonGoName"
                    value={values.pokemonGoName}
                    onChange={handleInputChange}
                    placeholder="Optional"
                    disabled={values.pokemonGoNameDisabled}
                    aria-invalid={Boolean(errors.pokemonGoName)}
                  />
                  {errors.pokemonGoName && <strong className="register-error">{errors.pokemonGoName}</strong>}
                </div>
                <div className="register-field">
                  <label htmlFor="register-trainer-code">Trainer code</label>
                  <input
                    id="register-trainer-code"
                    inputMode="numeric"
                    type="text"
                    name="trainerCode"
                    value={values.trainerCode}
                    onChange={handleInputChange}
                    placeholder="0000 0000 0000"
                    data-testid="trainer-code-input"
                    aria-invalid={Boolean(errors.trainerCode)}
                  />
                  {errors.trainerCode && <strong className="register-error">{errors.trainerCode}</strong>}
                </div>
              </>
            )}

            {step === (oauthProvider ? 2 : 3) && (
              <>
                <div className="register-step-heading">
                  <FaMapMarkerAlt />
                  <div>
                    <span>{stepLabel(true)}</span>
                    <h2>Your area</h2>
                    <p>Location helps find nearby trainers and trades. Exact coordinates stay optional.</p>
                  </div>
                </div>
                <div className="register-location-field">
                  <div className="register-field">
                    <label htmlFor="register-location">City or place</label>
                    <input
                      id="register-location"
                      autoFocus
                      type="text"
                      name="locationInput"
                      value={values.locationInput}
                      onFocus={handleLocationInputFocus}
                      onBlur={handleLocationInputBlur}
                      onChange={handleInputChange}
                      placeholder="City, region, country"
                    />
                  </div>
                  {showLocationWarning && (
                    <div className="location-warning">Changing this resets saved coordinates.</div>
                  )}
                  {suggestions.length > 0 && (
                    <div className="suggestions-dropdown">
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={`${suggestion.displayName}-${index}`}
                          type="button"
                          className="suggestion-item"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectSuggestion(suggestion)}
                        >
                          {suggestion.displayName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <label className="register-choice">
                  <input
                    id="allowLocation"
                    type="checkbox"
                    name="allowLocation"
                    checked={values.allowLocation}
                    onChange={handleAllowLocationChange}
                  />
                  <span>
                    <strong>Use this device’s location</strong>
                    <small>Ask the browser for coordinates now.</small>
                  </span>
                </label>
                <button
                  type="button"
                  className="register-secondary-action"
                  onClick={() => setIsMapVisible(true)}
                  disabled={values.allowLocation}
                >
                  <FaMapMarkerAlt />
                  {selectedCoordinates ? 'Adjust map position' : 'Choose on map'}
                </button>
              </>
            )}

            {step === steps.length - 1 && (
              <>
                <div className="register-step-heading">
                  <FaCheck />
                  <div>
                    <span>{stepLabel()}</span>
                    <h2>Ready to join</h2>
                    <p>Your optional trainer details can be edited from your profile.</p>
                  </div>
                </div>
                <div className="register-review">
                  <button type="button" onClick={() => setStep(0)}>
                    <span><FaUser /><small>ACCOUNT</small><strong>{values.username}</strong></span>
                    <FaPen />
                  </button>
                  <button type="button" onClick={() => setStep(0)}>
                    <span><FaEnvelope /><small>EMAIL</small><strong>{values.email}</strong></span>
                    <FaPen />
                  </button>
                  <button type="button" onClick={() => setStep(oauthProvider ? 1 : 2)}>
                    <span><FaGamepad /><small>TRAINER</small><strong>{trainerName || 'Add later'}</strong></span>
                    <FaPen />
                  </button>
                  <button type="button" onClick={() => setStep(oauthProvider ? 1 : 2)}>
                    <span><FaGamepad /><small>TRAINER CODE</small><strong>{cleanTrainerCode || 'Add later'}</strong></span>
                    <FaPen />
                  </button>
                  <button type="button" onClick={() => setStep(oauthProvider ? 2 : 3)}>
                    <span><FaMapMarkerAlt /><small>AREA</small><strong>{locationSummary}</strong></span>
                    <FaPen />
                  </button>
                </div>
                <p className="register-agreement">
                  By creating an account, you agree to the <Link to="/terms">Terms</Link>
                  {' '}and acknowledge the <Link to="/privacy">Privacy Policy</Link>.
                </p>
              </>
            )}
          </div>

          {authMethod && <footer className="register-actions">
            {step > 0 ? (
              <button type="button" className="register-back" onClick={() => setStep((current) => current - 1)}>
                <FaArrowLeft /> Back
              </button>
            ) : <span />}
            <button className="register-continue" type="submit" data-testid="register-button">
              {step === steps.length - 1 ? (
                <>Create account <FaCheck /></>
              ) : (
                <>Continue <FaArrowRight /></>
              )}
            </button>
          </footer>}
        </form>
      </section>

      {isMapVisible && (
        <CoordinateSelector
          onCoordinatesSelect={handleCoordinatesSelect}
          onLocationSelect={handleLocationUpdate}
          onClose={() => setIsMapVisible(false)}
        />
      )}
      {showOptionsOverlay && (
        <LocationOptionsOverlay
          locations={locationOptions}
          onLocationSelect={handleOverlayLocationSelect}
          onDismiss={() => setShowOptionsOverlay(false)}
        />
      )}
    </main>
  );
};

export default RegisterForm;
