// LoginForm.tsx

import React, { FC, useState } from 'react';
import './LoginForm.css';

import { useModal } from '../../../contexts/ModalContext';
import type { LoginFormValues } from '../../../types/auth';
import type { FormErrors } from '../../../types/auth';
import { startGoogleAuthentication } from '@/services/authService';
import { startDiscordAuthentication } from '@/services/authService';
import { startFacebookAuthentication } from '@/services/authService';
import { FaDiscord, FaEye, FaEyeSlash, FaFacebookF } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';

interface LoginFormProps {
  values: LoginFormValues;
  errors: FormErrors;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onResetPassword?: () => void; // optional prop for reset password handling
}

const LoginForm: FC<LoginFormProps> = ({
  values,
  errors,
  onChange,
  onSubmit,
  onResetPassword,
}) => {
  const { alert } = useModal();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const handleResetPassword = () => {
    if (onResetPassword) {
      onResetPassword();
    } else {
      alert('Password Reset is not yet implemented.');
    }
  };

  return (
    <div className="login-page">
      <div className="login-form">
        <form onSubmit={onSubmit}>
          <div className="login-field">
            <label htmlFor="login-username">Username or email</label>
            <input
              id="login-username"
              type="text"
              name="username"
              value={values.username}
              onChange={onChange}
              placeholder="Username or Email"
              autoComplete="username"
              aria-invalid={Boolean(errors.username)}
              aria-describedby={errors.username ? 'login-username-error' : undefined}
              required
            />
            {errors.username && (
              <small id="login-username-error" className="login-field-error" role="alert">
                {errors.username}
              </small>
            )}
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <span className="login-password-control">
              <input
                id="login-password"
                type={isPasswordVisible ? 'text' : 'password'}
                name="password"
                value={values.password}
                onChange={onChange}
                placeholder="Password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'login-password-error' : undefined}
                required
              />
              <button
                type="button"
                className="login-password-toggle"
                aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                aria-pressed={isPasswordVisible}
                onClick={() => setIsPasswordVisible((isVisible) => !isVisible)}
              >
                {isPasswordVisible ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
              </button>
            </span>
            {errors.password && (
              <small id="login-password-error" className="login-field-error" role="alert">
                {errors.password}
              </small>
            )}
          </div>

          <button type="submit">Login</button>
          <button
            type="button"
            className="reset-password-button"
            onClick={handleResetPassword}
          >
            Reset Password
          </button>
          <div className="social-login-buttons">
            <button
              type="button"
              className="oauth-login-button oauth-login-button--google"
              onClick={() => startGoogleAuthentication('login')}
            >
              <FcGoogle aria-hidden="true" />
              Login with Google
            </button>
            <button
              type="button"
              className="oauth-login-button oauth-login-button--discord"
              onClick={() => startDiscordAuthentication('login')}
            >
              <FaDiscord aria-hidden="true" />
              Login with Discord
            </button>
            <button
              type="button"
              className="oauth-login-button oauth-login-button--facebook"
              onClick={() => startFacebookAuthentication('login')}
            >
              <FaFacebookF aria-hidden="true" />
              Login with Facebook
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;
