// ActionMenu.tsx

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FaBookOpen,
  FaCompass,
  FaInfoCircle,
  FaQuestionCircle,
  FaShareAlt,
  FaShieldAlt,
} from 'react-icons/fa';
import { useNavigate, useLocation } from 'react-router';
import ActionMenuButton from './ActionMenuButton';
import CloseButton from './CloseButton';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  isMobileContextBackEnvironment,
  useContextBackHandler,
} from '../contexts/ContextBackContext';
import { useAppLoading } from '../contexts/AppLoadingContext';
import { fetchFriendsOverview } from '../services/socialService';
import ThemeSwitch from './ThemeSwitch';
import { ACTION_MENU_DID_OPEN, ACTION_MENU_OPEN_REQUEST } from './actionMenuEvents';
import { actionMenuExperienceParityContract } from '@pokemongonexus/shared-ui-tokens';
import './ActionMenu.css';

const MENU_OPEN_TRANSITION_MS = actionMenuExperienceParityContract.motion.openMs;
const MENU_CLOSE_TRANSITION_MS = actionMenuExperienceParityContract.motion.closeMs;
const MENU_OPEN_DELAY_MS = 75;
const ACTION_MENU_NAVIGATION_SOURCE = 'action-menu-navigation';
const FOCUSABLE_MENU_CONTROL = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const SUPPORT_DESTINATION_ICONS = [
  FaCompass,
  FaQuestionCircle,
  FaInfoCircle,
  FaShieldAlt,
  FaBookOpen,
] as const;
const SUPPORT_DESTINATIONS = actionMenuExperienceParityContract.supportDestinations.map(
  (destination, index) => ({
    ...destination,
    icon: SUPPORT_DESTINATION_ICONS[index] ?? FaBookOpen,
  }),
);

const ActionMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isCloseEnabled, setIsCloseEnabled] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const supportButtonRef = useRef<HTMLButtonElement | null>(null);
  const supportPanelRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const shouldRestoreFocusRef = useRef(false);
  const openingAnimationTimeoutRef = useRef<number | null>(null);
  const closingAnimationTimeoutRef = useRef<number | null>(null);
  const closeEnableTimeoutRef = useRef<number | null>(null);
  const pendingMobileNavigationRef = useRef(false);
  const pendingNavigationLoadingRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { setLoadingSource } = useAppLoading();
  const { isLoggedIn } = useAuth() ?? {};
  const [pendingFriendCount, setPendingFriendCount] = useState(0);
  useTheme();

  const cancelPendingOpenAnimation = useCallback(() => {
    if (openingAnimationTimeoutRef.current === null) return;
    window.clearTimeout(openingAnimationTimeoutRef.current);
    openingAnimationTimeoutRef.current = null;
  }, []);

  const cancelPendingCloseEnable = useCallback(() => {
    if (closeEnableTimeoutRef.current === null) return;
    window.clearTimeout(closeEnableTimeoutRef.current);
    closeEnableTimeoutRef.current = null;
  }, []);

  const cancelPendingCloseAnimation = useCallback(() => {
    if (closingAnimationTimeoutRef.current === null) return;
    window.clearTimeout(closingAnimationTimeoutRef.current);
    closingAnimationTimeoutRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cancelPendingOpenAnimation();
      cancelPendingCloseAnimation();
      cancelPendingCloseEnable();
    };
  }, [
    cancelPendingCloseAnimation,
    cancelPendingCloseEnable,
    cancelPendingOpenAnimation,
  ]);

  useEffect(() => {
    if (!isVisible) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;

      if (!shouldRestoreFocusRef.current) return;
      shouldRestoreFocusRef.current = false;
      window.requestAnimationFrame(() => {
        const previousControl = restoreFocusRef.current;
        if (previousControl?.isConnected) {
          previousControl.focus({ preventScroll: true });
          return;
        }

        document
          .querySelector<HTMLButtonElement>('.action-menu-button')
          ?.focus({ preventScroll: true });
      });
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isOpen) return;
    overlayRef.current?.focus({ preventScroll: true });
  }, [isOpen]);

  useEffect(() => {
    let loadingReleaseFrame: number | null = null;

    if (pendingNavigationLoadingRef.current) {
      pendingNavigationLoadingRef.current = false;
      loadingReleaseFrame = window.requestAnimationFrame(() => {
        loadingReleaseFrame = null;
        setLoadingSource(ACTION_MENU_NAVIGATION_SOURCE, false);
      });
    }

    if (pendingMobileNavigationRef.current) {
      pendingMobileNavigationRef.current = false;
      cancelPendingOpenAnimation();
      cancelPendingCloseAnimation();
      cancelPendingCloseEnable();
      setIsCloseEnabled(false);
      setIsOpen(false);
      setIsVisible(false);
    }

    return () => {
      if (loadingReleaseFrame !== null) {
        window.cancelAnimationFrame(loadingReleaseFrame);
        setLoadingSource(ACTION_MENU_NAVIGATION_SOURCE, false);
      }
    };
  }, [
    cancelPendingCloseAnimation,
    cancelPendingCloseEnable,
    cancelPendingOpenAnimation,
    location.key,
    setLoadingSource,
  ]);

  useEffect(() => () => {
    setLoadingSource(ACTION_MENU_NAVIGATION_SOURCE, false);
  }, [setLoadingSource]);

  useEffect(() => {
    if (!isOpen || !isLoggedIn) {
      if (!isLoggedIn) setPendingFriendCount(0);
      return;
    }

    let active = true;
    void fetchFriendsOverview()
      .then((overview) => {
        if (active) setPendingFriendCount(overview.incoming.length);
      })
      .catch(() => {
        if (active) setPendingFriendCount(0);
      });

    return () => {
      active = false;
    };
  }, [isLoggedIn, isOpen]);

  const openMenu = useCallback(() => {
    cancelPendingOpenAnimation();
    cancelPendingCloseAnimation();
    cancelPendingCloseEnable();
    if (!isVisible) {
      restoreFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      shouldRestoreFocusRef.current = true;
    }
    setIsCloseEnabled(false);
    setIsVisible(true);
    window.dispatchEvent(new Event(ACTION_MENU_DID_OPEN));

    openingAnimationTimeoutRef.current = window.setTimeout(() => {
      openingAnimationTimeoutRef.current = null;
      setIsOpen(true);

      closeEnableTimeoutRef.current = window.setTimeout(() => {
        closeEnableTimeoutRef.current = null;
        setIsCloseEnabled(true);
      }, MENU_OPEN_TRANSITION_MS);
    }, MENU_OPEN_DELAY_MS);
  }, [
    cancelPendingCloseAnimation,
    cancelPendingCloseEnable,
    cancelPendingOpenAnimation,
    isVisible,
  ]);

  const closeMenu = useCallback(() => {
    cancelPendingOpenAnimation();
    cancelPendingCloseAnimation();
    cancelPendingCloseEnable();
    setIsCloseEnabled(false);
    setIsSupportOpen(false);
    setIsOpen(false);
    closingAnimationTimeoutRef.current = window.setTimeout(() => {
      closingAnimationTimeoutRef.current = null;
      setIsVisible(false);
    }, MENU_CLOSE_TRANSITION_MS);
  }, [
    cancelPendingCloseAnimation,
    cancelPendingCloseEnable,
    cancelPendingOpenAnimation,
  ]);

  const closeSupportMenu = useCallback((restoreFocus = true) => {
    setIsSupportOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => supportButtonRef.current?.focus());
    }
  }, []);

  const toggleSupportMenu = () => {
    if (isSupportOpen) {
      closeSupportMenu();
      return;
    }

    setIsSupportOpen(true);
    window.requestAnimationFrame(() => {
      supportPanelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    });
  };

  const handleMenuKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isOpen) return;

    if (event.key === 'Escape') {
      if (!isCloseEnabled) return;
      event.preventDefault();
      event.stopPropagation();
      if (isSupportOpen) {
        closeSupportMenu();
        return;
      }
      closeMenu();
      return;
    }

    if (event.key !== 'Tab') return;

    const menu = overlayRef.current;
    if (!menu) return;
    const controls = Array.from(
      menu.querySelectorAll<HTMLElement>(FOCUSABLE_MENU_CONTROL),
    ).filter((control) => control.getAttribute('aria-hidden') !== 'true');
    if (controls.length === 0) return;

    const firstControl = controls[0];
    const lastControl = controls[controls.length - 1];
    const activeControl = document.activeElement;

    if (event.shiftKey && (activeControl === firstControl || activeControl === menu)) {
      event.preventDefault();
      lastControl.focus();
      return;
    }

    if (!event.shiftKey && activeControl === lastControl) {
      event.preventDefault();
      firstControl.focus();
    }
  }, [closeMenu, closeSupportMenu, isCloseEnabled, isOpen, isSupportOpen]);

  useEffect(() => {
    const handleOpenRequest = () => openMenu();
    window.addEventListener(ACTION_MENU_OPEN_REQUEST, handleOpenRequest);

    return () => window.removeEventListener(ACTION_MENU_OPEN_REQUEST, handleOpenRequest);
  }, [openMenu]);

  const toggleMenu = () => {
    if (isOpen) {
      closeMenu();
      return;
    }
    openMenu();
  };

  const handleNavigation = (path: string) => {
    setIsSupportOpen(false);
    if (location.pathname !== path) {
      const replacesMobileMenuGuard = isMobileContextBackEnvironment();
      pendingMobileNavigationRef.current = replacesMobileMenuGuard;
      pendingNavigationLoadingRef.current = true;
      setLoadingSource(ACTION_MENU_NAVIGATION_SOURCE, true);
      navigate(path, {
        replace: replacesMobileMenuGuard,
        state: {
          contextBackTo: `${location.pathname}${location.search}${location.hash}`,
        },
      });
      if (replacesMobileMenuGuard) return;
    }
    cancelPendingOpenAnimation();
    cancelPendingCloseAnimation();
    cancelPendingCloseEnable();
    setIsCloseEnabled(false);
    setIsOpen(false);
    setIsVisible(false);
  };

  useContextBackHandler(isVisible, closeMenu, 'action-menu', 'mobile');
  useContextBackHandler(
    isVisible && isSupportOpen,
    () => closeSupportMenu(),
    'action-menu-support',
    'mobile',
  );

  return (
    <>
      {isVisible && (
        <div
          ref={overlayRef}
          className={`action-menu-overlay ${isOpen ? 'active' : ''}`}
          data-menu-state={isOpen ? 'open' : 'closed'}
          data-overlay-motion={isOpen ? 'entered' : 'exiting'}
          role="dialog"
          aria-label="Quick navigation"
          aria-modal="true"
          aria-hidden={!isOpen}
          inert={!isOpen}
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
        >
          <CloseButton
            className="action-menu-close"
            onClick={closeMenu}
            disabled={!isCloseEnabled}
          />

          {isLoggedIn ? (
            <button
              className="trade-board-button"
              onClick={() => handleNavigation('/trade-board')}
              type="button"
            >
              <FaShareAlt aria-hidden="true" />
              <span>Share Trade Board</span>
            </button>
          ) : null}

          <button
            className="settings-button"
            onClick={() => handleNavigation('/settings')}
            type="button"
          >
            <span className="settings-text">Settings</span>
            <img
              className="settings-icon"
              src="/images/btn_settings.png"
              alt=""
            />
          </button>

          <div className="theme-toggle">
            <div className="theme-toggle-container">
              <ThemeSwitch />
            </div>
          </div>

          <div className="auth-button-container">
            {isLoggedIn ? (
              <button
                className="auth-button"
                type="button"
                onClick={() => handleNavigation('/profile')}
                aria-label={pendingFriendCount > 0
                  ? `Profile, ${pendingFriendCount} pending friend ${pendingFriendCount === 1 ? 'request' : 'requests'}`
                  : 'Profile'}
              >
                <span className="auth-button-text">Profile</span>
                <span className="auth-button-icon-wrap">
                  <img
                    className="auth-button-icon"
                    src="/images/profile-icon.png"
                    alt=""
                  />
                  {pendingFriendCount > 0 ? (
                    <span className="action-menu-notification" aria-hidden="true">
                      {pendingFriendCount > 9 ? '9+' : pendingFriendCount}
                    </span>
                  ) : null}
                </span>
              </button>
            ) : (
              <div className="auth-button-stacked">
                <button
                  className="auth-button"
                  type="button"
                  onClick={() => handleNavigation('/register')}
                >
                  <span className="auth-button-text">Register</span>
                  <img
                    className="auth-button-icon"
                    src="/images/register-icon.png"
                    alt=""
                  />
                </button>
                <button
                  className="auth-button"
                  type="button"
                  onClick={() => handleNavigation('/login')}
                >
                  <span className="auth-button-text">Login</span>
                  <img
                    className="auth-button-icon"
                    src="/images/login-icon.png"
                    alt=""
                  />
                </button>
              </div>
            )}
          </div>

          <div className="action-menu-support">
            {isSupportOpen ? (
              <nav
                ref={supportPanelRef}
                className="action-menu-support__panel"
                id="action-menu-support-panel"
                aria-label="Learn and support"
              >
                <span className="action-menu-support__eyebrow">Learn &amp; support</span>
                {SUPPORT_DESTINATIONS.map(({ icon: Icon, label, path }) => (
                  <button
                    key={path}
                    className="action-menu-support__link"
                    onClick={() => handleNavigation(path)}
                    type="button"
                  >
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                ))}
              </nav>
            ) : null}
            <button
              ref={supportButtonRef}
              aria-controls="action-menu-support-panel"
              aria-expanded={isSupportOpen}
              className="help-button"
              onClick={toggleSupportMenu}
              type="button"
            >
              <FaBookOpen aria-hidden="true" />
              <span>Learn &amp; support</span>
            </button>
          </div>

          <div className={`action-menu-buttons-container ${isOpen ? 'open' : ''}`}>
            <button
              className="action-menu-item button-raid"
              onClick={() => handleNavigation('/raid')}
              type="button"
            >
              <div className="button-content">
                <img src="/images/btn_raid.png" alt="" className="button-icon" />
                <span className="button-label">Raid</span>
              </div>
            </button>

            <button
              className="action-menu-item button-search"
              onClick={() => handleNavigation('/search')}
              type="button"
            >
              <div className="button-content">
                <img src="/images/btn_search.png" alt="" className="button-icon" />
                <span className="button-label">Search</span>
              </div>
            </button>

            <button
              className="action-menu-item button-pokemon"
              onClick={() => handleNavigation('/pokemon')}
              type="button"
            >
              <div className="button-content">
                <img src="/images/btn_pokemon.png" alt="" className="button-icon" />
                <span className="button-label">Pokémon</span>
              </div>
            </button>

            <button
              className="action-menu-item button-pokedex"
              onClick={() => handleNavigation('/pokedex')}
              type="button"
            >
              <div className="button-content">
                <img src="/images/btn_pokedex.png" alt="" className="button-icon" />
                <span className="button-label">Pokedex</span>
              </div>
            </button>

            <button
              className="action-menu-item button-home"
              onClick={() => handleNavigation('/')}
              type="button"
            >
              <div className="button-content">
                <img src="/images/btn_home.png" alt="" className="button-icon" />
                <span className="button-label">Home</span>
              </div>
            </button>

            <button
              className="action-menu-item button-pvp"
              onClick={() => handleNavigation('/pvp')}
              type="button"
            >
              <div className="button-content">
                <img src="/images/btn_pvp.png" alt="" className="button-icon" />
                <span className="button-label">PvP</span>
              </div>
            </button>

            <button
              className="action-menu-item button-trades"
              onClick={() => handleNavigation('/trades')}
              type="button"
            >
              <div className="button-content">
                <img src="/images/btn_trades.png" alt="" className="button-icon" />
                <span className="button-label">Trades</span>
              </div>
            </button>

            <button
              className="action-menu-item button-rankings"
              onClick={() => handleNavigation('/rankings')}
              type="button"
            >
              <div className="button-content">
                <img src="/images/btn_rankings.png" alt="" className="button-icon" />
                <span className="button-label">Rankings</span>
              </div>
            </button>

            <button
              className="action-menu-item button-max"
              onClick={() => handleNavigation('/max')}
              type="button"
            >
              <div className="button-content">
                <img src="/images/btn_max.png" alt="" className="button-icon" />
                <span className="button-label">Max Battles</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {!isCloseEnabled && (
        <ActionMenuButton
          ariaHidden={isVisible}
          disabled={isVisible}
          onClick={toggleMenu}
        />
      )}
    </>
  );
};

export default ActionMenu;
