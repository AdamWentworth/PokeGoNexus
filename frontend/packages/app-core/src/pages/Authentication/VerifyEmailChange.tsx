import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { FaCheckCircle, FaEnvelope } from 'react-icons/fa';

import { confirmEmailChange } from '@/services/authService';
import './ResetPassword.css';

const VerifyEmailChange = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'working' | 'success' | 'error'>(
    token ? 'working' : 'error',
  );
  const [message, setMessage] = useState(
    token ? 'Confirming your new email…' : 'This verification link is incomplete.',
  );

  useEffect(() => {
    if (!token) return;
    void confirmEmailChange(token)
      .then(() => {
        setStatus('success');
        setMessage('Your email has been updated. Sign in again with your new address.');
      })
      .catch((error) => {
        setStatus('error');
        setMessage(
          error instanceof Error
            ? error.message
            : 'This verification link is invalid or expired.',
        );
      });
  }, [token]);

  return (
    <div className="password-reset-page">
      <section className="password-reset-card" aria-live="polite">
        <div className="password-reset-brand">Pokémon Go Nexus</div>
        <div className="password-reset-success">
          {status === 'success' ? <FaCheckCircle /> : <FaEnvelope />}
          <h1>
            {status === 'working'
              ? 'Confirming email'
              : status === 'success'
                ? 'Email updated'
                : 'Email not updated'}
          </h1>
          <p>{message}</p>
          {status !== 'working' ? <Link to="/login">Continue to login</Link> : null}
        </div>
      </section>
    </div>
  );
};

export default VerifyEmailChange;
