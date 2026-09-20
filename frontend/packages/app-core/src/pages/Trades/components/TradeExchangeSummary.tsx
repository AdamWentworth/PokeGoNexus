import type { ReactNode } from 'react';

import FriendshipLevel from '@/components/pokemonComponents/FriendshipLevel';

interface TradeExchangeSummaryProps {
  friendshipLevel: number;
  isLuckyTrade: boolean;
  stardustCost?: number | null;
  children?: ReactNode;
}

const TradeExchangeSummary = ({
  friendshipLevel,
  isLuckyTrade,
  stardustCost,
  children,
}: TradeExchangeSummaryProps) => (
  <div className="center-column" aria-label="Trade details">
    <div className="trade-friendship">
      <span className="trade-meta-label">Friendship</span>
      <FriendshipLevel level={friendshipLevel} prefLucky={isLuckyTrade} />
    </div>
    <div className="trade-icon" aria-hidden="true">
      <img src="/images/pogo_trade_icon.png" alt="" />
    </div>
    <div className="stardust-display">
      <span className="trade-meta-label">Stardust</span>
      <div className="stardust-value">
        <img src="/images/stardust.png" alt="" className="stardust-icon" />
        <span className="stardust-cost">
          {stardustCost?.toLocaleString() || '0'}
        </span>
      </div>
    </div>
    {children ? <div className="trade-actions">{children}</div> : null}
  </div>
);

export default TradeExchangeSummary;
