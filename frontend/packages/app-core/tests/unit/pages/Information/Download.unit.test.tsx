import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Download from '@/pages/Download/Download';
import { getAndroidBetaRelease } from '@/pages/Download/androidBeta';

vi.mock('@/pages/Download/androidBeta', () => ({ getAndroidBetaRelease: vi.fn() }));

describe('Android beta download', () => {
  beforeEach(() => vi.mocked(getAndroidBetaRelease).mockReturnValue(null));

  it('keeps the web app available without offering an unpublished download', async () => {
    const { container } = render(<MemoryRouter><Download /></MemoryRouter>);
    expect(screen.queryByRole('link', { name: 'Download Android APK' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Continue in the web app/ })).toHaveAttribute('href', '/pokemon');
    expect(screen.getByText(/affect your real account/)).toBeInTheDocument();
    expect(screen.getByText(/iPhone testing will open later/)).toBeInTheDocument();
    await expect(container).toHaveNoViolations();
  });

  it('links directly to the reviewed version and includes that version in feedback', async () => {
    const downloadUrl = 'https://github.com/AdamWentworth/PokeGoNexus/releases/download/android-beta-26091901/PokeGoNexus-Android-26091901.apk';
    vi.mocked(getAndroidBetaRelease).mockReturnValue({
      version: '1.0.3', versionCode: 26091901, publishedAt: '2026-09-19', sizeBytes: 80 * 1024 * 1024,
      downloadUrl, releaseNotesUrl: 'https://github.com/AdamWentworth/PokeGoNexus/releases/tag/android-beta-26091901', sha256: 'a'.repeat(64),
    });
    const { container } = render(<MemoryRouter><Download /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Download Android APK' })).toHaveAttribute('href', downloadUrl);
    const feedback = new URL(screen.getByRole('link', { name: /Send beta feedback/ }).getAttribute('href')!);
    expect(feedback.searchParams.get('title')).toContain('1.0.3, build 26091901');
    expect(screen.getByText(/Updates are manual/)).toBeInTheDocument();
    await expect(container).toHaveNoViolations();
  });
});
