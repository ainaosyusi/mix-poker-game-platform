/**
 * Phase 3-C: Game Variant Configurations
 * ゲームごとの設定を定義
 */

export type HandEvaluation =
    | 'high'        // 通常ハイハンド (NLH, PLO, 7CS)
    | 'highlow'     // ハイロースプリット (PLO8, 7CS8)
    | 'razz'        // A-5ローボール (RAZZ)
    | 'badugi'      // バドゥーギ
    | '2-7'         // 2-7ローボール
    | 'a5'          // A-5ローボール (ドロー用)
    | 'hidugi'      // ハイバドゥーギ (高い方が勝ち)
    | 'baduecey'    // バドゥーシー (Badugi + 2-7 スプリット)
    | 'badacey'     // バダシー (Badugi + A-5 スプリット)
    | 'archie'      // アーチー (A-5 + 2-7 スプリット)
    | 'razzdugi'    // ラズドゥーギ (Razz + Badugi スプリット)
    | 'stud27'      // スタッド2-7 (7枚からベスト2-7)
    | 'ofc';        // OFC (Open Face Chinese)

export interface GameVariantConfig {
    id: string;                    // "NLH", "PLO", "2-7_TD", "7CS"
    name: string;                  // 表示名
    holeCardCount: number;         // ホールカードの枚数
    communityCardType: 'flop' | 'stud' | 'none';
    betStructure: 'no-limit' | 'pot-limit' | 'fixed';
    hasButton: boolean;            // スタッドはボタンなし
    hasDrawPhase: boolean;         // ドローポーカーの交換フェーズ
    handEvaluatorType: 'high' | 'low' | 'high-low' | 'razz';
    handEvaluation: HandEvaluation; // ショーダウン評価タイプ
    maxDrawCount?: number;         // ドロー交換の最大枚数
    streets: string[];             // ストリート名

    // === β版拡張フィールド ===

    // ドローゲーム: ラウンド数 (1=シングルドロー, 3=トリプルドロー)
    drawRounds?: number;

    // PLO系: ハンド選択で必ず使う手札枚数 (PLO=2, Big-O=2)
    holeCardsForSelection?: number;

    // ボードパターン: コミュニティカードの配布枚数 ([3,1,1]標準, [3,1,1,1]Ocean)
    boardPattern?: number[];

    // ダブルボード: ボード枚数 (1=標準, 2=ダブルボード)
    boardCount?: number;

    // Oceanカード: 6枚目のコミュニティカード
    hasOceanCard?: boolean;

    // Dramaha: フロップ+ドローのハイブリッドゲーム
    isDramaha?: boolean;
    dramahaDrawEval?: HandEvaluation;  // ドロー部分の評価タイプ
    dramahaPickem?: boolean;           // Pick'em バリアント
    dramahaPenalty?: boolean;          // ペナルティルール

    // Cry Me a River: リバー後にカード消失
    vanishCards?: number;

    // アンティタイプ
    anteType?: 'blind' | 'ante' | 'button-ante';

    // スタッド: ブリングイン決定 (true=最高ドアカード, false=最低=デフォルト)
    isBringInHigh?: boolean;

    // 8人トリプルドロー: UTG強制シットアウト
    forceUtgSitOut?: boolean;
}

