/**
 * Phase 3-B: Game Engine
 * FSM（状態遷移マシン）とゲームループを管理
 * Phase 3-C: ローテーション対応を追加
 */

import type { Room, Player, GamePhase, ActionType, PlayerAction } from './types.js';
import { Dealer } from './Dealer.js';
import { RotationManager } from './RotationManager.js';
import { getVariantConfig } from './gameVariants.js';

export class GameEngine {
    private dealer: Dealer;
    private rotationManager: RotationManager;
    private deck: string[] = [];
    private actionTimeout: number = 30000; // 30秒

    constructor() {
        this.dealer = new Dealer();
        this.rotationManager = new RotationManager();
    }

    /**
     * ハンドを開始
     * @param room 部屋
     * @returns 成功時true
     */
    startHand(room: Room): boolean {
        // アクティブプレイヤー数をチェック
        const activePlayers = this.getSeatedPlayers(room);
        if (activePlayers.length < 2) {
            console.log('⚠️ Need at least 2 players to start hand');
            return false;
        }

        console.log(`\n🎴 Starting new hand #${room.gameState.handNumber + 1}`);

        // ハンド番号を増加
        room.gameState.handNumber = (room.gameState.handNumber || 0) + 1;

        this.resetPlayersForNewHand(room);
        this.resetHandState(room);
        this.deck = this.dealer.createDeck();

        const variantConfig = getVariantConfig(room.gameState.gameVariant);
        const { bbIndex } = this.setupButtonAndBlinds(room, variantConfig);
        const { bringInIndex } = this.initializeVariantHand(room, variantConfig);
        this.setInitialActivePlayer(room, variantConfig, bbIndex, bringInIndex);

        // このストリートの開始プレイヤーを記録
        room.streetStarterIndex = room.activePlayerIndex;

        console.log(`✅ Hand started. Active player: seat ${room.activePlayerIndex}`);

        return true;
    }

    private resetPlayersForNewHand(room: Room): void {
        for (const player of room.players) {
            if (!player || player.stack <= 0) continue;

            if (player.pendingSitOut) {
                player.status = 'SIT_OUT';
                player.pendingSitOut = false;
                player.pendingJoin = false;
                player.waitingForBB = false;
            } else if (player.disconnected) {
                player.status = 'SIT_OUT';
            } else if (player.status === 'SIT_OUT') {
                if (player.pendingJoin && !player.waitingForBB) {
                    player.status = 'ACTIVE';
                    player.pendingJoin = false;
                }
            } else {
                player.status = 'ACTIVE';
            }

            player.hand = null;
            player.bet = 0;
            player.totalBet = 0;
            if (player.studUpCards) player.studUpCards = [];
        }
    }

    private resetHandState(room: Room): void {
        room.gameState.pot = { main: 0, side: [] };
        room.gameState.board = [];
        room.gameState.currentBet = 0;
        room.gameState.minRaise = room.config.bigBlind;
        room.gameState.raisesThisRound = 0;
        room.lastAggressorIndex = -1;
    }

    private setupButtonAndBlinds(room: Room, variantConfig: any): { sbIndex: number; bbIndex: number } {
        if (!variantConfig.hasButton) {
            return { sbIndex: -1, bbIndex: -1 };
        }

        this.dealer.moveButton(room);
        const blinds = this.dealer.collectBlinds(room);
        room.gameState.currentBet = room.config.bigBlind;
        return { sbIndex: blinds.sbIndex, bbIndex: blinds.bbIndex };
    }

    private initializeVariantHand(room: Room, variantConfig: any): { bringInIndex: number } {
        if (variantConfig.communityCardType === 'stud') {
            return this.initializeStudHand(room);
        }
        if (variantConfig.hasDrawPhase) {
            this.initializeDrawHand(room, variantConfig);
            return { bringInIndex: -1 };
        }
        this.initializeFlopHand(room, variantConfig);
        return { bringInIndex: -1 };
    }

    private initializeStudHand(room: Room): { bringInIndex: number } {
        this.dealer.dealStudInitial(this.deck, room.players);
        room.gameState.status = 'THIRD_STREET' as any;
        room.gameState.street = 0;

        const isRazz = room.gameState.gameVariant === 'RAZZ';
        const bringInIndex = this.dealer.determineBringIn(room.players, isRazz);

        if (bringInIndex !== -1) {
            const bringInAmount = room.config.studAnte ?? Math.max(1, Math.floor(room.config.bigBlind / 5));
            this.dealer.collectBringIn(room, bringInIndex, bringInAmount);
            room.gameState.minRaise = room.config.bigBlind;
            room.gameState.currentBet = bringInAmount;
        }

        return { bringInIndex };
    }

    private initializeDrawHand(room: Room, variantConfig: any): void {
        this.dealer.dealHoleCards(this.deck, room.players, variantConfig.holeCardCount);
        room.gameState.status = 'PREDRAW' as any;
        room.gameState.street = 0;
    }

    private initializeFlopHand(room: Room, variantConfig: any): void {
        this.dealer.dealHoleCards(this.deck, room.players, variantConfig.holeCardCount);
        room.gameState.status = 'PREFLOP' as any;
        room.gameState.street = 0;
    }

