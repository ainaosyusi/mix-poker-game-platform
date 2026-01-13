/**
 * Phase 3-B: Dealer Class
 * カード配布、ボタン管理、ブラインド徴収を担当
 */

import type { Room, Player } from './types.js';

export class Dealer {
    // カードデッキ（スート×13ランク = 52枚）
    private readonly SUITS = ['♠', '♥', '♦', '♣'];
    private readonly RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

    /**
     * 52枚のデッキを生成してシャッフル
     */
    createDeck(): string[] {
        const deck: string[] = [];
        for (const suit of this.SUITS) {
            for (const rank of this.RANKS) {
                deck.push(rank + suit);
            }
        }
        return this.shuffle(deck);
    }

    /**
     * Fisher-Yatesアルゴリズムでシャッフル
     */
    private shuffle(deck: string[]): string[] {
        const shuffled = [...deck];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * ホールカードを配布（Texas Hold'em: 2枚）
     * @param deck デッキ（破壊的に編集される）
     * @param players プレイヤー配列
     * @param count 各プレイヤーに配る枚数（デフォルト2）
     */
    dealHoleCards(deck: string[], players: (Player | null)[], count: number = 2): void {
        const activePlayers = players.filter(p => p !== null && p.status !== 'SIT_OUT') as Player[];

        // ラウンドロビン方式で配布
        for (let i = 0; i < count; i++) {
            for (const player of activePlayers) {
                if (deck.length === 0) {
                    throw new Error('Deck is empty');
                }
                const card = deck.shift()!;
                if (!player.hand) {
                    player.hand = [];
                }
                player.hand.push(card);
            }
        }
    }

    /**
     * フロップを配布（バーン1枚 + フロップ3枚）
     */
    dealFlop(deck: string[]): string[] {
        if (deck.length < 4) {
            throw new Error('Not enough cards for flop');
        }

        deck.shift(); // バーンカード
        return [deck.shift()!, deck.shift()!, deck.shift()!];
    }

    /**
     * ターンを配布（バーン1枚 + ターン1枚）
     */
    dealTurn(deck: string[]): string {
        if (deck.length < 2) {
            throw new Error('Not enough cards for turn');
        }

        deck.shift(); // バーンカード
        return deck.shift()!;
    }

    /**
     * リバーを配布（バーン1枚 + リバー1枚）
     */
    dealRiver(deck: string[]): string {
        if (deck.length < 2) {
            throw new Error('Not enough cards for river');
        }

        deck.shift(); // バーンカード
        return deck.shift()!;
    }

    /**
     * ディーラーボタンを次のプレイヤーに移動
     * @param room 部屋
     * @returns 新しいボタンのインデックス
     */
    moveButton(room: Room): number {
        const maxPlayers = room.config.maxPlayers;
        let nextIndex = (room.dealerBtnIndex + 1) % maxPlayers;

        // 次の有効なプレイヤー（着席中）を探す
        let attempts = 0;
        while (attempts < maxPlayers) {
            const player = room.players[nextIndex];
            if (player !== null && player.status !== 'SIT_OUT') {
                room.dealerBtnIndex = nextIndex;
                return nextIndex;
            }
            nextIndex = (nextIndex + 1) % maxPlayers;
            attempts++;
        }

        throw new Error('No active players to move button to');
    }

    /**
     * 次のアクティブプレイヤーを取得
     * @param room 部屋
     * @param currentIndex 現在のインデックス
     * @returns 次のアクティブプレイヤーのインデックス（-1の場合は全員完了）
     */
    getNextActivePlayer(room: Room, currentIndex: number): number {
        const maxPlayers = room.config.maxPlayers;
        let nextIndex = (currentIndex + 1) % maxPlayers;
        let attempts = 0;

        while (attempts < maxPlayers) {
            const player = room.players[nextIndex];
            if (
                player !== null &&
                player.status === 'ACTIVE' &&
                player.stack > 0  // スタックがある
            ) {
                return nextIndex;
            }
            nextIndex = (nextIndex + 1) % maxPlayers;
            attempts++;
        }

        return -1; // 全員アクション完了
    }

    /**
     * スモールブラインドとビッグブラインドを徴収
     * @param room 部屋
     * @returns {sbIndex, bbIndex} SBとBBのプレイヤーインデックス
     */
    collectBlinds(room: Room): { sbIndex: number; bbIndex: number } {
        const dealerIndex = room.dealerBtnIndex;
        const maxPlayers = room.config.maxPlayers;

        // アクティブなプレイヤー数を数える
        const activePlayers = room.players.filter(p =>
            p !== null && p.status !== 'SIT_OUT' && p.stack > 0
        );

        if (activePlayers.length < 2) {
            throw new Error('Need at least 2 players to collect blinds');
        }

        // ヘッズアップの場合: ボタン=SB, 次がBB
        // 3人以上の場合: ボタンの次=SB, その次=BB
        let sbIndex: number;
        let bbIndex: number;

        if (activePlayers.length === 2) {
            // ヘッズアップ
            sbIndex = dealerIndex;
            bbIndex = this.getNextActivePlayer(room, dealerIndex);
        } else {
            // 3人以上
            sbIndex = this.getNextActivePlayer(room, dealerIndex);
            bbIndex = this.getNextActivePlayer(room, sbIndex);
        }

        // ブラインド徴収
        const sbPlayer = room.players[sbIndex];
        const bbPlayer = room.players[bbIndex];

        if (!sbPlayer || !bbPlayer) {
            throw new Error('Blind positions not found');
        }

        const sb = room.config.smallBlind;
        const bb = room.config.bigBlind;

        // SB徴収
        const sbAmount = Math.min(sbPlayer.stack, sb);
        sbPlayer.stack -= sbAmount;
        sbPlayer.bet = sbAmount;
        sbPlayer.totalBet = sbAmount;
        room.gameState.pot.main += sbAmount;

        // BB徴収
        const bbAmount = Math.min(bbPlayer.stack, bb);
        bbPlayer.stack -= bbAmount;
        bbPlayer.bet = bbAmount;
        bbPlayer.totalBet = bbAmount;
        room.gameState.pot.main += bbAmount;

        // オールインチェック
        if (sbPlayer.stack === 0) {
            sbPlayer.status = 'ALL_IN';
        }
        if (bbPlayer.stack === 0) {
            bbPlayer.status = 'ALL_IN';
        }

        console.log(`💰 Blinds collected: SB=${sbAmount} (seat ${sbIndex}), BB=${bbAmount} (seat ${bbIndex})`);

        return { sbIndex, bbIndex };
    }

    /**
     * アクティブプレイヤー数を取得
     */
    getActivePlayerCount(room: Room): number {
        return room.players.filter(p =>
            p !== null &&
            (p.status === 'ACTIVE' || p.status === 'ALL_IN')
        ).length;
    }

    /**
     * ハンド終了時のクリーンアップ
     */
    clearHands(room: Room): void {
        for (const player of room.players) {
            if (player) {
                player.hand = null;
                player.bet = 0;
                player.totalBet = 0;
                if (player.status === 'FOLDED') {
                    player.status = 'ACTIVE';
                }
            }
        }
        room.gameState.board = [];
        room.gameState.pot = { main: 0, side: [] };
    }
}
