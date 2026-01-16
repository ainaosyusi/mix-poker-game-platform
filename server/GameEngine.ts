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

        // プレイヤーの状態をリセット
        for (const player of room.players) {
            if (player && player.stack > 0) {
                player.status = 'ACTIVE';
                player.hand = null;
                player.bet = 0;
                player.totalBet = 0;
                // Stud用のアップカードもクリア
                if (player.studUpCards) player.studUpCards = [];
            }
        }

        // ポットをリセット
        room.gameState.pot = { main: 0, side: [] };
        room.gameState.board = [];
        room.gameState.currentBet = 0;
        room.gameState.minRaise = room.config.bigBlind;
        room.gameState.raisesThisRound = 0; // レイズカウンタリセット

        // 最後のアグレッサーをリセット
        room.lastAggressorIndex = -1;

        // デッキを作成
        this.deck = this.dealer.createDeck();

        // ゲームバリアント取得
        const variantConfig = getVariantConfig(room.gameState.gameVariant);

        // ボタンを移動（ボタンありゲームのみ）
        if (variantConfig.hasButton) {
            this.dealer.moveButton(room);
        }

        // ブラインド徴収（ボタンありゲームのみ、Studはアンティ）
        let sbIndex = -1;
        let bbIndex = -1;
        if (variantConfig.hasButton) {
            const blinds = this.dealer.collectBlinds(room);
            sbIndex = blinds.sbIndex;
            bbIndex = blinds.bbIndex;
            room.gameState.currentBet = room.config.bigBlind;
        }

        // バリアントに応じたカード配布
        let bringInIndex = -1;
        if (variantConfig.communityCardType === 'stud') {
            // Stud: 3rd Street (2 down + 1 up)
            this.dealer.dealStudInitial(this.deck, room.players);
            room.gameState.status = 'THIRD_STREET' as any;
            room.gameState.street = 0;

            // Bring-In判定（Razzは最も強いカードがBring-In）
            const isRazz = room.gameState.gameVariant === 'RAZZ';
            bringInIndex = this.dealer.determineBringIn(room.players, isRazz);

            if (bringInIndex !== -1) {
                // Bring-In額: 設定値があればそれを使用、なければBB/5をデフォルト
                const bringInAmount = room.config.studAnte ?? Math.max(1, Math.floor(room.config.bigBlind / 5));
                this.dealer.collectBringIn(room, bringInIndex, bringInAmount);
                // Complete額 = Small Bet (BB額)
                // 3rd-4th Street: Small Bet = BB
                // 5th+ Street: Big Bet = 2*BB (getFixedBetSizeで処理)
                room.gameState.minRaise = room.config.bigBlind;
                room.gameState.currentBet = bringInAmount;
            }
        } else if (variantConfig.hasDrawPhase) {
            // Draw: 5枚配布（Badugiは4枚）
            this.dealer.dealHoleCards(this.deck, room.players, variantConfig.holeCardCount);
            room.gameState.status = 'PREDRAW' as any;
            room.gameState.street = 0;
        } else {
            // Flop games (NLH, PLO): ホールカード配布
            this.dealer.dealHoleCards(this.deck, room.players, variantConfig.holeCardCount);
            room.gameState.status = 'PREFLOP' as any;
            room.gameState.street = 0;
        }

        // アクティブプレイヤーを設定
        if (variantConfig.hasButton && bbIndex !== -1) {
            // ボタンありゲーム: BBの次から
            room.activePlayerIndex = this.dealer.getNextActivePlayer(room, bbIndex);
        } else if (bringInIndex !== -1) {
            // Stud: Bring-Inの次から（時計回り）
            room.activePlayerIndex = this.dealer.getNextActivePlayer(room, bringInIndex);
        } else {
            // フォールバック: 座席0から
            room.activePlayerIndex = this.dealer.getNextActivePlayer(room, -1);
        }

        // このストリートの開始プレイヤーを記録
        room.streetStarterIndex = room.activePlayerIndex;

        console.log(`✅ Hand started. Active player: seat ${room.activePlayerIndex}`);

        return true;
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

        switch (action.type) {
            case 'FOLD':
                player.status = 'FOLDED';
                break;

            case 'CHECK':
                if (player.bet < room.gameState.currentBet) {
                    return { success: false, error: 'Cannot check, must call or raise' };
                }
                break;

            case 'CALL':
                const callAmount = Math.min(room.gameState.currentBet - player.bet, player.stack);
                player.stack -= callAmount;
                player.bet += callAmount;
                player.totalBet += callAmount;
                room.gameState.pot.main += callAmount;
                if (player.stack === 0) {
                    player.status = 'ALL_IN';
                }
                break;

            case 'BET':
            case 'RAISE':
                const betAmount = action.amount || 0;
                const variantConfigBet = getVariantConfig(room.gameState.gameVariant);

                // Fixed-Limit: キャップチェック（5-bet cap = 4 raises）
                if (variantConfigBet.betStructure === 'fixed') {
                    const capLimit = this.getCapLimit(room);
                    if (room.gameState.raisesThisRound >= capLimit) {
                        return { success: false, error: 'Betting is capped' };
                    }
                }

                // 最小ベット額の計算
                // BET: minRaise（BB額）
                // RAISE: currentBet + minRaise（現在のベット + レイズ増分）
                const minTotal = room.gameState.currentBet === 0
                    ? room.gameState.minRaise  // BET: BB額
                    : room.gameState.currentBet + room.gameState.minRaise;  // RAISE: 2xBBまたはそれ以上

                const totalBet = player.bet + betAmount;

                if (totalBet < minTotal) {
                    return { success: false, error: `Minimum raise is ${minTotal}` };
                }
                if (betAmount > player.stack) {
                    return { success: false, error: 'Not enough chips' };
                }

                // Pot-Limit: 最大ベット額チェック
                if (variantConfigBet.betStructure === 'pot-limit') {
                    const maxPotBet = this.calculatePotLimitMax(room, player);
                    if (totalBet > maxPotBet) {
                        return { success: false, error: `Maximum bet is ${maxPotBet} (pot limit)` };
                    }
                }

                const raiseSize = totalBet - room.gameState.currentBet;

                player.stack -= betAmount;
                player.bet = totalBet;
                player.totalBet += betAmount;
                room.gameState.pot.main += betAmount;
                room.gameState.currentBet = totalBet;
                room.gameState.minRaise = raiseSize;

                // レイズカウンタを増加（BET/RAISE共に）
                room.gameState.raisesThisRound++;

                // アグレッシブアクション後、このプレイヤーがストリートを閉じる
                room.streetStarterIndex = room.activePlayerIndex;
                // 最後のアグレッサーを記録（ショーダウン順序用）
                room.lastAggressorIndex = room.activePlayerIndex;

                if (player.stack === 0) {
                    player.status = 'ALL_IN';
                }
                break;

            case 'ALL_IN':
                const allInAmount = player.stack;
                const newTotal = player.bet + allInAmount;

                player.bet = newTotal;
                player.totalBet += allInAmount;
                player.stack = 0;
                player.status = 'ALL_IN';
                room.gameState.pot.main += allInAmount;

                if (newTotal > room.gameState.currentBet) {
                    room.gameState.minRaise = newTotal - room.gameState.currentBet;
                    room.gameState.currentBet = newTotal;
                    // レイズを含むALL_INの場合、このプレイヤーがストリートを閉じる
                    room.streetStarterIndex = room.activePlayerIndex;
                    // 最後のアグレッサーを記録
                    room.lastAggressorIndex = room.activePlayerIndex;
                }
                break;
        }

        // 次のプレイヤーに移動
        this.advanceAction(room);

        return { success: true };
    }

    /**
     * 次のプレイヤーに進む、またはストリートを進める
     */
    private advanceAction(room: Room): void {
        // アクティブプレイヤー（FOLDED/ALL_IN以外）を取得
        const actionablePlayers = room.players.filter(p =>
            p !== null && p.status === 'ACTIVE'
        );

        // アクション可能なプレイヤーとALL INプレイヤーを取得
        const allInPlayers = room.players.filter(p =>
            p !== null && p.status === 'ALL_IN'
        );

        const remainingPlayers = room.players.filter(p =>
            p !== null && (p.status === 'ACTIVE' || p.status === 'ALL_IN')
        );

        // 1人以下なら終了
        if (remainingPlayers.length <= 1) {
            this.endHand(room);
            return;
        }

        // 全員ALL INの場合、自動的にリバーまで進めてショーダウン
        if (actionablePlayers.length === 0 && allInPlayers.length >= 2) {
            console.log('💥 All players ALL IN - auto-dealing to showdown');
            // ランアウト情報を記録（クライアントがアニメーション表示に使用）
            room.gameState.isRunout = true;
            room.gameState.runoutPhase = room.gameState.status;
            this.dealToShowdown(room);
            this.endHand(room);
            return;
        }

        // 1人だけアクティブで他がALL-INの場合、そのプレイヤーがコールしたらランアウト
        // (相手がオールインでショートスタックの場合など)
        if (actionablePlayers.length === 1 && allInPlayers.length >= 1) {
            const activePlayer = actionablePlayers[0]!;
            // 全員のベットが揃っている場合、ランアウトへ
            const allBetsMatched = activePlayer.bet >= room.gameState.currentBet;
            if (allBetsMatched) {
                console.log('💥 One active player matched all-in bet - running out');
                room.gameState.isRunout = true;
                room.gameState.runoutPhase = room.gameState.status;
                this.dealToShowdown(room);
                this.endHand(room);
                return;
            }
        }

        // アクション可能なプレイヤーが0人の場合（全員ALL_INまたはフォールド）
        // 残りプレイヤーが1人以下なら終了（勝者確定）
        if (actionablePlayers.length === 0) {
            // 1人のALL_INプレイヤーが残っている場合はそのまま終了
            this.endHand(room);
            return;
        }

        // 全員のベットが揃っているかチェック
        const allBetsEqual = actionablePlayers.every(p =>
            p!.bet === room.gameState.currentBet || p!.stack === 0
        );

        // 次のアクティブプレイヤーを探す
        const nextIndex = this.dealer.getNextActivePlayer(room, room.activePlayerIndex);

        // streetStarterがまだアクティブかチェック
        const streetStarter = room.players[room.streetStarterIndex];
        const streetStarterIsActive = streetStarter?.status === 'ACTIVE';

        // ラウンド終了判定
        let roundComplete = false;

        if (allBetsEqual) {
            if (streetStarterIsActive) {
                // 通常ケース: streetStarterに戻ったら完了
                roundComplete = nextIndex === room.streetStarterIndex;
            } else {
                // streetStarterがALL_INまたはフォールドの場合
                // 全員のベットが揃っていれば、アクティブプレイヤーが一周したとみなす
                // 次のプレイヤーが現在のプレイヤーと同じ（1人だけ）か、-1なら完了
                roundComplete = nextIndex === -1 ||
                    nextIndex === room.activePlayerIndex ||
                    actionablePlayers.length === 1;
            }
        }

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
     * 次のストリートに進む
     */
    nextStreet(room: Room): void {
        // ベットをリセット
        for (const player of room.players) {
            if (player) {
                player.bet = 0;
            }
        }
        room.gameState.currentBet = 0;
        room.gameState.minRaise = room.config.bigBlind;
        room.gameState.raisesThisRound = 0; // レイズカウンタリセット

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

        // ストリート進行後、再度ALL INチェック
        const actionablePlayers = room.players.filter(p =>
            p !== null && p.status === 'ACTIVE'
        );

        const allInPlayers = room.players.filter(p =>
            p !== null && p.status === 'ALL_IN'
        );

        // SHOWDOWNに到達した場合はリターン
        if (room.gameState.status === 'SHOWDOWN') {
            return;
        }

        // 全員ALL INなら自動的に次へ進む
        if (actionablePlayers.length === 0 && allInPlayers.length >= 2) {
            console.log('💥 All players still ALL IN - continuing auto-deal');
            this.nextStreet(room);
            return;
        }

        // アクション可能なプレイヤーが1人で、相手が全員ALL-INの場合
        // その1人は誰にも対抗できないので、ランアウトで残りのカードを配る
        if (actionablePlayers.length === 1 && allInPlayers.length >= 1) {
            console.log('💥 Only one active player vs all-in - running out');
            // ランアウト情報を記録（クライアントがアニメーション表示に使用）
            room.gameState.isRunout = true;
            room.gameState.runoutPhase = room.gameState.status;
            this.dealToShowdown(room);
            this.endHand(room);
            return;
        }

        // ボタンの次のアクティブプレイヤーから開始（Studは別ロジック）
        if (variantConfig.hasButton) {
            room.activePlayerIndex = this.dealer.getNextActivePlayer(room, room.dealerBtnIndex);
        } else {
            // Stud: 最強/最弱のアップカードを持つプレイヤーから（簡易版: 座席0から）
            room.activePlayerIndex = this.dealer.getNextActivePlayer(room, -1);
        }
        // 新しいストリートの開始プレイヤーを記録
        room.streetStarterIndex = room.activePlayerIndex;
    }

    /**
     * Flop系ゲーム（NLH, PLO）のストリート進行
     */
    private nextFlopStreet(room: Room, phase: any): void {
        switch (phase) {
            case 'PREFLOP':
                room.gameState.status = 'FLOP' as any;
                room.gameState.board = this.dealer.dealFlop(this.deck);
                room.gameState.street = 1;
                console.log(`🃏 Flop: ${room.gameState.board.join(' ')}`);
                break;

            case 'FLOP':
                room.gameState.status = 'TURN' as any;
                room.gameState.board.push(this.dealer.dealTurn(this.deck));
                room.gameState.street = 2;
                console.log(`🃏 Turn: ${room.gameState.board[3]}`);
                break;

            case 'TURN':
                room.gameState.status = 'RIVER' as any;
                room.gameState.board.push(this.dealer.dealRiver(this.deck));
                room.gameState.street = 3;
                console.log(`🃏 River: ${room.gameState.board[4]}`);
                break;

            case 'RIVER':
                room.gameState.status = 'SHOWDOWN' as any;
                room.gameState.street = 4;
                this.endHand(room);
                break;
        }
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
        // ベッティング完了後、ドロー交換フェーズに入る
        // 最後のラウンド（THIRD_DRAW）はそのままショーダウンへ
        switch (phase) {
            case 'PREFLOP': // 便宜上PREFLOPとして開始
            case 'PREDRAW':
                // PREDRAW ベッティング完了 → 1st Draw 交換フェーズへ
                room.gameState.status = 'FIRST_DRAW' as any;
                room.gameState.street = 1;
                room.gameState.isDrawPhase = true;
                room.gameState.playersCompletedDraw = [];
                this.autoCompleteAllInDraws(room);
                console.log(`🔄 First Draw exchange phase - waiting for players to draw`);
                break;

            case 'FIRST_DRAW':
                // FIRST_DRAW ベッティング完了 → 2nd Draw 交換フェーズへ
                room.gameState.status = 'SECOND_DRAW' as any;
                room.gameState.street = 2;
                room.gameState.isDrawPhase = true;
                room.gameState.playersCompletedDraw = [];
                this.autoCompleteAllInDraws(room);
                console.log(`🔄 Second Draw exchange phase - waiting for players to draw`);
                break;

            case 'SECOND_DRAW':
                // SECOND_DRAW ベッティング完了 → 3rd Draw 交換フェーズへ
                room.gameState.status = 'THIRD_DRAW' as any;
                room.gameState.street = 3;
                room.gameState.isDrawPhase = true;
                room.gameState.playersCompletedDraw = [];
                this.autoCompleteAllInDraws(room);
                console.log(`🔄 Third Draw exchange phase - waiting for players to draw`);
                break;

            case 'THIRD_DRAW':
                // THIRD_DRAW ベッティング完了 → ショーダウン
                room.gameState.status = 'SHOWDOWN' as any;
                room.gameState.street = 4;
                room.gameState.isDrawPhase = false;
                this.endHand(room);
                break;
        }
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
            room.gameState.minRaise = room.config.bigBlind;
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
            p !== null && p.stack > 0
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

        // コール額を計算
        const callAmount = Math.max(0, room.gameState.currentBet - player.bet);
        const wouldCallAllIn = callAmount >= player.stack;

        if (player.bet >= room.gameState.currentBet) {
            // ベットがない（または既にコール済み）→ チェック可能、フォールド不可
            actions.push('CHECK');
        } else {
            // ベットに直面 → フォールドまたはコール
            actions.push('FOLD');
            actions.push('CALL');
        }

        // BET/RAISEの可否判定
        const canAffordRaise = player.stack > callAmount;

        // Fixed-Limit: キャップチェック
        const isCapped = variantConfig.betStructure === 'fixed' &&
            room.gameState.raisesThisRound >= this.getCapLimit(room);

        // 他にアクティブなプレイヤーがいない場合（全員ALL-INまたはフォールド）、レイズ不可
        const canRaise = canAffordRaise && !isCapped && otherActivePlayers.length > 0;

        if (canRaise) {
            if (room.gameState.currentBet === 0) {
                actions.push('BET');
            } else {
                actions.push('RAISE');
            }
        }

        // ALL-IN: No-Limitのみ、かつコールがALL-INにならない場合のみ表示
        // （コールがALL-INになる場合は、CALLを選べばALL-INになる）
        if (variantConfig.betStructure === 'no-limit' && !wouldCallAllIn && player.stack > 0) {
            actions.push('ALL_IN');
        }

        return actions;
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

        // 最小ベット額（TO値）
        const minBetTo = room.gameState.currentBet === 0
            ? room.gameState.minRaise
            : room.gameState.currentBet + room.gameState.minRaise;

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

        // Stud系: 5th Street以降はBig Bet
        if (variantConfig.communityCardType === 'stud') {
            if (phase === 'FIFTH_STREET' || phase === 'SIXTH_STREET' || phase === 'SEVENTH_STREET') {
                return bigBet;
            }
            return smallBet;
        }

        // Draw系: 2nd Draw以降はBig Bet
        if (variantConfig.hasDrawPhase) {
            if (phase === 'SECOND_DRAW' || phase === 'THIRD_DRAW') {
                return bigBet;
            }
            return smallBet;
        }

        // Flop系: Turn/River はBig Bet
        if (phase === 'TURN' || phase === 'RIVER') {
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
     * Flop系ゲームのオートディール
     */
    private dealFlopToShowdown(room: Room, phase: any): void {
        if (phase === 'PREFLOP') {
            room.gameState.board = this.dealer.dealFlop(this.deck);
            console.log(`🃏 Auto-Flop: ${room.gameState.board.join(' ')}`);
            room.gameState.board.push(this.dealer.dealTurn(this.deck));
            console.log(`🃏 Auto-Turn: ${room.gameState.board[3]}`);
            room.gameState.board.push(this.dealer.dealRiver(this.deck));
            console.log(`🃏 Auto-River: ${room.gameState.board[4]}`);
        } else if (phase === 'FLOP') {
            room.gameState.board.push(this.dealer.dealTurn(this.deck));
            console.log(`🃏 Auto-Turn: ${room.gameState.board[3]}`);
            room.gameState.board.push(this.dealer.dealRiver(this.deck));
            console.log(`🃏 Auto-River: ${room.gameState.board[4]}`);
        } else if (phase === 'TURN') {
            room.gameState.board.push(this.dealer.dealRiver(this.deck));
            console.log(`🃏 Auto-River: ${room.gameState.board[4]}`);
        }
        // RIVERの場合はそのまま（既にボードは完成している）
        // それ以外は状態をRIVERに設定
        if (phase !== 'RIVER') {
            room.gameState.status = 'RIVER' as any;
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
}