    private setInitialActivePlayer(
        room: Room,
        variantConfig: any,
        bbIndex: number,
        bringInIndex: number
    ): void {
        if (variantConfig.hasButton && bbIndex !== -1) {
            room.activePlayerIndex = this.dealer.getNextActivePlayer(room, bbIndex);
            return;
        }
        if (bringInIndex !== -1) {
            room.activePlayerIndex = this.dealer.getNextActivePlayer(room, bringInIndex);
            return;
        }
        room.activePlayerIndex = this.dealer.getNextActivePlayer(room, -1);
    }

    /**
     * プレイヤーアクションを処理
     * @param room 部屋
     * @param action プレイヤーアクション
     * @returns 処理結果
     */
    processAction(room: Room, action: PlayerAction): { success: boolean; error?: string } {
        const player = room.players.find(p => p?.socketId === action.playerId);

        if (!player) {
            return { success: false, error: 'Player not found' };
        }

        if (room.players[room.activePlayerIndex]?.socketId !== action.playerId) {
            return { success: false, error: 'Not your turn' };
        }

        console.log(`🎯 ${player.name} -> ${action.type}${action.amount ? ` ${action.amount}` : ''}`);

        const actionError = this.applyAction(room, player, action);
        if (actionError) {
            return { success: false, error: actionError };
        }

        // 次のプレイヤーに移動
        this.advanceAction(room);

        return { success: true };
    }

    private applyAction(room: Room, player: RoomPlayer, action: PlayerAction): string | null {
        switch (action.type) {
            case 'FOLD':
                return this.processFold(player);
            case 'CHECK':
                return this.processCheck(room, player);
            case 'CALL':
                return this.processCall(room, player);
            case 'BET':
            case 'RAISE':
                return this.processBetOrRaise(room, player, action);
            case 'ALL_IN':
                return this.processAllIn(room, player);
            default:
                return 'Invalid action';
        }
    }

    private processFold(player: RoomPlayer): string | null {
        player.status = 'FOLDED';
        return null;
    }

    private processCheck(room: Room, player: RoomPlayer): string | null {
        if (player.bet < room.gameState.currentBet) {
            return 'Cannot check, must call or raise';
        }
        return null;
    }

    private processCall(room: Room, player: RoomPlayer): string | null {
        const callAmount = Math.min(room.gameState.currentBet - player.bet, player.stack);
        player.stack -= callAmount;
        player.bet += callAmount;
        player.totalBet += callAmount;
        room.gameState.pot.main += callAmount;
        if (player.stack === 0) {
            player.status = 'ALL_IN';
        }
        return null;
    }

    private processBetOrRaise(room: Room, player: RoomPlayer, action: PlayerAction): string | null {
        const betAmount = action.amount || 0;
        const variantConfigBet = getVariantConfig(room.gameState.gameVariant);

        if (variantConfigBet.betStructure === 'fixed') {
            return this.processBetOrRaiseFixed(room, player, betAmount);
        }
        if (variantConfigBet.betStructure === 'pot-limit') {
            return this.processBetOrRaisePotLimit(room, player, betAmount);
        }
        return this.processBetOrRaiseNoLimit(room, player, betAmount);
    }

    private processBetOrRaiseFixed(room: Room, player: RoomPlayer, betAmount: number): string | null {
        const capLimit = this.getCapLimit(room);
        if (room.gameState.raisesThisRound >= capLimit) {
            return 'Betting is capped';
        }

        const context = this.getBetContext(room, player, betAmount);
        if ('error' in context) return context.error;

        this.applyBetOrRaise(room, player, betAmount, context.totalBet, 'fixed');
        return null;
    }

    private processBetOrRaisePotLimit(room: Room, player: RoomPlayer, betAmount: number): string | null {
        const context = this.getBetContext(room, player, betAmount);
        if ('error' in context) return context.error;

        const maxPotBet = this.calculatePotLimitMax(room, player);
        if (context.totalBet > maxPotBet) {
            return `Maximum bet is ${maxPotBet} (pot limit)`;
        }

        this.applyBetOrRaise(room, player, betAmount, context.totalBet, 'pot-limit');
        return null;
    }

    private processBetOrRaiseNoLimit(room: Room, player: RoomPlayer, betAmount: number): string | null {
        const context = this.getBetContext(room, player, betAmount);
        if ('error' in context) return context.error;

        this.applyBetOrRaise(room, player, betAmount, context.totalBet, 'no-limit');
        return null;
    }

    private getBetContext(
        room: Room,
        player: RoomPlayer,
        betAmount: number
    ): { totalBet: number; isAllInBet: boolean } | { error: string } {
        if (!Number.isFinite(betAmount) || betAmount <= 0) {
            return { error: 'Invalid bet amount' };
        }

        const isAllInBet = betAmount >= player.stack;
        const minTotal = this.getMinBetTo(room, player);
        const totalBet = player.bet + betAmount;

        if (totalBet < minTotal && !isAllInBet) {
            return { error: `Minimum raise is ${minTotal}` };
        }
        if (betAmount > player.stack) {
            return { error: 'Not enough chips' };
        }

        return { totalBet, isAllInBet };
    }

