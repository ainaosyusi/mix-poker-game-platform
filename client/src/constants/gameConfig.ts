/**
 * ゲーム設定の共通定数
 * PrivateRoom, HostControlsPanel 等で共有
 */

export const GAME_OPTIONS = [
  { id: 'NLH', name: "Hold'em" },
  { id: 'PLO', name: 'Omaha' },
  { id: 'PLO8', name: 'PLO Hi-Lo' },
  { id: '7CS', name: 'Stud' },
  { id: '7CS8', name: 'Stud Hi-Lo' },
  { id: 'RAZZ', name: 'Razz' },
  { id: '2-7_TD', name: '2-7 TD' },
  { id: 'BADUGI', name: 'Badugi' },
  { id: 'OFC', name: 'Pineapple OFC' },
] as const;

export const BLIND_PRESETS = [
  { sb: 1, bb: 2, label: '1/2' },
  { sb: 2, bb: 5, label: '2/5' },
  { sb: 5, bb: 10, label: '5/10' },
  { sb: 10, bb: 25, label: '10/25' },
  { sb: 25, bb: 50, label: '25/50' },
  { sb: 50, bb: 100, label: '50/100' },
] as const;
