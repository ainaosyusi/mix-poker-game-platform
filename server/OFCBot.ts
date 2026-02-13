// ========================================
// OFC Bot - AI推論対応版
// Phase 9 FL Mastery モデル (ONNX) を使用
// フォールバック: ヒューリスティック配置
// ========================================

import * as ort from 'onnxruntime-node';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { OFCPlacement, OFCRow } from './types.js';
import { checkFoul, parseCards, resolveJokersForFiveCards, resolveJokersForThreeCards, compareHandsJokerAware } from './OFCScoring.js';

// ESM対応の__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========================================
// バージョン情報
// ========================================

export const OFC_BOT_VERSION = '1.4.0';
export const OFC_MODEL_VERSION = 'Phase 10 FL Stay (18M steps, logits)';

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

const RANKS = 'A23456789TJQK';  // A=0, 2=1, ..., K=12 (C++エンジンと一致)
const SUITS = 'shdc';  // spade, heart, diamond, club
const SUIT_SYMBOLS: Record<string, string> = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };

/**
 * カード文字列をインデックスに変換 (0-51)
 * 'As' or 'A♠' → 0 (ACE of SPADES)
 */
function cardToIndex(card: string): number {
    // Joker mapping
    if (card === 'JK1') return 52;
    if (card === 'JK2') return 53;

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
const NUM_CARDS = 54;  // 54枚デッキ（Joker 2枚含む）

/**
 * カード文字列からインデックスを返す（外部利用可）
 */
export { cardToIndex };

/**
 * ゲーム状態から881次元の観測ベクトルを生成
 * 学習環境 (ofc_3max_env.py) と完全一致させる
 *
 * @param cards - 手札カード文字列
 * @param board - 自分のボード
 * @param opponentBoards - 相手ボード [next(下家), prev(上家)] の順
 * @param round - OFCゲームのラウンド番号 (1=initial, 2-5=pineapple)
 * @param playerPosition - ボタンからの相対位置 (0=BTN, 1=SB, 2=BB) default=0
 * @param discards - 過去に捨てたカードのインデックス配列 default=[]
 */
function buildObservation(
    cards: string[],
    board: OFCRow,
    opponentBoards: OFCRow[],
    round: number,
    playerPosition: number = 0,
    discards: number[] = []
): Float32Array {
    const obs = new Float32Array(OBS_DIM);
    let offset = 0;

    // ★ アルファベット順でflatten（Python学習環境のsorted(obs.keys())と一致）
    // 1. game_state: 14
    obs[offset++] = round;
    obs[offset++] = board.top.length;
    obs[offset++] = board.middle.length;
    obs[offset++] = board.bottom.length;
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
    // FL情報 (is_fl, fl_hand_count, next_in_fl, prev_in_fl)
    offset += 4;
    // offset = 14

    // 2. my_board: 3 * 54 = 162
    const myBoardOffset = offset;
    for (const [rowIdx, rowCards] of [board.top, board.middle, board.bottom].entries()) {
        for (const card of rowCards) {
            const idx = cardToIndex(card);
            if (idx >= 0 && idx < NUM_CARDS) {
                obs[myBoardOffset + rowIdx * NUM_CARDS + idx] = 1;
            }
        }
    }
    offset += 3 * NUM_CARDS;  // offset = 176

    // 3. my_discards: 54 (過去に捨てたカード)
    const discardsOffset = offset;
    for (const discardIdx of discards) {
        if (discardIdx >= 0 && discardIdx < NUM_CARDS) {
            obs[discardsOffset + discardIdx] = 1;
        }
    }
    offset += NUM_CARDS;  // offset = 230

    // 4. my_hand: 5 * 54 = 270
    const myHandOffset = offset;
    for (let i = 0; i < Math.min(5, cards.length); i++) {
        const idx = cardToIndex(cards[i]);
        if (idx >= 0 && idx < NUM_CARDS) {
            obs[myHandOffset + i * NUM_CARDS + idx] = 1;
        }
    }
    offset += 5 * NUM_CARDS;  // offset = 500

    // 5. next_opponent_board: 3 * 54 = 162
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
    offset += 3 * NUM_CARDS;  // offset = 662

    // 6. position_info: 3 (one-hot, ボタンからの相対位置)
    const posIdx = Math.min(Math.max(playerPosition, 0), 2);
    obs[offset + posIdx] = 1;
    offset += 3;  // offset = 665

    // 7. prev_opponent_board: 3 * 54 = 162
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
    offset += 3 * NUM_CARDS;  // offset = 827

    // 8. unseen_probability: 54 (見えていないカードの確率分布)
    const seen = new Uint8Array(NUM_CARDS);

    // 自分のボード
    for (const rowCards of [board.top, board.middle, board.bottom]) {
        for (const card of rowCards) {
            const idx = cardToIndex(card);
            if (idx >= 0 && idx < NUM_CARDS) seen[idx] = 1;
        }
    }
    // 自分のハンド
    for (const card of cards) {
        const idx = cardToIndex(card);
        if (idx >= 0 && idx < NUM_CARDS) seen[idx] = 1;
    }
    // 自分の捨て札
    for (const discardIdx of discards) {
        if (discardIdx >= 0 && discardIdx < NUM_CARDS) seen[discardIdx] = 1;
    }
    // 相手のボード
    for (const opp of opponentBoards) {
        for (const rowCards of [opp.top, opp.middle, opp.bottom]) {
            for (const card of rowCards) {
                const idx = cardToIndex(card);
                if (idx >= 0 && idx < NUM_CARDS) seen[idx] = 1;
            }
        }
    }

    let unseenCount = 0;
    for (let i = 0; i < NUM_CARDS; i++) {
        if (!seen[i]) unseenCount++;
    }
    const unseenOffset = offset;
    if (unseenCount > 0) {
        const prob = 1.0 / unseenCount;
        for (let i = 0; i < NUM_CARDS; i++) {
            obs[unseenOffset + i] = seen[i] ? 0 : prob;
        }
    }
    offset += NUM_CARDS;  // offset = 881

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
        // ofc_3max_env.py: action = discard_idx * 9 + row2 * 3 + row1
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
        // ofc_3max_env.py: action = discard_idx * 9 + row2 * 3 + row1
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
        console.log(`🤖 [OFCBot v${OFC_BOT_VERSION}] Loading ONNX model...`);
        console.log(`   Model: ${OFC_MODEL_VERSION}`);
        onnxSession = await ort.InferenceSession.create(MODEL_PATH);
        console.log('✅ [OFCBot] AI model loaded successfully');
    } catch (e) {
        console.error('❌ [OFCBot] Failed to load ONNX model:', e);
        console.log('⚠️  [OFCBot] Falling back to heuristic mode');
        onnxSession = null;
    }
}

