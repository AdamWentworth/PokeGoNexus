import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NATIVE_INFORMATION_PAGES } from '../../../src/features/information/nativeInformationContent';
import { NativeInformationScreen } from '../../../src/screens/NativeInformationScreen';

const renderPage = (
  slug: keyof typeof NATIVE_INFORMATION_PAGES,
  onNavigate = jest.fn(),
  initialFaqId?: string,
) => render(
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}>
    <NativeInformationScreen
      assetBaseUrl="https://pokegonexus.com"
      initialFaqId={initialFaqId}
      onBack={jest.fn()}
      onNavigate={onNavigate}
      page={NATIVE_INFORMATION_PAGES[slug]}
    />
  </SafeAreaProvider>,
);

describe('NativeInformationScreen', () => {
  it('renders legal content and its effective date without a web fallback', () => {
    renderPage('privacy');
    expect(screen.getByText('Privacy Policy')).toBeTruthy();
    expect(screen.getByText('Last updated: July 28, 2026')).toBeTruthy();
    expect(screen.getByText('What Pokémon Go Nexus collects')).toBeTruthy();
    expect(screen.getByText(/We collect the account information you provide, such as your email address/)).toBeTruthy();
  });

  it('keeps the canonical data-deletion copy and inline Account Security link', () => {
    const onNavigate = jest.fn();
    renderPage('data-deletion', onNavigate);

    expect(screen.getByText('Sign in to the Pokémon Go Nexus account you want to delete.')).toBeTruthy();
    fireEvent.press(screen.getByRole('link', { name: 'Settings → Account Security' }));
    expect(onNavigate).toHaveBeenCalledWith('/settings/account');
  });

  it('filters and expands categorized FAQ answers', () => {
    renderPage('faq');
    fireEvent.press(screen.getByRole('button', { name: 'Browse Trading questions' }));
    expect(screen.getByText('How do I propose a trade?')).toBeTruthy();
    expect(screen.queryByText('How do custom tags work?')).toBeNull();
    fireEvent.press(screen.getByText('How do I propose a trade?'));
    expect(screen.getByText(/Open another trainer’s For Trade/)).toBeTruthy();
  });

  it('opens a deep-linked FAQ answer and preserves its canonical self-link', () => {
    const onNavigate = jest.fn();
    renderPage('faq', onNavigate, 'remote-trades');

    expect(screen.getAllByText('Trading').length).toBeGreaterThan(0);
    expect(screen.getByText(/Five hearts represents Forever Friends/)).toBeTruthy();
    fireEvent.press(screen.getByRole('link', { name: /Link to this answer/ }));
    expect(onNavigate).toHaveBeenCalledWith('/faq#remote-trades');
  });

  it('routes guide actions through the native navigation adapter', () => {
    const onNavigate = jest.fn();
    renderPage('getting-started', onNavigate);
    fireEvent.press(screen.getByRole('button', { name: 'Open Pokémon' }));
    expect(onNavigate).toHaveBeenCalledWith('/pokemon');
  });

  it('does not carry an FAQ category filter into another information route', () => {
    const view = renderPage('faq');
    fireEvent.press(screen.getByRole('button', { name: 'Browse Trading questions' }));
    expect(screen.queryByText('How do custom tags work?')).toBeNull();

    view.rerender(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}>
        <NativeInformationScreen
          assetBaseUrl="https://pokegonexus.com"
          onBack={jest.fn()}
          onNavigate={jest.fn()}
          page={NATIVE_INFORMATION_PAGES.help}
        />
      </SafeAreaProvider>,
    );

    expect(screen.getByText('Privacy and account information')).toBeTruthy();
  });
});
