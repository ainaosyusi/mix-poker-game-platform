/**
 * Pot Manager Tests
 * テスト仕様書: SP-01 ~ SP-05 (サイドポット)
 */

import { describe, it, expect } from 'vitest';
import { PotManager } from './PotManager.js';
import type { Player, PlayerStatus } from './types.js';

// Helper: テスト用プレイヤー作成
function createPlayer(
    socketId: string,
    stack: number,
    totalBet: number,
    status: PlayerStatus = 'ACTIVE'
): Player {
    return {
        socketId,
        name: socketId,
        stack,
        bet: 0,
        totalBet,
        status,
        hand: null
    };
}

describe('PotManager - Side Pot Calculation (SP-01~SP-05)', () => {
    const potManager = new PotManager();

    describe('SP-01: 基本サイドポット', () => {
        it('オールイン時のサイドポット生成', () => {
            // Player A: stack 100, all-in with 100
            // Player B: stack 500, bet 200
            // Player C: stack 500, bet 200
            const players = [
                createPlayer('A', 0, 100, 'ALL_IN'),
                createPlayer('B', 300, 200, 'ACTIVE'),
                createPlayer('C', 300, 200, 'ACTIVE')
            ];

            const pots = potManager.calculatePots(players);

            // Main pot: 100 x 3 = 300 (A, B, C eligible)
            // Side pot: 100 x 2 = 200 (B, C eligible)
            expect(pots.main).toBe(300);
            expect(pots.side.length).toBe(1);
            expect(pots.side[0].amount).toBe(200);
            expect(pots.side[0].eligiblePlayers).toContain('B');
            expect(pots.side[0].eligiblePlayers).toContain('C');
            expect(pots.side[0].eligiblePlayers).not.toContain('A');
        });
    });

    describe('SP-02: 複数サイドポット', () => {
        it('3人異なるスタックでオールイン', () => {
            // Player A: all-in with 50
            // Player B: all-in with 100
            // Player C: bet 200
            const players = [
                createPlayer('A', 0, 50, 'ALL_IN'),
                createPlayer('B', 0, 100, 'ALL_IN'),
                createPlayer('C', 100, 200, 'ACTIVE')
            ];

            const pots = potManager.calculatePots(players);

            // Main pot: 50 x 3 = 150 (A, B, C)
            // Side pot 1: 50 x 2 = 100 (B, C)
            // Side pot 2: 100 x 1 = 100 (C only)
            expect(pots.main).toBe(150);
            expect(pots.side.length).toBe(2);

            const sidePot1 = pots.side.find(p => p.eligiblePlayers.length === 2);
            const sidePot2 = pots.side.find(p => p.eligiblePlayers.length === 1);

            expect(sidePot1?.amount).toBe(100);
            expect(sidePot2?.amount).toBe(100);
        });
    });

    describe('SP-03: サイドポット勝者判定', () => {
        it('メインポットとサイドポットの正しい分配', () => {
            // A が50でオールイン、B, Cが100ずつ
            const players = [
                createPlayer('A', 0, 50, 'ALL_IN'),
                createPlayer('B', 0, 100, 'ACTIVE'),
                createPlayer('C', 0, 100, 'ACTIVE')
            ];

            const pots = potManager.calculatePots(players);

            // Aがメインポット勝利、Bがサイドポット勝利
            const distributions = potManager.distributePots(pots, [
                { playerId: 'A', rank: 1 } // A wins main
            ]);

            // A should get main pot (150)
            const aWin = distributions.find(d => d.playerId === 'A');
            expect(aWin?.amount).toBe(150);
        });

        it('サイドポット勝者がメインも取れる', () => {
            const players = [
                createPlayer('A', 0, 50, 'ALL_IN'),
                createPlayer('B', 0, 100, 'ACTIVE'),
                createPlayer('C', 0, 100, 'ACTIVE')
            ];

            const pots = potManager.calculatePots(players);

            // B wins everything (best hand)
            const distributions = potManager.distributePots(pots, [
                { playerId: 'B', rank: 1 }
            ]);

            const bWin = distributions.find(d => d.playerId === 'B');
            // Main: 150 + Side: 100 = 250
            expect(bWin?.amount).toBe(250);
        });
    });

    describe('SP-04: Chop Pot (ポット分割)', () => {
        it('同じ役で複数勝者', () => {
            const players = [
                createPlayer('A', 0, 100, 'ACTIVE'),
                createPlayer('B', 0, 100, 'ACTIVE'),
                createPlayer('C', 0, 100, 'ACTIVE')
            ];

            const pots = potManager.calculatePots(players);

            // A and B tie
            const distributions = potManager.distributePots(pots, [
                { playerId: 'A', rank: 1 },
                { playerId: 'B', rank: 1 }
            ]);

            const aWin = distributions.find(d => d.playerId === 'A');
            const bWin = distributions.find(d => d.playerId === 'B');

            // 300 / 2 = 150 each
            expect(aWin?.amount).toBe(150);
            expect(bWin?.amount).toBe(150);
        });

        it('端数処理（300を2人で割る→150, 150）', () => {
            const players = [
                createPlayer('A', 0, 100, 'ACTIVE'),
                createPlayer('B', 0, 100, 'ACTIVE'),
                createPlayer('C', 0, 100, 'ACTIVE')
            ];

            const pots = potManager.calculatePots(players);

            const distributions = potManager.distributePots(pots, [
                { playerId: 'A', rank: 1 },
                { playerId: 'B', rank: 1 }
            ]);

            const total = distributions.reduce((sum, d) => sum + d.amount, 0);
            expect(total).toBe(300);
        });

        it('端数処理（301を2人で割る→151, 150）', () => {
            // Create uneven pot
            const potState = { main: 301, side: [] };

            const distributions = potManager.distributePots(potState, [
                { playerId: 'A', rank: 1 },
                { playerId: 'B', rank: 1 }
            ]);

            const total = distributions.reduce((sum, d) => sum + d.amount, 0);
            expect(total).toBe(301);

            // One gets 151, other gets 150
            const amounts = distributions.map(d => d.amount).sort((a, b) => b - a);
            expect(amounts).toEqual([151, 150]);
        });
    });

    describe('SP-05: 複雑なシナリオ', () => {
        it('フォールドプレイヤーのベットはポットに含まれる', () => {
            const players = [
                createPlayer('A', 50, 50, 'FOLDED'), // Folded
                createPlayer('B', 0, 100, 'ACTIVE'),
                createPlayer('C', 0, 100, 'ACTIVE')
            ];

            const pots = potManager.calculatePots(players);

            // Folded chips stay in the pot
            // Main: 50 + 100 + 100 = 250
            expect(pots.main).toBe(250);
            expect(pots.side.length).toBe(0);
        });

        it('4人のうち2人がオールイン', () => {
            // A: all-in 30
            // B: all-in 70
            // C: bet 100
            // D: bet 100
            const players = [
                createPlayer('A', 0, 30, 'ALL_IN'),
                createPlayer('B', 0, 70, 'ALL_IN'),
                createPlayer('C', 0, 100, 'ACTIVE'),
                createPlayer('D', 0, 100, 'ACTIVE')
            ];

            const pots = potManager.calculatePots(players);

            // Main: 30 x 4 = 120 (A, B, C, D)
            // Side 1: 40 x 3 = 120 (B, C, D)
            // Side 2: 30 x 2 = 60 (C, D)
            expect(pots.main).toBe(120);
            expect(pots.side.length).toBe(2);

            const totalPot = potManager.getTotalPot(pots);
            expect(totalPot).toBe(300); // 30+70+100+100
        });

        it('全員同額ベット→サイドポットなし', () => {
            const players = [
                createPlayer('A', 0, 100, 'ACTIVE'),
                createPlayer('B', 0, 100, 'ACTIVE'),
                createPlayer('C', 0, 100, 'ACTIVE')
            ];

            const pots = potManager.calculatePots(players);

            expect(pots.main).toBe(300);
            expect(pots.side.length).toBe(0);
        });
    });
});

describe('PotManager - Utility Methods', () => {
    const potManager = new PotManager();

    it('getTotalPot returns sum of main and side pots', () => {
        const potState = {
            main: 100,
            side: [
                { amount: 50, eligiblePlayers: ['A', 'B'] },
                { amount: 30, eligiblePlayers: ['A'] }
            ]
        };

        expect(potManager.getTotalPot(potState)).toBe(180);
    });

    it('getTotalPot with no side pots', () => {
        const potState = { main: 200, side: [] };
        expect(potManager.getTotalPot(potState)).toBe(200);
    });
});