/**
 * AI状態を取得
 */
export function getOFCBotStatus(): {
    version: string;
    modelVersion: string;
    aiEnabled: boolean;
    aiLoaded: boolean;
} {
    return {
        version: OFC_BOT_VERSION,
        modelVersion: OFC_MODEL_VERSION,
        aiEnabled: USE_AI,
        aiLoaded: onnxSession !== null,
    };
}

/**
 * ONNX推論 — logitsを返す（マスク適用済み）
 */
async function runInferenceLogits(
    obs: Float32Array,
    mask: Float32Array
): Promise<Float32Array> {
    if (!onnxSession) {
        throw new Error('ONNX session not initialized');
    }

    const obsTensor = new ort.Tensor('float32', obs, [1, OBS_DIM]);
    const maskTensor = new ort.Tensor('float32', mask, [1, ACTION_DIM]);

    const results = await onnxSession.run({
        observation: obsTensor,
        action_mask: maskTensor,
    });

    // logitsモデル: maskedされたlogitsを返す
    const logitsOutput = results.logits;
    if (logitsOutput) {
        return new Float32Array(logitsOutput.data as Float32Array);
    }

    // フォールバック: 旧actionモデル対応
    const actionOutput = results.action;
    if (actionOutput) {
        const actionData = actionOutput.data as BigInt64Array | Int32Array;
        const logits = new Float32Array(ACTION_DIM).fill(-1e8);
        logits[Number(actionData[0])] = 1;
        return logits;
    }

    throw new Error('ONNX model returned unexpected output');
}

/**
 * logitsからargmaxアクションを返す
 */
