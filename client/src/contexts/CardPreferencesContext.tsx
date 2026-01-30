// ========================================
// Mix Poker - Card Preferences Context
// ========================================

import { createContext, useContext, type ReactNode } from 'react';
import { useCardPreferences, type CardColorMode, type SuitInfo } from '../hooks/useCardPreferences';

interface CardPreferencesContextType {
  colorMode: CardColorMode;
  toggleColorMode: (mode: CardColorMode) => void;
  suitConfig: Record<string, SuitInfo>;
}

const CardPreferencesContext = createContext<CardPreferencesContextType | null>(null);

export function CardPreferencesProvider({ children }: { children: ReactNode }) {
  const preferences = useCardPreferences();
  return (
    <CardPreferencesContext.Provider value={preferences}>
      {children}
    </CardPreferencesContext.Provider>
  );
}

export function useCardPreferencesContext() {
  const ctx = useContext(CardPreferencesContext);
  if (!ctx) throw new Error('useCardPreferencesContext must be used within CardPreferencesProvider');
  return ctx;
}
