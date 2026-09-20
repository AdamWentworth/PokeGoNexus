import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ContextBackProvider,
  useContextBackHandler,
  type ContextBackBehavior,
} from '@/contexts/ContextBackContext';

const installMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      matches,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
    })),
  });
};

const LocationHarness = () => {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
};

const BackLayerHarness = ({
  behavior = 'all',
  onBack,
}: {
  behavior?: ContextBackBehavior;
  onBack?: () => void;
}) => {
  const [open, setOpen] = useState(true);

  useContextBackHandler(
    open,
    () => {
      onBack?.();
      setOpen(false);
      return true;
    },
    'test-layer',
    behavior,
  );

  return (
    <>
      <LocationHarness />
      <span data-testid="layer-state">{open ? 'open' : 'closed'}</span>
      <button type="button" onClick={() => setOpen(false)}>
        Close layer
      </button>
    </>
  );
};

const StackedBackLayersHarness = () => {
  const [parentOpen, setParentOpen] = useState(true);
  const [childOpen, setChildOpen] = useState(true);

  useContextBackHandler(
    parentOpen,
    () => {
      setParentOpen(false);
      return true;
    },
    'parent-layer',
  );
  useContextBackHandler(
    childOpen,
    () => {
      setChildOpen(false);
      return true;
    },
    'child-layer',
  );

  return (
    <>
      <LocationHarness />
      <span data-testid="parent-layer-state">
        {parentOpen ? 'open' : 'closed'}
      </span>
      <span data-testid="child-layer-state">
        {childOpen ? 'open' : 'closed'}
      </span>
    </>
  );
};

const renderAtSecondRoute = (children: ReactNode) => {
  window.history.replaceState({}, '', '/first');
  window.history.pushState({}, '', '/second');

  return render(
    <BrowserRouter>
      <ContextBackProvider>
        <Routes>
          <Route path="/first" element={<LocationHarness />} />
          <Route path="/second" element={children} />
        </Routes>
      </ContextBackProvider>
    </BrowserRouter>,
  );
};

describe('ContextBackProvider', () => {
  beforeEach(() => {
    installMatchMedia(false);
  });

  it('allows ordinary browser Back navigation when no context layer is open', async () => {
    renderAtSecondRoute(<LocationHarness />);
    expect(screen.getByTestId('location')).toHaveTextContent('/second');

    act(() => window.history.back());

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/first');
    });
  });

  it('closes one meaningful layer before navigating away from its route', async () => {
    renderAtSecondRoute(<BackLayerHarness />);
    expect(screen.getByTestId('layer-state')).toHaveTextContent('open');

    act(() => window.history.back());

    await waitFor(() => {
      expect(screen.getByTestId('layer-state')).toHaveTextContent('closed');
    });
    expect(screen.getByTestId('location')).toHaveTextContent('/second');

    act(() => window.history.back());

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/first');
    });
  });

  it('removes a layer guard when the visible close control dismisses it', async () => {
    renderAtSecondRoute(<BackLayerHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Close layer' }));
    await waitFor(() => {
      expect(screen.getByTestId('layer-state')).toHaveTextContent('closed');
    });

    act(() => window.history.back());

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/first');
    });
  });

  it('closes stacked layers one at a time before leaving the route', async () => {
    renderAtSecondRoute(<StackedBackLayersHarness />);

    act(() => window.history.back());

    await waitFor(() => {
      expect(screen.getByTestId('child-layer-state')).toHaveTextContent('closed');
    });
    expect(screen.getByTestId('parent-layer-state')).toHaveTextContent('open');
    expect(screen.getByTestId('location')).toHaveTextContent('/second');

    act(() => window.history.back());

    await waitFor(() => {
      expect(screen.getByTestId('parent-layer-state')).toHaveTextContent('closed');
    });
    expect(screen.getByTestId('location')).toHaveTextContent('/second');

    act(() => window.history.back());

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/first');
    });
  });

  it('keeps lightweight mobile-only UI out of desktop history', async () => {
    const onBack = vi.fn();
    renderAtSecondRoute(
      <BackLayerHarness behavior="mobile" onBack={onBack} />,
    );

    act(() => window.history.back());

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/first');
    });
    expect(onBack).not.toHaveBeenCalled();
  });

  it('dismisses lightweight UI first in a mobile back environment', async () => {
    installMatchMedia(true);
    renderAtSecondRoute(<BackLayerHarness behavior="mobile" />);

    act(() => window.history.back());

    await waitFor(() => {
      expect(screen.getByTestId('layer-state')).toHaveTextContent('closed');
    });
    expect(screen.getByTestId('location')).toHaveTextContent('/second');
  });
});
