// ========================================
// Mix Poker - Card Color Preferences Hook
// 2色/4色デックモード切替
// ========================================

import { useState, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'mgp-card-color-mode';

export type CardColorMode = '2-color' | '4-color';

export interface SuitInfo {
  symbol: string;
  color: string;
  bg: string;
}

// 2色: ♠♣=黒, ♥♦=赤
const SUITS_2_COLOR: Record<string, SuitInfo> = {
  's': { symbol: '♠', color: '#1a1a2e', bg: 'rgba(30,41,59,0.08)' },
  'h': { symbol: '♥', color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
  'd': { symbol: '♦', color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
  'c': { symbol: '♣', color: '#1a1a2e', bg: 'rgba(30,41,59,0.08)' },
  '♠': { symbol: '♠', color: '#1a1a2e', bg: 'rgba(30,41,59,0.08)' },
  '♥': { symbol: '♥', color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
  '♦': { symbol: '♦', color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
  '♣': { symbol: '♣', color: '#1a1a2e', bg: 'rgba(30,41,59,0.08)' },
};

// 4色: ♠=黒, ♥=赤, ♦=青, ♣=緑
const SUITS_4_COLOR: Record<string, SuitInfo> = {
  's': { symbol: '♠', color: '#1a1a2e', bg: 'rgba(30,41,59,0.08)' },
  'h': { symbol: '♥', color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
  'd': { symbol: '♦', color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
  'c': { symbol: '♣', color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
  '♠': { symbol: '♠', color: '#1a1a2e', bg: 'rgba(30,41,59,0.08)' },
  '♥': { symbol: '♥', color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
  '♦': { symbol: '♦', color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
  '♣': { symbol: '♣', color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
};

export function useCardPreferences() {
  const [colorMode, setColorMode] = useState<CardColorMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === '4-color' ? '4-color' : '2-color';
  });

  const toggleColorMode = useCallback((mode: CardColorMode) => {
    setColorMode(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, []);

  const suitConfig = useMemo(() => {
    return colorMode === '4-color' ? SUITS_4_COLOR : SUITS_2_COLOR;
  }, [colorMode]);

  return { colorMode, toggleColorMode, suitConfig };
}
