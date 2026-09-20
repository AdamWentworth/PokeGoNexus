import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DevSettings } from 'react-native';
import { MobileErrorBoundary } from '../../../src/components/MobileErrorBoundary';
import { reportCrash } from '../../../src/observability/crashReporter';

jest.mock('../../../src/observability/crashReporter', () => ({
  reportCrash: jest.fn().mockResolvedValue(undefined),
}));

const mockedReportCrash = reportCrash as jest.MockedFunction<typeof reportCrash>;

const ExplodingComponent = () => {
  throw new Error('render-failure');
};

describe('MobileErrorBoundary', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders fallback and reports crash when child throws', () => {
    render(
      <MobileErrorBoundary>
        <ExplodingComponent />
      </MobileErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(mockedReportCrash).toHaveBeenCalledWith(
      'react_error_boundary',
      expect.any(Error),
      expect.objectContaining({ fatal: true }),
    );
  });

  it('allows retry from fallback', () => {
    render(
      <MobileErrorBoundary>
        <ExplodingComponent />
      </MobileErrorBoundary>,
    );

    fireEvent.press(screen.getByText('Try Again'));
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('offers the canonical full reload recovery action', () => {
    const reload = jest.spyOn(DevSettings, 'reload').mockImplementation(() => undefined);
    render(
      <MobileErrorBoundary>
        <ExplodingComponent />
      </MobileErrorBoundary>,
    );

    fireEvent.press(screen.getByText('Reload'));
    expect(reload).toHaveBeenCalledTimes(1);
    reload.mockRestore();
  });
});
