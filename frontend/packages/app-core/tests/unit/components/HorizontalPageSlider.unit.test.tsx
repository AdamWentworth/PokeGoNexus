import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HorizontalPageSlider from '@/components/motion/HorizontalPageSlider';

describe('HorizontalPageSlider', () => {
  it('positions neighboring pages on one shared horizontal track', () => {
    render(
      <HorizontalPageSlider activeIndex={1} dragOffset={24}>
        <div>First page</div>
        <div>Second page</div>
      </HorizontalPageSlider>,
    );

    const track = document.querySelector('.horizontal-page-slider__track');
    expect(track).toHaveStyle({
      transform: 'translate3d(calc(-100% + 24px), 0, 0)',
    });
    expect(screen.getByText('First page').parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Second page').parentElement).toHaveAttribute('data-active', 'true');
  });

  it('removes the transition while the user is dragging', () => {
    render(
      <HorizontalPageSlider activeIndex={0} isDragging>
        <div>Current page</div>
        <div>Next page</div>
      </HorizontalPageSlider>,
    );

    expect(document.querySelector('.horizontal-page-slider__track')).toHaveStyle({
      transition: 'none',
    });
  });
});
