// ONNX推論の一致確認: Python検証と同じ入力で同じアクションが出るか
import { botPlaceInitial, cardToIndex } from '../OFCBot.js';
import type { OFCRow } from '../types.js';

async function main() {
    console.log('='.repeat(60));
    console.log('ONNX Match Test: Same input as Python verify_model_io.py');
    console.log('='.repeat(60));

    // Same test case as Python: hand = As, Ks, Qs, Js, Ts
    // Python output: action 186 → As→top, Ks→bottom, Qs→bottom, Js→top, Ts→bottom
    const cards = ['As', 'Ks', 'Qs', 'Js', 'Ts'];

    console.log('\nHand:', cards.join(', '));
    console.log('Card indices:');
    for (const c of cards) {
        console.log(`  ${c} → ${cardToIndex(c)}`);
    }
    console.log('Expected indices: [0, 12, 11, 10, 9]');

    const emptyBoard: OFCRow = { top: [], middle: [], bottom: [] };
    const emptyOpps: OFCRow[] = [
        { top: [], middle: [], bottom: [] },
        { top: [], middle: [], bottom: [] },
    ];

    console.log('\nRunning botPlaceInitial...');
    const placements = await botPlaceInitial(cards, emptyOpps, 0, [false, false]);

    console.log('Result:');
    for (const p of placements) {
        console.log(`  ${p.card} → ${p.row}`);
    }

    // Expected from Python: As→top, Ks→bottom, Qs→bottom, Js→top, Ts→bottom
    const expected = [
        { card: 'As', row: 'top' },
        { card: 'Ks', row: 'bottom' },
        { card: 'Qs', row: 'bottom' },
        { card: 'Js', row: 'top' },
        { card: 'Ts', row: 'bottom' },
    ];

    let match = true;
    for (let i = 0; i < 5; i++) {
        if (placements[i].card !== expected[i].card || placements[i].row !== expected[i].row) {
            match = false;
            console.log(`  MISMATCH at ${i}: got ${placements[i].card}→${placements[i].row}, expected ${expected[i].card}→${expected[i].row}`);
        }
    }
    console.log(match ? '\n✓ MATCH with Python!' : '\n✗ MISMATCH with Python!');

    // Additional test: different hand
    console.log('\n--- Test 2: Ah, Kd, 7c, 3s, 2h ---');
    const cards2 = ['Ah', 'Kd', '7c', '3s', '2h'];
    console.log('Card indices:');
    for (const c of cards2) {
        console.log(`  ${c} → ${cardToIndex(c)}`);
    }
    const placements2 = await botPlaceInitial(cards2, emptyOpps, 0, [false, false]);
    console.log('Result:');
    for (const p of placements2) {
        console.log(`  ${p.card} → ${p.row}`);
    }

    console.log('\nDone.');
}

main().catch(console.error);
