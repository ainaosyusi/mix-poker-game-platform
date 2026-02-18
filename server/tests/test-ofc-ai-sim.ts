// OFC AI Bot Simulation Test
// AI vs AI で複数ゲームを実施し、フォール率・スコア・FL資格率を計測
import { botPlaceInitial, botPlacePineapple, getOFCBotStatus, cardToIndex } from '../OFCBot.js';
import { checkFoul, checkFantasylandEntry, getTopRoyalties, getMiddleRoyalties, getBottomRoyalties, parseCards, resolveJokersForFiveCards, resolveJokersForThreeCards } from '../OFCScoring.js';
import type { OFCRow, OFCPlacement } from '../types.js';

// ========================================
// デッキ管理
// ========================================

const FULL_DECK = (() => {
    const suits = ['s', 'h', 'd', 'c'];
    const ranks = 'A23456789TJQK';
    const deck: string[] = [];
    for (const s of suits) {
        for (const r of ranks) {
            deck.push(r + s);
        }
    }
    deck.push('JK1', 'JK2');
    return deck;
})();

function shuffleDeck(): string[] {
    const deck = [...FULL_DECK];
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// ========================================
// ゲームシミュレーション
// ========================================

interface PlayerState {
    board: OFCRow;
    discards: number[];
    position: number;
}

interface GameResult {
    foulCount: number;
    flQualCount: number;
    totalRoyalties: number;
    handRanks: { top: string; middle: string; bottom: string };
    board?: OFCRow; // for foul analysis
}

function getHandRankName(rank: number): string {
    const names = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'];
    return names[rank] || `Rank ${rank}`;
}

async function simulateOneGame(numPlayers: number): Promise<GameResult[]> {
    const deck = shuffleDeck();
    let deckIdx = 0;

    const players: PlayerState[] = [];
    for (let i = 0; i < numPlayers; i++) {
        players.push({
            board: { top: [], middle: [], bottom: [] },
            discards: [],
            position: i,
        });
    }

    // Round 1: Initial placement (5 cards each)
    for (let i = 0; i < numPlayers; i++) {
        const cards = deck.slice(deckIdx, deckIdx + 5);
        deckIdx += 5;

        const nextIdx = (i + 1) % numPlayers;
        const prevIdx = (i - 1 + numPlayers) % numPlayers;
        const opponentBoards = [players[nextIdx].board];
        if (numPlayers >= 3) opponentBoards.push(players[prevIdx].board);
        const opponentFL = opponentBoards.map(() => false);

        const placements = await botPlaceInitial(cards, opponentBoards, i, opponentFL);
        for (const p of placements) {
            players[i].board[p.row].push(p.card);
        }
    }

    // Rounds 2-5: Pineapple (3 cards each, place 2, discard 1)
    for (let round = 2; round <= 5; round++) {
        for (let i = 0; i < numPlayers; i++) {
            const cards = deck.slice(deckIdx, deckIdx + 3);
            deckIdx += 3;

            const nextIdx = (i + 1) % numPlayers;
            const prevIdx = (i - 1 + numPlayers) % numPlayers;
            const opponentBoards = [players[nextIdx].board];
            if (numPlayers >= 3) opponentBoards.push(players[prevIdx].board);
            const opponentFL = opponentBoards.map(() => false);

            const result = await botPlacePineapple(
                cards,
                players[i].board,
                opponentBoards,
                round,
                i,
                players[i].discards,
                opponentFL
            );

            for (const p of result.placements) {
                players[i].board[p.row].push(p.card);
            }

            if (result.discard) {
                const discardIdx = cardToIndex(result.discard);
                if (discardIdx >= 0) players[i].discards.push(discardIdx);
            }
        }
    }

    // Evaluate results
    const results: GameResult[] = [];
    for (const player of players) {
        const board = player.board;
        const isFouled = checkFoul(board);
        const flQual = checkFantasylandEntry(board, isFouled);

        let totalRoyalties = 0;
        let handRanks = { top: 'N/A', middle: 'N/A', bottom: 'N/A' };

        if (!isFouled) {
            const topCards = parseCards(board.top);
            const midCards = parseCards(board.middle);
            const botCards = parseCards(board.bottom);

            totalRoyalties = getTopRoyalties(topCards) + getMiddleRoyalties(midCards) + getBottomRoyalties(botCards);

            const topRank = resolveJokersForThreeCards(topCards);
            const midRank = resolveJokersForFiveCards(midCards);
            const botRank = resolveJokersForFiveCards(botCards);

            handRanks = {
                top: getHandRankName(topRank.rank),
                middle: getHandRankName(midRank.rank),
                bottom: getHandRankName(botRank.rank),
            };
        }

        results.push({
            foulCount: isFouled ? 1 : 0,
            flQualCount: flQual ? 1 : 0,
            totalRoyalties,
            handRanks,
            board: isFouled ? { top: [...board.top], middle: [...board.middle], bottom: [...board.bottom] } : undefined,
        });
    }

    return results;
}

// ========================================
// メイン
// ========================================

async function main() {
    const NUM_GAMES = 200;
    const NUM_PLAYERS = 3; // 3人対戦（学習環境と同じ）

    console.log('='.repeat(60));
    console.log('OFC AI Bot Simulation Test');
    console.log('='.repeat(60));

    const status = getOFCBotStatus();
    console.log(`Bot Version: ${status.version}`);
    console.log(`Model: ${status.modelVersion}`);
    console.log(`AI Enabled: ${status.aiEnabled}`);
    console.log(`Players: ${NUM_PLAYERS}, Games: ${NUM_GAMES}`);
    console.log('');

    // Warm up
    console.log('Warming up model...');
    const warmupDeck = shuffleDeck();
    await botPlaceInitial(warmupDeck.slice(0, 5));
    console.log('Model ready.\n');

    let totalFouls = 0;
    let totalFL = 0;
    let totalRoyalties = 0;
    let totalHands = 0;
    const rowHandCounts: { top: Record<string, number>; middle: Record<string, number>; bottom: Record<string, number> } = {
        top: {}, middle: {}, bottom: {},
    };
    const foulBoards: OFCRow[] = [];

    const startTime = Date.now();

    for (let game = 0; game < NUM_GAMES; game++) {
        const results = await simulateOneGame(NUM_PLAYERS);

        for (const result of results) {
            totalFouls += result.foulCount;
            totalFL += result.flQualCount;
            totalRoyalties += result.totalRoyalties;
            totalHands++;

            if (result.foulCount === 0) {
                for (const row of ['top', 'middle', 'bottom'] as const) {
                    const name = result.handRanks[row];
                    rowHandCounts[row][name] = (rowHandCounts[row][name] || 0) + 1;
                }
            } else if (result.board) {
                foulBoards.push(result.board);
            }
        }

        // Progress
        if ((game + 1) % 20 === 0) {
            const foulRate = ((totalFouls / totalHands) * 100).toFixed(1);
            console.log(`  Game ${game + 1}/${NUM_GAMES} - Foul rate so far: ${foulRate}%`);
        }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const foulRate = ((totalFouls / totalHands) * 100).toFixed(1);
    const flRate = ((totalFL / totalHands) * 100).toFixed(1);
    const avgRoyalties = (totalRoyalties / (totalHands - totalFouls)).toFixed(1);
    const validHands = totalHands - totalFouls;

    console.log('\n' + '='.repeat(60));
    console.log('RESULTS');
    console.log('='.repeat(60));
    console.log(`Total hands:     ${totalHands}`);
    console.log(`Fouls:           ${totalFouls} / ${totalHands} (${foulRate}%)`);
    console.log(`FL qualified:    ${totalFL} / ${totalHands} (${flRate}%)`);
    console.log(`Avg royalties:   ${avgRoyalties} (non-fouled hands only)`);
    console.log(`Time:            ${elapsed}s (${(Number(elapsed) / NUM_GAMES * 1000).toFixed(0)}ms/game)`);

    console.log('\n--- Hand Distribution (non-fouled) ---');
    for (const row of ['top', 'middle', 'bottom'] as const) {
        const counts = rowHandCounts[row];
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const pctEntries = sorted.map(([name, count]) =>
            `${name}: ${count} (${((count / validHands) * 100).toFixed(0)}%)`
        );
        console.log(`  ${row.toUpperCase()}: ${pctEntries.join(', ')}`);
    }

    // Foul analysis
    console.log('\n--- Foul Analysis (sample of first 10) ---');
    for (const board of foulBoards.slice(0, 10)) {
        const topCards = parseCards(board.top);
        const midCards = parseCards(board.middle);
        const botCards = parseCards(board.bottom);
        const topRank = board.top.length === 3 ? resolveJokersForThreeCards(topCards) : null;
        const midRank = board.middle.length === 5 ? resolveJokersForFiveCards(midCards) : null;
        const botRank = board.bottom.length === 5 ? resolveJokersForFiveCards(botCards) : null;
        console.log(`  Top [${board.top.join(',')}] ${topRank ? getHandRankName(topRank.rank) : 'incomplete'}`);
        console.log(`  Mid [${board.middle.join(',')}] ${midRank ? getHandRankName(midRank.rank) : 'incomplete'}`);
        console.log(`  Bot [${board.bottom.join(',')}] ${botRank ? getHandRankName(botRank.rank) : 'incomplete'}`);
        console.log('  ---');
    }

    console.log('\n' + '='.repeat(60));
    console.log('Test Complete');
    console.log('='.repeat(60));
}

main().catch(console.error);
