// ========================================
// OFC Game Engine
// Pineapple OFC - ゲーム進行管理
// ========================================

import type {
    Room, OFCGameState, OFCPlayerState, OFCPlacement, OFCRow,
    OFCPhase, OFCRoundScore,
} from './types.js';
import { calculateOFCScores, checkFoul, checkFantasylandEntry, checkFantasylandContinuation } from './OFCScoring.js';

// ========================================
// Deck Management
// ========================================

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

function createDeck(): string[] {
    const deck: string[] = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push(rank + suit);
        }
    }
    // Add 2 Jokers (fully wild)
    deck.push('JK1');
    deck.push('JK2');
    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function dealCards(deck: string[], count: number): string[] {
    const cards: string[] = [];
    for (let i = 0; i < count; i++) {
        if (deck.length === 0) throw new Error('Deck is empty');
        cards.push(deck.shift()!);
    }
    return cards;
}

// ========================================
// OFC Game Engine Class
// ========================================

/** Callback events emitted by the engine */
export interface OFCEngineEvent {
    type: 'deal' | 'placement-accepted' | 'round-complete' | 'scoring' | 'hand-complete' | 'error';
    data: any;
}

export class OFCGameEngine {

    /**
     * OFCハンドを開始
     * - デッキ生成
     * - 各プレイヤーに5枚配布（ファンタジーランドは14枚）
     * - phase → OFC_INITIAL_PLACING
     */
    startHand(room: Room): OFCEngineEvent[] {
        const events: OFCEngineEvent[] = [];
        const players = room.players.filter(p => p && p.status !== 'SIT_OUT' && p.stack > 0);

        if (players.length < 2) {
            return [{ type: 'error', data: { reason: 'Need at least 2 players' } }];
        }

        const deck = createDeck();

        // Determine which players are in fantasyland from previous hand
        const prevOfc = room.ofcState;
        const flQueue = prevOfc?.fantasylandQueue || [];

        const ofcPlayers: OFCPlayerState[] = players.map(p => {
            const isFL = flQueue.includes(p!.socketId);
            const cardCount = isFL ? 14 : 5;
            const cards = dealCards(deck, cardCount);

            return {
                socketId: p!.socketId,
                name: p!.name,
                stack: p!.stack,
                board: { top: [], middle: [], bottom: [] },
                currentCards: isFL ? [] : cards,
                isFantasyland: isFL,
                fantasyCandidateCards: isFL ? cards : undefined,
                hasPlaced: false,
                isBot: p!.socketId.startsWith('bot-'),
                isFouled: false,
            };
        });

        const handNumber = (prevOfc?.handNumber || 0) + 1;

        // ボタン位置: FL突入者がいる場合はボタン固定（JOPTルール）
        let buttonIndex: number;
        if (prevOfc) {
            const hasFL = flQueue.length > 0;
            buttonIndex = hasFL
                ? prevOfc.buttonIndex   // FL時はボタン停止
                : (prevOfc.buttonIndex + 1) % ofcPlayers.length;
        } else {
            buttonIndex = 0; // 初回はSeat 0
        }

        const ofcState: OFCGameState = {
            phase: 'OFC_INITIAL_PLACING',
            round: 1,
            players: ofcPlayers,
            deck,
            handNumber,
            fantasylandQueue: [],
            scores: prevOfc?.scores || {},
            bigBlind: room.config.bigBlind,
            buttonIndex,
            currentTurnIndex: -1, // 一旦-1、下で設定
        };

        room.ofcState = ofcState;
        room.gameState.status = 'OFC_INITIAL_PLACING';
        room.gameState.gameVariant = 'OFC';
        room.gameState.handNumber = handNumber;

        // 全ラウンド順番制: ボタン左から順に配置
        ofcState.currentTurnIndex = this.getNextUnplacedPlayer(ofcState);

        events.push({
            type: 'deal',
            data: {
                round: 1,
                currentTurnIndex: ofcState.currentTurnIndex,
                players: ofcPlayers.map(p => ({
                    socketId: p.socketId,
                    cardCount: p.isFantasyland
                        ? p.fantasyCandidateCards!.length
                        : p.currentCards.length,
                    isFantasyland: p.isFantasyland,
                })),
            },
        });

        return events;
    }

