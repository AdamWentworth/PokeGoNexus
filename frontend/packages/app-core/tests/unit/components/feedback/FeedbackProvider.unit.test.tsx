import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FeedbackProvider, feedback } from '@/components/feedback';

const renderProvider = () =>
  render(
    <FeedbackProvider>
      <span>App content</span>
    </FeedbackProvider>,
  );

describe('FeedbackProvider', () => {
  afterEach(() => {
    act(() => feedback.clear());
    vi.useRealTimers();
  });

  it('renders branded non-blocking feedback and supports dismissal', () => {
    renderProvider();

    act(() => {
      feedback.success('Trade proposal sent.');
    });

    expect(screen.getByRole('status')).toHaveTextContent('Success');
    expect(screen.getByRole('status')).toHaveTextContent('Trade proposal sent.');

    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss success notification' }),
    );
    expect(screen.queryByText('Trade proposal sent.')).not.toBeInTheDocument();
  });

  it('deduplicates stable ids and announces errors assertively', () => {
    renderProvider();

    act(() => {
      feedback.error('First failure', { id: 'save-error', duration: false });
      feedback.error('Updated failure', { id: 'save-error', duration: false });
    });

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Updated failure');
    expect(screen.queryByText('First failure')).not.toBeInTheDocument();
  });

  it('runs optional actions and removes their notification', () => {
    const onAction = vi.fn();
    renderProvider();

    act(() => {
      feedback.info('Your catalog changed.', {
        duration: false,
        action: { label: 'Review', onClick: onAction },
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Your catalog changed.')).not.toBeInTheDocument();
  });

  it('dismisses transient feedback after its configured duration', () => {
    vi.useFakeTimers();
    renderProvider();

    act(() => {
      feedback.warning('Temporary warning', { duration: 1_000 });
    });
    expect(screen.getByText('Temporary warning')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.queryByText('Temporary warning')).not.toBeInTheDocument();
  });

  it('keeps the notification stack bounded on small screens', () => {
    renderProvider();

    act(() => {
      for (let index = 1; index <= 5; index += 1) {
        feedback.info(`Notice ${index}`, { duration: false });
      }
    });

    expect(screen.getAllByRole('status')).toHaveLength(4);
    expect(screen.queryByText('Notice 1')).not.toBeInTheDocument();
    expect(screen.getByText('Notice 5')).toBeInTheDocument();
  });
});