    private applyBetOrRaise(
        room: Room,
        player: RoomPlayer,
        betAmount: number,
        totalBet: number,
        betStructure: 'fixed' | 'pot-limit' | 'no-limit'
    ): void {
        const raiseSize = totalBet - room.gameState.currentBet;
        const reopensAction = raiseSize >= room.gameState.minRaise;

        player.stack -= betAmount;
        player.bet = totalBet;
        player.totalBet += betAmount;
        room.gameState.pot.main += betAmount;
        room.gameState.currentBet = totalBet;

        if (reopensAction) {
            room.gameState.minRaise = raiseSize;
            room.streetStarterIndex = room.activePlayerIndex;
            if (betStructure === 'fixed') {
                room.gameState.raisesThisRound++;
            }
        }

        room.lastAggressorIndex = room.activePlayerIndex;

        if (player.stack === 0) {
            player.status = 'ALL_IN';
        }
    }

    private processAllIn(room: Room, player: RoomPlayer): string | null {
        const allInAmount = player.stack;
        const newTotal = player.bet + allInAmount;
        const raiseSizeAllIn = newTotal - room.gameState.currentBet;
        const reopensAllIn = raiseSizeAllIn >= room.gameState.minRaise;

        player.bet = newTotal;
        player.totalBet += allInAmount;
        player.stack = 0;
        player.status = 'ALL_IN';
        room.gameState.pot.main += allInAmount;

        if (newTotal > room.gameState.currentBet) {
            room.gameState.currentBet = newTotal;
            if (reopensAllIn) {
                room.gameState.minRaise = raiseSizeAllIn;
                room.streetStarterIndex = room.activePlayerIndex;
            }
            room.lastAggressorIndex = room.activePlayerIndex;
            const variantConfig = getVariantConfig(room.gameState.gameVariant);
            if (variantConfig.betStructure === 'fixed' && reopensAllIn) {
                room.gameState.raisesThisRound++;
            } else if (variantConfig.betStructure !== 'fixed') {
                room.gameState.raisesThisRound++;
            }
        }
        return null;
    }

    /**
     * 次のプレイヤーに進む、またはストリートを進める
     */
    private advanceAction(room: Room): void {
        const playerCounts = this.getPlayerCounts(room);

        // 早期終了判定
        const earlyEndResult = this.checkEarlyHandEnd(room, playerCounts);
        if (earlyEndResult.shouldEnd) {
            return;
        }

        // ラウンド終了判定
        const roundComplete = this.isRoundComplete(room, playerCounts);
        const nextIndex = this.dealer.getNextActivePlayer(room, room.activePlayerIndex);

        if (roundComplete) {
            // 次のストリートへ
            this.nextStreet(room);
        } else if (nextIndex === -1) {
            // アクション可能なプレイヤーがいない
            this.endHand(room);
        } else {
            // 次のプレイヤーへ
            room.activePlayerIndex = nextIndex;
        }
    }

    /**
     * プレイヤー分類を取得
     */
    private getPlayerCounts(room: Room) {
        const actionablePlayers = room.players.filter(p =>
            p !== null && p.status === 'ACTIVE'
        );

        const allInPlayers = room.players.filter(p =>
            p !== null && p.status === 'ALL_IN'
        );

        const remainingPlayers = room.players.filter(p =>
            p !== null && (p.status === 'ACTIVE' || p.status === 'ALL_IN')
        );

        return { actionablePlayers, allInPlayers, remainingPlayers };
    }

    /**
     * 早期終了判定（ALL INランアウト含む）
     */
    private checkEarlyHandEnd(room: Room, playerCounts: {
        actionablePlayers: (Player | null)[];
        allInPlayers: (Player | null)[];
        remainingPlayers: (Player | null)[];
    }): { shouldEnd: boolean } {
        const { actionablePlayers, allInPlayers, remainingPlayers } = playerCounts;

        // 1人以下なら終了
        if (remainingPlayers.length <= 1) {
            this.endHand(room);
            return { shouldEnd: true };
        }

        // 全員ALL INの場合、自動的にリバーまで進めてショーダウン
        if (actionablePlayers.length === 0 && allInPlayers.length >= 2) {
            console.log('💥 All players ALL IN - auto-dealing to showdown');
            room.gameState.isRunout = true;
            room.gameState.runoutPhase = room.gameState.status;
            this.dealToShowdown(room);
            this.endHand(room);
            return { shouldEnd: true };
        }

        // 1人だけアクティブで他がALL-INの場合、そのプレイヤーがコールしたらランアウト
        if (actionablePlayers.length === 1 && allInPlayers.length >= 1) {
            const activePlayer = actionablePlayers[0]!;
            const allBetsMatched = activePlayer.bet >= room.gameState.currentBet;
            if (allBetsMatched) {
                console.log('💥 One active player matched all-in bet - running out');
                room.gameState.isRunout = true;
                room.gameState.runoutPhase = room.gameState.status;
                this.dealToShowdown(room);
                this.endHand(room);
                return { shouldEnd: true };
            }
        }

        // アクション可能なプレイヤーが0人の場合（全員ALL_INまたはフォールド）
        if (actionablePlayers.length === 0) {
            this.endHand(room);
            return { shouldEnd: true };
        }

        return { shouldEnd: false };
    }

