import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { BrowserRouter, Link, MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RouteScrollRestoration, {
  readRouteScrollPosition,
} from '@/components/navigation/RouteScrollRestoration';

describe('RouteScrollRestoration navigation timing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    window.history.replaceState({ idx: 0 }, '', '/');
    document.body.scrollTop = 0;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
    window.history.replaceState(null, '', '/');
    document.body.scrollTop = 0;
  });

  it('saves the outgoing position when a link activates before the scroll event arrives', () => {
    const view = render(
      <BrowserRouter>
        <RouteScrollRestoration />
        <Link to="/help">Help</Link>
      </BrowserRouter>,
    );
    act(() => vi.advanceTimersByTime(100));
    const replaceState = vi.spyOn(window.history, 'replaceState');

    // WebKit can update this coordinate before dispatching a scroll event.
    // A programmatic/accessibility click also need not emit pointerdown.
    document.body.scrollTop = 900;
    fireEvent.click(view.getByRole('link', { name: 'Help' }));

    expect(window.location.pathname).toBe('/help');
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(readRouteScrollPosition(replaceState.mock.calls[0][0])).toEqual({ x: 0, y: 900 });
    expect(readRouteScrollPosition(window.history.state)).toBeNull();
  });

  it('does not flush an outgoing route timer into the initial history entry after Back', () => {
    window.history.replaceState({ idx: 1, key: 'help-key' }, '', '/help');
    render(
      <MemoryRouter initialEntries={[{ pathname: '/help', key: 'help-key' }]}>
        <RouteScrollRestoration />
      </MemoryRouter>,
    );
    act(() => vi.advanceTimersByTime(100));
    document.body.scrollTop = 400;
    fireEvent.scroll(document.body);

    // History changes before React publishes the POP location. The initial
    // entry has no stored key, but still must reject the help entry's timer.
    const initialState = { idx: 0, __pgnRouteScrollPosition: { x: 0, y: 900 } };
    window.history.replaceState(initialState, '', '/');
    act(() => vi.advanceTimersByTime(80));

    expect(window.history.state).toEqual(initialState);
  });
});
