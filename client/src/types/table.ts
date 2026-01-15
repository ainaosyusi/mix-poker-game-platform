// ========================================
// Mix Poker - Table Types
// ========================================

// プレイヤー情報
export interface Player {
  socketId: string;
  name: string;
  stack: number;
  bet: number;
  totalBet: number;
  status: 'ACTIVE' | 'FOLDED' | 'ALL_IN' | 'SIT_OUT';
  hand?: string[] | null;
}

// ゲーム状態
export interface GameState {
  status: 'WAITING' | 'PLAYING' | 'PAUSED';
  gameVariant: string;
  pot: {
    main: number;
    side: { amount: number; eligible?: string[] }[];
  };
  board: string[];
  currentBet: number;
  minRaise: number;
  handNumber: number;
}

// 部屋設定
export interface RoomConfig {
  maxPlayers: 6 | 8;
  smallBlind: number;
  bigBlind: number;
  buyInMin: number;
  buyInMax: number;
  allowedGames?: string[];
}

// 部屋情報
export interface Room {
  id: string;
  config: RoomConfig;
  players: (Player | null)[];
  gameState: GameState;
  dealerBtnIndex: number;
  activePlayerIndex: number;
}

// アクションタイプ
export type ActionType = 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'ALL_IN';

// 座席位置
export interface SeatPosition {
  x: number;           // テーブル中心からの相対X座標 (%)
  y: number;           // テーブル中心からの相対Y座標 (%)
  angle: number;       // カードの回転角度
  betOffset: {         // ベット表示のオフセット
    x: number;
    y: number;
  };
}

// 計算済み座席位置（絶対座標）
export interface AbsoluteSeatPosition extends SeatPosition {
  absoluteX: number;
  absoluteY: number;
  betAbsoluteX: number;
  betAbsoluteY: number;
}

// ショーダウン結果
export interface ShowdownResult {
  winners: {
    playerId: string;
    playerName: string;
    hand: string[];
    handRank: string;
    amount: number;
  }[];
  allHands: {
    playerId: string;
    playerName: string;
    hand: string[];
    handRank: string;
  }[];
}

// TablePropsの型定義
export interface TableProps {
  socket: any; // Socket型はsocket.io-clientからインポート
  roomId: string;
  initialRoomData: Room | null;
  yourSocketId: string;
  onLeaveRoom: () => void;
}

// PlayerSeatProps
export interface PlayerSeatProps {
  player: Player | null;
  seatIndex: number;
  isActive: boolean;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  isYou: boolean;
  position: React.CSSProperties;
  onSeatClick?: () => void;
}

// CardProps
export interface CardProps {
  card: string;
  animate?: boolean;
  size?: 'small' | 'medium' | 'large';
  faceDown?: boolean;
}

// ActionPanelProps
export interface ActionPanelProps {
  validActions: ActionType[];
  currentBet: number;
  minRaise: number;
  maxBet: number;
  yourBet: number;
  pot: number;
  onAction: (type: ActionType, amount?: number) => void;
}