function argmaxAction(logits: Float32Array): number {
    let bestAction = 0;
    let bestLogit = -Infinity;
    for (let i = 0; i < logits.length; i++) {
        if (logits[i] > bestLogit) {
            bestLogit = logits[i];
            bestAction = i;
        }
    }
    return bestAction;
}

/**
 * logitsからアクションをスコア順にソートして返す
 */
function rankActionsByLogit(logits: Float32Array, mask: Float32Array): number[] {
    const scored: { action: number; logit: number }[] = [];
    for (let i = 0; i < ACTION_DIM; i++) {
        if (mask[i] > 0) {
            scored.push({ action: i, logit: logits[i] });
        }
    }
    scored.sort((a, b) => b.logit - a.logit);
    return scored.map(s => s.action);
}

// ========================================
// ファウル防止レイヤー
// ========================================

/**
 * ボードのコピーを作成
 */
function copyBoard(board: OFCRow): OFCRow {
    return {
        top: [...board.top],
        middle: [...board.middle],
        bottom: [...board.bottom],
    };
}

/**
 * テスト用にプレースメントを適用（ボードを直接変更）
 */
function applyTestPlacements(board: OFCRow, placements: OFCPlacement[]): void {
    for (const p of placements) {
        board[p.row].push(p.card);
    }
}

/**
 * 部分的なrow内の最大マッチ数（ペア=2, トリプス=3, クアッズ=4）
 * Jokerを含む場合はJoker分を加算
 */
function getPartialMaxMatch(cards: string[]): number {
    if (cards.length < 2) return cards.length;
    const parsed = parseCards(cards);
    const ranks = parsed.map(c => c.rank);
    const jokerCount = ranks.filter(r => r === 'JOKER').length;
    const nonJokerRanks = ranks.filter(r => r !== 'JOKER');
    const counts: Record<string, number> = {};
    for (const r of nonJokerRanks) counts[r] = (counts[r] || 0) + 1;
    const maxNatural = Math.max(0, ...Object.values(counts));
    return maxNatural + jokerCount;
}

/**
 * 部分的なファウルチェック
 * 完成したrow間の強さ順序を検証
 * bottom >= middle >= top が守られていない場合 true を返す
 * 近完成rowのヒューリスティックチェックも含む
 */
function checkPartialFoul(board: OFCRow): boolean {
    // 全rowが完成 → 完全なファウルチェック
    if (board.top.length === 3 && board.middle.length === 5 && board.bottom.length === 5) {
        return checkFoul(board);
    }

    // middle(5枚) と bottom(5枚) の両方が完成
    if (board.middle.length === 5 && board.bottom.length === 5) {
        const cmp = compareHandsJokerAware(
            parseCards(board.bottom),
            parseCards(board.middle)
        );
        if (cmp < 0) return true; // bottom < middle = ファウル
    }

    // top(3枚) と middle(5枚) の両方が完成
    if (board.top.length === 3 && board.middle.length === 5) {
        const midHand = resolveJokersForFiveCards(parseCards(board.middle));
        const topHand = resolveJokersForThreeCards(parseCards(board.top));
        if (midHand.rank < topHand.rank) return true; // middle < top = ファウル
        if (midHand.rank === topHand.rank) {
            for (let i = 0; i < Math.min(midHand.highCards.length, topHand.highCards.length); i++) {
                if (midHand.highCards[i] > topHand.highCards[i]) break;
                if (midHand.highCards[i] < topHand.highCards[i]) return true;
            }
        }
    }

    // *** 近完成rowのヒューリスティック ***

    // top完成(3枚)でペア以上 + middle4枚でペアなし → 残り1枚でペアが必要（~30%）
    if (board.top.length === 3 && board.middle.length === 4) {
        const topHand = resolveJokersForThreeCards(parseCards(board.top));
        if (topHand.rank >= 1) { // topがペア以上
            const midMax = getPartialMaxMatch(board.middle);
            if (midMax < 2) return true; // middle4枚でペアなし → ファウルリスク高
        }
    }

    // top完成(3枚)でトリプス + middle3-4枚でトリプスなし → 危険
    if (board.top.length === 3 && board.middle.length >= 3) {
        const topHand = resolveJokersForThreeCards(parseCards(board.top));
        if (topHand.rank >= 3) { // topがトリプス
            const midMax = getPartialMaxMatch(board.middle);
            if (midMax < 3) return true; // middleでトリプス以上が必要
        }
    }

    // middle完成(5枚) + bottom4枚でペアなし → middleがペア以上なら危険
    if (board.middle.length === 5 && board.bottom.length === 4) {
        const midHand = resolveJokersForFiveCards(parseCards(board.middle));
        if (midHand.rank >= 1) {
            const botMax = getPartialMaxMatch(board.bottom);
            if (botMax < 2) return true; // bottom4枚でペアなし → ファウルリスク高
        }
    }

    // middle4枚でトリプス以上 + bottom4枚でペアなし → 危険
    if (board.middle.length === 4 && board.bottom.length === 4) {
        const midMax = getPartialMaxMatch(board.middle);
        const botMax = getPartialMaxMatch(board.bottom);
        if (midMax >= 3 && botMax < 2) return true;
    }

    return false;
}

