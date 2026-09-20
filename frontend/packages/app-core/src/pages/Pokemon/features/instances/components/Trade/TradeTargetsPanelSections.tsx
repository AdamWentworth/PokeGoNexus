import React from 'react';
import { FaUndoAlt } from 'react-icons/fa';

import { resolveTradeTargetsPanelCopy } from './tradeTargetsPanelState';

type TradeTargetsIntroProps = {
  isMirror: boolean;
};

export const TradeTargetsIntro: React.FC<TradeTargetsIntroProps> = ({ isMirror }) => {
  const copy = resolveTradeTargetsPanelCopy(isMirror);

  return (
    <div className="trade-details-container__intro">
      <div className="trade-details-container__eyebrow">{copy.eyebrow}</div>
      <h2>{copy.title}</h2>
      <p>{copy.description}</p>
    </div>
  );
};

type TradeTargetsWantedPanelProps = {
  isMirror: boolean;
  isEditable: boolean;
  editMode: boolean;
  visibleCount: number;
  activeRuleCount?: number;
  onResetFilters: () => void;
  children: React.ReactNode;
};

export const TradeTargetsWantedPanel: React.FC<TradeTargetsWantedPanelProps> = ({
  isMirror,
  isEditable,
  editMode,
  visibleCount,
  activeRuleCount = 0,
  onResetFilters,
  children,
}) => {
  const copy = resolveTradeTargetsPanelCopy(isMirror);
  const showResetFilters = !isMirror && isEditable;
  const countLabel = isMirror
    ? `${visibleCount} mirror ${visibleCount === 1 ? 'target' : 'targets'}`
    : `${visibleCount} wanted · ${activeRuleCount === 0
      ? 'no advanced rules'
      : `${activeRuleCount} active ${activeRuleCount === 1 ? 'rule' : 'rules'}`}`;

  return (
    <div className="trade-details-container__wanted-panel">
      <div className="trade-details-container__wanted-header">
        <div>
          <h3>{copy.listTitle}</h3>
          <span>{countLabel}</span>
        </div>
        {showResetFilters && (
          <button
            type="button"
            className={`trade-target-reset-button ${editMode ? 'editable' : ''}`}
            disabled={!editMode}
            onClick={editMode ? onResetFilters : undefined}
          >
            <FaUndoAlt aria-hidden="true" />
            <span>Reset</span>
          </button>
        )}
      </div>
      {children}
    </div>
  );
};