    /**
     * 初期5枚の配置処理
     * placements: 5枚すべてをTop/Middle/Bottomに振り分け
     *
     * ファンタジーランドの場合: 14枚から13枚配置 + 1枚捨て
     */
    placeInitialCards(
        room: Room,
        socketId: string,
        placements: OFCPlacement[],
        discardCard?: string,
    ): OFCEngineEvent[] {
        const events: OFCEngineEvent[] = [];
        const ofc = room.ofcState;
        if (!ofc || ofc.phase !== 'OFC_INITIAL_PLACING') {
            return [{ type: 'error', data: { reason: 'Not in initial placing phase' } }];
        }

        const playerIndex = ofc.players.findIndex(p => p.socketId === socketId);
        const player = playerIndex >= 0 ? ofc.players[playerIndex] : undefined;
        if (!player) {
            return [{ type: 'error', data: { reason: 'Player not found' } }];
        }
        if (player.hasPlaced) {
            return [{ type: 'error', data: { reason: 'Already placed cards' } }];
        }

        // 順番チェック（全ラウンド順番制）
        if (ofc.currentTurnIndex >= 0 && ofc.currentTurnIndex !== playerIndex) {
            return [{ type: 'error', data: { reason: 'Not your turn' } }];
        }

        // Fantasyland: 14 cards → 13 placed + 1 discarded
        if (player.isFantasyland) {
            return this.placeFantasylandCards(room, player, placements, discardCard);
        }

        // Normal: exactly 5 cards
        if (placements.length !== 5) {
            return [{ type: 'error', data: { reason: 'Must place exactly 5 cards' } }];
        }

        // Validate that all placed cards are in hand
        const handSet = new Set(player.currentCards);
        for (const p of placements) {
            if (!handSet.has(p.card)) {
                return [{ type: 'error', data: { reason: `Card ${p.card} not in hand` } }];
            }
        }

        // Validate row limits
        if (!this.validateRowLimits(placements, player.board)) {
            return [{ type: 'error', data: { reason: 'Row capacity exceeded' } }];
        }

        // Apply placements
        this.applyPlacements(player, placements);
        player.currentCards = [];
        player.hasPlaced = true;

        // ターンを次のプレイヤーに進める
        ofc.currentTurnIndex = this.getNextUnplacedPlayer(ofc);

        // 配置情報をまとめる
        const placementSummary = this.summarizePlacements(placements);

        events.push({
            type: 'placement-accepted',
            data: {
                socketId,
                playerName: player.name,
                round: ofc.round,
                nextTurnIndex: ofc.currentTurnIndex,
                placements: placementSummary,
            },
        });

        // Check if all players have placed
        if (ofc.players.every(p => p.hasPlaced)) {
            const advanceEvents = this.advanceRound(room);
            events.push(...advanceEvents);
        }

        return events;
    }

    /**
     * ファンタジーランド: 14枚 → 13配置 + 1捨て
     */
    private placeFantasylandCards(
        room: Room,
        player: OFCPlayerState,
        placements: OFCPlacement[],
        discardCard?: string,
    ): OFCEngineEvent[] {
        const events: OFCEngineEvent[] = [];
        const ofc = room.ofcState!;

        if (placements.length !== 13 || !discardCard) {
            return [{ type: 'error', data: { reason: 'FL: Must place 13 cards and discard 1' } }];
        }

        const allCards = player.fantasyCandidateCards!;
        const allSet = new Set(allCards);

        // Validate placements + discard
        const usedCards = new Set<string>();
        for (const p of placements) {
            if (!allSet.has(p.card)) {
                return [{ type: 'error', data: { reason: `Card ${p.card} not in FL hand` } }];
            }
            usedCards.add(p.card);
        }
        if (!allSet.has(discardCard) || usedCards.has(discardCard)) {
            return [{ type: 'error', data: { reason: 'Invalid discard card' } }];
        }
        usedCards.add(discardCard);

        if (usedCards.size !== 14) {
            return [{ type: 'error', data: { reason: 'Must use all 14 cards' } }];
        }

        // Validate exact row counts: Top=3, Middle=5, Bottom=5
        const topCount = placements.filter(p => p.row === 'top').length;
        const midCount = placements.filter(p => p.row === 'middle').length;
        const botCount = placements.filter(p => p.row === 'bottom').length;
        if (topCount !== 3 || midCount !== 5 || botCount !== 5) {
            return [{ type: 'error', data: { reason: 'FL: Must place Top:3, Middle:5, Bottom:5' } }];
        }

        // Apply placements
        this.applyPlacements(player, placements);
        player.fantasyCandidateCards = undefined;
        player.currentCards = [];
        player.hasPlaced = true;

        // 配置情報をまとめる
        const placementSummary = this.summarizePlacements(placements);

        events.push({
            type: 'placement-accepted',
            data: {
                socketId: player.socketId,
                playerName: player.name,
                round: ofc.round,
                placements: placementSummary,
                isFantasyland: true,
                discardCard,
            },
        });

        if (ofc.players.every(p => p.hasPlaced)) {
            const advanceEvents = this.advanceRound(room);
            events.push(...advanceEvents);
        }

        return events;
    }

