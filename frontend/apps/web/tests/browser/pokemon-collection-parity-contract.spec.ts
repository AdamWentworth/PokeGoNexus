import { expect, test } from '@playwright/test';

import {
  collectionExperienceParityContract,
  collectionParityTokens,
} from '../../../../packages/shared-ui-tokens/src/index';
import { expectActivePokemonView, openPokemonPage } from './support/pokemonApp';

const closeTo = (actual: number, expected: number, tolerance = 1) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
};

test.describe('canonical Pokémon collection parity contract', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !['chromium-desktop', 'mobile-chrome'].includes(testInfo.project.name),
      'The parity measurements use the agreed desktop and Pixel Chromium references.',
    );
  });

  test('keeps the measured header, slider, search, grid, and tags geometry', async ({
    page,
  }, testInfo) => {
    await openPokemonPage(page);
    const mobile = testInfo.project.name === 'mobile-chrome';
    const expectedColumns = mobile
      ? collectionParityTokens.grid.narrowColumns
      : collectionParityTokens.grid.wideColumns;
    const expectedHeaderInset = mobile
      ? collectionParityTokens.header.horizontalPaddingNarrow
      : collectionParityTokens.header.horizontalPaddingWide;
    const expectedHeaderFont = mobile
      ? collectionParityTokens.header.narrowLabelSize
      : collectionParityTokens.header.wideLabelSize;

    const pokemonGeometry = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>('.header');
      const tabs = Array.from(document.querySelectorAll<HTMLElement>('.toggle-col'));
      const underline = document.querySelector<HTMLElement>('.header-underline');
      const activeLabel = document.querySelector<HTMLElement>('.toggle-text.active');
      const slider = document.querySelector<HTMLElement>('.view-slider');
      const search = document.querySelector<HTMLElement>('.arrow-input-wrapper');
      const grid = document.querySelector<HTMLElement>('.pokemon-grid-row');
      const gridContainer = document.querySelector<HTMLElement>('.grid-container');
      if (
        !header || tabs.length !== 3 || !underline || !activeLabel || !slider
        || !search || !grid || !gridContainer
      ) {
        throw new Error('The canonical collection shell did not render its required structure.');
      }
      const style = (element: HTMLElement) => window.getComputedStyle(element);
      const headerRect = header.getBoundingClientRect();
      const tabRects = tabs.map((tab) => tab.getBoundingClientRect());
      const underlineRect = underline.getBoundingClientRect();
      const searchRect = search.getBoundingClientRect();
      const gridStyle = style(grid);
      const gridContainerStyle = style(gridContainer);
      const sliderStyle = style(slider);
      return {
        headerPaddingLeft: Number.parseFloat(style(header).paddingLeft),
        tabWidths: tabRects.map((rect) => rect.width),
        tabCenters: tabRects.map((rect) => rect.left + (rect.width / 2) - headerRect.left),
        underlineCenter: underlineRect.left + (underlineRect.width / 2) - headerRect.left,
        underlineHeight: underlineRect.height,
        underlineWidth: underlineRect.width,
        headerFontSize: Number.parseFloat(style(activeLabel).fontSize),
        searchHeight: searchRect.height,
        searchWidth: searchRect.width,
        viewportWidth: window.innerWidth,
        gridColumns: gridStyle.gridTemplateColumns.split(' ').filter(Boolean).length,
        gridGap: Number.parseFloat(gridStyle.columnGap),
        gridPaddingLeft: Number.parseFloat(gridContainerStyle.paddingLeft),
        sliderTransitionDuration: sliderStyle.transitionDuration,
        sliderTransitionProperty: sliderStyle.transitionProperty,
      };
    });

    closeTo(pokemonGeometry.headerPaddingLeft, expectedHeaderInset);
    pokemonGeometry.tabWidths.forEach((width) => {
      closeTo(
        width,
        (pokemonGeometry.viewportWidth - (expectedHeaderInset * 2)) / 3,
      );
    });
    closeTo(
      pokemonGeometry.underlineWidth,
      Math.max(
        collectionParityTokens.header.underlineMinWidth,
        pokemonGeometry.viewportWidth * collectionParityTokens.header.underlineViewportRatio,
      ),
    );
    closeTo(pokemonGeometry.underlineHeight, collectionParityTokens.header.underlineHeight);
    closeTo(pokemonGeometry.underlineCenter, pokemonGeometry.tabCenters[1]);
    closeTo(pokemonGeometry.headerFontSize, expectedHeaderFont, 0.25);
    closeTo(pokemonGeometry.searchHeight, mobile ? 40 : 50);
    closeTo(pokemonGeometry.searchWidth, pokemonGeometry.viewportWidth * 0.8, 2);
    expect(pokemonGeometry.gridColumns).toBe(expectedColumns);
    closeTo(pokemonGeometry.gridGap, collectionParityTokens.grid.gap);
    closeTo(
      pokemonGeometry.gridPaddingLeft,
      collectionParityTokens.grid.horizontalPadding,
    );
    expect(pokemonGeometry.sliderTransitionProperty).toContain('transform');
    expect(pokemonGeometry.sliderTransitionDuration).toContain(
      `${collectionExperienceParityContract.pageTransitionMs / 1_000}s`,
    );

    await page.getByText('TAGS', { exact: true }).click();
    await expectActivePokemonView(page, 'TAGS');
    const tagGeometry = await page.evaluate(() => {
      const menu = document.querySelector<HTMLElement>('.tags-menu');
      const card = document.querySelector<HTMLElement>('.tag-item');
      const preview = document.querySelector<HTMLElement>('.tag-preview');
      const footer = document.querySelector<HTMLElement>('.tag-footer');
      if (!menu || !card || !preview || !footer) {
        throw new Error('The canonical tags view did not render its required structure.');
      }
      const style = (element: HTMLElement) => window.getComputedStyle(element);
      return {
        menuMarginLeft: Number.parseFloat(style(menu).marginLeft),
        cardMarginTop: Number.parseFloat(style(card).marginTop),
        cardPadding: Number.parseFloat(style(card).paddingTop),
        cardRadius: Number.parseFloat(style(card).borderTopLeftRadius),
        previewMinHeight: Number.parseFloat(style(preview).minHeight),
        footerPaddingTop: Number.parseFloat(style(footer).paddingTop),
        footerPaddingLeft: Number.parseFloat(style(footer).paddingLeft),
      };
    });

    closeTo(tagGeometry.menuMarginLeft, collectionParityTokens.tags.pageInset);
    closeTo(tagGeometry.cardMarginTop, collectionParityTokens.tags.cardMarginVertical);
    closeTo(tagGeometry.cardPadding, collectionParityTokens.tags.cardPadding);
    closeTo(tagGeometry.cardRadius, collectionParityTokens.tags.cardRadius);
    closeTo(tagGeometry.previewMinHeight, mobile ? 94 : 154, 2);
    closeTo(tagGeometry.footerPaddingTop, collectionParityTokens.tags.footerVerticalInset);
    closeTo(tagGeometry.footerPaddingLeft, collectionParityTokens.tags.footerHorizontalInset);

    await page.getByText('WISHLIST', { exact: true }).click();
    await expectActivePokemonView(page, 'WISHLIST');
    await expect.poll(async () => page.locator('.header-underline').evaluate((element) => {
      const header = element.closest<HTMLElement>('.header');
      const rect = element.getBoundingClientRect();
      const headerRect = header?.getBoundingClientRect();
      if (!headerRect) throw new Error('Header not found for the Wishlist underline.');
      return Math.round(rect.left + (rect.width / 2) - headerRect.left);
    })).toBe(Math.round(pokemonGeometry.tabCenters[2]));
  });
});