    /**
     * ラウンド終了判定
     */
    private isRoundComplete(room: Room, playerCounts: {
        actionablePlayers: (Player | null)[];
        allInPlayers: (Player | null)[];
        remainingPlayers: (Player | null)[];
    }): boolean {
        const { actionablePlayers } = playerCounts;

        // 全員のベットが揃っているかチェック
        const allBetsEqual = actionablePlayers.every(p =>
            p!.bet === room.gameState.currentBet || p!.stack === 0
        );

        if (!allBetsEqual) {
            return false;
        }

        // 次のアクティブプレイヤーを探す
        const nextIndex = this.dealer.getNextActivePlayer(room, room.activePlayerIndex);

        // streetStarterがまだアクティブかチェック
        const streetStarter = room.players[room.streetStarterIndex];
        const streetStarterIsActive = streetStarter?.status === 'ACTIVE';

        if (streetStarterIsActive) {
            // 通常ケース: streetStarterに戻ったら完了
            return nextIndex === room.streetStarterIndex;
        } else {
            // streetStarterがALL_INまたはフォールドの場合
            // 全員のベットが揃っていれば、アクティブプレイヤーが一周したとみなす
            return nextIndex === -1 ||
                nextIndex === room.activePlayerIndex ||
                actionablePlayers.length === 1;
        }
    }

    /**
     * 次のストリートに進む
     */
    nextStreet(room: Room): void {
        this.resetBetsForNewStreet(room);

        const phase = room.gameState.status;
        const variantConfig = getVariantConfig(room.gameState.gameVariant);

        // ゲームタイプに応じたストリート進行
        if (variantConfig.communityCardType === 'stud') {
            this.nextStudStreet(room, phase);
        } else if (variantConfig.hasDrawPhase) {
            this.nextDrawStreet(room, phase);
        } else {
            this.nextFlopStreet(room, phase);
        }

        const runoutCheck = this.checkPostStreetRunout(room, variantConfig);
        if (runoutCheck.shouldReturn) {
            return;
        }

        this.setStreetStartPlayer(room, variantConfig);
    }

    private resetBetsForNewStreet(room: Room): void {
        for (const player of room.players) {
            if (player) {
                player.bet = 0;
            }
        }
        room.gameState.currentBet = 0;
        room.gameState.raisesThisRound = 0;
    }

    private checkPostStreetRunout(room: Room, variantConfig: any): { shouldReturn: boolean } {
        const actionablePlayers = room.players.filter(p =>
            p !== null && p.status === 'ACTIVE'
        );

        const allInPlayers = room.players.filter(p =>
            p !== null && p.status === 'ALL_IN'
        );

        if (room.gameState.status === 'SHOWDOWN') {
            return { shouldReturn: true };
        }

        room.gameState.minRaise = variantConfig.betStructure === 'fixed'
            ? this.getFixedBetSize(room)
            : room.config.bigBlind;

        if (actionablePlayers.length === 0 && allInPlayers.length >= 2) {
            console.log('💥 All players still ALL IN - continuing auto-deal');
            this.nextStreet(room);
            return { shouldReturn: true };
        }

        if (actionablePlayers.length === 1 && allInPlayers.length >= 1) {
            console.log('💥 Only one active player vs all-in - running out');
            room.gameState.isRunout = true;
            room.gameState.runoutPhase = room.gameState.status;
            this.dealToShowdown(room);
            this.endHand(room);
            return { shouldReturn: true };
        }

        return { shouldReturn: false };
    }

    private setStreetStartPlayer(room: Room, variantConfig: any): void {
        if (variantConfig.hasButton) {
            room.activePlayerIndex = this.dealer.getNextActivePlayer(room, room.dealerBtnIndex);
        } else {
            const isRazz = room.gameState.gameVariant === 'RAZZ';
            room.activePlayerIndex = this.dealer.getStudActionStartIndex(room, isRazz);
        }
        room.streetStarterIndex = room.activePlayerIndex;
    }

    /**
     * Flop系ゲームのストリート進行（データ駆動）
     * boardPatternに基づいてボードカードを配布
     */
    private nextFlopStreet(room: Room, phase: any): void {
        const variantConfig = getVariantConfig(room.gameState.gameVariant);
        const boardPattern = variantConfig.boardPattern || [3, 1, 1];
        // フェーズ名の配列（street indexに対応）
        const FLOP_PHASES = ['PREFLOP', 'FLOP', 'TURN', 'RIVER', 'OCEAN'];

        const currentStreet = room.gameState.street;
        const nextStreet = currentStreet + 1;

        // 全ボードカードが配布済み → ショーダウン
        if (nextStreet > boardPattern.length) {
            room.gameState.status = 'SHOWDOWN' as any;
            room.gameState.street = nextStreet;
            this.endHand(room);
            return;
        }

        // 次のフェーズに進行
        const nextPhase = FLOP_PHASES[nextStreet] || 'SHOWDOWN';
        room.gameState.status = nextPhase as any;
        room.gameState.street = nextStreet;

        // ボードカードを配布
        const cardCount = boardPattern[nextStreet - 1]; // boardPattern[0]=flop, [1]=turn, [2]=river, [3]=ocean
        const newCards = this.dealer.dealBoardCards(this.deck, cardCount);
        room.gameState.board.push(...newCards);

        console.log(`🃏 ${nextPhase}: ${newCards.join(' ')} (board: ${room.gameState.board.join(' ')})`);
    }

