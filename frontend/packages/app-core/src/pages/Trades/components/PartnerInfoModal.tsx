import { useEffect, useState } from 'react';
import { FaCheck, FaCopy, FaDiscord, FaExternalLinkAlt, FaFire, FaShieldAlt, FaTimes } from 'react-icons/fa';
import type { PartnerInfo } from '@shared-contracts/trades';

import OverlayDismissButton from '@/components/OverlayDismissButton';
import OverlayPortal from '@/components/OverlayPortal';

import './PartnerInfoModal.css';

interface PartnerInfoModalProps {
  partnerInfo: PartnerInfo | null;
  partnerUsername?: string | null;
  onClose: () => void;
}

type CopiedField = 'trainer-code' | 'pokemon-go-name' | 'coordination-handle';

export function formatTrainerCode(code?: string | null): string {
  if (!code) return '';

  const stripped = code.replace(/\D/g, '');
  const matches = stripped.match(/.{1,4}/g);
  return matches ? matches.join(' ') : code;
}

const coordinationLabel = (method: PartnerInfo['coordinationMethod']): string => {
  switch (method) {
    case 'campfire': return 'Campfire';
    case 'discord': return 'Discord';
    case 'other': return 'Other community or app';
    default: return 'No external method shared';
  }
};

function PartnerInfoModal({ partnerInfo, partnerUsername, onClose }: PartnerInfoModalProps) {
  const [copiedField, setCopiedField] = useState<CopiedField | null>(null);

  useEffect(() => {
    if (!copiedField) return;
    const timer = window.setTimeout(() => setCopiedField(null), 1800);
    return () => window.clearTimeout(timer);
  }, [copiedField]);

  if (!partnerInfo) return null;

  const displayName = partnerInfo.pokemonGoName || partnerUsername || 'your trade partner';
  const formattedCode = formatTrainerCode(partnerInfo.trainerCode);
  const methodLabel = coordinationLabel(partnerInfo.coordinationMethod);

  const copyValue = async (field: CopiedField, value: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
    } catch {
      setCopiedField(null);
    }
  };

  const copyButton = (field: CopiedField, value: string, label: string) => (
    <button
      type="button"
      className="partner-copy-button"
      aria-label={`Copy ${label}`}
      onClick={() => void copyValue(field, value)}
    >
      {copiedField === field ? <FaCheck aria-hidden="true" /> : <FaCopy aria-hidden="true" />}
      <span>{copiedField === field ? 'Copied' : 'Copy'}</span>
    </button>
  );

  return (
    <OverlayPortal onClose={onClose} closeOnBackdrop>
      <div className="partner-coordination-overlay">
        <section
          className="partner-coordination-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="partner-coordination-title"
        >
          <OverlayDismissButton
            className="partner-coordination-close"
            aria-label="Close trade coordination"
            onDismiss={onClose}
          >
            <FaTimes aria-hidden="true" />
          </OverlayDismissButton>

          <header className="partner-coordination-header">
            <span>Accepted trade</span>
            <h2 id="partner-coordination-title">Coordinate the exchange</h2>
            <p>
              Pokémon Go Nexus matches the trade. You and {displayName} arrange the
              details externally, then complete it in Pokémon GO.
            </p>
          </header>

          {partnerInfo.sharingEnabled ? (
            <>
              <ol className="partner-coordination-steps" aria-label="Trade coordination steps">
                <li><span>1</span><strong>Add trainer</strong></li>
                <li><span>2</span><strong>Message externally</strong></li>
                <li><span>3</span><strong>Trade in Pokémon GO</strong></li>
              </ol>

              <div className="partner-identity-grid">
                <article className="partner-detail-card">
                  <span>Pokémon GO name</span>
                  <strong>{partnerInfo.pokemonGoName || 'Not provided'}</strong>
                  {partnerInfo.pokemonGoName
                    ? copyButton('pokemon-go-name', partnerInfo.pokemonGoName, 'Pokémon GO name')
                    : null}
                </article>
                <article className="partner-detail-card">
                  <span>Trainer Code</span>
                  <strong>{formattedCode || 'Not provided'}</strong>
                  {formattedCode
                    ? copyButton('trainer-code', formattedCode, 'trainer code')
                    : null}
                </article>
              </div>

              <article className={`partner-method-card partner-method-${partnerInfo.coordinationMethod}`}>
                <div className="partner-method-icon" aria-hidden="true">
                  {partnerInfo.coordinationMethod === 'discord' ? <FaDiscord /> : <FaFire />}
                </div>
                <div>
                  <span>Preferred contact</span>
                  <strong>{methodLabel}</strong>
                  {partnerInfo.coordinationHandle ? (
                    <p>@{partnerInfo.coordinationHandle}</p>
                  ) : partnerInfo.coordinationMethod === 'campfire' ? (
                    <p>Add the Trainer Code first, then find your new Niantic friend in Campfire.</p>
                  ) : (
                    <p>No username was provided. Use the Trainer Code to connect if available.</p>
                  )}
                </div>
                <div className="partner-method-actions">
                  {partnerInfo.coordinationHandle
                    ? copyButton('coordination-handle', partnerInfo.coordinationHandle, 'coordination username')
                    : null}
                  {partnerInfo.coordinationMethod === 'campfire' ? (
                    <a href="https://campfire.nianticlabs.com/" target="_blank" rel="noreferrer">
                      Open Campfire <FaExternalLinkAlt aria-hidden="true" />
                    </a>
                  ) : partnerInfo.coordinationMethod === 'discord' ? (
                    <a href="https://discord.com/app" target="_blank" rel="noreferrer">
                      Open Discord <FaExternalLinkAlt aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              </article>

              {partnerInfo.location ? (
                <p className="partner-general-location">
                  <strong>General location:</strong> {partnerInfo.location}
                </p>
              ) : null}
            </>
          ) : (
            <div className="partner-sharing-unavailable">
              <FaShieldAlt aria-hidden="true" />
              <div>
                <strong>{displayName} has not shared coordination details.</strong>
                <p>The trade remains active, but you will need an existing way to contact them.</p>
              </div>
            </div>
          )}

          <aside className="partner-coordination-safety">
            <FaShieldAlt aria-hidden="true" />
            <p>
              Messaging and the in-game exchange happen outside Pokémon Go Nexus. Protect
              your privacy, confirm the trainer and Pokémon, and never send money or account credentials.
            </p>
          </aside>
        </section>
      </div>
    </OverlayPortal>
  );
}

export default PartnerInfoModal;
