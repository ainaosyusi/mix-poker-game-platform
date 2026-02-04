// ========================================
// OFC Bot - AI推論対応版
// Phase 9 FL Mastery モデル (ONNX) を使用
// フォールバック: ヒューリスティック配置
// ========================================

import * as ort from 'onnxruntime-node';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { OFCPlacement, OFCRow } from './types.js';

// ESM対応の__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========================================
// 設定
// ========================================

// AI使用フラグ（falseでヒューリスティックにフォールバック）
const USE_AI = true;

// ONNXモデルパス
const MODEL_PATH = path.join(__dirname, 'models', 'ofc_ai.onnx');

// グローバルセッション（遅延初期化）
let onnxSession: ort.InferenceSession | null = null;
let sessionInitPromise: Promise<void> | null = null;

// ========================================
// カード変換
// ========================================

const RANKS = '23456789TJQKA';
const SUITS = 'shdc';  // spade, heart, diamond, club
const SUIT_SYMBOLS: Record<string, string> = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };

/**
 * カード文字列をインデックスに変換 (0-51)
 * 'As' or 'A♠' → 0 (ACE of SPADES)
 */
function cardToIndex(card: string): number {
    if (card.length < 2) return -1;

    const rankChar = card[0].toUpperCase();
    let suitChar = card.length === 2 ? card[1].toLowerCase() : card[1];

    // 記号スーツを変換
    if (SUIT_SYMBOLS[suitChar]) {
        suitChar = SUIT_SYMBOLS[suitChar];
    }

    const rankIdx = RANKS.indexOf(rankChar);
    const suitIdx = SUITS.indexOf(suitChar);

    if (rankIdx === -1 || suitIdx === -1) return -1;

    // インデックス: suit * 13 + rank
    return suitIdx * 13 + rankIdx;
}

// ========================================
// 観測生成
// ========================================

const OBS_DIM = 881;
const ACTION_DIM = 243;
const NUM_CARDS = 54;  // 学習時は54枚（Joker含む）、実際は52枚のみ使用

/**
 * ゲーム状態から881次元の観測ベクトルを生成
 */
function buildObservation(
    cards: string[],
    board: OFCRow,
    opponentBoards: OFCRow[],
    phase: 'initial' | 'pineapple'
): Float32Array {
    const obs = new Float32Array(OBS_DIM);
    let offset = 0;

    // my_board: 3 * 54 = 162
    const myBoardOffset = offset;
    for (const [rowIdx, rowCards] of [board.top, board.middle, board.bottom].entries()) {
        for (const card of rowCards) {
            const idx = cardToIndex(card);
            if (idx >= 0 && idx < NUM_CARDS) {
                obs[myBoardOffset + rowIdx * NUM_CARDS + idx] = 1;
            }
        }
    }
    offset += 3 * NUM_CARDS;  // 162

    // my_hand: 5 * 54 = 270
    const myHandOffset = offset;
    for (let i = 0; i < Math.min(5, cards.length); i++) {
        const idx = cardToIndex(cards[i]);
        if (idx >= 0 && idx < NUM_CARDS) {
            obs[myHandOffset + i * NUM_CARDS + idx] = 1;
        }
    }
    offset += 5 * NUM_CARDS;  // 270

    // next_opponent_board: 3 * 54 = 162
    const nextOppOffset = offset;
    if (opponentBoards.length > 0) {
        const opp = opponentBoards[0];
        for (const [rowIdx, rowCards] of [opp.top, opp.middle, opp.bottom].entries()) {
            for (const card of rowCards) {
                const idx = cardToIndex(card);
                if (idx >= 0 && idx < NUM_CARDS) {
                    obs[nextOppOffset + rowIdx * NUM_CARDS + idx] = 1;
                }
            }
        }
    }
    offset += 3 * NUM_CARDS;  // 162

    // prev_opponent_board: 3 * 54 = 162
    const prevOppOffset = offset;
    if (opponentBoards.length > 1) {
        const opp = opponentBoards[1];
        for (const [rowIdx, rowCards] of [opp.top, opp.middle, opp.bottom].entries()) {
            for (const card of rowCards) {
                const idx = cardToIndex(card);
                if (idx >= 0 && idx < NUM_CARDS) {
                    obs[prevOppOffset + rowIdx * NUM_CARDS + idx] = 1;
                }
            }
        }
    }
    offset += 3 * NUM_CARDS;  // 162

    // my_discards: 54 (未使用、ゼロ)
    offset += NUM_CARDS;  // 54

    // unseen_probability: 54 (均等)
    const unseenOffset = offset;
    for (let i = 0; i < NUM_CARDS; i++) {
        obs[unseenOffset + i] = 1.0 / NUM_CARDS;
    }
    offset += NUM_CARDS;  // 54

    // position_info: 3 (one-hot, ボタン位置)
    obs[offset] = 1;  // ボタン
    offset += 3;

    // game_state: 14
    const street = phase === 'initial' ? 1 : 2;
    obs[offset++] = street;
    obs[offset++] = board.top.length;
    obs[offset++] = board.middle.length;
    obs[offset++] = board.bottom.length;
    // 相手のボード情報（簡略化）
    if (opponentBoards.length > 0) {
        obs[offset++] = opponentBoards[0].top.length;
        obs[offset++] = opponentBoards[0].middle.length;
        obs[offset++] = opponentBoards[0].bottom.length;
    } else {
        offset += 3;
    }
    if (opponentBoards.length > 1) {
        obs[offset++] = opponentBoards[1].top.length;
        obs[offset++] = opponentBoards[1].middle.length;
        obs[offset++] = opponentBoards[1].bottom.length;
    } else {
        offset += 3;
    }
    // FL情報（0固定）
    offset += 4;

    return obs;
}

