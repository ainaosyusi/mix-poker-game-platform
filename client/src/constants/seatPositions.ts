// ========================================
// Mix Poker - Seat Positions
// 6人/8人テーブルの座席配置定数
// ========================================

import type { SeatPosition } from '../types/table';

// 6人テーブル配置（楕円形）
// 座席0が下中央（自分の位置）から時計回り
// ネームタグはテーブル縁に配置、チップはテーブル内部
export const SEAT_POSITIONS_6: SeatPosition[] = [
  // 0: 下中央（自分）- テーブル外縁
  { x: 0, y: 58, angle: 0, betOffset: { x: 0, y: -30 } },
  // 1: 左下
  { x: -45, y: 32, angle: 15, betOffset: { x: 22, y: -12 } },
  // 2: 左上
  { x: -45, y: -32, angle: -15, betOffset: { x: 22, y: 12 } },
  // 3: 上中央
  { x: 0, y: -58, angle: 0, betOffset: { x: 0, y: 30 } },
  // 4: 右上
  { x: 45, y: -32, angle: 15, betOffset: { x: -22, y: 12 } },
  // 5: 右下
  { x: 45, y: 32, angle: -15, betOffset: { x: -22, y: -12 } },
];

// 8人テーブル配置（楕円形）
// 全席がテーブル外縁に配置されるように調整
export const SEAT_POSITIONS_8: SeatPosition[] = [
  // 0: 下中央
  { x: 0, y: 58, angle: 0, betOffset: { x: 0, y: -28 } },
  // 1: 左下
  { x: -35, y: 46, angle: 20, betOffset: { x: 18, y: -14 } },
  // 2: 左
  { x: -52, y: 10, angle: 10, betOffset: { x: 22, y: 0 } },
  // 3: 左上 - テーブル外縁に配置
  { x: -38, y: -38, angle: -10, betOffset: { x: 18, y: 16 } },
  // 4: 上中央
  { x: 0, y: -58, angle: 0, betOffset: { x: 0, y: 28 } },
  // 5: 右上 - テーブル外縁に配置
  { x: 38, y: -38, angle: 10, betOffset: { x: -18, y: 16 } },
  // 6: 右
  { x: 52, y: 10, angle: -10, betOffset: { x: -22, y: 0 } },
  // 7: 右下
  { x: 35, y: 46, angle: -20, betOffset: { x: -18, y: -14 } },
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
