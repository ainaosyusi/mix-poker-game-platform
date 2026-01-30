// ========================================
// Mix Poker - useOrientation Hook
// 画面向き検出（portrait / landscape）
// ========================================

import { useState, useEffect } from 'react';

export type Orientation = 'portrait' | 'landscape';

function getOrientation(): Orientation {
  return window.innerWidth < window.innerHeight ? 'portrait' : 'landscape';
}

export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>(getOrientation);

  useEffect(() => {
    const handleChange = () => {
      setOrientation(getOrientation());
    };

    window.addEventListener('resize', handleChange);
    window.addEventListener('orientationchange', handleChange);

    return () => {
      window.removeEventListener('resize', handleChange);
      window.removeEventListener('orientationchange', handleChange);
    };
  }, []);

  return orientation;
}