/**
 * アクションマスクを生成
 */
function buildActionMask(
    cards: string[],
    board: OFCRow,
    phase: 'initial' | 'pineapple'
): Float32Array {
    const mask = new Float32Array(ACTION_DIM);

    const topCap = 3 - board.top.length;
    const midCap = 5 - board.middle.length;
    const botCap = 5 - board.bottom.length;

    if (phase === 'initial') {
        // 初期配置: 5枚を配置
        for (let action = 0; action < 243; action++) {
            let temp = action;
            const rows: number[] = [];
            for (let i = 0; i < 5; i++) {
                rows.push(temp % 3);
                temp = Math.floor(temp / 3);
            }

            const topCount = rows.filter(r => r === 0).length;
            const midCount = rows.filter(r => r === 1).length;
            const botCount = rows.filter(r => r === 2).length;

            if (topCount <= topCap && midCount <= midCap && botCount <= botCap) {
                mask[action] = 1;
            }
        }
    } else {
        // Pineapple: 3枚から2枚配置、1枚捨て
        for (let discardIdx = 0; discardIdx < Math.min(3, cards.length); discardIdx++) {
            for (let placementAction = 0; placementAction < 9; placementAction++) {
                const row1 = placementAction % 3;
                const row2 = Math.floor(placementAction / 3);

                const topNew = (row1 === 0 ? 1 : 0) + (row2 === 0 ? 1 : 0);
                const midNew = (row1 === 1 ? 1 : 0) + (row2 === 1 ? 1 : 0);
                const botNew = (row1 === 2 ? 1 : 0) + (row2 === 2 ? 1 : 0);

                if (topNew <= topCap && midNew <= midCap && botNew <= botCap) {
                    const action = discardIdx * 9 + row2 * 3 + row1;
                    mask[action] = 1;
                }
            }
        }
    }

    // 少なくとも1つは有効に
    if (mask.reduce((a, b) => a + b, 0) === 0) {
        mask[0] = 1;
    }

    return mask;
}

/**
 * アクションをPlacementsに変換
 */
function decodeAction(
    action: number,
    cards: string[],
    phase: 'initial' | 'pineapple'
): { placements: OFCPlacement[]; discard?: string } {
    const rowNames: ('top' | 'middle' | 'bottom')[] = ['top', 'middle', 'bottom'];
    const placements: OFCPlacement[] = [];
    let discard: string | undefined;

    if (phase === 'initial') {
        let temp = action;
        for (let i = 0; i < 5 && i < cards.length; i++) {
            const rowIdx = temp % 3;
            temp = Math.floor(temp / 3);
            placements.push({ card: cards[i], row: rowNames[rowIdx] });
        }
    } else {
        const row1 = action % 3;
        const row2 = Math.floor(action / 3) % 3;
        const discardIdx = Math.floor(action / 9) % 3;

        const playIndices = [0, 1, 2].filter(i => i !== discardIdx).slice(0, 2);

        if (playIndices[0] < cards.length) {
            placements.push({ card: cards[playIndices[0]], row: rowNames[row1] });
        }
        if (playIndices[1] < cards.length) {
            placements.push({ card: cards[playIndices[1]], row: rowNames[row2] });
        }
        if (discardIdx < cards.length) {
            discard = cards[discardIdx];
        }
    }

    return { placements, discard };
}

// ========================================
// ONNX推論
// ========================================

async function initSession(): Promise<void> {
    if (onnxSession) return;

    try {
        console.log(`[OFCBot] Loading ONNX model from ${MODEL_PATH}...`);
        onnxSession = await ort.InferenceSession.create(MODEL_PATH);
        console.log('[OFCBot] ONNX model loaded successfully');
    } catch (e) {
        console.error('[OFCBot] Failed to load ONNX model:', e);
        onnxSession = null;
    }
}

async function runInference(
    obs: Float32Array,
    mask: Float32Array
): Promise<number> {
    if (!onnxSession) {
        throw new Error('ONNX session not initialized');
    }

    const obsTensor = new ort.Tensor('float32', obs, [1, OBS_DIM]);
    const maskTensor = new ort.Tensor('float32', mask, [1, ACTION_DIM]);

    const results = await onnxSession.run({
        observation: obsTensor,
        action_mask: maskTensor,
    });

    const actionData = results.action.data as BigInt64Array | Int32Array;
    return Number(actionData[0]);
}

