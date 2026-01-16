/**
 * Phase 3-C: Game Variant Configurations
 * ゲームごとの設定を定義
 */

export interface GameVariantConfig {
    id: string;                    // "NLH", "PLO", "2-7_TD", "7CS"
    name: string;                  // 表示名
    holeCardCount: number;         // ホールカードの枚数
    communityCardType: 'flop' | 'stud' | 'none';
    betStructure: 'no-limit' | 'pot-limit' | 'fixed';
    hasButton: boolean;            // スタッドはボタンなし
    hasDrawPhase: boolean;         // ドローポーカーの交換フェーズ
    handEvaluatorType: 'high' | 'low' | 'high-low' | 'razz';
    handEvaluation: 'high' | 'highlow' | 'razz' | 'badugi' | '2-7'; // ショーダウン評価タイプ
    maxDrawCount?: number;         // ドロー交換の最大枚数
    streets: string[];             // ストリート名
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
        streets: ['Pre-Draw', 'First Draw', 'Second Draw', 'Third Draw']
    }
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
