// ========================================
// OFC Bot Simulation Test
// Plays N hands between N bots and reports statistics
// ========================================

import { OFCGameEngine } from '../OFCGameEngine.js';
import { botPlaceInitial, botPlacePineapple, botPlaceFantasyland, cardToIndex } from '../OFCBot.js';
import { calculateOFCScores } from '../OFCScoring.js';
import type { Room, OFCGameState } from '../types.js';

const NUM_HANDS = 200;
const NUM_PLAYERS = parseInt(process.argv[2] || '3', 10);

// ========================================
// Create a minimal Room for simulation
// ========================================
function createTestRoom(numPlayers: number): Room {
    const players = [];
    for (let i = 0; i < numPlayers; i++) {
        players.push({
            socketId: `bot-${i + 1}`,
            name: `Bot ${String.fromCharCode(65 + i)}`,
            stack: 10000,
            bet: 0,
            totalBet: 0,
            status: 'ACTIVE',
            hand: null,
        });
    }

    return {
        id: 'sim-001',
        config: {
            maxPlayers: numPlayers,
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
        players,
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
// Per-player discard tracking
// ========================================
const playerDiscards: Map<string, number[]> = new Map();

function resetDiscards(numPlayers: number) {
    playerDiscards.clear();
    for (let i = 0; i < numPlayers; i++) {
        playerDiscards.set(`bot-${i + 1}`, []);
    }
}

function recordDiscard(socketId: string, cardStr: string) {
    const idx = cardToIndex(cardStr);
    if (idx >= 0) {
        const arr = playerDiscards.get(socketId) || [];
        arr.push(idx);
        playerDiscards.set(socketId, arr);
    }
}

// ========================================
// Helper: compute opponent boards in correct order
// Python env: next = (idx+1)%N, prev = (idx-1+N)%N
// ========================================
function getOrderedOpponentBoards(ofc: OFCGameState, playerIdx: number) {
    const N = ofc.players.length;
    const nextIdx = (playerIdx + 1) % N;
    const prevIdx = (playerIdx - 1 + N) % N;

    if (N === 2) {
        // 2人: nextだけ（prevは空）
        return [ofc.players[nextIdx].board];
    }
    // 3人: [next, prev]
    return [ofc.players[nextIdx].board, ofc.players[prevIdx].board];
}

// ========================================
// Helper: compute player position relative to button
// Python env: (player_idx - button_position) % N
// ========================================
function getPlayerPosition(playerIdx: number, buttonIdx: number, numPlayers: number): number {
    return ((playerIdx - buttonIdx) % numPlayers + numPlayers) % numPlayers;
}

// ========================================
// Helper: place for the player whose turn it is
// ========================================
async function placeForCurrentTurn(engine: OFCGameEngine, room: Room, ofc: OFCGameState): Promise<string | null> {
    const idx = ofc.currentTurnIndex;
    if (idx < 0) return null;

    const player = ofc.players[idx];
    if (player.hasPlaced) return null;

    const numPlayers = ofc.players.length;
    const buttonIdx = ofc.buttonIndex;
    const opponentBoards = getOrderedOpponentBoards(ofc, idx);
    const playerPosition = getPlayerPosition(idx, buttonIdx, numPlayers);
    const discards = playerDiscards.get(player.socketId) || [];

    if (ofc.phase === 'OFC_INITIAL_PLACING') {
        if (player.isFantasyland) {
            const flCards = player.fantasyCandidateCards!;
            const { placements, discard } = botPlaceFantasyland(flCards);
            const events = engine.placeInitialCards(room, player.socketId, placements, discard);
            const err = events.find(e => e.type === 'error');
            return err ? `R1 FL ${player.name}: ${err.data.reason}` : null;
        } else {
            const cards = engine.getPlayerCards(room, player.socketId);
            const placements = await botPlaceInitial(cards, opponentBoards, playerPosition);
            const events = engine.placeInitialCards(room, player.socketId, placements);
            const err = events.find(e => e.type === 'error');
            return err ? `R1 ${player.name}: ${err.data.reason}` : null;
        }
    }

    if (ofc.phase === 'OFC_PINEAPPLE_PLACING') {
        if (player.isFantasyland) {
            engine.placePineappleCards(room, player.socketId, [], '');
            return null;
        }

        const cards = engine.getPlayerCards(room, player.socketId);
        if (cards.length === 0) return null;

        const { placements, discard } = await botPlacePineapple(
            cards, player.board, opponentBoards, ofc.round, playerPosition, discards
        );
        const events = engine.placePineappleCards(room, player.socketId, placements, discard);
        const err = events.find(e => e.type === 'error');

        // Record discard for future rounds
        if (!err && discard) {
            recordDiscard(player.socketId, discard);
        }

        return err ? `R${ofc.round} ${player.name}: ${err.data.reason}` : null;
    }

    return null;
}

// ========================================
// Statistics tracking
// ========================================
interface SimStats {
    numPlayers: number;
    totalHands: number;
    foulCount: number[];
    flEntryCount: number[];
    flContinueCount: number[];
    flHands: number[];
    totalPoints: number[];
    totalRoyalties: number[];
    handDistribution: Record<string, number>;
    errors: string[];
}

function initStats(numPlayers: number): SimStats {
    return {
        numPlayers,
        totalHands: 0,
        foulCount: new Array(numPlayers).fill(0),
        flEntryCount: new Array(numPlayers).fill(0),
        flContinueCount: new Array(numPlayers).fill(0),
        flHands: new Array(numPlayers).fill(0),
        totalPoints: new Array(numPlayers).fill(0),
        totalRoyalties: new Array(numPlayers).fill(0),
        handDistribution: {},
        errors: [],
    };
}

// ========================================
// Main simulation loop
// ========================================
async function simulate(numHands: number, numPlayers: number): Promise<SimStats> {
    const engine = new OFCGameEngine();
    const room = createTestRoom(numPlayers);
    const stats = initStats(numPlayers);

    for (let hand = 0; hand < numHands; hand++) {
        try {
            // Reset discards each hand
            resetDiscards(numPlayers);

            // Track FL hands
            const flQueue = room.ofcState?.fantasylandQueue || [];
            for (let pi = 0; pi < numPlayers; pi++) {
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

            // Play until hand is done (max 200 iterations safety)
            let iterations = 0;
            while (ofc.phase !== 'OFC_DONE' && iterations < 200) {
                iterations++;

                if (ofc.currentTurnIndex >= 0) {
                    const err = await placeForCurrentTurn(engine, room, ofc);
                    if (err) {
                        stats.errors.push(`Hand ${hand + 1} ${err}`);
                        break;
                    }
                } else if (ofc.phase === 'OFC_PINEAPPLE_PLACING') {
                    break;
                } else {
                    break;
                }
            }

            // Collect results
            if (ofc.phase === 'OFC_DONE') {
                stats.totalHands++;

                const roundScores = calculateOFCScores(ofc.players, ofc.bigBlind);

                for (let pi = 0; pi < numPlayers; pi++) {
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
                    const totalFouls = stats.foulCount.reduce((a, b) => a + b, 0);
                    const totalFL = stats.flEntryCount.reduce((a, b) => a + b, 0);
                    const foulRate = (totalFouls / (stats.totalHands * numPlayers) * 100).toFixed(1);
                    console.log(`  [${hand + 1}/${numHands}] Foul: ${foulRate}%, FL entries: ${totalFL}`);
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
    const np = stats.numPlayers;
    console.log('\n' + '='.repeat(60));
    console.log(`  OFC Bot Simulation Report (${np} players)`);
    console.log('='.repeat(60));
    console.log(`  Hands played: ${n}`);
    console.log('');

    console.log('--- Per-Player Stats ---');
    for (let pi = 0; pi < np; pi++) {
        const name = `Bot ${String.fromCharCode(65 + pi)}`;
        console.log(`\n  [${name}]`);
        console.log(`    Fouls:            ${stats.foulCount[pi]}/${n} (${(stats.foulCount[pi] / n * 100).toFixed(1)}%)`);
        console.log(`    FL Entries:        ${stats.flEntryCount[pi]} (${(stats.flEntryCount[pi] / n * 100).toFixed(1)}%)`);
        console.log(`    FL Continuations:  ${stats.flContinueCount[pi]}`);
        console.log(`    FL Hands Played:   ${stats.flHands[pi]} (${(stats.flHands[pi] / n * 100).toFixed(1)}%)`);
        console.log(`    Total Points:      ${stats.totalPoints[pi] > 0 ? '+' : ''}${stats.totalPoints[pi]}`);
        console.log(`    Total Royalties:   ${stats.totalRoyalties[pi]}`);
        console.log(`    Avg Points/Hand:   ${(stats.totalPoints[pi] / n).toFixed(2)}`);
    }

    console.log(`\n--- Hand Distribution (all rows, ${np} players) ---`);
    const sorted = Object.entries(stats.handDistribution)
        .sort((a, b) => b[1] - a[1]);
    const totalRows = n * np * 3;
    for (const [name, count] of sorted) {
        console.log(`    ${name.padEnd(25)} ${count.toString().padStart(5)} (${(count / totalRows * 100).toFixed(1)}%)`);
    }

    // Sanity checks
    console.log('\n--- Sanity Checks ---');
    const totalPts = stats.totalPoints.reduce((a, b) => a + b, 0);
    const zeroSum = totalPts === 0;
    console.log(`    Zero-sum:       ${stats.totalPoints.join(' + ')} = ${totalPts} → ${zeroSum ? 'PASS' : 'FAIL'}`);
    const totalFouls = stats.foulCount.reduce((a, b) => a + b, 0);
    const totalFL = stats.flEntryCount.reduce((a, b) => a + b, 0);
    console.log(`    Foul Rate:      ${(totalFouls / (n * np) * 100).toFixed(1)}%`);
    console.log(`    FL Entry Rate:  ${(totalFL / (n * np) * 100).toFixed(1)}%`);

    if (stats.errors.length > 0) {
        console.log(`\n--- Errors (${stats.errors.length}) ---`);
        for (const err of stats.errors.slice(0, 10)) {
            console.log(`    ${err}`);
        }
        if (stats.errors.length > 10) {
            console.log(`    ... and ${stats.errors.length - 10} more`);
        }
    } else {
        console.log('\n    No errors');
    }

    console.log('='.repeat(60));
}

// ========================================
// Run
// ========================================
async function main() {
    console.log(`Starting OFC simulation: ${NUM_HANDS} hands between ${NUM_PLAYERS} AI bots...`);

    const stats = await simulate(NUM_HANDS, NUM_PLAYERS);
    report(stats);

    const exitCode = stats.errors.length > 0 ? 1 : 0;
    console.log(`\nExiting with code ${exitCode}`);
    setTimeout(() => process.exit(exitCode), 100);
}

main().catch(e => {
    console.error('Fatal error:', e);
    setTimeout(() => process.exit(1), 100);
});
