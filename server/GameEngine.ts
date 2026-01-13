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
            }
        }

        // ポットをリセット
        room.gameState.pot = { main: 0, side: [] };
        room.gameState.board = [];
        room.gameState.currentBet = 0;
        room.gameState.minRaise = room.config.bigBlind;

        // デッキを作成
        this.deck = this.dealer.createDeck();

        // ボタンを移動
        this.dealer.moveButton(room);

        // ブラインド徴収
        const { sbIndex, bbIndex } = this.dealer.collectBlinds(room);
        room.gameState.currentBet = room.config.bigBlind;

        // ホールカードを配布（バリアントに応じた枚数）
        const variantConfig = getVariantConfig(room.gameState.gameVariant);
        const holeCardCount = variantConfig.communityCardType === 'flop' ? variantConfig.holeCardCount : 2;
        this.dealer.dealHoleCards(this.deck, room.players, holeCardCount);

        // フェーズをPREFLOPに
        room.gameState.status = 'PREFLOP' as any; // GameStatus -> GamePhase

        // アクティブプレイヤーを設定（BBの次から）
        room.activePlayerIndex = this.dealer.getNextActivePlayer(room, bbIndex);

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
                if (betAmount < room.gameState.minRaise) {
                    return { success: false, error: `Minimum bet is ${room.gameState.minRaise}` };
                }
                if (betAmount > player.stack) {
                    return { success: false, error: 'Not enough chips' };
                }

                const totalBet = player.bet + betAmount;
                const raiseSize = totalBet - room.gameState.currentBet;

                player.stack -= betAmount;
                player.bet = totalBet;
                player.totalBet += betAmount;
                room.gameState.pot.main += betAmount;
                room.gameState.currentBet = totalBet;
                room.gameState.minRaise = raiseSize;

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
            this.dealToShowdown(room);
            this.endHand(room);
            return;
        }

        // アクション可能なプレイヤーが1人以下なら終了
        if (actionablePlayers.length <= 1) {
            this.endHand(room);
            return;
        }

        // 全員のベットが揃っているかチェック
        const allBetsEqual = actionablePlayers.every(p =>
            p!.bet === room.gameState.currentBet || p!.stack === 0
        );

        // 次のアクティブプレイヤーを探す
        const nextIndex = this.dealer.getNextActivePlayer(room, room.activePlayerIndex);

        // ラウンド終了判定：全員ベットが揃って一周した
        if (allBetsEqual && nextIndex !== -1) {
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

        const phase = room.gameState.status;

        switch (phase) {
            case 'PREFLOP':
                room.gameState.status = 'FLOP' as any;
                room.gameState.board = this.dealer.dealFlop(this.deck);
                console.log(`🃏 Flop: ${room.gameState.board.join(' ')}`);
                break;

            case 'FLOP':
                room.gameState.status = 'TURN' as any;
                room.gameState.board.push(this.dealer.dealTurn(this.deck));
                console.log(`🃏 Turn: ${room.gameState.board[3]}`);
                break;

            case 'TURN':
                room.gameState.status = 'RIVER' as any;
                room.gameState.board.push(this.dealer.dealRiver(this.deck));
                console.log(`🃏 River: ${room.gameState.board[4]}`);
                break;

            case 'RIVER':
                room.gameState.status = 'SHOWDOWN' as any;
                this.endHand(room);
                return;
        }

        // ストリート進行後、再度ALL INチェック
        const actionablePlayers = room.players.filter(p =>
            p !== null && p.status === 'ACTIVE'
        );

        const allInPlayers = room.players.filter(p =>
            p !== null && p.status === 'ALL_IN'
        );

        // 全員ALL INなら自動的に次へ進む
        if (actionablePlayers.length === 0 && allInPlayers.length >= 2) {
            console.log('💥 All players still ALL IN - continuing auto-deal');
            this.nextStreet(room);
            return;
        }

        // ボタンの次のアクティブプレイヤーから開始
        room.activePlayerIndex = this.dealer.getNextActivePlayer(room, room.dealerBtnIndex);
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
     */
    getValidActions(room: Room, playerId: string): ActionType[] {
        const player = room.players.find(p => p?.socketId === playerId);
        if (!player) return [];

        const actions: ActionType[] = ['FOLD'];

        if (player.bet >= room.gameState.currentBet) {
            actions.push('CHECK');
        } else {
            actions.push('CALL');
        }

        if (player.stack > room.gameState.currentBet - player.bet) {
            if (room.gameState.currentBet === 0) {
                actions.push('BET');
            } else {
                actions.push('RAISE');
            }
        }

        actions.push('ALL_IN');

        return actions;
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

        // 現在のフェーズから順にリバーまで配る
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

        room.gameState.status = 'RIVER' as any;
    }
}
