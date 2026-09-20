import React, { useMemo, useRef, useState } from 'react';
import {
  FaCheck,
  FaDownload,
  FaLink,
  FaShareAlt,
  FaShieldAlt,
  FaTimes,
} from 'react-icons/fa';

import OverlayDismissButton from '@/components/OverlayDismissButton';
import OverlayPortal from '@/components/OverlayPortal';
import { feedback } from '@/components/feedback';
import { useAuthStore } from '@/stores/useAuthStore';
import type { AllVariants } from '@/types/pokemonVariants';
import type { TagBuckets } from '@/types/tags';
import { useTradeBoardQrCode } from '../hooks/useTradeBoardQrCode';
import {
  buildTradeBoardModel,
  tradeBoardFilename,
  type TradeBoardTheme,
} from '../model/tradeBoardModel';
import { tradeBoardPublicUrl } from '../model/tradeBoardUrl';
import {
  canShareTradeBoardFile,
  downloadTradeBoardBlob,
  renderTradeBoardBlob,
  shareTradeBoardBlob,
} from '../services/tradeBoardExport';
import TradeBoard from './TradeBoard';
import TradeBoardViewport from './TradeBoardViewport';
import './TradeBoardComposer.css';

export interface TradeBoardComposerProps {
  activeTags: Pick<TagBuckets, 'wanted' | 'trade'>;
  onClose?: () => void;
  presentation?: 'overlay' | 'page';
  variants: AllVariants;
}

const THEMES: Array<{
  id: TradeBoardTheme;
  label: string;
  description: string;
}> = [
  { id: 'brand-dark', label: 'Nexus Dark', description: 'Bold and ideal for social feeds.' },
  { id: 'brand-light', label: 'Nexus Light', description: 'Clean and bright for messaging.' },
  { id: 'minimal', label: 'Minimal', description: 'Neutral and easy to print.' },
];

const copyText = async (value: string): Promise<void> => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement('textarea');
  input.value = value;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('Your browser could not copy the link.');
};

