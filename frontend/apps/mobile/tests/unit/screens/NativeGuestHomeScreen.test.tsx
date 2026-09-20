import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NativeGuestHomeScreen } from '../../../src/screens/NativeGuestHomeScreen';

describe('NativeGuestHomeScreen', () => {
  it('preserves the guest selling points, guide, directory, and account actions', () => {
    const onNavigate = jest.fn();
    render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}>
        <NativeGuestHomeScreen assetBaseUrl="https://pokegonexus.com" onNavigate={onNavigate} />
      </SafeAreaProvider>,
    );
    expect(screen.getByText('Build your collection.')).toBeTruthy();
    expect(screen.getByText('Find the right trade.')).toBeTruthy();
    expect(screen.getByText('Exact variants and custom tags')).toBeTruthy();
    expect(screen.getByText('Reciprocal trade matching')).toBeTruthy();
    expect(screen.getByText('You each have what the other trainer wants')).toBeTruthy();
    expect(screen.getByText('Catalog what you have')).toBeTruthy();
    expect(screen.getByText('Find a real match')).toBeTruthy();
    expect(screen.getByText('Propose with confidence')).toBeTruthy();

    fireEvent.press(screen.getByText('Create your free account'));
    fireEvent.press(screen.getByText('Explore the app ↓'));
    expect(onNavigate).toHaveBeenNthCalledWith(1, '/register');
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('keeps the Vite story, directory, and footer order', () => {
    const { toJSON } = render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}>
        <NativeGuestHomeScreen assetBaseUrl="https://pokegonexus.com" onNavigate={jest.fn()} />
      </SafeAreaProvider>,
    );
    const testIds: string[] = [];
    const visit = (node: unknown): void => {
      if (!node || typeof node === 'string' || Array.isArray(node)) {
        if (Array.isArray(node)) node.forEach(visit);
        return;
      }
      const element = node as { children?: unknown; props?: { testID?: unknown } };
      if (typeof element.props?.testID === 'string') testIds.push(element.props.testID);
      visit(element.children);
    };
    visit(toJSON());

    expect(testIds.indexOf('native-home-trade-story')).toBeLessThan(
      testIds.indexOf('native-home-feature-directory'),
    );
  });

  it('routes every Vite guest Home destination from a native link', () => {
    const onNavigate = jest.fn();
    render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}>
        <NativeGuestHomeScreen assetBaseUrl="https://pokegonexus.com" onNavigate={onNavigate} />
      </SafeAreaProvider>,
    );

    screen.getAllByRole('link').forEach((link) => fireEvent.press(link));
    const destinations = new Set(onNavigate.mock.calls.map(([path]) => path));
    expect(destinations).toEqual(new Set([
      '/', '/about', '/data-deletion', '/faq', '/friends', '/getting-started', '/help',
      '/login', '/max', '/pokedex', '/pokemon', '/privacy', '/pvp', '/raid', '/rankings',
      '/register', '/safety', '/search', '/terms', '/trade-board', '/trades',
    ]));
  });
});
