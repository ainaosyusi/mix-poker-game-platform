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
        const activePlayers = players.filter(p =>
            p !== null && p.stack > 0 && p.status === 'ACTIVE'
        ) as Player[];

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
            if (player !== null && player.stack > 0) {
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
     * 次のブラインド対象プレイヤーを取得
     * @param includeWaitingForBB trueの場合、BB待ちも対象に含める
     */
    getNextBlindPlayer(room: Room, currentIndex: number, includeWaitingForBB: boolean): number {
        const maxPlayers = room.config.maxPlayers;
        let nextIndex = (currentIndex + 1) % maxPlayers;
        let attempts = 0;

        while (attempts < maxPlayers) {
            const player = room.players[nextIndex];
            if (
                player !== null &&
                player.stack > 0 &&
                (player.status === 'ACTIVE' || (includeWaitingForBB && player.waitingForBB))
            ) {
                return nextIndex;
            }
            nextIndex = (nextIndex + 1) % maxPlayers;
            attempts++;
        }

        return -1;
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
            p !== null && p.stack > 0 && p.status === 'ACTIVE'
        );

        const blindEligible = room.players.filter(p =>
            p !== null && p.stack > 0 && (p.status === 'ACTIVE' || p.waitingForBB)
        );

        if (blindEligible.length < 2) {
            throw new Error('Need at least 2 players to collect blinds');
        }

        // ヘッズアップの場合: ボタン=SB, 次がBB
        // 3人以上の場合: ボタンの次=SB, その次=BB
        let sbIndex: number;
        let bbIndex: number;

        if (activePlayers.length === 2) {
            // ヘッズアップ
            sbIndex = (room.players[dealerIndex]?.status === 'ACTIVE')
                ? dealerIndex
                : this.getNextActivePlayer(room, dealerIndex);
            bbIndex = this.getNextBlindPlayer(room, sbIndex, true);
        } else if (activePlayers.length < 2) {
            sbIndex = (room.players[dealerIndex]?.status === 'ACTIVE')
                ? dealerIndex
                : this.getNextActivePlayer(room, dealerIndex);
            if (sbIndex === -1) {
                sbIndex = this.getNextBlindPlayer(room, dealerIndex, true);
            }
            bbIndex = this.getNextBlindPlayer(room, sbIndex, true);
        } else {
            // 3人以上
            sbIndex = this.getNextActivePlayer(room, dealerIndex);
            bbIndex = this.getNextBlindPlayer(room, sbIndex, true);
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

        // BB待ちのプレイヤーはここで参加扱いにする
        if (bbPlayer.waitingForBB) {
            bbPlayer.waitingForBB = false;
            bbPlayer.pendingJoin = false;
            bbPlayer.status = 'ACTIVE';
        }

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

    /**
     * カードのランク値を取得（Bring-In判定用）
     */
    private getCardRankValue(card: string): number {
        const rank = card[0];
        const values: { [key: string]: number } = {
            '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10,
            'J': 11, 'Q': 12, 'K': 13, 'A': 14
        };
        return values[rank] || 0;
    }

    /**
     * カードのスート値を取得（タイブレーク用: ♣ < ♦ < ♥ < ♠）
     */
    private getCardSuitValue(card: string): number {
        const suit = card[1];
        const values: { [key: string]: number } = {
            '♣': 1, '♦': 2, '♥': 3, '♠': 4
        };
        return values[suit] || 0;
    }

    /**
     * Stud Bring-In判定: 最も弱いアップカードを持つプレイヤーのインデックスを返す
     * @param players プレイヤー配列
     * @param isRazz Razzの場合は最も強いアップカード
     * @returns プレイヤーのインデックス
     */
    determineBringIn(players: (Player | null)[], isRazz: boolean = false): number {
        let bringInIndex = -1;
        let targetRank = isRazz ? 0 : 15; // Razz: 高い方、通常: 低い方
        let targetSuit = isRazz ? 0 : 5;

        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            if (!player || !player.studUpCards || player.studUpCards.length === 0) continue;

            const upCard = player.studUpCards[0]; // 3rd Streetの最初のアップカード
            const rank = this.getCardRankValue(upCard);
            const suit = this.getCardSuitValue(upCard);

            if (isRazz) {
                // Razz: 最も高いカード（強い＝悪い）がBring-In
                if (rank > targetRank || (rank === targetRank && suit > targetSuit)) {
                    targetRank = rank;
                    targetSuit = suit;
                    bringInIndex = i;
                }
            } else {
                // 通常Stud: 最も低いカードがBring-In
                if (rank < targetRank || (rank === targetRank && suit < targetSuit)) {
                    targetRank = rank;
                    targetSuit = suit;
                    bringInIndex = i;
                }
            }
        }

        return bringInIndex;
    }

    /**
     * Bring-Inを徴収
     * @param room 部屋
     * @param bringInIndex Bring-Inプレイヤーのインデックス
     * @param bringInAmount Bring-In額（通常はSBの半分程度）
     */
    collectBringIn(room: Room, bringInIndex: number, bringInAmount: number): void {
        const player = room.players[bringInIndex];
        if (!player) return;

        const amount = Math.min(player.stack, bringInAmount);
        player.stack -= amount;
        player.bet = amount;
        player.totalBet = amount;
        room.gameState.pot.main += amount;
        room.gameState.currentBet = amount;

        if (player.stack === 0) {
            player.status = 'ALL_IN';
        }

        console.log(`💰 Bring-In: ${player.name} posts ${amount}`);
    }

    /**
     * Studのアクション開始プレイヤーを決定
     * - 通常: 最も強いアップカードのプレイヤー
     * - Razz: 最も弱いアップカードのプレイヤー
     * タイはディーラーの左から順に優先
     */
    getStudActionStartIndex(room: Room, isRazz: boolean = false): number {
        const candidates = room.players
            .map((player, index) => ({ player, index }))
            .filter(p => p.player !== null && p.player.status === 'ACTIVE' && (p.player.studUpCards?.length || 0) > 0);

        if (candidates.length === 0) {
            return this.getNextActivePlayer(room, -1);
        }

        const compareUpCards = (a: Player, b: Player): number => {
            const aRanks = (a.studUpCards || []).map(card => this.getCardRankValue(card));
            const bRanks = (b.studUpCards || []).map(card => this.getCardRankValue(card));

            aRanks.sort((x, y) => isRazz ? x - y : y - x);
            bRanks.sort((x, y) => isRazz ? x - y : y - x);

            const maxLen = Math.max(aRanks.length, bRanks.length);
            for (let i = 0; i < maxLen; i++) {
                const av = aRanks[i] ?? (isRazz ? 99 : 0);
                const bv = bRanks[i] ?? (isRazz ? 99 : 0);
                if (av === bv) continue;
                return isRazz ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1);
            }
            return 0;
        };

        let best = candidates[0];
        let tied: number[] = [best.index];

        for (const candidate of candidates.slice(1)) {
            const result = compareUpCards(candidate.player!, best.player!);
            if (result > 0) {
                best = candidate;
                tied = [candidate.index];
            } else if (result === 0) {
                tied.push(candidate.index);
            }
        }

        if (tied.length === 1) {
            return tied[0];
        }

        const maxPlayers = room.config.maxPlayers;
        let idx = (room.dealerBtnIndex + 1) % maxPlayers;
        for (let i = 0; i < maxPlayers; i++) {
            if (tied.includes(idx)) {
                return idx;
            }
            idx = (idx + 1) % maxPlayers;
        }

        return tied[0];
    }

    /**
     * スタッド用カード配布（3rd Street: 2 down + 1 up）
     */
    dealStudInitial(deck: string[], players: (Player | null)[]): void {
        const activePlayers = players.filter(p =>
            p !== null && p.stack > 0 && p.status === 'ACTIVE'
        ) as Player[];

        // 2枚ダウンカード
        for (let i = 0; i < 2; i++) {
            for (const player of activePlayers) {
                if (deck.length === 0) throw new Error('Deck is empty');
                const card = deck.shift()!;
                if (!player.hand) player.hand = [];
                player.hand.push(card);
            }
        }

        // 1枚アップカード
        for (const player of activePlayers) {
            if (deck.length === 0) throw new Error('Deck is empty');
            const card = deck.shift()!;
            player.hand!.push(card);
            // アップカードはstudUpCardsに記録
            if (!player.studUpCards) player.studUpCards = [];
            player.studUpCards.push(card);
        }

        console.log('🎴 Dealt Stud 3rd Street: 2 down + 1 up');
    }

    /**
     * スタッド用追加カード配布（4th-6th Street: up cards）
     */
    dealStudStreet(deck: string[], players: (Player | null)[], isLastStreet: boolean = false): void {
        const activePlayers = players.filter(p =>
            p !== null && (p.status === 'ACTIVE' || p.status === 'ALL_IN')
        ) as Player[];

        for (const player of activePlayers) {
            if (deck.length === 0) throw new Error('Deck is empty');
            const card = deck.shift()!;
            player.hand!.push(card);

            // 7th Streetはダウンカード、それ以外はアップカード
            if (!isLastStreet) {
                if (!player.studUpCards) player.studUpCards = [];
                player.studUpCards.push(card);
            }
        }

        console.log(`🎴 Dealt Stud street: ${isLastStreet ? 'down card' : 'up card'}`);
    }

    /**
     * ドロー交換処理
     * @param deck デッキ
     * @param player プレイヤー
     * @param discardIndexes 捨てるカードのインデックス配列
     */
    exchangeDrawCards(deck: string[], player: Player, discardIndexes: number[]): void {
        if (!player.hand) return;

        const discardCount = discardIndexes.length;
        if (deck.length < discardCount) {
            throw new Error('Not enough cards for draw exchange');
        }

        // Sort indexes in descending order to avoid index shift issues
        const sortedIndexes = [...discardIndexes].sort((a, b) => b - a);

        // Remove discarded cards
        for (const idx of sortedIndexes) {
            if (idx >= 0 && idx < player.hand.length) {
                player.hand.splice(idx, 1);
            }
        }

        // Deal new cards
        for (let i = 0; i < discardCount; i++) {
            const card = deck.shift()!;
            player.hand.push(card);
        }

        console.log(`🔄 ${player.name} exchanged ${discardCount} cards`);
    }

    /**
     * リシャッフル（Pattern C: 高度なアルゴリズム）
     * デッキが不足した場合、ディスカードパイルとスタブを合わせてリシャッフル
     */
    reshuffleIfNeeded(deck: string[], discardPile: string[], requiredCards: number): string[] {
        if (deck.length >= requiredCards) {
            return deck; // 十分なカードがある
        }

        console.log(`⚠️ Deck low (${deck.length} cards), need ${requiredCards}. Reshuffling...`);

        // スタブとディスカードを合わせる
        const combined = [...deck, ...discardPile];
        const reshuffled = this.shuffle(combined);

        console.log(`✅ Reshuffled ${combined.length} cards`);

        // ディスカードパイルをクリア
        discardPile.length = 0;

        return reshuffled;
    }
}
