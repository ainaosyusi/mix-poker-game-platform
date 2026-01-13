import { RoomManager } from './dist/RoomManager.js';

console.log('🧪 Phase 3-A 自動検査\n');

const rm = new RoomManager();
let pass = 0, fail = 0;

const test = (name, fn) => {
  try { fn(); console.log(`✅ ${name}`); pass++; }
  catch (e) { console.log(`❌ ${name}: ${e.message}`); fail++; }
};

const cfg = { maxPlayers: 6, smallBlind: 5, bigBlind: 10, buyInMin: 100, buyInMax: 1000, allowedGames: ['NLH'] };

console.log('=== 部屋作成 ===');
test('Open卓作成', () => { const r = rm.createRoom(undefined, cfg); if (!/^\d{6}$/.test(r.id)) throw Error('ID不正'); });
test('Private卓作成', () => { const r = rm.createRoom('h1', cfg, '111111'); if (r.id !== '111111') throw Error('ID不正'); });
test('重複IDエラー', () => { try { rm.createRoom('h2', cfg, '111111'); throw Error('失敗'); } catch(e) { if (!e.message.includes('exists')) throw e; } });

console.log('\n=== 着席・離席 ===');
const room = rm.createRoom(undefined, cfg);
const p = { socketId: 's1', name: 'P1', stack: 500, bet: 0, totalBet: 0, status: 'SIT_OUT', hand: null };
test('着席', () => { rm.sitDown(room.id, 0, p); if (!rm.getRoomById(room.id).players[0]) throw Error('失敗'); });
test('重複着席エラー', () => { try { rm.sitDown(room.id, 0, {...p, socketId: 's2'}); throw Error('失敗'); } catch(e) { if (!e.message.includes('occupied')) throw e; } });
test('離席', () => { rm.standUp(room.id, 's1'); if (rm.getRoomById(room.id).players[0] !== null) throw Error('失敗'); });

console.log(`\n${'='.repeat(40)}\n✅ 成功: ${pass} | ❌ 失敗: ${fail}\n${'='.repeat(40)}`);
console.log(fail === 0 ? '🎉 すべて合格！' : '⚠️ 一部失敗');
