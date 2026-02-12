// ========================================
// OFC Bot Simulation Test
// Plays N hands between 2 bots and reports statistics
// ========================================

import { OFCGameEngine } from '../OFCGameEngine.js';
import { botPlaceInitial, botPlacePineapple, botPlaceFantasyland } from '../OFCBot.js';
import { calculateOFCScores } from '../OFCScoring.js';
import type { Room, OFCGameState } from '../types.js';

const NUM_HANDS = 200;

// ========================================
// Create a minimal Room for simulation
// ========================================
function createTestRoom(): Room {
    return {
        id: 'sim-001',
        config: {
            maxPlayers: 2,
            smallBlind: 1,
            bigBlind: 2,
        },
        gameState: {
            status: 'WAITING',
            gameVariant: 'OFC',
            street: 0,
            pot: { main: 0, side: [] },
            board: [],
            deckStatus: { stubCount: 54, burnCount: 0 },
            currentBet: 0,
            minRaise: 0,
            handNumber: 0,
        },
        players: [
            {
                socketId: 'bot-1',
                name: 'Bot A',
                stack: 10000,
                bet: 0,
                totalBet: 0,
                status: 'ACTIVE',
                hand: null,
            },
            {
                socketId: 'bot-2',
                name: 'Bot B',
                stack: 10000,
                bet: 0,
                totalBet: 0,
                status: 'ACTIVE',
                hand: null,
            },
        ],
        dealerBtnIndex: 0,
        activePlayerIndex: -1,
        streetStarterIndex: -1,
        lastAggressorIndex: -1,
        rotation: {
            enabled: false,
            gamesList: ['OFC'],
            currentGameIndex: 0,
            handsPerGame: 8,
        },
        metaGame: {
            standUp: { isActive: false, remainingPlayers: [] },
            sevenDeuce: false,
        },
        createdAt: Date.now(),
    } as unknown as Room;
}

// ========================================
// Helper: place for the player whose turn it is
// ========================================
async function placeForCurrentTurn(engine: OFCGameEngine, room: Room, ofc: OFCGameState): Promise<string | null> {
    const idx = ofc.currentTurnIndex;
    if (idx < 0) return null; // no one to place

    const player = ofc.players[idx];
    if (player.hasPlaced) return null;

    if (ofc.phase === 'OFC_INITIAL_PLACING') {
        if (player.isFantasyland) {
            const flCards = player.fantasyCandidateCards!;
            const { placements, discard } = botPlaceFantasyland(flCards);
            const events = engine.placeInitialCards(room, player.socketId, placements, discard);
            const err = events.find(e => e.type === 'error');
            return err ? `R1 FL ${player.name}: ${err.data.reason}` : null;
        } else {
            const cards = engine.getPlayerCards(room, player.socketId);
            const opponentBoards = ofc.players
                .filter(p => p.socketId !== player.socketId)
                .map(p => p.board);
            const placements = await botPlaceInitial(cards, opponentBoards);
            const events = engine.placeInitialCards(room, player.socketId, placements);
            const err = events.find(e => e.type === 'error');
            return err ? `R1 ${player.name}: ${err.data.reason}` : null;
        }
    }

    if (ofc.phase === 'OFC_PINEAPPLE_PLACING') {
        if (player.isFantasyland) {
            // FL players auto-skip in pineapple - engine handles this
            engine.placePineappleCards(room, player.socketId, [], '');
            return null;
        }

        const cards = engine.getPlayerCards(room, player.socketId);
        if (cards.length === 0) return null;

        const opponentBoards = ofc.players
            .filter(p => p.socketId !== player.socketId)
            .map(p => p.board);
        const { placements, discard } = await botPlacePineapple(cards, player.board, opponentBoards, ofc.round);
        const events = engine.placePineappleCards(room, player.socketId, placements, discard);
        const err = events.find(e => e.type === 'error');
        return err ? `R${ofc.round} ${player.name}: ${err.data.reason}` : null;
    }

    return null;
}

// ========================================
// Statistics tracking
// ========================================
interface SimStats {
    totalHands: number;
    foulCount: [number, number];
    flEntryCount: [number, number];
    flContinueCount: [number, number];
    flHands: [number, number];
    totalPoints: [number, number];
    totalRoyalties: [number, number];
    handDistribution: Record<string, number>;
    errors: string[];
}

function initStats(): SimStats {
    return {
        totalHands: 0,
        foulCount: [0, 0],
        flEntryCount: [0, 0],
        flContinueCount: [0, 0],
        flHands: [0, 0],
        totalPoints: [0, 0],
        totalRoyalties: [0, 0],
        handDistribution: {},
        errors: [],
    };
}

