// ========================================
// Trace a single hand to debug foul detection
// ========================================
import { OFCGameEngine } from '../OFCGameEngine.js';
import { botPlaceInitial, botPlacePineapple, botPlaceFantasyland, cardToIndex } from '../OFCBot.js';
import { checkFoul, evaluateHand, evaluateThreeCardHand, resolveJokersForFiveCards, resolveJokersForThreeCards } from '../OFCScoring.js';
import type { Room, OFCRow } from '../types.js';

function createTestRoom(numPlayers: number): Room {
    const players = [];
    for (let i = 0; i < numPlayers; i++) {
        players.push({
            socketId: `bot-${i + 1}`,
            name: `Bot ${String.fromCharCode(65 + i)}`,
            stack: 10000, bet: 0, totalBet: 0, status: 'ACTIVE', hand: null,
        });
    }
    return {
        id: 'trace-001',
        config: { maxPlayers: numPlayers, smallBlind: 1, bigBlind: 2 },
        gameState: { status: 'WAITING', gameVariant: 'OFC', street: 0, pot: { main: 0, side: [] }, board: [], deckStatus: { stubCount: 54, burnCount: 0 }, currentBet: 0, minRaise: 0, handNumber: 0 },
        players,
        dealerBtnIndex: 0, activePlayerIndex: -1, streetStarterIndex: -1, lastAggressorIndex: -1,
        rotation: { enabled: false, gamesList: ['OFC'], currentGameIndex: 0, handsPerGame: 8 },
        metaGame: { standUp: { isActive: false, remainingPlayers: [] }, sevenDeuce: false },
        createdAt: Date.now(),
    } as any;
}

function getOrderedOpponentBoards(ofc: any, playerIdx: number) {
    const N = ofc.players.length;
    const nextIdx = (playerIdx + 1) % N;
    const prevIdx = (playerIdx - 1 + N) % N;
    if (N === 2) return [ofc.players[nextIdx].board];
    return [ofc.players[nextIdx].board, ofc.players[prevIdx].board];
}

function getPlayerPosition(playerIdx: number, buttonIdx: number, numPlayers: number): number {
    return ((playerIdx - buttonIdx) % numPlayers + numPlayers) % numPlayers;
}

function printBoard(name: string, board: OFCRow) {
    const total = board.top.length + board.middle.length + board.bottom.length;
    console.log(`  ${name}: Top[${board.top.join(',')}] Mid[${board.middle.join(',')}] Bot[${board.bottom.join(',')}] (${total}/13)`);
}

async function traceHand() {
    const engine = new OFCGameEngine();
    const room = createTestRoom(3);
    const playerDiscards: Map<string, number[]> = new Map();
    for (let i = 0; i < 3; i++) playerDiscards.set(`bot-${i + 1}`, []);

    engine.startHand(room);
    const ofc = room.ofcState!;

    console.log(`Button: ${ofc.buttonIndex}`);
    console.log(`Turn order: button+1 first\n`);

    let iterations = 0;
    while (ofc.phase !== 'OFC_DONE' && iterations < 200) {
        iterations++;
        const idx = ofc.currentTurnIndex;
        if (idx < 0) break;

        const player = ofc.players[idx];
        if (player.hasPlaced) break;

        const numPlayers = ofc.players.length;
        const buttonIdx = ofc.buttonIndex;
        const opponentBoards = getOrderedOpponentBoards(ofc, idx);
        const playerPosition = getPlayerPosition(idx, buttonIdx, numPlayers);
        const discards = playerDiscards.get(player.socketId) || [];

        if (ofc.phase === 'OFC_INITIAL_PLACING') {
            const cards = engine.getPlayerCards(room, player.socketId);
            console.log(`=== Round ${ofc.round}: ${player.name} (pos=${playerPosition}) ===`);
            console.log(`  Hand: [${cards.join(', ')}]`);
            console.log(`  Card indices: [${cards.map(c => cardToIndex(c)).join(', ')}]`);

            const placements = await botPlaceInitial(cards, opponentBoards, playerPosition);
            console.log(`  AI placements:`);
            for (const p of placements) console.log(`    ${p.card} → ${p.row}`);

            const events = engine.placeInitialCards(room, player.socketId, placements);
            const err = events.find(e => e.type === 'error');
            if (err) { console.log(`  ERROR: ${err.data.reason}`); break; }

            printBoard(player.name, player.board);
            console.log('');
        }
        else if (ofc.phase === 'OFC_PINEAPPLE_PLACING') {
            if (player.isFantasyland) {
                engine.placePineappleCards(room, player.socketId, [], '');
                continue;
            }

            const cards = engine.getPlayerCards(room, player.socketId);
            if (cards.length === 0) continue;

            console.log(`=== Round ${ofc.round}: ${player.name} (pos=${playerPosition}) ===`);
            console.log(`  Hand: [${cards.join(', ')}]`);

            const { placements, discard } = await botPlacePineapple(
                cards, player.board, opponentBoards, ofc.round, playerPosition, discards
            );
            console.log(`  AI: place ${placements.map(p => `${p.card}→${p.row}`).join(', ')}, discard ${discard}`);

            const events = engine.placePineappleCards(room, player.socketId, placements, discard);
            const err = events.find(e => e.type === 'error');
            if (err) { console.log(`  ERROR: ${err.data.reason}`); break; }

            if (discard) {
                const dIdx = cardToIndex(discard);
                if (dIdx >= 0) {
                    const arr = playerDiscards.get(player.socketId) || [];
                    arr.push(dIdx);
                    playerDiscards.set(player.socketId, arr);
                }
            }

            printBoard(player.name, player.board);
            console.log('');
        }
    }

    // Final boards + foul check
    console.log('\n========== FINAL BOARDS ==========');
    for (const player of ofc.players) {
        printBoard(player.name, player.board);
        const isFouled = checkFoul(player.board);
        console.log(`  Fouled: ${isFouled}`);

        if (!isFouled) {
            // Show hand evaluations
            const topCards = player.board.top.map(c => ({ rank: c[0] === 'J' && c[1] === 'K' ? 'JOKER' : c[0], suit: c.slice(1) }));
            const midCards = player.board.middle.map(c => ({ rank: c[0] === 'J' && c[1] === 'K' ? 'JOKER' : c[0], suit: c.slice(1) }));
            const botCards = player.board.bottom.map(c => ({ rank: c[0] === 'J' && c[1] === 'K' ? 'JOKER' : c[0], suit: c.slice(1) }));
            console.log(`  Top eval: rank=${evaluateThreeCardHand(topCards as any).rank}, name=${evaluateThreeCardHand(topCards as any).name}`);
        }
        console.log('');
    }

    console.log('Done.');
    setTimeout(() => process.exit(0), 200);
}

traceHand().catch(e => { console.error(e); process.exit(1); });
