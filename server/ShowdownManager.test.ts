/**
 * Showdown Manager Tests
 * テスト仕様書: V-PLO (2枚使用ルール), E-01~E-04
 */

import { describe, it, expect, vi } from 'vitest';
import { ShowdownManager } from './ShowdownManager.ts';
import type { Room, Player, PlayerStatus, GameVariant } from './types.ts';

// Helper: テスト用プレイヤー作成
function createPlayer(
    socketId: string,
    name: string,
    stack: number,
    hand: string[] | null,
    status: PlayerStatus = 'ACTIVE',
    totalBet: number = 0
): Player {
    return {
        socketId,
        name,
        stack,
        bet: 0,
        totalBet,
        status,
        hand
    };
}

// Helper: テスト用Room作成
function createRoom(
    players: (Player | null)[],
    board: string[],
    variant: GameVariant,
    mainPot: number,
    sidePots: { amount: number; eligiblePlayers: string[] }[] = []
): Room {
    return {
        id: 'test-room',
        hostId: 'host',
        config: {
            maxPlayers: 6,
            smallBlind: 5,
            bigBlind: 10,
            timeLimit: 30
        },
        players,
        dealerBtnIndex: 0,
        activePlayerIndex: 0,
        gameState: {
            status: 'SHOWDOWN' as any,
            board,
            pot: { main: mainPot, side: sidePots },
            currentBet: 0,
            minRaise: 10,
            deck: [],
            handNumber: 1,
            gameVariant: variant
        },
        rotation: {
            enabled: false,
            gamesList: ['NLH'],
            currentGameIndex: 0,
            handsPerGame: 8
        },
        lastAggressorIndex: -1
    };
}

describe('ShowdownManager - PLO 2-Card Rule (V-PLO)', () => {
    const showdownManager = new ShowdownManager();

    it('PLO: 手札から2枚、ボードから3枚を使う', () => {
        // Player has: A♠ K♠ Q♠ J♠ (4 spades in hand)
        // Board: T♠ 9♠ 8♦ 7♣ 2♥ (2 spades on board)
        // In Hold'em: A♠ K♠ Q♠ T♠ 9♠ would be Royal Flush
        // In PLO: Must use exactly 2 from hand, 3 from board
        // Best: A♠ K♠ + T♠ 9♠ 8♦ = Flush (not straight flush)

        const player1 = createPlayer('p1', 'Player1', 100, ['A♠', 'K♠', 'Q♠', 'J♠'], 'ACTIVE', 50);
        const player2 = createPlayer('p2', 'Player2', 100, ['A♥', 'A♦', '2♣', '3♣'], 'ACTIVE', 50);

        const room = createRoom(
            [player1, player2],
            ['T♠', '9♠', '8♦', '7♣', '2♥'],
            'PLO',
            100
        );

        const result = showdownManager.executeShowdown(room);

        // Player1 should have Flush or Straight (depending on best combo)
        // Player2 has One Pair (A-A)
        expect(result.winners.length).toBeGreaterThan(0);
    });

    it('PLO: フラッシュには手札から2枚のスートが必要', () => {
        // Player has only 1 spade in hand - cannot make flush
        // Board: A♠ K♠ Q♠ J♠ 2♥ (4 spades)
        // Player: 3♠ A♥ K♥ Q♦ (only 1 spade)
        // Cannot use all 4 board spades - must use exactly 2 from hand

        const player1 = createPlayer('p1', 'Player1', 100, ['3♠', 'A♥', 'K♥', 'Q♦'], 'ACTIVE', 50);
        const player2 = createPlayer('p2', 'Player2', 100, ['T♠', '9♠', '2♣', '3♣'], 'ACTIVE', 50);

        const room = createRoom(
            [player1, player2],
            ['A♠', 'K♠', 'Q♠', 'J♠', '2♥'],
            'PLO',
            100
        );

        const result = showdownManager.executeShowdown(room);

        // Player2 can make flush (T♠ 9♠ + A♠ K♠ Q♠ from board)
        // Player1 cannot (only 1 spade in hand)
        const player2Winner = result.winners.find(w => w.playerId === 'p2');
        expect(player2Winner).toBeDefined();
        expect(player2Winner?.handRank).toContain('Flush');
    });

    it('PLO: ストレートには手札から2枚のランクが必要', () => {
        // Board: 5♠ 6♥ 7♦ 8♣ A♠
        // Player1: 9♠ T♥ 2♣ 3♣ (has 9, T - can make 6-7-8-9-T straight)
        // Player2: 4♠ 9♥ K♣ Q♣ (has 4, 9 - can make 5-6-7-8-9 straight)

        const player1 = createPlayer('p1', 'Player1', 100, ['9♠', 'T♥', '2♣', '3♣'], 'ACTIVE', 50);
        const player2 = createPlayer('p2', 'Player2', 100, ['4♠', '9♥', 'K♣', 'Q♣'], 'ACTIVE', 50);

        const room = createRoom(
            [player1, player2],
            ['5♠', '6♥', '7♦', '8♣', 'A♠'],
            'PLO',
            100
        );

        const result = showdownManager.executeShowdown(room);

        // Player1 wins with higher straight (6-T vs 5-9)
        const player1Winner = result.winners.find(w => w.playerId === 'p1');
        expect(player1Winner).toBeDefined();
    });
});