    /**
     * Pineappleラウンド: 3枚 → 2配置 + 1捨て
     */
    placePineappleCards(
        room: Room,
        socketId: string,
        placements: OFCPlacement[],
        discardCard: string,
    ): OFCEngineEvent[] {
        const events: OFCEngineEvent[] = [];
        const ofc = room.ofcState;
        if (!ofc || ofc.phase !== 'OFC_PINEAPPLE_PLACING') {
            return [{ type: 'error', data: { reason: 'Not in pineapple placing phase' } }];
        }

        const playerIndex = ofc.players.findIndex(p => p.socketId === socketId);
        const player = playerIndex >= 0 ? ofc.players[playerIndex] : undefined;
        if (!player) {
            return [{ type: 'error', data: { reason: 'Player not found' } }];
        }
        if (player.hasPlaced) {
            return [{ type: 'error', data: { reason: 'Already placed this round' } }];
        }

        // 順番チェック（Pineappleは順番制）
        if (ofc.currentTurnIndex >= 0 && ofc.currentTurnIndex !== playerIndex) {
            return [{ type: 'error', data: { reason: 'Not your turn' } }];
        }

        // FL player has already placed everything in initial phase
        if (player.isFantasyland) {
            player.hasPlaced = true;
            events.push({
                type: 'placement-accepted',
                data: { socketId, round: ofc.round },
            });

            if (ofc.players.every(p => p.hasPlaced)) {
                events.push(...this.advanceRound(room));
            }
            return events;
        }

        // Must place exactly 2 cards and discard 1
        if (placements.length !== 2) {
            return [{ type: 'error', data: { reason: 'Must place exactly 2 cards' } }];
        }

        const handSet = new Set(player.currentCards);
        for (const p of placements) {
            if (!handSet.has(p.card)) {
                return [{ type: 'error', data: { reason: `Card ${p.card} not in hand` } }];
            }
        }
        if (!handSet.has(discardCard)) {
            return [{ type: 'error', data: { reason: 'Discard card not in hand' } }];
        }

        // Ensure all 3 cards are accounted for
        const usedCards = new Set(placements.map(p => p.card));
        usedCards.add(discardCard);
        if (usedCards.size !== 3) {
            return [{ type: 'error', data: { reason: 'Must use all 3 dealt cards' } }];
        }

        // Validate row limits
        if (!this.validateRowLimits(placements, player.board)) {
            return [{ type: 'error', data: { reason: 'Row capacity exceeded' } }];
        }

        // Apply
        this.applyPlacements(player, placements);
        player.currentCards = [];
        player.hasPlaced = true;

        // ターンを次のプレイヤーに進める
        ofc.currentTurnIndex = this.getNextUnplacedPlayer(ofc);

        // 配置情報をまとめる
        const placementSummary = this.summarizePlacements(placements);

        events.push({
            type: 'placement-accepted',
            data: {
                socketId,
                playerName: player.name,
                round: ofc.round,
                nextTurnIndex: ofc.currentTurnIndex,
                placements: placementSummary,
                discardCard,
            },
        });

        if (ofc.players.every(p => p.hasPlaced)) {
            events.push(...this.advanceRound(room));
        }

        return events;
    }