    /**
     * Stud系ゲーム（7CS, RAZZ）のストリート進行
     */
    private nextStudStreet(room: Room, phase: any): void {
        switch (phase) {
            case 'PREFLOP': // 便宜上PREFLOPとして開始
            case 'THIRD_STREET':
                room.gameState.status = 'FOURTH_STREET' as any;
                this.dealer.dealStudStreet(this.deck, room.players, false);
                room.gameState.street = 1;
                console.log(`🎴 4th Street dealt`);
                break;

            case 'FOURTH_STREET':
                room.gameState.status = 'FIFTH_STREET' as any;
                this.dealer.dealStudStreet(this.deck, room.players, false);
                room.gameState.street = 2;
                console.log(`🎴 5th Street dealt`);
                break;

            case 'FIFTH_STREET':
                room.gameState.status = 'SIXTH_STREET' as any;
                this.dealer.dealStudStreet(this.deck, room.players, false);
                room.gameState.street = 3;
                console.log(`🎴 6th Street dealt`);
                break;

            case 'SIXTH_STREET':
                room.gameState.status = 'SEVENTH_STREET' as any;
                this.dealer.dealStudStreet(this.deck, room.players, true); // 最後はダウンカード
                room.gameState.street = 4;
                console.log(`🎴 7th Street dealt (down card)`);
                break;

            case 'SEVENTH_STREET':
                room.gameState.status = 'SHOWDOWN' as any;
                room.gameState.street = 5;
                this.endHand(room);
                break;
        }
    }

    /**
     * Draw系ゲーム（2-7 TD, Badugi）のストリート進行
     * ベッティング完了後、ドロー交換フェーズに入る
     */
    private nextDrawStreet(room: Room, phase: any): void {
        const variantConfig = getVariantConfig(room.gameState.gameVariant);
        const drawRounds = variantConfig.drawRounds || 3; // デフォルト: トリプルドロー
        const DRAW_PHASES = ['PREDRAW', 'FIRST_DRAW', 'SECOND_DRAW', 'THIRD_DRAW'];

        const currentStreet = room.gameState.street;
        // PREFLOP/PREDRAWはstreet 0
        const nextStreet = (phase === 'PREFLOP' || phase === 'PREDRAW') ? 1 : currentStreet + 1;

        if (nextStreet > drawRounds) {
            // 全ドローラウンド完了 → ショーダウン
            room.gameState.status = 'SHOWDOWN' as any;
            room.gameState.street = nextStreet;
            room.gameState.isDrawPhase = false;
            this.endHand(room);
            return;
        }

        // 次のドロー交換フェーズへ
        const nextPhase = DRAW_PHASES[nextStreet];
        room.gameState.status = nextPhase as any;
        room.gameState.street = nextStreet;
        room.gameState.isDrawPhase = true;
        room.gameState.playersCompletedDraw = [];
        this.autoCompleteAllInDraws(room);
        console.log(`🔄 ${nextPhase} exchange phase - waiting for players to draw`);
    }

    /**
     * プレイヤーがドロー交換を完了した時に呼ばれる
     * 全員完了したらベッティングフェーズに移行
     */
    checkDrawPhaseComplete(room: Room): boolean {
        if (!room.gameState.isDrawPhase) return false;

        // FOLDED以外のプレイヤーを取得
        const activePlayers = room.players.filter(p =>
            p !== null && (p.status === 'ACTIVE' || p.status === 'ALL_IN')
        );

        const completedDraw = room.gameState.playersCompletedDraw || [];

        // 全員完了したかチェック
        const allCompleted = activePlayers.every(p =>
            completedDraw.includes(p!.socketId)
        );

        if (allCompleted) {
            // ドロー交換完了 → ベッティングフェーズへ
            room.gameState.isDrawPhase = false;
            room.gameState.playersCompletedDraw = [];

            // ベットをリセット
            for (const player of room.players) {
                if (player) {
                    player.bet = 0;
                }
            }
            room.gameState.currentBet = 0;
            const variantConfig = getVariantConfig(room.gameState.gameVariant);
            room.gameState.minRaise = variantConfig.betStructure === 'fixed'
                ? this.getFixedBetSize(room)
                : room.config.bigBlind;
            room.gameState.raisesThisRound = 0;

            // アクティブプレイヤーを設定（ボタンの次から）
            room.activePlayerIndex = this.dealer.getNextActivePlayer(room, room.dealerBtnIndex);
            room.streetStarterIndex = room.activePlayerIndex;

            console.log(`✅ Draw exchange complete - starting betting round`);
            return true;
        }

        return false;
    }

    /**
     * ドローフェーズ開始時にALL_INプレイヤーを自動的に完了としてマーク
     * （ALL_INプレイヤーはカードを交換できないため、0枚交換として扱う）
     */
    autoCompleteAllInDraws(room: Room): void {
        if (!room.gameState.isDrawPhase) return;

        const allInPlayers = room.players.filter(p =>
            p !== null && p.status === 'ALL_IN'
        );

        for (const player of allInPlayers) {
            if (player) {
                this.markDrawComplete(room, player.socketId);
                player.drawDiscards = 0; // スタンドパット
                console.log(`🔄 ${player.name} auto-stands pat (ALL_IN)`);
            }
        }
    }

