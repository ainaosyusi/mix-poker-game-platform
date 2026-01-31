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
  studUpCards?: string[];  // Stud games: public up cards
  lastAction?: string;     // Last action taken (CHECK, BET, CALL, RAISE, FOLD, ALL_IN)
  waitingForBB?: boolean;
  pendingJoin?: boolean;
  pendingSitOut?: boolean;
  disconnected?: boolean;
}

// ゲーム状態
export interface GameState {
  status: 'WAITING' | 'PLAYING' | 'PAUSED' | 'OFC_INITIAL_PLACING' | 'OFC_PINEAPPLE_PLACING' | 'OFC_SCORING';
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
  password?: string;
}

// 保留設定変更
export interface PendingConfigChange {
  config?: Partial<RoomConfig>;
  rotation?: {
    enabled?: boolean;
    gamesList?: string[];
    handsPerGame?: number;
  };
  gameVariant?: string;
  requestedBy: string;
  requestedAt: number;
}

// ローテーション状態
export interface RotationState {
  orbitCount: number;
  gamesList: string[];
  currentGameIndex: number;
}

// メタゲーム状態
export interface MetaGameState {
  standUp: {
    isActive: boolean;
    remainingPlayers: string[];
  };
  sevenDeuce: boolean;
}

// 部屋情報
export interface Room {
  id: string;
  hostId?: string;
  config: RoomConfig;
  players: (Player | null)[];
  gameState: GameState;
  dealerBtnIndex: number;
  activePlayerIndex: number;
  streetStarterIndex: number;
  rotation: RotationState;
  metaGame: MetaGameState;
  pendingConfig?: PendingConfigChange;
  ofcState?: OFCPublicState;
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
    qualifyingHoleCards?: string[];  // 役判定に使われたホールカード
    qualifyingBoardCards?: string[]; // 役判定に使われたボードカード
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
  initialHand?: string[] | null;
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
  size?: 'tiny' | 'small' | 'medium' | 'large';
  faceDown?: boolean;
  className?: string;
}

// ========================================
// OFC (Open Face Chinese) Types
// ========================================

export interface OFCRow {
  top: string[];
  middle: string[];
  bottom: string[];
}

export interface OFCPlayerInfo {
  socketId: string;
  name: string;
  stack: number;
  board: OFCRow;
  cardCount: number;       // 手持ちカード数（他人用）
  hasPlaced: boolean;
  isBot: boolean;
  isFantasyland: boolean;
  isFouled: boolean;
}

export interface OFCPublicState {
  phase: 'OFC_WAITING' | 'OFC_INITIAL_PLACING' | 'OFC_PINEAPPLE_PLACING' | 'OFC_SCORING' | 'OFC_DONE';
  round: number;
  handNumber: number;
  players: OFCPlayerInfo[];
  scores: Record<string, number>;
}

export interface OFCRoundScore {
  playerId: string;
  playerName: string;
  topHand: string;
  middleHand: string;
  bottomHand: string;
  topRoyalties: number;
  middleRoyalties: number;
  bottomRoyalties: number;
  totalPoints: number;
  chipChange: number;
  isFouled: boolean;
}

export interface OFCPlacement {
  card: string;
  row: 'top' | 'middle' | 'bottom';
}

// ベッティング構造タイプ
export type BetStructure = 'no-limit' | 'pot-limit' | 'fixed';

// ActionPanelProps
export interface ActionPanelProps {
  validActions: ActionType[];
  currentBet: number;
  minRaise: number;
  maxBet: number;
  yourBet: number;
  pot: number;
  onAction: (type: ActionType, amount?: number) => void;
  // ベッティング構造情報
  betStructure?: BetStructure;
  isCapped?: boolean;
  raisesRemaining?: number;
  fixedBetSize?: number;
}