/**
 * ファウル防止: logit順に代替アクションを試行
 * @param rankedActions - logitスコア降順のアクションリスト
 */
function findNonFoulingAction(
    rankedActions: number[],
    cards: string[],
    currentBoard: OFCRow,
    phase: 'initial' | 'pineapple'
): { action: number; rank: number } {
    for (let rank = 0; rank < rankedActions.length; rank++) {
        const action = rankedActions[rank];
        const decoded = decodeAction(action, cards, phase);
        const testBoard = copyBoard(currentBoard);
        applyTestPlacements(testBoard, decoded.placements);

        if (!checkPartialFoul(testBoard)) {
            return { action, rank };
        }
    }

    // 全アクションがファウルする場合、最高logitのアクションを使用
    return { action: rankedActions[0], rank: 0 };
}

// ========================================
// ヒューリスティック（フォールバック）
// ========================================

const rankVal = (card: string): number => {
    // Jokers are the highest value for heuristic sorting
    if (card === 'JK1' || card === 'JK2') return 15;
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
 * @param opponentBoards - [next(下家), prev(上家)] の順
 * @param playerPosition - ボタンからの相対位置 (0=BTN, 1, 2)
 */
export async function botPlaceInitial(
    cards: string[],
    opponentBoards: OFCRow[] = [],
    playerPosition: number = 0
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
        const obs = buildObservation(cards, board, opponentBoards, 1, playerPosition);
        const mask = buildActionMask(cards, board, 'initial');
        const logits = await runInferenceLogits(obs, mask);
        const rankedActions = rankActionsByLogit(logits, mask);
        const { action, rank } = findNonFoulingAction(rankedActions, cards, board, 'initial');
        if (rank > 0) {
            console.log(`[OFCBot] Foul prevention: rank #${rank} action ${action} (initial)`);
        }
        const { placements } = decodeAction(action, cards, 'initial');
        return placements;
    } catch (e) {
        console.error('[OFCBot] AI inference failed:', e);
        return heuristicPlaceInitial(cards);
    }
}

/**
 * Pineappleラウンド（3枚→2枚配置+1枚捨て）
 * @param opponentBoards - [next(下家), prev(上家)] の順
 * @param round - OFCゲームのラウンド番号 (2-5)
 * @param playerPosition - ボタンからの相対位置 (0=BTN, 1, 2)
 * @param discards - 過去に捨てたカードのインデックス配列
 */
export async function botPlacePineapple(
    cards: string[],
    currentBoard: OFCRow,
    opponentBoards: OFCRow[] = [],
    round: number = 2,
    playerPosition: number = 0,
    discards: number[] = []
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
        const obs = buildObservation(cards, currentBoard, opponentBoards, round, playerPosition, discards);
        const mask = buildActionMask(cards, currentBoard, 'pineapple');
        const logits = await runInferenceLogits(obs, mask);
        const rankedActions = rankActionsByLogit(logits, mask);
        const { action, rank } = findNonFoulingAction(rankedActions, cards, currentBoard, 'pineapple');
        if (rank > 0) {
            console.log(`[OFCBot] Foul prevention: rank #${rank} action ${action} (round ${round})`);
        }
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