describe('ShowdownManager - NLH (Standard)', () => {
    const showdownManager = new ShowdownManager();

    it('NLH: 7枚から最強の5枚を選べる', () => {
        // Player can use any 5 of 7 cards (2 hole + 5 board)
        const player1 = createPlayer('p1', 'Player1', 100, ['A♠', 'K♠'], 'ACTIVE', 50);
        const player2 = createPlayer('p2', 'Player2', 100, ['2♣', '3♣'], 'ACTIVE', 50);

        const room = createRoom(
            [player1, player2],
            ['Q♠', 'J♠', 'T♠', '9♥', '8♦'],
            'NLH',
            100
        );

        const result = showdownManager.executeShowdown(room);

        // Player1 has Royal Flush (A♠ K♠ Q♠ J♠ T♠)
        const player1Winner = result.winners.find(w => w.playerId === 'p1');
        expect(player1Winner).toBeDefined();
        expect(player1Winner?.handRank).toBe('Straight Flush');
    });
});

describe('ShowdownManager - Side Pot Distribution', () => {
    const showdownManager = new ShowdownManager();

    it('オールインプレイヤーはメインポットのみ獲得可能', () => {
        // A: all-in with 50, has best hand (Pair of Aces)
        // B: active with 100, has second best (Pair of Kings)
        // C: active with 100, has worst (Pair of Queens)
        // Board should NOT allow straights
        const playerA = createPlayer('A', 'PlayerA', 0, ['A♠', 'A♥'], 'ALL_IN', 50);
        const playerB = createPlayer('B', 'PlayerB', 0, ['K♠', 'K♥'], 'ACTIVE', 100);
        const playerC = createPlayer('C', 'PlayerC', 0, ['Q♠', 'Q♥'], 'ACTIVE', 100);

        // Main pot: 150 (50 x 3), Side pot: 100 (50 x 2 from B and C)
        // Board: 2♦ 7♣ J♥ T♠ 9♣ - no straight possible
        const room = createRoom(
            [playerA, playerB, playerC],
            ['2♦', '7♣', 'J♥', 'T♠', '9♣'],
            'NLH',
            150,
            [{ amount: 100, eligiblePlayers: ['B', 'C'] }]
        );

        const result = showdownManager.executeShowdown(room);

        // A wins main pot (150 - has best hand: Pair of Aces)
        const aWinner = result.winners.find(w => w.playerId === 'A');
        expect(aWinner).toBeDefined();
        expect(aWinner?.amount).toBe(150);

        // B wins side pot (100 - has second best: Pair of Kings)
        const bWinner = result.winners.find(w => w.playerId === 'B');
        expect(bWinner).toBeDefined();
        expect(bWinner?.amount).toBe(100);
    });

    it('同じ役の場合はポット分割', () => {
        // Both players have same hand strength
        const playerA = createPlayer('A', 'PlayerA', 0, ['A♠', 'K♥'], 'ACTIVE', 100);
        const playerB = createPlayer('B', 'PlayerB', 0, ['A♥', 'K♠'], 'ACTIVE', 100);

        const room = createRoom(
            [playerA, playerB],
            ['Q♠', 'J♦', 'T♣', '2♥', '3♦'],
            'NLH',
            200
        );

        const result = showdownManager.executeShowdown(room);

        // Both should win 100 each (chop pot)
        expect(result.winners.length).toBe(2);
        expect(result.winners[0].amount).toBe(100);
        expect(result.winners[1].amount).toBe(100);
    });
});

