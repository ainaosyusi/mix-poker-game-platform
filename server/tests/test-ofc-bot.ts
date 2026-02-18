// OFCBot AI Inference Test
import { botPlaceInitial, botPlacePineapple, getOFCBotStatus } from '../OFCBot.js';
import type { OFCRow } from '../types.js';

async function runTests() {
    console.log('='.repeat(50));
    console.log('OFCBot AI Inference Test');
    console.log('='.repeat(50));

    // Check bot status
    const status = getOFCBotStatus();
    console.log('\n[1] Bot Status:');
    console.log(`    Version: ${status.version}`);
    console.log(`    Model: ${status.modelVersion}`);
    console.log(`    AI Enabled: ${status.aiEnabled}`);
    console.log(`    AI Loaded: ${status.aiLoaded}`);

    // Test initial placement (5 cards)
    console.log('\n[2] Testing Initial Placement (5 cards):');
    const initialCards = ['As', 'Kh', 'Qd', 'Jc', '9s'];
    console.log(`    Input cards: ${initialCards.join(', ')}`);

    try {
        const startTime = Date.now();
        const placements = await botPlaceInitial(initialCards);
        const elapsed = Date.now() - startTime;

        console.log(`    Placements (${elapsed}ms):`);
        for (const p of placements) {
            console.log(`      ${p.card} -> ${p.row}`);
        }

        // Validate
        const tops = placements.filter(p => p.row === 'top').length;
        const mids = placements.filter(p => p.row === 'middle').length;
        const bots = placements.filter(p => p.row === 'bottom').length;
        console.log(`    Distribution: Top=${tops}, Middle=${mids}, Bottom=${bots}`);

        if (tops > 3) console.error('    ERROR: Top has more than 3 cards!');
        if (mids > 5) console.error('    ERROR: Middle has more than 5 cards!');
        if (bots > 5) console.error('    ERROR: Bottom has more than 5 cards!');
        if (tops + mids + bots !== 5) console.error('    ERROR: Total cards mismatch!');
        console.log('    PASS');
    } catch (e) {
        console.error('    FAILED:', e);
    }

    // Test pineapple placement (3 cards -> 2 place, 1 discard)
    console.log('\n[3] Testing Pineapple Placement (3 cards):');
    const pineappleCards = ['Th', '7d', '3c'];
    const currentBoard: OFCRow = {
        top: ['9s'],
        middle: ['Qd', 'Jc'],
        bottom: ['As', 'Kh'],
    };
    console.log(`    Input cards: ${pineappleCards.join(', ')}`);
    console.log(`    Current board: Top=[${currentBoard.top}], Mid=[${currentBoard.middle}], Bot=[${currentBoard.bottom}]`);

    try {
        const startTime = Date.now();
        const result = await botPlacePineapple(pineappleCards, currentBoard);
        const elapsed = Date.now() - startTime;

        console.log(`    Result (${elapsed}ms):`);
        console.log(`    Discard: ${result.discard}`);
        console.log(`    Placements:`);
        for (const p of result.placements) {
            console.log(`      ${p.card} -> ${p.row}`);
        }

        // Validate
        if (result.placements.length !== 2) {
            console.error('    ERROR: Should place exactly 2 cards!');
        }
        if (!result.discard) {
            console.error('    ERROR: Must discard 1 card!');
        }

        // Check capacity
        const topNew = result.placements.filter(p => p.row === 'top').length;
        const midNew = result.placements.filter(p => p.row === 'middle').length;
        const botNew = result.placements.filter(p => p.row === 'bottom').length;

        if (currentBoard.top.length + topNew > 3) console.error('    ERROR: Top overflow!');
        if (currentBoard.middle.length + midNew > 5) console.error('    ERROR: Middle overflow!');
        if (currentBoard.bottom.length + botNew > 5) console.error('    ERROR: Bottom overflow!');
        console.log('    PASS');
    } catch (e) {
        console.error('    FAILED:', e);
    }

    // Test with different hands
    console.log('\n[4] Testing Multiple Initial Hands:');
    const testHands = [
        ['2c', '5h', '8d', 'Js', 'Ac'],
        ['Kc', 'Kh', 'Qc', 'Qd', '2s'],
        ['Ah', 'Kh', 'Qh', 'Jh', 'Th'],
    ];

    for (let i = 0; i < testHands.length; i++) {
        const cards = testHands[i];
        try {
            const startTime = Date.now();
            const placements = await botPlaceInitial(cards);
            const elapsed = Date.now() - startTime;
            console.log(`    Hand ${i + 1}: ${cards.join(',')} -> ${elapsed}ms`);

            for (const p of placements) {
                console.log(`      ${p.card} -> ${p.row}`);
            }
        } catch (e) {
            console.error(`    Hand ${i + 1} FAILED:`, e);
        }
    }

    // Final status
    console.log('\n[5] Final Bot Status:');
    const finalStatus = getOFCBotStatus();
    console.log(`    AI Loaded: ${finalStatus.aiLoaded}`);

    console.log('\n' + '='.repeat(50));
    console.log('Test Complete');
    console.log('='.repeat(50));
}

runTests().catch(console.error);