    /**
     * ドロー交換を完了としてマーク
     */
    markDrawComplete(room: Room, playerId: string): void {
        if (!room.gameState.playersCompletedDraw) {
            room.gameState.playersCompletedDraw = [];
        }
        if (!room.gameState.playersCompletedDraw.includes(playerId)) {
            room.gameState.playersCompletedDraw.push(playerId);
        }
    }

    /**
     * ハンド終了処理
     */
    endHand(room: Room): void {
        console.log(`\n🏁 Hand #${room.gameState.handNumber} ended`);

        // 状態をSHOWDOWNに設定（クライアント通知用）
        room.gameState.status = 'SHOWDOWN' as any;
        room.activePlayerIndex = -1;
    }

    /**
     * 着席中のプレイヤーを取得
     */
    getSeatedPlayers(room: Room): Player[] {
        return room.players.filter(p =>
            p !== null &&
            p.stack > 0 &&
            (p.status === 'ACTIVE' || p.waitingForBB)
        ) as Player[];
    }

    /**
     * 現在のプレイヤーの有効なアクションを取得
     * ポーカールール:
     * - ベットがない（チェック可能）時はFOLDできない
     * - ベットに直面している時のみFOLD可能
     * - Fixed-Limit: キャップに達したらレイズ不可
     */
    getValidActions(room: Room, playerId: string): ActionType[] {
        const player = room.players.find(p => p?.socketId === playerId);
        if (!player) return [];

        const actions: ActionType[] = [];
        const variantConfig = getVariantConfig(room.gameState.gameVariant);

        // 他のアクティブなプレイヤー（ACTIVE状態のみ）を取得
        const otherActivePlayers = room.players.filter(p =>
            p !== null && p.socketId !== playerId && p.status === 'ACTIVE'
        );

        const callAmount = Math.max(0, room.gameState.currentBet - player.bet);

        // 基本アクション (CHECK vs FOLD/CALL)
        this.addBaseActions(actions, player, room.gameState.currentBet);

        // BET/RAISE
        if (this.canPlayerRaise(room, player, variantConfig, callAmount, otherActivePlayers)) {
            actions.push(room.gameState.currentBet === 0 ? 'BET' : 'RAISE');
        }

        // ALL-IN
        if (this.canPlayerAllIn(player, variantConfig, callAmount)) {
            actions.push('ALL_IN');
        }

        return actions;
    }

    /**
     * 基本アクション (CHECK vs FOLD/CALL) を追加
     */
    private addBaseActions(actions: ActionType[], player: RoomPlayer, currentBet: number): void {
        if (player.bet >= currentBet) {
            // ベットがない（または既にコール済み）→ チェック可能
            actions.push('CHECK');
        } else {
            // ベットに直面 → フォールドまたはコール
            actions.push('FOLD');
            actions.push('CALL');
        }
    }

    /**
     * BET/RAISE が可能かを判定
     */
    private canPlayerRaise(
        room: Room,
        player: RoomPlayer,
        variantConfig: any,
        callAmount: number,
        otherActivePlayers: any[]
    ): boolean {
        const canAffordRaise = player.stack > callAmount;

        // Fixed-Limit: キャップチェック
        const isCapped = variantConfig.betStructure === 'fixed' &&
            room.gameState.raisesThisRound >= this.getCapLimit(room);

        // 他にアクティブなプレイヤーがいない場合（全員ALL-INまたはフォールド）、レイズ不可
        return canAffordRaise && !isCapped && otherActivePlayers.length > 0;
    }

    /**
     * ALL-IN が可能かを判定
     */
    private canPlayerAllIn(player: RoomPlayer, variantConfig: any, callAmount: number): boolean {
        const wouldCallAllIn = callAmount >= player.stack;
        // No-Limitのみ、かつコールがALL-INにならない場合のみ表示
        return variantConfig.betStructure === 'no-limit' && !wouldCallAllIn && player.stack > 0;
    }

    /**
     * ベッティング情報を取得（クライアント用）
     * minBet, maxBet, betStructure などを返す
     */
    getBettingInfo(room: Room, playerId: string): {
        minBet: number;
        maxBet: number;
        betStructure: string;
        isCapped: boolean;
        raisesRemaining: number;
        fixedBetSize?: number;
    } {
        const player = room.players.find(p => p?.socketId === playerId);
        const variantConfig = getVariantConfig(room.gameState.gameVariant);

        if (!player) {
            return {
                minBet: 0,
                maxBet: 0,
                betStructure: variantConfig.betStructure,
                isCapped: false,
                raisesRemaining: 0
            };
        }

        const callAmount = Math.max(0, room.gameState.currentBet - player.bet);
        const minBetTo = this.getMinBetTo(room, player);

        // 最大ベット額の計算
        let maxBetTo: number;
        let fixedBetSize: number | undefined;

        switch (variantConfig.betStructure) {
            case 'pot-limit':
                maxBetTo = Math.min(
                    this.calculatePotLimitMax(room, player),
                    player.stack + player.bet
                );
                break;

            case 'fixed':
                // Fixed-Limit: Small Bet or Big Bet
                fixedBetSize = this.getFixedBetSize(room);
                maxBetTo = room.gameState.currentBet + fixedBetSize;
                // スタックが足りない場合は調整
                maxBetTo = Math.min(maxBetTo, player.stack + player.bet);
                break;

            default: // no-limit
                maxBetTo = player.stack + player.bet;
                break;
        }

        const capLimit = this.getCapLimit(room);
        const isCapped = variantConfig.betStructure === 'fixed' &&
            room.gameState.raisesThisRound >= capLimit;
        const raisesRemaining = Math.max(0, capLimit - room.gameState.raisesThisRound);

        return {
            minBet: minBetTo,
            maxBet: maxBetTo,
            betStructure: variantConfig.betStructure,
            isCapped,
            raisesRemaining,
            fixedBetSize
        };
    }

