import { fireEvent, render, screen } from '@testing-library/react';
import { useState, type FormEvent } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import RegisterForm from '@/pages/Authentication/FormComponents/RegisterForm';
import type { RegisterFormValues } from '@/types/auth';

const initialValues: RegisterFormValues = {
  username: '',
  email: '',
  password: '',
  trainerCode: '',
  pokemonGoName: '',
  locationInput: '',
  coordinates: null,
  allowLocation: false,
  pokemonGoNameDisabled: false,
};

function Harness({
  onSubmit = vi.fn(),
  validateFields = vi.fn(() => true),
  oauthProvider,
}: {
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  validateFields?: (fieldNames: Array<keyof RegisterFormValues>) => boolean;
  oauthProvider?: 'google';
}) {
  const [values, setValues] = useState({
    ...initialValues,
    ...(oauthProvider ? { email: 'verified@example.com' } : {}),
  });

  return (
    <MemoryRouter>
      <RegisterForm
        onSubmit={onSubmit}
        errors={{}}
        values={values}
        validateFields={validateFields}
        handleInputChange={(event) => {
          const { name, value } = event.target;
          setValues((current) => ({ ...current, [name]: value }));
        }}
        handleCheckboxChange={(event) => {
          const { name, checked } = event.target;
          setValues((current) => ({
            ...current,
            [name]: checked,
            ...(name === 'pokemonGoNameDisabled' && checked
              ? { pokemonGoName: current.username }
              : {}),
          }));
        }}
        handleAllowLocationChange={vi.fn()}
        handleCoordinatesSelect={vi.fn()}
        handleLocationInputFocus={vi.fn()}
        handleLocationInputBlur={vi.fn()}
        selectSuggestion={vi.fn()}
        handleLocationUpdate={vi.fn()}
        handleOverlayLocationSelect={vi.fn()}
        isMapVisible={false}
        setIsMapVisible={vi.fn()}
        selectedCoordinates={null}
        showLocationWarning={false}
        suggestions={[]}
        showOptionsOverlay={false}
        setShowOptionsOverlay={vi.fn()}
        locationOptions={[]}
        oauthProvider={oauthProvider}
        onGoogleClick={vi.fn()}
      />
    </MemoryRouter>
  );
}

function completeAccountStep() {
  fireEvent.click(screen.getByRole('button', { name: /continue with email/i }));
  fireEvent.change(screen.getByLabelText('Username'), {
    target: { name: 'username', value: 'Ash_Ketchum' },
  });
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { name: 'email', value: 'ash@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
}

describe('RegisterForm', () => {
  it('guides a trainer through every step and submits from review', () => {
    const onSubmit = vi.fn();
    const validateFields = vi.fn(() => true);
    render(<Harness onSubmit={onSubmit} validateFields={validateFields} />);

    expect(screen.getAllByRole('heading', { name: 'Create your account' })).toHaveLength(1);
    expect(screen.getByText('Already have an account?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('group', { name: 'Choose a sign-up method' })).toBeInTheDocument();
    completeAccountStep();
    expect(validateFields).toHaveBeenCalledWith(['username', 'email']);

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { name: 'password', value: 'StrongPass1!' },
    });
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'StrongPass1!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByRole('heading', { name: 'Your Pokémon GO identity' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByRole('heading', { name: 'Your area' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByRole('heading', { name: 'Ready to join' })).toBeInTheDocument();
    expect(screen.getByText('Ash_Ketchum')).toBeInTheDocument();
    expect(screen.getByText('ash@example.com')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not leave the security step when confirmation differs', () => {
    render(<Harness />);
    completeAccountStep();

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { name: 'password', value: 'StrongPass1!' },
    });
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'DifferentPass1!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Protect your account' })).toBeInTheDocument();
  });

  it('keeps the current step visible when its fields fail validation', () => {
    const validateFields = vi.fn(() => false);
    render(<Harness validateFields={validateFields} />);

    fireEvent.click(screen.getByRole('button', { name: /continue with email/i }));
    fireEvent.click(screen.getByTestId('register-button'));

    expect(screen.getByRole('heading', { name: 'Your account' })).toBeInTheDocument();
    expect(validateFields).toHaveBeenCalledWith(['username', 'email']);
  });

  it('skips password creation after Google verifies the email', () => {
    render(<Harness oauthProvider="google" />);

    fireEvent.change(screen.getByLabelText('Username'), {
      target: { name: 'username', value: 'GoogleTrainer' },
    });
    expect(screen.getByLabelText('Email')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.queryByRole('heading', { name: 'Protect your account' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your Pokémon GO identity' })).toBeInTheDocument();
  });
});