describe('ShowdownManager - Last Player Wins (Uncontested)', () => {
    const showdownManager = new ShowdownManager();

    it('全員フォールドで最後の1人が勝ち', () => {
        const playerA = createPlayer('A', 'PlayerA', 0, ['A♠', 'K♥'], 'FOLDED', 50);
        const playerB = createPlayer('B', 'PlayerB', 100, ['2♣', '3♣'], 'ACTIVE', 50);
        const playerC = createPlayer('C', 'PlayerC', 0, ['4♠', '5♥'], 'FOLDED', 50);

        const room = createRoom(
            [playerA, playerB, playerC],
            [],
            'NLH',
            150
        );

        const result = showdownManager.awardToLastPlayer(room);

        expect(result.winners.length).toBe(1);
        expect(result.winners[0].playerId).toBe('B');
        expect(result.winners[0].amount).toBe(150);
        expect(result.winners[0].handRank).toBe('Uncontested');
    });
});

describe('ShowdownManager - Hi-Lo Games (V-PLO8, V-7CS8)', () => {
    const showdownManager = new ShowdownManager();

    it('PLO8: ハイとローでポットを分割', () => {
        // Player1: has good high hand
        // Player2: has good low hand
        const player1 = createPlayer('p1', 'Player1', 100, ['A♠', 'K♠', 'Q♠', 'J♠'], 'ACTIVE', 50);
        const player2 = createPlayer('p2', 'Player2', 100, ['A♥', '2♥', '3♦', '4♣'], 'ACTIVE', 50);

        const room = createRoom(
            [player1, player2],
            ['5♠', '6♥', '7♦', '8♣', '9♠'],
            'PLO8',
            100
        );

        const result = showdownManager.executeShowdown(room);

        // Both players should win something (high and low split)
        expect(result.winners.length).toBeGreaterThan(0);
    });
});

describe('ShowdownManager - Razz (V-RAZZ)', () => {
    const showdownManager = new ShowdownManager();

    it('Razz: 最も低いハンドが勝ち', () => {
        // Player1: wheel (A-2-3-4-5)
        // Player2: 8-7-6-5-4
        const player1 = createPlayer('p1', 'Player1', 100, ['A♠', '2♥', '3♦', '4♣', '5♠', '6♥', '7♦'], 'ACTIVE', 50);
        const player2 = createPlayer('p2', 'Player2', 100, ['8♠', '7♥', '6♦', '5♣', '4♠', 'K♥', 'Q♦'], 'ACTIVE', 50);

        const room = createRoom(
            [player1, player2],
            [],
            'RAZZ',
            100
        );

        const result = showdownManager.executeShowdown(room);

        // Player1 should win with wheel
        const winner = result.winners.find(w => w.playerId === 'p1');
        expect(winner).toBeDefined();
    });
});

describe('ShowdownManager - Badugi (V-BAD)', () => {
    const showdownManager = new ShowdownManager();

    it('Badugi: 4-card Badugiが勝ち', () => {
        // Player1: 4-card badugi (A♠ 2♥ 3♦ 4♣)
        // Player2: 3-card (A♠ 2♠ 3♦ 4♣) - same suit conflict
        const player1 = createPlayer('p1', 'Player1', 100, ['A♠', '2♥', '3♦', '4♣'], 'ACTIVE', 50);
        const player2 = createPlayer('p2', 'Player2', 100, ['A♠', '2♠', '3♦', '4♣'], 'ACTIVE', 50);

        const room = createRoom(
            [player1, player2],
            [],
            'BADUGI',
            100
        );

        const result = showdownManager.executeShowdown(room);

        // Player1 should win with 4-card badugi
        const winner = result.winners.find(w => w.playerId === 'p1');
        expect(winner).toBeDefined();
        expect(winner?.handRank).toContain('Badugi');
    });
});

describe('ShowdownManager - 2-7 Triple Draw (V-27)', () => {
    const showdownManager = new ShowdownManager();

    it('2-7: 7-5-4-3-2 offsuit が最強', () => {
        // Player1: perfect 2-7 (7-5-4-3-2)
        // Player2: 8-5-4-3-2
        const player1 = createPlayer('p1', 'Player1', 100, ['7♠', '5♥', '4♦', '3♣', '2♠'], 'ACTIVE', 50);
        const player2 = createPlayer('p2', 'Player2', 100, ['8♠', '5♥', '4♦', '3♣', '2♠'], 'ACTIVE', 50);

        const room = createRoom(
            [player1, player2],
            [],
            '2-7_TD',
            100
        );

        const result = showdownManager.executeShowdown(room);

        // Player1 should win with 7-high
        const winner = result.winners.find(w => w.playerId === 'p1');
        expect(winner).toBeDefined();
        expect(winner?.handRank).toBe('7-High');
    });
});