// デフォルトのゲーム設定
export const GAME_VARIANTS: Record<string, GameVariantConfig> = {
    // No-Limit Hold'em
    NLH: {
        id: 'NLH',
        name: 'No-Limit Hold\'em',
        holeCardCount: 2,
        communityCardType: 'flop',
        betStructure: 'no-limit',
        hasButton: true,
        hasDrawPhase: false,
        handEvaluatorType: 'high',
        handEvaluation: 'high',
        streets: ['Preflop', 'Flop', 'Turn', 'River']
    },

    // Pot-Limit Omaha
    PLO: {
        id: 'PLO',
        name: 'Pot-Limit Omaha',
        holeCardCount: 4,
        communityCardType: 'flop',
        betStructure: 'pot-limit',
        hasButton: true,
        hasDrawPhase: false,
        handEvaluatorType: 'high',
        handEvaluation: 'high',
        holeCardsForSelection: 2,
        streets: ['Preflop', 'Flop', 'Turn', 'River']
    },

    // Pot-Limit Omaha Hi-Lo
    PLO8: {
        id: 'PLO8',
        name: 'Pot-Limit Omaha Hi-Lo',
        holeCardCount: 4,
        communityCardType: 'flop',
        betStructure: 'pot-limit',
        hasButton: true,
        hasDrawPhase: false,
        handEvaluatorType: 'high-low',
        handEvaluation: 'highlow',
        holeCardsForSelection: 2,
        streets: ['Preflop', 'Flop', 'Turn', 'River']
    },

    // 2-7 Triple Draw
    '2-7_TD': {
        id: '2-7_TD',
        name: '2-7 Triple Draw',
        holeCardCount: 5,
        communityCardType: 'none',
        betStructure: 'fixed',
        hasButton: true,
        hasDrawPhase: true,
        handEvaluatorType: 'low',
        handEvaluation: '2-7',
        maxDrawCount: 5,
        drawRounds: 3,
        streets: ['Pre-Draw', 'First Draw', 'Second Draw', 'Third Draw']
    },

    // 7-Card Stud
    '7CS': {
        id: '7CS',
        name: '7-Card Stud',
        holeCardCount: 7, // 3 down + 4 up
        communityCardType: 'stud',
        betStructure: 'fixed',
        hasButton: false,
        hasDrawPhase: false,
        handEvaluatorType: 'high',
        handEvaluation: 'high',
        streets: ['3rd Street', '4th Street', '5th Street', '6th Street', '7th Street']
    },

    // 7-Card Stud Hi-Lo
    '7CS8': {
        id: '7CS8',
        name: '7-Card Stud Hi-Lo',
        holeCardCount: 7,
        communityCardType: 'stud',
        betStructure: 'fixed',
        hasButton: false,
        hasDrawPhase: false,
        handEvaluatorType: 'high-low',
        handEvaluation: 'highlow',
        streets: ['3rd Street', '4th Street', '5th Street', '6th Street', '7th Street']
    },

    // Razz
    'RAZZ': {
        id: 'RAZZ',
        name: 'Razz',
        holeCardCount: 7,
        communityCardType: 'stud',
        betStructure: 'fixed',
        hasButton: false,
        hasDrawPhase: false,
        handEvaluatorType: 'razz',
        handEvaluation: 'razz',
        streets: ['3rd Street', '4th Street', '5th Street', '6th Street', '7th Street']
    },

    // Badugi
    'BADUGI': {
        id: 'BADUGI',
        name: 'Badugi',
        holeCardCount: 4,
        communityCardType: 'none',
        betStructure: 'fixed',
        hasButton: true,
        hasDrawPhase: true,
        handEvaluatorType: 'low',
        handEvaluation: 'badugi',
        maxDrawCount: 4,
        drawRounds: 3,
        streets: ['Pre-Draw', 'First Draw', 'Second Draw', 'Third Draw']
    },

    // Pineapple OFC (Open Face Chinese)
    'OFC': {
        id: 'OFC',
        name: 'Pineapple OFC',
        holeCardCount: 5,               // 初期配布5枚
        communityCardType: 'none',
        betStructure: 'no-limit',        // スコアリング制（ベッティングなし）
        hasButton: true,
        hasDrawPhase: false,
        handEvaluatorType: 'high',
        handEvaluation: 'ofc',
        streets: ['Initial', 'Pineapple 1', 'Pineapple 2', 'Pineapple 3', 'Pineapple 4'],
    },
};

/**
 * ゲームバリアントを取得
 */
export function getVariantConfig(variantId: string): GameVariantConfig {
    return GAME_VARIANTS[variantId] || GAME_VARIANTS['NLH'];
}

/**
 * すべてのゲームバリアントIDを取得
 */
export function getAllVariantIds(): string[] {
    return Object.keys(GAME_VARIANTS);
}

/**
 * ミックスゲームのプリセット
 */
export const ROTATION_PRESETS: Record<string, string[]> = {
    'HORSE': ['NLH', 'PLO8', '7CS', '7CS8', 'RAZZ'],
    '8-Game': ['2-7_TD', 'NLH', 'PLO', 'RAZZ', '7CS', '7CS8', 'PLO8', 'BADUGI'],
    'Mixed Hold\'em/Omaha': ['NLH', 'PLO', 'PLO8'],
    'Hold\'em Only': ['NLH']
};