    /**
     * 最小ベット/レイズの「TO」値を取得
     */
    private getMinBetTo(room: Room, player: Player): number {
        const variantConfig = getVariantConfig(room.gameState.gameVariant);
        if (variantConfig.betStructure === 'fixed') {
            const fixedBetSize = this.getFixedBetSize(room);
            return room.gameState.currentBet === 0
                ? fixedBetSize
                : room.gameState.currentBet + fixedBetSize;
        }

        return room.gameState.currentBet === 0
            ? room.gameState.minRaise
            : room.gameState.currentBet + room.gameState.minRaise;
    }

    /**
     * Pot-Limitの最大ベット額を計算
     * 計算式: MaxBetTo = CurrentPot + (AmountToCall * 2)
     *
     * Note: pot.main には既に全てのベット（ブラインド含む）が含まれているため、
     * player.bet を追加すると二重カウントになる。
     */
    private calculatePotLimitMax(room: Room, player: Player): number {
        // 現在のポット（メイン + サイド）
        // pot.main には既にブラインドや今ラウンドのベットが含まれている
        let currentPot = room.gameState.pot.main;
        for (const sidePot of room.gameState.pot.side) {
            currentPot += sidePot.amount;
        }

        // コール額
        const amountToCall = Math.max(0, room.gameState.currentBet - player.bet);

        // Pot-Limit計算: コール後の仮想ポットまでレイズ可能
        // コール後のポット = currentPot + amountToCall
        // 最大レイズ = コール後のポット
        // MaxBetTo = amountToCall + (currentPot + amountToCall) = currentPot + 2*amountToCall
        const maxBetTo = currentPot + (amountToCall * 2);

        return maxBetTo;
    }

    /**
     * Fixed-Limitのベットサイズを取得
     * Small Bet: Preflop, Flop (または Stud 3rd-4th Street)
     * Big Bet: Turn, River (または Stud 5th-7th Street)
     */
    private getFixedBetSize(room: Room): number {
        const smallBet = room.config.bigBlind; // Small Bet = BB額
        const bigBet = smallBet * 2;           // Big Bet = 2x Small Bet

        const phase = room.gameState.status;
        const variantConfig = getVariantConfig(room.gameState.gameVariant);

        if (variantConfig.communityCardType === 'stud') {
            return this.getFixedBetSizeStud(phase, smallBet, bigBet);
        }

        if (variantConfig.hasDrawPhase) {
            return this.getFixedBetSizeDraw(room, variantConfig, phase, smallBet, bigBet);
        }

        return this.getFixedBetSizeFlop(room, smallBet, bigBet);
    }

    private getFixedBetSizeStud(phase: GamePhase, smallBet: number, bigBet: number): number {
        // Stud系: 5th Street以降はBig Bet
        if (phase === 'FIFTH_STREET' || phase === 'SIXTH_STREET' || phase === 'SEVENTH_STREET') {
            return bigBet;
        }
        return smallBet;
    }

    private getFixedBetSizeDraw(
        room: Room,
        variantConfig: any,
        phase: GamePhase,
        smallBet: number,
        bigBet: number
    ): number {
        const drawRounds = variantConfig.drawRounds || 3;
        // Phase-based判定（防御的）: statusを直接チェック
        // Triple Draw: PREDRAW, FIRST_DRAW = Small Bet, SECOND_DRAW, THIRD_DRAW = Big Bet
        if (phase === 'SECOND_DRAW' || phase === 'THIRD_DRAW' || phase === 'FOURTH_DRAW') {
            return bigBet;
        }
        // Fallback: street-based判定
        // ベッティングラウンド数 = drawRounds + 1 (predraw + 各ドロー後)
        // Big Betは後半から: Math.ceil((drawRounds+1) / 2)
        // 3ラウンド: street 2,3 = Big Bet (SECOND_DRAW, THIRD_DRAW)
        const bigBetStartStreet = Math.ceil((drawRounds + 1) / 2);
        if (room.gameState.street >= bigBetStartStreet) {
            return bigBet;
        }
        return smallBet;
    }

    private getFixedBetSizeFlop(room: Room, smallBet: number, bigBet: number): number {
        // Flop系: 後半のストリートはBig Bet
        // 標準[3,1,1]: street 2(Turn),3(River) = Big Bet
        // Ocean[3,1,1,1]: street 2(Turn),3(River),4(Ocean) = Big Bet
        if (room.gameState.street >= 2) {
            return bigBet;
        }
        return smallBet;
    }