    /**
     * 配置情報をまとめる（ログ表示用）
     */
    private summarizePlacements(placements: OFCPlacement[]): { row: string; count: number }[] {
        const summary: Record<string, number> = { top: 0, middle: 0, bottom: 0 };
        for (const p of placements) {
            summary[p.row] = (summary[p.row] || 0) + 1;
        }
        return Object.entries(summary)
            .filter(([, count]) => count > 0)
            .map(([row, count]) => ({ row, count }));
    }

    /**
     * ボタン左から順に、未配置のプレイヤーを探す（FL除く）
     * 全員配置済み or FLのみ残り → -1
     */
    private getNextUnplacedPlayer(ofc: OFCGameState): number {
        const N = ofc.players.length;
        for (let i = 1; i <= N; i++) {
            const idx = (ofc.buttonIndex + i) % N;
            const player = ofc.players[idx];
            if (!player.hasPlaced && !player.isFantasyland) {
                return idx;
            }
        }
        return -1;
    }

    /**
     * ラウンドを進行
     * Round 1完了 → Round 2 (Pineapple) → ... → Round 5完了 → スコアリング
     */
    private advanceRound(room: Room): OFCEngineEvent[] {
        const events: OFCEngineEvent[] = [];
        const ofc = room.ofcState!;

        events.push({
            type: 'round-complete',
            data: {
                round: ofc.round,
                players: ofc.players.map(p => ({
                    socketId: p.socketId,
                    board: p.board,
                })),
            },
        });

        if (ofc.round >= 5) {
            // All rounds complete → scoring
            return [...events, ...this.executeScoring(room)];
        }

        // Advance to next round
        ofc.round += 1;
        ofc.phase = 'OFC_PINEAPPLE_PLACING';
        room.gameState.status = 'OFC_PINEAPPLE_PLACING';

        // Deal 3 cards to non-FL players
        for (const player of ofc.players) {
            player.hasPlaced = false;

            if (player.isFantasyland) {
                // FL player already placed all 13 cards in round 1
                player.hasPlaced = true;
                continue;
            }

            const cards = dealCards(ofc.deck, 3);
            player.currentCards = cards;
        }

        // Pineappleラウンドは順番制: ボタン左から
        ofc.currentTurnIndex = this.getNextUnplacedPlayer(ofc);

        events.push({
            type: 'deal',
            data: {
                round: ofc.round,
                currentTurnIndex: ofc.currentTurnIndex,
                players: ofc.players.map(p => ({
                    socketId: p.socketId,
                    cardCount: p.isFantasyland ? 0 : p.currentCards.length,
                    isFantasyland: p.isFantasyland,
                })),
            },
        });

        // If all FL players auto-placed, check if round is already done
        if (ofc.players.every(p => p.hasPlaced)) {
            events.push(...this.advanceRound(room));
        }

        return events;
    }

    /**
     * スコアリング実行
     */
    private executeScoring(room: Room): OFCEngineEvent[] {
        const events: OFCEngineEvent[] = [];
        const ofc = room.ofcState!;

        ofc.phase = 'OFC_SCORING';
        room.gameState.status = 'OFC_SCORING';

        // Check fouls
        for (const player of ofc.players) {
            player.isFouled = checkFoul(player.board);
        }

        // Calculate scores
        const scores = calculateOFCScores(ofc.players, ofc.bigBlind);

        // Apply chip changes to stacks
        for (const score of scores) {
            const player = ofc.players.find(p => p.socketId === score.playerId);
            if (player) {
                player.stack += score.chipChange;
                if (player.stack < 0) player.stack = 0;

                // Update room player stack too
                const roomPlayer = room.players.find(p => p?.socketId === score.playerId);
                if (roomPlayer) {
                    roomPlayer.stack += score.chipChange;
                    if (roomPlayer.stack < 0) roomPlayer.stack = 0;
                }

                // Accumulate scores
                ofc.scores[score.playerId] = (ofc.scores[score.playerId] || 0) + score.totalPoints;
            }
        }

        // Check fantasyland entry/continuation
        const newFlQueue: string[] = [];
        for (const player of ofc.players) {
            if (player.isFantasyland) {
                if (checkFantasylandContinuation(player.board, player.isFouled)) {
                    newFlQueue.push(player.socketId);
                }
            } else {
                if (checkFantasylandEntry(player.board, player.isFouled)) {
                    newFlQueue.push(player.socketId);
                }
            }
        }
        ofc.fantasylandQueue = newFlQueue;

        events.push({
            type: 'scoring',
            data: {
                scores,
                fantasylandPlayers: newFlQueue,
            },
        });

        // Mark hand as complete
        ofc.phase = 'OFC_DONE';
        room.gameState.status = 'WAITING';

        events.push({
            type: 'hand-complete',
            data: { handNumber: ofc.handNumber },
        });

        return events;
    }