const TradeBoardComposer: React.FC<TradeBoardComposerProps> = ({
  activeTags,
  onClose,
  presentation = 'overlay',
  variants,
}) => {
  const user = useAuthStore((state) => state.user);
  const username = user?.username?.trim() || 'trainer';
  const pokemonGoName = user?.pokemonGoName?.trim() || null;
  const tradeItems = useMemo(() => Object.values(activeTags.trade ?? {}), [activeTags.trade]);
  const wantedItems = useMemo(() => Object.values(activeTags.wanted ?? {}), [activeTags.wanted]);
  const [includeTrade, setIncludeTrade] = useState(tradeItems.length > 0);
  const [includeWanted, setIncludeWanted] = useState(wantedItems.length > 0);
  const [showPokemonGoName, setShowPokemonGoName] = useState(true);
  const [theme, setTheme] = useState<TradeBoardTheme>('brand-dark');
  const [generatedAt] = useState(() => new Date().toISOString());
  const [isExporting, setIsExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const boardUrl = tradeBoardPublicUrl(username);
  const qrCodeDataUrl = useTradeBoardQrCode(boardUrl);
  const model = useMemo(() => buildTradeBoardModel({
    boardUrl,
    generatedAt,
    includeTrade,
    includeWanted,
    pokemonGoName,
    showPokemonGoName,
    tradeItems,
    username,
    variants,
    wantedItems,
  }), [
    boardUrl,
    generatedAt,
    includeTrade,
    includeWanted,
    pokemonGoName,
    showPokemonGoName,
    tradeItems,
    username,
    variants,
    wantedItems,
  ]);
  const filename = tradeBoardFilename(username, generatedAt);
  const canShare = canShareTradeBoardFile(filename);

  const updateSection = (section: 'trade' | 'wanted', nextValue: boolean) => {
    if (!nextValue && ((section === 'trade' && !includeWanted) || (section === 'wanted' && !includeTrade))) {
      feedback.info('Keep at least one Trade Board section selected.');
      return;
    }
    if (section === 'trade') setIncludeTrade(nextValue);
    else setIncludeWanted(nextValue);
  };

  const createBlob = async () => {
    if (!exportRef.current) throw new Error('The Trade Board is not ready yet.');
    return renderTradeBoardBlob(exportRef.current);
  };

  const handleDownload = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const blob = await createBlob();
      downloadTradeBoardBlob(blob, filename);
      feedback.success('Your Trade Board image was downloaded.');
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : 'Could not create your Trade Board image.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const blob = await createBlob();
      await shareTradeBoardBlob(blob, filename, boardUrl);
      feedback.success('Your Trade Board is ready to share.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      feedback.error(error instanceof Error ? error.message : 'Could not share your Trade Board.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await copyText(boardUrl);
      feedback.success('Live Trade Board link copied.');
    } catch (error) {
      feedback.error(error instanceof Error ? error.message : 'Could not copy the link.');
    }
  };

  const isPage = presentation === 'page';
  const closeComposer = () => onClose?.();
  const composer = (
        <section
          aria-labelledby="trade-board-composer-title"
          {...(!isPage ? { 'aria-modal': true } : {})}
          className={`trade-board-composer ${isPage ? 'trade-board-composer--page' : ''}`}
          role={isPage ? 'region' : 'dialog'}
        >
          <header className="trade-board-composer__header">
            <div>
              <span>Share your collection</span>
              <h2 id="trade-board-composer-title">
                {isPage ? 'Share your Trade Board' : 'Create a Trade Board'}
              </h2>
              <p>One clear image for what you have and what you want.</p>
            </div>
            {!isPage ? (
              <OverlayDismissButton
                aria-label="Close Trade Board composer"
                className="trade-board-composer__close"
                disabled={isExporting}
                onDismiss={closeComposer}
              >
                <FaTimes aria-hidden="true" />
              </OverlayDismissButton>
            ) : null}
          </header>

          <div className="trade-board-composer__body">
            <aside className="trade-board-composer__controls" aria-label="Trade Board options">
              <fieldset>
                <legend>Include on board</legend>
                <label className="trade-board-composer__section-option trade-board-composer__section-option--trade">
                  <input
                    checked={includeTrade}
                    disabled={tradeItems.length === 0}
                    onChange={(event) => updateSection('trade', event.target.checked)}
                    type="checkbox"
                  />
                  <span><FaCheck aria-hidden="true" /></span>
                  <div><strong>For Trade</strong><small>{tradeItems.length} Pokémon</small></div>
                </label>
                <label className="trade-board-composer__section-option trade-board-composer__section-option--wanted">
                  <input
                    checked={includeWanted}
                    disabled={wantedItems.length === 0}
                    onChange={(event) => updateSection('wanted', event.target.checked)}
                    type="checkbox"
                  />
                  <span><FaCheck aria-hidden="true" /></span>
                  <div><strong>Looking For</strong><small>{wantedItems.length} Pokémon</small></div>
                </label>
              </fieldset>

              <fieldset>
                <legend>Board style</legend>
                <div className="trade-board-composer__themes">
                  {THEMES.map((option) => (
                    <button
                      aria-pressed={theme === option.id}
                      data-theme-option={option.id}
                      key={option.id}
                      onClick={() => setTheme(option.id)}
                      type="button"
                    >
                      <span aria-hidden="true" />
                      <div><strong>{option.label}</strong><small>{option.description}</small></div>
                    </button>
                  ))}
                </div>
              </fieldset>

              {pokemonGoName && pokemonGoName.toLowerCase() !== username.toLowerCase() ? (
                <label className="trade-board-composer__identity-option">
                  <input
                    checked={showPokemonGoName}
                    onChange={(event) => setShowPokemonGoName(event.target.checked)}
                    type="checkbox"
                  />
                  <span>Show my Pokémon GO name</span>
                </label>
              ) : null}

              <div className="trade-board-composer__privacy-note">
                <FaShieldAlt aria-hidden="true" />
                <p><strong>Your privacy still applies.</strong> The QR code opens a live, read-only board and never exposes private location data.</p>
              </div>
            </aside>

            <div className="trade-board-composer__preview">
              <header>
                <div><span>Live preview</span><strong>Exactly what gets exported</strong></div>
                <small>High-resolution PNG</small>
              </header>
              <TradeBoardViewport model={model} qrCodeDataUrl={qrCodeDataUrl} theme={theme} />
            </div>
          </div>

          <footer className="trade-board-composer__footer">
            <button className="trade-board-composer__copy" onClick={() => void handleCopyLink()} type="button">
              <FaLink aria-hidden="true" /> Copy live link
            </button>
            <div>
              <button disabled={isExporting || !qrCodeDataUrl} onClick={() => void handleDownload()} type="button">
                <FaDownload aria-hidden="true" /> {isExporting ? 'Creating…' : qrCodeDataUrl ? 'Download PNG' : 'Preparing…'}
              </button>
              {canShare ? (
                <button
                  className="trade-board-composer__share"
                  disabled={isExporting || !qrCodeDataUrl}
                  onClick={() => void handleShare()}
                  type="button"
                >
                  <FaShareAlt aria-hidden="true" /> {isExporting ? 'Creating…' : qrCodeDataUrl ? 'Share image' : 'Preparing…'}
                </button>
              ) : null}
            </div>
          </footer>

          <div aria-hidden="true" className="trade-board-composer__export-board">
            <TradeBoard model={model} qrCodeDataUrl={qrCodeDataUrl} ref={exportRef} theme={theme} />
          </div>
        </section>
  );

  if (isPage) {
    return <div className="trade-board-composer-page">{composer}</div>;
  }

  return (
    <OverlayPortal closeOnBackdrop dismissible={!isExporting} onClose={closeComposer}>
      <div className="trade-board-composer-overlay">
        {composer}
      </div>
    </OverlayPortal>
  );
};

export default TradeBoardComposer;
