import { useEffect, useState } from "react";
import {
  FaDiscord,
  FaEnvelope,
  FaFacebook,
  FaGoogle,
  FaKey,
  FaLaptop,
  FaSignOutAlt,
  FaTrash,
  FaUser,
} from "react-icons/fa";
import { useNavigate, useSearchParams } from "react-router";
import { feedback } from '@/components/feedback';

import { useAuth } from "@/contexts/AuthContext";
import { useModal } from "@/contexts/ModalContext";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  fetchAccountSecurity,
  requestEmailChange,
  revokeAllSessions,
  startDiscordAuthentication,
  startFacebookAuthentication,
  startGoogleAuthentication,
  unlinkProvider,
} from "@/services/authService";
import type { AccountSecuritySummary, OAuthProvider } from "@shared-contracts/auth";

import TrainerPageShell from "./TrainerPageShell";

const AccountSecurity = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { confirm } = useModal();
  const { updateUserDetails, logout, deleteAccount } = useAuth();
  const user = useAuthStore((state) => state.user);
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [security, setSecurity] = useState<AccountSecuritySummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [providerWorking, setProviderWorking] = useState<OAuthProvider | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
    }
  }, [navigate, user]);

  useEffect(() => {
    if (!user) return;
    void fetchAccountSecurity()
      .then(setSecurity)
      .catch(() => feedback.error("Could not load account security details."));
  }, [user]);

  useEffect(() => {
    const oauth = searchParams.get("oauth");
    if (oauth === "linked") feedback.success("Sign-in method connected");
    if (oauth === "link-conflict") {
      feedback.error("That provider account is already connected elsewhere.");
    }
  }, [searchParams]);

  if (!user) return null;

  const saveAccount = async () => {
    if (password && password !== confirmPassword) {
      feedback.error("Passwords do not match.");
      return;
    }
    const requestedEmail = email.trim().toLowerCase();
    const emailChanged = requestedEmail !== user.email.toLowerCase();
    setSaving(true);
    const result = await updateUserDetails(user.user_id, {
      username: username.trim(),
      email: user.email,
      ...(password ? { password } : {}),
      ...(password && currentPassword
        ? { currentPassword }
        : {}),
    });
    if (!result.success) {
      setSaving(false);
      feedback.error(
        typeof result.error === "string"
          ? result.error
          : "Could not update account.",
      );
      return;
    }
    if (emailChanged) {
      try {
        await requestEmailChange(requestedEmail, currentPassword || undefined);
        feedback.success(`Verification sent to ${requestedEmail}`);
      } catch (error) {
        setSaving(false);
        feedback.error(
          error instanceof Error
            ? error.message
            : "Could not send email verification.",
        );
        return;
      }
    }
    setSaving(false);
    setPassword("");
    setConfirmPassword("");
    setCurrentPassword("");
    if (!emailChanged) feedback.success("Account updated");
  };

  const signOut = async () => {
    await logout();
    navigate("/login");
  };

  const removeAccount = async () => {
    const approved = await confirm(
      "Permanently delete your account, catalog, profile, trades, and social data? This cannot be undone.",
    );
    if (!approved) return;
    try {
      await deleteAccount(user.user_id, currentPassword || undefined);
      feedback.success("Account deleted");
    } catch (error) {
      feedback.error(
        error instanceof Error ? error.message : "Could not delete account.",
      );
    }
  };

  const signOutEverywhere = async () => {
    const approved = await confirm(
      "Sign out every device currently connected to this account?",
    );
    if (!approved) return;
    setRevoking(true);
    try {
      await revokeAllSessions(currentPassword || undefined);
      feedback.success("All devices signed out");
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      feedback.error(
        error instanceof Error ? error.message : "Could not revoke sessions.",
      );
    } finally {
      setRevoking(false);
    }
  };

  const providerIcon = (provider: OAuthProvider) => {
    if (provider === "google") return <FaGoogle />;
    if (provider === "discord") return <FaDiscord />;
    return <FaFacebook />;
  };

  const connectProvider = (provider: OAuthProvider) => {
    if (provider === "google") startGoogleAuthentication("link");
    if (provider === "discord") startDiscordAuthentication("link");
    if (provider === "facebook") startFacebookAuthentication("link");
  };

  const disconnectProvider = async (provider: OAuthProvider) => {
    const approved = await confirm(
      `Disconnect ${provider}? You will no longer be able to use it to sign in.`,
    );
    if (!approved) return;
    setProviderWorking(provider);
    try {
      await unlinkProvider(provider, currentPassword || undefined);
      setSecurity(await fetchAccountSecurity());
      feedback.success(`${provider[0].toUpperCase() + provider.slice(1)} disconnected`);
    } catch (error) {
      feedback.error(
        error instanceof Error ? error.message : "Could not disconnect provider.",
      );
    } finally {
      setProviderWorking(null);
    }
  };

  return (
    <TrainerPageShell workspace="settings" title="Account">
      <section className="trainer-section">
        <header>
          <div>
            <span>Login identity</span>
            <h2>Account details</h2>
          </div>
          <FaKey />
        </header>
        <div className="trainer-form-grid">
          <label className="trainer-field">
            <span>
              <FaUser /> Username
            </span>
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          {security?.hasPassword ? (
            <label className="trainer-field">
              <span>Current password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                placeholder="Required for security changes"
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
              <small>
                Required when changing your email or password, signing out every
                device, or deleting your account.
              </small>
            </label>
          ) : null}
          <label className="trainer-field">
            <span>
              <FaEnvelope /> Email
            </span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="trainer-field">
            <span>New password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              placeholder="Leave blank to keep current password"
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="trainer-field">
            <span>Confirm new password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
        </div>
        <div className="trainer-form-actions">
          <button
            type="button"
            className="trainer-button trainer-button-primary"
            disabled={saving}
            onClick={() => void saveAccount()}
          >
            <FaKey />
            {saving ? "Saving..." : "Update account"}
          </button>
        </div>
      </section>

      <section className="trainer-section">
        <header>
          <div>
            <span>Sign-in methods</span>
            <h2>Connected accounts</h2>
          </div>
          <FaKey />
        </header>
        <p className="trainer-section-copy">
          These verified providers currently open this same Pokémon Go Nexus account.
        </p>
        <div className="trainer-connected-accounts">
          {(["google", "discord", "facebook"] as OAuthProvider[]).map(
            (provider) => {
              const identity = security?.providers.find(
                (candidate) => candidate.provider === provider,
              );
              return (
                <div key={provider} className="trainer-connected-account">
                  {providerIcon(provider)}
                  <span>
                    <strong>
                      {provider[0].toUpperCase() + provider.slice(1)}
                    </strong>
                    <small>
                      {identity
                        ? identity.email || "Verified provider identity"
                        : "Not connected"}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="trainer-provider-action"
                    disabled={providerWorking === provider}
                    onClick={() =>
                      identity
                        ? void disconnectProvider(provider)
                        : connectProvider(provider)
                    }
                  >
                    {providerWorking === provider
                      ? "Working…"
                      : identity
                        ? "Disconnect"
                        : "Connect"}
                  </button>
                </div>
              );
            },
          )}
        </div>
      </section>

      <section className="trainer-section">
        <header>
          <div>
            <span>Session</span>
            <h2>Sign out</h2>
          </div>
          <FaSignOutAlt />
        </header>
        <p className="trainer-section-copy">
          End this session and clear locally stored account data from this
          device.
        </p>
        <button
          type="button"
          className="trainer-button trainer-button-secondary"
          onClick={() => void signOut()}
        >
          <FaSignOutAlt />
          Sign out
        </button>
        <div className="trainer-session-summary">
          <FaLaptop />
          <span>
            <strong>{security?.activeSessions ?? "—"} active sessions</strong>
            <small>Includes this browser when its session is active.</small>
          </span>
        </div>
        <button
          type="button"
          className="trainer-button trainer-button-secondary"
          disabled={revoking}
          onClick={() => void signOutEverywhere()}
        >
          <FaLaptop />
          {revoking ? "Signing out…" : "Sign out every device"}
        </button>
      </section>

      <section className="trainer-section trainer-danger-section">
        <header>
          <div>
            <span>Permanent action</span>
            <h2>Delete account</h2>
          </div>
          <FaTrash />
        </header>
        <p className="trainer-section-copy">
          Permanently remove your sign-in account, Pokemon catalog, profile,
          trades, friendships, privacy preferences, and active sessions.
        </p>
        <button
          type="button"
          className="trainer-button trainer-button-danger"
          onClick={() => void removeAccount()}
        >
          <FaTrash />
          Delete account
        </button>
      </section>
    </TrainerPageShell>
  );
};

export default AccountSecurity;
