import { useEffect, useState } from 'react';
import { FaTimes } from 'react-icons/fa';

import {
  ACTION_MENU_DID_OPEN,
  requestActionMenuOpen,
} from '@/components/actionMenuEvents';

import './HomeActionMenuHint.css';

interface HomeActionMenuHintProps {
  trainerKey: string;
  audience?: 'guest' | 'trainer';
}

const storageKeyFor = (trainerKey: string, audience: 'guest' | 'trainer') =>
  audience === 'guest'
    ? 'pokegonexus-action-menu-hint:guest'
    : `pokegonexus-action-menu-hint:${trainerKey}`;

const hasSeenHint = (storageKey: string) => {
  try {
    return window.localStorage.getItem(storageKey) === 'seen';
  } catch {
    return false;
  }
};

const rememberHint = (storageKey: string) => {
  try {
    window.localStorage.setItem(storageKey, 'seen');
  } catch {
    // The hint can still be dismissed for this visit when storage is unavailable.
  }
};

const HomeActionMenuHint = ({
  trainerKey,
  audience = 'trainer',
}: HomeActionMenuHintProps) => {
  const storageKey = storageKeyFor(trainerKey, audience);
  const [isVisible, setIsVisible] = useState(() => !hasSeenHint(storageKey));

  useEffect(() => {
    const acknowledgeMenu = () => {
      rememberHint(storageKey);
      setIsVisible(false);
    };

    window.addEventListener(ACTION_MENU_DID_OPEN, acknowledgeMenu);
    return () => window.removeEventListener(ACTION_MENU_DID_OPEN, acknowledgeMenu);
  }, [storageKey]);

  if (!isVisible) return null;

  const dismiss = () => {
    rememberHint(storageKey);
    setIsVisible(false);
  };

  const openMenu = () => {
    dismiss();
    requestActionMenuOpen();
  };

  return (
    <div className="home-action-menu-hint" role="note" aria-label="Action menu tip">
      <img src="/images/btn_action_menu.png" alt="" />
      <div>
        <span className="home-eyebrow">Quick navigation</span>
        <p>
          {audience === 'guest' ? (
            <>
              <span className="home-action-menu-hint__full-copy">
                Tap the <strong>Poké Ball</strong> at the bottom of any page to explore tools,
                switch themes, and find account options.
              </span>
              <span className="home-action-menu-hint__compact-copy">
                Tap the <strong>Poké Ball below</strong> to explore the app.
              </span>
            </>
          ) : (
            <>
              <span className="home-action-menu-hint__full-copy">
                Tap the <strong>Poké Ball</strong> at the bottom of any page to open the action menu.
              </span>
              <span className="home-action-menu-hint__compact-copy">
                Tap the <strong>Poké Ball below</strong> for quick navigation.
              </span>
            </>
          )}
        </p>
      </div>
      <button className="home-action-menu-hint__open" type="button" onClick={openMenu}>
        Open action menu
      </button>
      <button
        className="home-action-menu-hint__dismiss"
        type="button"
        aria-label="Dismiss action menu tip"
        onClick={dismiss}
      >
        <FaTimes aria-hidden="true" />
      </button>
    </div>
  );
};

export default HomeActionMenuHint;
