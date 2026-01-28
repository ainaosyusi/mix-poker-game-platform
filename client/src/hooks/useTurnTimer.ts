import { useEffect, type Dispatch, type SetStateAction } from 'react';

export function useTurnTimer(
  isYourTurn: boolean,
  timerSeconds: number | undefined,
  setTimerSeconds: Dispatch<SetStateAction<number | undefined>>
) {
  useEffect(() => {
    if (!isYourTurn || timerSeconds === undefined) return;

    const interval = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev === undefined || prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isYourTurn, timerSeconds !== undefined]);

  useEffect(() => {
    if (timerSeconds === 0 && isYourTurn) {
      setTimerSeconds(undefined);
    }
  }, [timerSeconds, isYourTurn, setTimerSeconds]);
}
