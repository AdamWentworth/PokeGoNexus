import React, { useLayoutEffect, useRef, useState } from 'react';

import TradeBoard, { type TradeBoardProps } from './TradeBoard';
import './TradeBoardViewport.css';

const BOARD_WIDTH = 1200;

const TradeBoardViewport: React.FC<TradeBoardProps> = (props) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const board = boardRef.current;
    if (!frame || !board) return undefined;

    const measure = () => {
      const nextScale = Math.min(1, frame.clientWidth / BOARD_WIDTH);
      setScale(nextScale);
      setHeight(board.offsetHeight * nextScale);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(board);
    return () => observer.disconnect();
  }, [props.model, props.qrCodeDataUrl, props.theme]);

  return (
    <div
      className="trade-board-viewport"
      data-testid="trade-board-viewport"
      ref={frameRef}
      style={{ height: height || undefined }}
    >
      <div
        className="trade-board-viewport__scaler"
        style={{ transform: `scale(${scale})` }}
      >
        <TradeBoard {...props} ref={boardRef} />
      </div>
    </div>
  );
};

export default TradeBoardViewport;