    /**
     * Fixed-Limitのキャップ（レイズ上限回数）を取得
     * 通常: 4回（5-bet cap）
     * Heads-Up: 無制限（オプション）
     */
    private getCapLimit(room: Room): number {
        // Heads-Up（2人）の場合は無制限を許可するオプション
        // 現在は簡易版として常に4回とする
        const activePlayers = room.players.filter(p =>
            p !== null && (p.status === 'ACTIVE' || p.status === 'ALL_IN')
        ).length;

        // Heads-Up例外: 無制限（大きな数を返す）
        // TODO: 設定で ON/OFF 可能にする
        if (activePlayers === 2) {
            return 99; // 事実上無制限
        }

        return 4; // 5-bet cap (1 bet + 4 raises)
    }

    /**
     * デッキへの参照を取得（テスト用）
     */
    getDeck(): string[] {
        return this.deck;
    }

    /**
     * ALL IN時に残りのストリートを自動で配る
     */
    private dealToShowdown(room: Room): void {
        const phase = room.gameState.status;
        const variantConfig = getVariantConfig(room.gameState.gameVariant);

        if (variantConfig.communityCardType === 'stud') {
            // Stud: 残りのストリートを配る
            this.dealStudToShowdown(room, phase);
        } else if (variantConfig.hasDrawPhase) {
            // Draw: カード交換なしでそのままショーダウン
            console.log(`🔄 Auto-Showdown: No more draws`);
            room.gameState.status = 'SHOWDOWN' as any;
        } else {
            // Flop games: ボードを完成させる
            this.dealFlopToShowdown(room, phase);
        }
    }

    /**
     * Flop系ゲームのオートディール（全ボードカードを一気に配布）
     * boardPatternに基づいてデータ駆動
     */
    private dealFlopToShowdown(room: Room, phase: any): void {
        const variantConfig = getVariantConfig(room.gameState.gameVariant);
        const boardPattern = variantConfig.boardPattern || [3, 1, 1];
        const FLOP_PHASES = ['PREFLOP', 'FLOP', 'TURN', 'RIVER', 'OCEAN'];

        const currentStreet = room.gameState.street;

        // 残りのストリートを全て配布
        for (let streetIdx = currentStreet + 1; streetIdx <= boardPattern.length; streetIdx++) {
            const cardCount = boardPattern[streetIdx - 1];
            const newCards = this.dealer.dealBoardCards(this.deck, cardCount);
            room.gameState.board.push(...newCards);
            const phaseName = FLOP_PHASES[streetIdx] || `Street${streetIdx}`;
            console.log(`🃏 Auto-${phaseName}: ${newCards.join(' ')}`);
        }

        // 最後のフェーズに状態を設定
        const lastStreet = boardPattern.length;
        const lastPhase = FLOP_PHASES[lastStreet] || 'RIVER';
        if (currentStreet < lastStreet) {
            room.gameState.status = lastPhase as any;
            room.gameState.street = lastStreet;
        }
    }

    /**
     * Stud系ゲームのオートディール
     */
    private dealStudToShowdown(room: Room, phase: any): void {
        const phases = ['THIRD_STREET', 'FOURTH_STREET', 'FIFTH_STREET', 'SIXTH_STREET', 'SEVENTH_STREET'];
        let currentIdx = phases.indexOf(phase);

        // 3rd Street (PREFLOP)から始まる場合
        if (currentIdx === -1 && phase === 'PREFLOP') {
            currentIdx = 0;
        }

        // 残りのストリートを配る
        while (currentIdx < 4) { // 7th Streetまで
            currentIdx++;
            if (currentIdx <= 3) {
                // 4th-6th Street: up card
                this.dealer.dealStudStreet(this.deck, room.players, false);
                console.log(`🎴 Auto-${phases[currentIdx]}`);
            } else if (currentIdx === 4) {
                // 7th Street: down card
                this.dealer.dealStudStreet(this.deck, room.players, true);
                console.log(`🎴 Auto-7th Street (down)`);
            }
        }

        room.gameState.status = 'SEVENTH_STREET' as any;
    }

    /**
     * テスト用: privateメソッドへのアクセス
     */
    __testing__ = {
        processFold: (player: Player) => this.processFold(player as any),
        processCheck: (room: Room, player: Player) => this.processCheck(room, player as any),
        processCall: (room: Room, player: Player) => this.processCall(room, player as any),
        processBetOrRaise: (room: Room, player: Player, action: PlayerAction) =>
            this.processBetOrRaise(room, player as any, action),
        processAllIn: (room: Room, player: Player) => this.processAllIn(room, player as any),
        applyAction: (room: Room, player: Player, action: PlayerAction) =>
            this.applyAction(room, player as any, action),
        getMinBetTo: (room: Room, player: Player) => this.getMinBetTo(room, player),
        getFixedBetSize: (room: Room) => this.getFixedBetSize(room),
        calculatePotLimitMax: (room: Room, player: Player) => this.calculatePotLimitMax(room, player),
        getCapLimit: (room: Room) => this.getCapLimit(room),
        getPlayerCounts: (room: Room) => this.getPlayerCounts(room),
        checkEarlyHandEnd: (room: Room, playerCounts: any) => this.checkEarlyHandEnd(room, playerCounts),
        isRoundComplete: (room: Room, playerCounts: any) => this.isRoundComplete(room, playerCounts)
    };
}
