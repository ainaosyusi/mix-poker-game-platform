/**
 * Phase 3-A: Room Management System
 * Type definitions for the Multi-Room Poker Platform
 */

// ========== Room Configuration ==========

export interface RoomConfig {
    maxPlayers: number;        // 最大プレイヤー数（現在は6固定、将来8に拡張可能）
    smallBlind: number;        // スモールブラインド
    bigBlind: number;          // ビッグブラインド
    buyInMin: number;          // 最小バイイン
    buyInMax: number;          // 最大バイイン
    allowedGames: string[];    // 許可されたゲーム一覧 ["NLH", "PLO", "2-7_TD", ...]
}

// ========== Pot State ==========

export interface PotState {
    main: number;              // メインポット
    side: SidePot[];           // サイドポット配列
}

export interface SidePot {
    amount: number;            // サイドポットの額
    eligiblePlayers: string[]; // このポットに参加できるプレイヤーのsocketId
}

// ========== Player State ==========

export type PlayerStatus = 'ACTIVE' | 'FOLDED' | 'ALL_IN' | 'SIT_OUT';

export interface Player {
    socketId: string;          // Socket.IOの接続ID
    name: string;              // プレイヤー名
    stack: number;             // 持ちチップ量
    bet: number;               // 現在のストリートでのベット額
    totalBet: number;          // そのハンドでの総ベット額（サイドポット計算用）
    status: PlayerStatus;      // プレイヤーの状態
    hand: string[] | null;     // 手札（サーバー内部のみ保持、クライアントには伏せて送る）

    // ゲーム固有情報（オプショナル）
    drawDiscards?: number;     // ドローゲームで何枚交換したか
    studUpCards?: string[];    // スタッドの公開カード
}

// ========== Game State ==========

export type GameStatus = 'WAITING' | 'PLAYING' | 'PAUSED';

export interface GameState {
    status: GameStatus | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';
    gameVariant: string;       // 現在のゲーム (例: "NLH", "PLO_OCEAN")
    street: number;            // 0:Pre, 1:Flop, 2:Turn, 3:River, 4:Showdown
    pot: PotState;             // ポットの状態
    board: string[];           // コミュニティカード
    deckStatus: {              // リシャッフル判定用
        stubCount: number;     // 残りの山札枚数
        burnCount: number;     // バーンカードの枚数
    };
    // Phase 3-B追加
    currentBet: number;        // 現在のベット額
    minRaise: number;          // 最小レイズ額
    handNumber: number;        // ハンド番号
}

// ========== Rotation Management ==========

export interface RotationState {
    orbitCount: number;        // 現在の周回数
    gamesList: string[];       // ローテーション予定リスト
    currentGameIndex: number;  // リストのどこにいるか
}

// ========== Meta Game ==========

export interface MetaGameState {
    standUp: {
        isActive: boolean;                // Stand Upゲームが有効か
        remainingPlayers: string[];       // まだ勝っていないプレイヤーのsocketId
    };
    sevenDeuce: boolean;                // 7-2ゲームが有効かどうか
}

// ========== Room State (最重要) ==========

export interface Room {
    id: string;                         // 6桁の部屋ID
    hostId?: string;                    // Private卓のホストSocketID (Open卓はundefined)
    config: RoomConfig;                 // 部屋の設定

    // ゲーム進行状態
    gameState: GameState;

    // プレイヤー管理
    players: (Player | null)[];         // 長さ6の配列（nullは空席）
    dealerBtnIndex: number;             // ボタンの位置
    activePlayerIndex: number;          // 現在アクション待ちのプレイヤー（-1は誰も待っていない）

    // ローテーション管理
    rotation: RotationState;

    // サイドゲーム状態
    metaGame: MetaGameState;

    // メタ情報
    createdAt: number;                  // 部屋作成時刻（タイムスタンプ）
}

// ========== Socket Event Payloads ==========

// クライアント → サーバー

export interface CreateRoomRequest {
    playerName: string;
    config: RoomConfig;
    isPrivate: boolean;                 // Private卓かどうか
    customRoomId?: string;              // Private卓の場合、指定したいID（6桁数字）
}

export interface JoinRoomRequest {
    roomId: string;
    playerName: string;
}

export interface SitDownRequest {
    seatIndex: number;                  // 0-5の座席番号
    buyIn: number;                      // バイイン額
}

export interface PlayerActionRequest {
    type: 'BET' | 'FOLD' | 'CHECK' | 'CALL' | 'RAISE';
    amount?: number;                    // BET/RAISEの場合に必要
    seqId: number;                      // 同期ズレ防止ID
}

// サーバー → クライアント

export interface RoomJoinedResponse {
    room: Room;
    yourSocketId: string;
}

export interface RoomListItem {
    id: string;
    playerCount: number;                // 現在の着席人数
    maxPlayers: number;
    gameVariant: string;
    blinds: string;                     // 例: "5/10"
    isPrivate: boolean;
}

export interface ErrorResponse {
    message: string;
    code?: string;
}

// ========== Utility Types ==========

// クライアントに送信する際、手札を伏せるためのPlayer型
export interface PlayerPublic extends Omit<Player, 'hand'> {
    hasCards: boolean;                  // カードを持っているかどうか（枚数は隠す）
}

// クライアントに送信するRoom型（全プレイヤーの手札を伏せる）
export interface RoomPublic extends Omit<Room, 'players'> {
    players: (PlayerPublic | null)[];
}

// ========== Phase 3-B: Game Engine Types ==========

// アクション種別
export type ActionType = 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'ALL_IN';

// ゲームフェーズ
export type GamePhase =
    | 'WAITING'      // ゲーム開始待ち（2人以上着席が必要）
    | 'PREFLOP'      // プリフロップ
    | 'FLOP'         // フロップ
    | 'TURN'         // ターン
    | 'RIVER'        // リバー
    | 'SHOWDOWN';    // ショーダウン

// プレイヤーアクション
export interface PlayerAction {
    playerId: string;          // プレイヤーのsocketId
    type: ActionType;          // アクション種別
    amount?: number;           // BET/RAISEの場合の額
    timestamp: number;         // アクション時刻
}

// アクション検証結果
export interface ActionValidation {
    isValid: boolean;          // 有効なアクションか
    reason?: string;           // 無効な場合の理由
    minBet?: number;           // 最小ベット額
    maxBet?: number;           // 最大ベット額（スタック）
    validActions: ActionType[]; // 現在有効なアクション一覧
}

// タイマー設定
export interface TimerConfig {
    actionTimeout: number;     // アクションタイムアウト（デフォルト30秒）
    thinkTime: number;         // 考慮時間（秒）
}

// ハンド履歴（リプレイ用）
export interface HandHistory {
    handNumber: number;
    gameVariant: string;
    players: { name: string; stack: number }[];
    actions: PlayerAction[];
    board: string[];
    winners: { playerId: string; amount: number }[];
}
