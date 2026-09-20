import { render, screen } from '@testing-library/react-native';
import { MobileAppRoot } from '../../src/MobileAppRoot';

jest.mock('../../src/screens/WebReplicaApp', () => {
  const ReactLocal = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    WebReplicaApp: () =>
      ReactLocal.createElement(Text, { testID: 'web-experience' }, 'Web'),
  };
});

describe('MobileAppRoot', () => {
  it('keeps the existing WebView experience on the production-safe root', () => {
    render(<MobileAppRoot />);
    expect(screen.getByTestId('web-experience')).toBeTruthy();
  });
});
