// ========================================
// Mix Poker - Seat Positions
// 6人/8人テーブルの座席配置定数
// ========================================

import type { SeatPosition } from '../types/table';

// 6人テーブル配置（楕円形）
// 座席0が下中央（自分の位置）から時計回り
export const SEAT_POSITIONS_6: SeatPosition[] = [
  // 0: 下中央（自分）
  { x: 0, y: 52, angle: 0, betOffset: { x: 0, y: -22 } },
  // 1: 左下
  { x: -42, y: 28, angle: 15, betOffset: { x: 18, y: -8 } },
  // 2: 左上
  { x: -42, y: -28, angle: -15, betOffset: { x: 18, y: 8 } },
  // 3: 上中央
  { x: 0, y: -52, angle: 0, betOffset: { x: 0, y: 22 } },
  // 4: 右上
  { x: 42, y: -28, angle: 15, betOffset: { x: -18, y: 8 } },
  // 5: 右下
  { x: 42, y: 28, angle: -15, betOffset: { x: -18, y: -8 } },
];

// 8人テーブル配置（楕円形）
export const SEAT_POSITIONS_8: SeatPosition[] = [
  // 0: 下中央
  { x: 0, y: 52, angle: 0, betOffset: { x: 0, y: -20 } },
  // 1: 左下
  { x: -32, y: 40, angle: 20, betOffset: { x: 14, y: -10 } },
  // 2: 左
  { x: -48, y: 8, angle: 10, betOffset: { x: 18, y: 0 } },
  // 3: 左上
  { x: -32, y: -28, angle: -10, betOffset: { x: 14, y: 10 } },
  // 4: 上中央
  { x: 0, y: -52, angle: 0, betOffset: { x: 0, y: 20 } },
  // 5: 右上
  { x: 32, y: -28, angle: 10, betOffset: { x: -14, y: 10 } },
  // 6: 右
  { x: 48, y: 8, angle: -10, betOffset: { x: -18, y: 0 } },
  // 7: 右下
  { x: 32, y: 40, angle: -20, betOffset: { x: -14, y: -10 } },
];

// チップカラー定義
export const CHIP_COLORS = {
  white: { value: 1, color: '#ffffff', stripe: '#e0e0e0' },
  red: { value: 5, color: '#dc2626', stripe: '#991b1b' },
  blue: { value: 10, color: '#2563eb', stripe: '#1d4ed8' },
  green: { value: 25, color: '#16a34a', stripe: '#15803d' },
  black: { value: 100, color: '#1f2937', stripe: '#111827' },
  purple: { value: 500, color: '#7c3aed', stripe: '#5b21b6' },
  yellow: { value: 1000, color: '#eab308', stripe: '#ca8a04' },
} as const;

// チップスタック計算用
export function calculateChipStack(amount: number): { color: keyof typeof CHIP_COLORS; count: number }[] {
  const result: { color: keyof typeof CHIP_COLORS; count: number }[] = [];
  let remaining = amount;

  const chipOrder: (keyof typeof CHIP_COLORS)[] = ['yellow', 'purple', 'black', 'green', 'blue', 'red', 'white'];

  for (const color of chipOrder) {
    const value = CHIP_COLORS[color].value;
    const count = Math.floor(remaining / value);
    if (count > 0) {
      result.push({ color, count: Math.min(count, 10) }); // 最大10枚まで表示
      remaining -= count * value;
    }
  }

  return result;
}
