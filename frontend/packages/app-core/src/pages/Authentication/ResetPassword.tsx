import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { FaCheckCircle, FaKey, FaLock } from 'react-icons/fa';
import { feedback } from '@/components/feedback';

import { confirmPasswordReset } from '@/services/authService';
import './ResetPassword.css';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const validPassword = useMemo(() =>
    password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) &&
    /\d/.test(password) && /[^A-Za-z\d]/.test(password), [password]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return feedback.error('This reset link is incomplete.');
    if (!validPassword) return feedback.error('Choose a password that meets every requirement.');
    if (password !== confirmation) return feedback.error('Passwords do not match.');
    setSubmitting(true);
    try {
      await confirmPasswordReset({ token, password });
      setComplete(true);
      window.setTimeout(() => navigate('/login'), 2500);
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : 'This reset link is invalid or expired.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="password-reset-page">
      <section className="password-reset-card">
        <div className="password-reset-brand">Pokémon Go Nexus</div>
        {complete ? (
          <div className="password-reset-success">
            <FaCheckCircle />
            <h1>Password updated</h1>
            <p>Your other sessions have been signed out. Taking you back to login…</p>
            <Link to="/login">Continue to login</Link>
          </div>
        ) : (
          <>
            <div className="password-reset-icon"><FaKey /></div>
            <h1>Choose a new password</h1>
            <p className="password-reset-intro">Use a strong password you do not use on another site.</p>
            <form onSubmit={submit}>
              <label>New password
                <input type="password" autoComplete="new-password" value={password}
                  onChange={(event) => setPassword(event.target.value)} />
              </label>
              <label>Confirm new password
                <input type="password" autoComplete="new-password" value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)} />
              </label>
              <div className="password-reset-rules">
                <FaLock /><span>8+ characters with uppercase, lowercase, a number, and a symbol.</span>
              </div>
              <button type="submit" disabled={submitting || !token}>
                {submitting ? 'Updating…' : 'Update password'}
              </button>
            </form>
            {!token ? <p className="password-reset-error">This reset link is incomplete.</p> : null}
            <Link className="password-reset-back" to="/login">Return to login</Link>
          </>
        )}
      </section>
    </div>
  );
};

export default ResetPassword;