// ========================================
// ヒューリスティック（フォールバック）
// ========================================

const rankVal = (card: string): number => {
    const r = card[0];
    const values: Record<string, number> = {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
        '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
    };
    return values[r] || 0;
};

function heuristicPlaceInitial(cards: string[]): OFCPlacement[] {
    const sorted = [...cards].sort((a, b) => rankVal(b) - rankVal(a));
    return [
        { card: sorted[0], row: 'bottom' },
        { card: sorted[1], row: 'bottom' },
        { card: sorted[2], row: 'middle' },
        { card: sorted[3], row: 'middle' },
        { card: sorted[4], row: 'top' },
    ];
}

function heuristicPlacePineapple(
    cards: string[],
    currentBoard: OFCRow
): { placements: OFCPlacement[]; discard: string } {
    const sorted = [...cards].sort((a, b) => rankVal(b) - rankVal(a));
    const discard = sorted[2];
    const toPlace = [sorted[0], sorted[1]];

    const topCap = 3 - currentBoard.top.length;
    const midCap = 5 - currentBoard.middle.length;
    const botCap = 5 - currentBoard.bottom.length;

    const placements: OFCPlacement[] = [];
    for (const card of toPlace) {
        if (botCap - placements.filter(p => p.row === 'bottom').length > 0) {
            placements.push({ card, row: 'bottom' });
        } else if (midCap - placements.filter(p => p.row === 'middle').length > 0) {
            placements.push({ card, row: 'middle' });
        } else {
            placements.push({ card, row: 'top' });
        }
    }

    return { placements, discard };
}

// ========================================
// 公開API
// ========================================

/**
 * 初期5枚配置（AI推論 or ヒューリスティック）
 */
export async function botPlaceInitial(
    cards: string[],
    opponentBoards: OFCRow[] = []
): Promise<OFCPlacement[]> {
    if (!USE_AI) {
        return heuristicPlaceInitial(cards);
    }

    // セッション初期化
    if (!sessionInitPromise) {
        sessionInitPromise = initSession();
    }
    await sessionInitPromise;

    if (!onnxSession) {
        console.warn('[OFCBot] AI unavailable, using heuristic');
        return heuristicPlaceInitial(cards);
    }

    try {
        const board: OFCRow = { top: [], middle: [], bottom: [] };
        const obs = buildObservation(cards, board, opponentBoards, 'initial');
        const mask = buildActionMask(cards, board, 'initial');
        const action = await runInference(obs, mask);
        const { placements } = decodeAction(action, cards, 'initial');
        return placements;
    } catch (e) {
        console.error('[OFCBot] AI inference failed:', e);
        return heuristicPlaceInitial(cards);
    }
}

/**
 * Pineappleラウンド（3枚→2枚配置+1枚捨て）
 */
export async function botPlacePineapple(
    cards: string[],
    currentBoard: OFCRow,
    opponentBoards: OFCRow[] = []
): Promise<{ placements: OFCPlacement[]; discard: string }> {
    if (!USE_AI) {
        return heuristicPlacePineapple(cards, currentBoard);
    }

    if (!sessionInitPromise) {
        sessionInitPromise = initSession();
    }
    await sessionInitPromise;

    if (!onnxSession) {
        console.warn('[OFCBot] AI unavailable, using heuristic');
        return heuristicPlacePineapple(cards, currentBoard);
    }

    try {
        const obs = buildObservation(cards, currentBoard, opponentBoards, 'pineapple');
        const mask = buildActionMask(cards, currentBoard, 'pineapple');
        const action = await runInference(obs, mask);
        const { placements, discard } = decodeAction(action, cards, 'pineapple');
        return { placements, discard: discard || cards[cards.length - 1] };
    } catch (e) {
        console.error('[OFCBot] AI inference failed:', e);
        return heuristicPlacePineapple(cards, currentBoard);
    }
}

/**
 * Fantasyland（14枚→13枚配置+1枚捨て）
 * 注: 学習モデルはFL用のGreedyソルバーを使用しているため、
 * ここではヒューリスティックを使用
 */
export function botPlaceFantasyland(
    cards: string[]
): { placements: OFCPlacement[]; discard: string } {
    const sorted = [...cards].sort((a, b) => rankVal(b) - rankVal(a));
    const discard = sorted[13] || sorted[sorted.length - 1];

    const placements: OFCPlacement[] = [];
    for (let i = 0; i < 5; i++) placements.push({ card: sorted[i], row: 'bottom' });
    for (let i = 5; i < 10; i++) placements.push({ card: sorted[i], row: 'middle' });
    for (let i = 10; i < 13; i++) placements.push({ card: sorted[i], row: 'top' });

    return { placements, discard };
}