    // ========================================
    // Validation Helpers
    // ========================================

    /** Validate that placements don't exceed row limits */
    private validateRowLimits(placements: OFCPlacement[], currentBoard: OFCRow): boolean {
        const topNew = placements.filter(p => p.row === 'top').length;
        const midNew = placements.filter(p => p.row === 'middle').length;
        const botNew = placements.filter(p => p.row === 'bottom').length;

        if (currentBoard.top.length + topNew > 3) return false;
        if (currentBoard.middle.length + midNew > 5) return false;
        if (currentBoard.bottom.length + botNew > 5) return false;

        return true;
    }

    /** Apply placements to a player's board */
    private applyPlacements(player: OFCPlayerState, placements: OFCPlacement[]): void {
        for (const p of placements) {
            switch (p.row) {
                case 'top':
                    player.board.top.push(p.card);
                    break;
                case 'middle':
                    player.board.middle.push(p.card);
                    break;
                case 'bottom':
                    player.board.bottom.push(p.card);
                    break;
            }
        }
    }

    // ========================================
    // Query Methods
    // ========================================

    /** Get a player's current cards (for sending to client) */
    getPlayerCards(room: Room, socketId: string): string[] {
        const ofc = room.ofcState;
        if (!ofc) return [];

        const player = ofc.players.find(p => p.socketId === socketId);
        if (!player) return [];

        if (player.isFantasyland && player.fantasyCandidateCards) {
            return player.fantasyCandidateCards;
        }
        return player.currentCards;
    }

    /** Check if it's a given player's turn to place */
    isPlayerTurn(room: Room, socketId: string): boolean {
        const ofc = room.ofcState;
        if (!ofc) return false;
        if (ofc.phase !== 'OFC_INITIAL_PLACING' && ofc.phase !== 'OFC_PINEAPPLE_PLACING') {
            return false;
        }

        const playerIndex = ofc.players.findIndex(p => p.socketId === socketId);
        if (playerIndex < 0) return false;
        const player = ofc.players[playerIndex];
        if (player.hasPlaced) return false;

        // 順番制: currentTurnIndexと一致するか
        if (ofc.currentTurnIndex >= 0) {
            return ofc.currentTurnIndex === playerIndex;
        }
        return true;
    }

    /** Get the public OFC state (hide other players' cards) */
    getPublicState(room: Room, forSocketId?: string): any {
        const ofc = room.ofcState;
        if (!ofc) return null;

        return {
            phase: ofc.phase,
            round: ofc.round,
            handNumber: ofc.handNumber,
            players: ofc.players.map(p => ({
                socketId: p.socketId,
                name: p.name,
                stack: p.stack,
                board: p.board,
                cardCount: p.isFantasyland
                    ? (p.fantasyCandidateCards?.length || 0)
                    : p.currentCards.length,
                hasPlaced: p.hasPlaced,
                isBot: p.isBot,
                isFantasyland: p.isFantasyland,
                isFouled: ofc.phase === 'OFC_SCORING' || ofc.phase === 'OFC_DONE'
                    ? p.isFouled
                    : false,
            })),
            scores: ofc.scores,
            buttonIndex: ofc.buttonIndex,
            currentTurnSocketId: ofc.currentTurnIndex >= 0
                ? ofc.players[ofc.currentTurnIndex]?.socketId || null
                : null,
        };
    }
}