// ========================================
// Main simulation loop
// ========================================
async function simulate(numHands: number): Promise<SimStats> {
    const engine = new OFCGameEngine();
    const room = createTestRoom();
    const stats = initStats();

    for (let hand = 0; hand < numHands; hand++) {
        try {
            // Track FL hands
            const flQueue = room.ofcState?.fantasylandQueue || [];
            for (let pi = 0; pi < 2; pi++) {
                const socketId = `bot-${pi + 1}`;
                if (flQueue.includes(socketId)) {
                    stats.flHands[pi]++;
                }
            }

            // Start hand
            const startEvents = engine.startHand(room);
            const hasError = startEvents.find(e => e.type === 'error');
            if (hasError) {
                stats.errors.push(`Hand ${hand + 1}: startHand error: ${hasError.data.reason}`);
                break;
            }

            const ofc = room.ofcState!;

            // Play until hand is done (max 100 iterations safety)
            let iterations = 0;
            while (ofc.phase !== 'OFC_DONE' && iterations < 100) {
                iterations++;

                if (ofc.currentTurnIndex >= 0) {
                    const err = await placeForCurrentTurn(engine, room, ofc);
                    if (err) {
                        stats.errors.push(`Hand ${hand + 1} ${err}`);
                        break;
                    }
                } else if (ofc.phase === 'OFC_PINEAPPLE_PLACING') {
                    // All players already placed (all FL?) — advance should happen automatically
                    break;
                } else {
                    break;
                }
            }

            // Collect results
            if (ofc.phase === 'OFC_DONE') {
                stats.totalHands++;

                const roundScores = calculateOFCScores(ofc.players, ofc.bigBlind);

                for (let pi = 0; pi < 2; pi++) {
                    const player = ofc.players[pi];
                    const score = roundScores[pi];

                    if (player.isFouled) stats.foulCount[pi]++;

                    // FL queue for NEXT hand
                    if (ofc.fantasylandQueue.includes(player.socketId)) {
                        if (player.isFantasyland) {
                            stats.flContinueCount[pi]++;
                        } else {
                            stats.flEntryCount[pi]++;
                        }
                    }

                    stats.totalPoints[pi] += score.totalPoints;
                    stats.totalRoyalties[pi] += score.topRoyalties + score.middleRoyalties + score.bottomRoyalties;

                    // Hand distribution
                    for (const handName of [score.topHand, score.middleHand, score.bottomHand]) {
                        stats.handDistribution[handName] = (stats.handDistribution[handName] || 0) + 1;
                    }
                }

                // Progress log every 50 hands
                if ((hand + 1) % 50 === 0) {
                    const foulRate = ((stats.foulCount[0] + stats.foulCount[1]) / (stats.totalHands * 2) * 100).toFixed(1);
                    console.log(`  [${hand + 1}/${numHands}] Foul: ${foulRate}%, FL entries: ${stats.flEntryCount[0] + stats.flEntryCount[1]}`);
                }
            }
        } catch (e: any) {
            stats.errors.push(`Hand ${hand + 1}: Exception: ${e.message}`);
            // Reset room for next hand
            room.ofcState = undefined;
            (room.gameState as any).status = 'WAITING';
        }
    }

    return stats;
}

// ========================================
// Report
// ========================================
function report(stats: SimStats) {
    const n = stats.totalHands;
    console.log('\n' + '='.repeat(60));
    console.log('  OFC Bot Simulation Report');
    console.log('='.repeat(60));
    console.log(`  Hands played: ${n}`);
    console.log('');

    console.log('--- Per-Player Stats ---');
    for (let pi = 0; pi < 2; pi++) {
        const name = pi === 0 ? 'Bot A' : 'Bot B';
        console.log(`\n  [${name}]`);
        console.log(`    Fouls:            ${stats.foulCount[pi]}/${n} (${(stats.foulCount[pi] / n * 100).toFixed(1)}%)`);
        console.log(`    FL Entries:        ${stats.flEntryCount[pi]} (${(stats.flEntryCount[pi] / n * 100).toFixed(1)}%)`);
        console.log(`    FL Continuations:  ${stats.flContinueCount[pi]}`);
        console.log(`    FL Hands Played:   ${stats.flHands[pi]} (${(stats.flHands[pi] / n * 100).toFixed(1)}%)`);
        console.log(`    Total Points:      ${stats.totalPoints[pi] > 0 ? '+' : ''}${stats.totalPoints[pi]}`);
        console.log(`    Total Royalties:   ${stats.totalRoyalties[pi]}`);
        console.log(`    Avg Points/Hand:   ${(stats.totalPoints[pi] / n).toFixed(2)}`);
    }

    console.log('\n--- Hand Distribution (all rows, both players) ---');
    const sorted = Object.entries(stats.handDistribution)
        .sort((a, b) => b[1] - a[1]);
    const totalRows = n * 2 * 3;
    for (const [name, count] of sorted) {
        console.log(`    ${name.padEnd(25)} ${count.toString().padStart(5)} (${(count / totalRows * 100).toFixed(1)}%)`);
    }

    // Sanity checks
    console.log('\n--- Sanity Checks ---');
    const p1 = stats.totalPoints[0];
    const p2 = stats.totalPoints[1];
    const zeroSum = p1 + p2 === 0;
    console.log(`    Zero-sum:       ${p1} + ${p2} = ${p1 + p2} → ${zeroSum ? 'PASS ✓' : 'FAIL ✗'}`);
    console.log(`    Foul Rate:      ${((stats.foulCount[0] + stats.foulCount[1]) / (n * 2) * 100).toFixed(1)}%`);
    console.log(`    FL Entry Rate:  ${((stats.flEntryCount[0] + stats.flEntryCount[1]) / (n * 2) * 100).toFixed(1)}%`);

    if (stats.errors.length > 0) {
        console.log(`\n--- Errors (${stats.errors.length}) ---`);
        for (const err of stats.errors.slice(0, 10)) {
            console.log(`    ${err}`);
        }
        if (stats.errors.length > 10) {
            console.log(`    ... and ${stats.errors.length - 10} more`);
        }
    } else {
        console.log('\n    No errors ✓');
    }

    console.log('='.repeat(60));
}

// ========================================
// Run
// ========================================
async function main() {
    console.log(`Starting OFC simulation: ${NUM_HANDS} hands between 2 AI bots...`);

    const stats = await simulate(NUM_HANDS);
    report(stats);

    // Exit cleanly without waiting for ONNX cleanup
    const exitCode = stats.errors.length > 0 ? 1 : 0;
    console.log(`\nExiting with code ${exitCode}`);
    setTimeout(() => process.exit(exitCode), 100);
}

main().catch(e => {
    console.error('Fatal error:', e);
    setTimeout(() => process.exit(1), 100);
});
