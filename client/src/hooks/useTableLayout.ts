// ========================================
// Mix Poker - useTableLayout Hook
// テーブルレイアウト計算
// ========================================

import { useMemo, useState, useEffect, type RefObject } from 'react';
import { SEAT_POSITIONS_6, SEAT_POSITIONS_8 } from '../constants/seatPositions';
import type { SeatPosition, AbsoluteSeatPosition } from '../types/table';

interface UseTableLayoutOptions {
  maxPlayers: 6 | 8;
  containerRef: RefObject<HTMLDivElement | null>;
}

interface TableDimensions {
  width: number;
  height: number;
}

export function useTableLayout({ maxPlayers, containerRef }: UseTableLayoutOptions) {
  const [dimensions, setDimensions] = useState<TableDimensions>({ width: 0, height: 0 });

  // ResizeObserverでテーブルサイズを監視
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [containerRef]);

  // 座席位置を計算
  const seatPositions = useMemo((): AbsoluteSeatPosition[] => {
    const basePositions: SeatPosition[] = maxPlayers === 6 ? SEAT_POSITIONS_6 : SEAT_POSITIONS_8;
    const { width, height } = dimensions;

    if (width === 0 || height === 0) {
      return basePositions.map((pos) => ({
        ...pos,
        absoluteX: 0,
        absoluteY: 0,
        betAbsoluteX: 0,
        betAbsoluteY: 0,
      }));
    }

    return basePositions.map((pos) => ({
      ...pos,
      // パーセンテージからピクセルに変換
      absoluteX: width / 2 + (pos.x / 100) * width,
      absoluteY: height / 2 + (pos.y / 100) * height,
      betAbsoluteX: width / 2 + ((pos.x + pos.betOffset.x) / 100) * width,
      betAbsoluteY: height / 2 + ((pos.y + pos.betOffset.y) / 100) * height,
    }));
  }, [maxPlayers, dimensions]);

  // CSS位置スタイルを生成
  const getSeatStyle = (index: number): React.CSSProperties => {
    const pos = seatPositions[index];
    if (!pos || dimensions.width === 0) {
      return {};
    }

    return {
      position: 'absolute',
      left: `${pos.absoluteX}px`,
      top: `${pos.absoluteY}px`,
      transform: `translate(-50%, -50%) rotate(${pos.angle}deg)`,
    };
  };

  // ベット位置スタイルを生成
  const getBetStyle = (index: number): React.CSSProperties => {
    const pos = seatPositions[index];
    if (!pos || dimensions.width === 0) {
      return {};
    }

    return {
      position: 'absolute',
      left: `${pos.betAbsoluteX}px`,
      top: `${pos.betAbsoluteY}px`,
      transform: 'translate(-50%, -50%)',
    };
  };

  return {
    seatPositions,
    dimensions,
    getSeatStyle,
    getBetStyle,
  };
}

// ポット位置を計算（テーブル中央）
export function getPotPosition(): React.CSSProperties {
  return {
    position: 'absolute',
    left: '50%',
    top: '45%',
    transform: 'translate(-50%, -50%)',
  };
}

// コミュニティカード位置を計算（テーブル中央上部）
export function getCommunityCardsPosition(): React.CSSProperties {
  return {
    position: 'absolute',
    left: '50%',
    top: '35%',
    transform: 'translate(-50%, -50%)',
  };
}
