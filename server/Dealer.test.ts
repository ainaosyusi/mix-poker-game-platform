/**
 * Dealer Tests
 * テスト仕様書: V-ST1 (Stud Bring-In), B-01~B-06 (基本フロー)
 */

import { describe, it, expect } from 'vitest';
import { Dealer } from './Dealer.js';
import type { Room, Player, PlayerStatus } from './types.js';

// Helper: テスト用プレイヤー作成
function createPlayer(
    socketId: string,
    name: string,
    stack: number,
    hand: string[] | null = null,
    status: PlayerStatus = 'ACTIVE',
    studUpCards: string[] = []
): Player {
    return {
        socketId,
        name,
        stack,
        bet: 0,
        totalBet: 0,
        status,
        hand,
        studUpCards
    };
}

// Helper: テスト用Room作成
function createRoom(players: (Player | null)[]): Room {
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
            status: 'WAITING' as any,
            board: [],
            pot: { main: 0, side: [] },
            currentBet: 0,
            minRaise: 10,
            deck: [],
            handNumber: 1,
            gameVariant: 'NLH'
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

describe('Dealer - Deck Management (B-01)', () => {
    const dealer = new Dealer();

    it('createDeck: 52枚のカードを生成', () => {
        const deck = dealer.createDeck();
        expect(deck.length).toBe(52);
    });

    it('createDeck: 重複なし', () => {
        const deck = dealer.createDeck();
        const uniqueCards = new Set(deck);
        expect(uniqueCards.size).toBe(52);
    });

    it('createDeck: 全スートが含まれる', () => {
        const deck = dealer.createDeck();
        const suits = new Set(deck.map(card => card.slice(-1)));
        expect(suits.has('♠')).toBe(true);
        expect(suits.has('♥')).toBe(true);
        expect(suits.has('♦')).toBe(true);
        expect(suits.has('♣')).toBe(true);
    });

    it('createDeck: シャッフルされている（毎回異なる順序）', () => {
        const deck1 = dealer.createDeck();
        const deck2 = dealer.createDeck();
        // 完全に同じ順序になる確率は非常に低い
        expect(deck1.join(',')).not.toBe(deck2.join(','));
    });
});

describe('Dealer - Hole Card Dealing (B-02)', () => {
    const dealer = new Dealer();

    it('dealHoleCards: 各プレイヤーに2枚配布', () => {
        const deck = dealer.createDeck();
        const players = [
            createPlayer('p1', 'Player1', 100),
            createPlayer('p2', 'Player2', 100),
            null,
            createPlayer('p3', 'Player3', 100)
        ];

        dealer.dealHoleCards(deck, players, 2);

        // 各プレイヤーが2枚持っている
        expect(players[0]?.hand?.length).toBe(2);
        expect(players[1]?.hand?.length).toBe(2);
        expect(players[3]?.hand?.length).toBe(2);
    });

    it('dealHoleCards: デッキから正しい枚数が減る', () => {
        const deck = dealer.createDeck();
        const initialCount = deck.length;
        const players = [
            createPlayer('p1', 'Player1', 100),
            createPlayer('p2', 'Player2', 100)
        ];

        dealer.dealHoleCards(deck, players, 2);

        // 2人 × 2枚 = 4枚減る
        expect(deck.length).toBe(initialCount - 4);
    });

    it('dealHoleCards: スタック0のプレイヤーには配らない', () => {
        const deck = dealer.createDeck();
        const players = [
            createPlayer('p1', 'Player1', 100),
            createPlayer('p2', 'Player2', 0) // スタック0
        ];

        dealer.dealHoleCards(deck, players, 2);

        expect(players[0]?.hand?.length).toBe(2);
        expect(players[1]?.hand).toBeNull();
    });
});

describe('Dealer - Board Card Dealing (B-03)', () => {
    const dealer = new Dealer();

    it('dealFlop: 3枚のフロップカードを返す', () => {
        const deck = dealer.createDeck();
        const flop = dealer.dealFlop(deck);

        expect(flop.length).toBe(3);
    });

    it('dealFlop: バーンカード込みで4枚消費', () => {
        const deck = dealer.createDeck();
        const initialCount = deck.length;

        dealer.dealFlop(deck);

        expect(deck.length).toBe(initialCount - 4);
    });

    it('dealTurn: 1枚のターンカードを返す', () => {
        const deck = dealer.createDeck();
        const turn = dealer.dealTurn(deck);

        expect(typeof turn).toBe('string');
        expect(turn.length).toBeGreaterThan(0);
    });

    it('dealTurn: バーンカード込みで2枚消費', () => {
        const deck = dealer.createDeck();
        const initialCount = deck.length;

        dealer.dealTurn(deck);

        expect(deck.length).toBe(initialCount - 2);
    });

    it('dealRiver: 1枚のリバーカードを返す', () => {
        const deck = dealer.createDeck();
        const river = dealer.dealRiver(deck);

        expect(typeof river).toBe('string');
    });
});

describe('Dealer - Button and Blinds (B-04)', () => {
    const dealer = new Dealer();

    it('moveButton: 次のアクティブプレイヤーにボタンが移動', () => {
        const players = [
            createPlayer('p0', 'Player0', 100),
            null, // 空席
            createPlayer('p2', 'Player2', 100),
            createPlayer('p3', 'Player3', 100)
        ];
        const room = createRoom(players);
        room.dealerBtnIndex = 0;

        const newIndex = dealer.moveButton(room);

        expect(newIndex).toBe(2); // 席1は空なので席2に移動
    });

    it('collectBlinds: SBとBBを正しく徴収', () => {
        const players = [
            createPlayer('p0', 'Player0', 100),
            createPlayer('p1', 'Player1', 100),
            createPlayer('p2', 'Player2', 100)
        ];
        const room = createRoom(players);
        room.dealerBtnIndex = 0;

        const { sbIndex, bbIndex } = dealer.collectBlinds(room);

        // 3人以上: ボタンの次=SB, その次=BB
        expect(sbIndex).toBe(1);
        expect(bbIndex).toBe(2);

        // SBは5, BBは10を支払い
        expect(players[1]!.stack).toBe(95);
        expect(players[1]!.bet).toBe(5);
        expect(players[2]!.stack).toBe(90);
        expect(players[2]!.bet).toBe(10);

        // ポットに追加
        expect(room.gameState.pot.main).toBe(15);
    });

    it('collectBlinds: ヘッズアップではボタン=SB', () => {
        const players = [
            createPlayer('p0', 'Player0', 100),
            createPlayer('p1', 'Player1', 100),
            null, null, null, null // 空席
        ];
        const room = createRoom(players);
        room.dealerBtnIndex = 0;

        const { sbIndex, bbIndex } = dealer.collectBlinds(room);

        // ヘッズアップ: ボタン=SB, 次=BB
        expect(sbIndex).toBe(0);
        expect(bbIndex).toBe(1);
    });

    it('collectBlinds: ショートスタックは全額ブラインド', () => {
        const players = [
            createPlayer('p0', 'Player0', 100),
            createPlayer('p1', 'Player1', 3), // SB(5)より少ない
            createPlayer('p2', 'Player2', 100)
        ];
        const room = createRoom(players);
        room.dealerBtnIndex = 0;

        dealer.collectBlinds(room);

        // SBは3（持っている分だけ）
        expect(players[1]!.stack).toBe(0);
        expect(players[1]!.bet).toBe(3);
        expect(players[1]!.status).toBe('ALL_IN');
    });
});

describe('Dealer - Stud Bring-In (V-ST1)', () => {
    const dealer = new Dealer();

    it('determineBringIn: 最も低いアップカードを判定', () => {
        const players = [
            createPlayer('p0', 'Player0', 100, ['X♠', 'X♥', '5♦'], 'ACTIVE', ['5♦']),
            createPlayer('p1', 'Player1', 100, ['X♠', 'X♥', '2♣'], 'ACTIVE', ['2♣']),
            createPlayer('p2', 'Player2', 100, ['X♠', 'X♥', 'K♠'], 'ACTIVE', ['K♠'])
        ];

        const bringInIndex = dealer.determineBringIn(players, false);

        // 2♣が最も低い
        expect(bringInIndex).toBe(1);
    });

    it('determineBringIn: 同ランク時はスートで判定（♣ < ♦ < ♥ < ♠）', () => {
        const players = [
            createPlayer('p0', 'Player0', 100, ['X♠', 'X♥', '5♠'], 'ACTIVE', ['5♠']),
            createPlayer('p1', 'Player1', 100, ['X♠', 'X♥', '5♣'], 'ACTIVE', ['5♣']),
            createPlayer('p2', 'Player2', 100, ['X♠', 'X♥', '5♥'], 'ACTIVE', ['5♥'])
        ];

        const bringInIndex = dealer.determineBringIn(players, false);

        // 5♣が最も低いスート
        expect(bringInIndex).toBe(1);
    });

    it('determineBringIn: Razzでは最も高いアップカードがBring-In', () => {
        const players = [
            createPlayer('p0', 'Player0', 100, ['X♠', 'X♥', '5♦'], 'ACTIVE', ['5♦']),
            createPlayer('p1', 'Player1', 100, ['X♠', 'X♥', 'K♣'], 'ACTIVE', ['K♣']),
            createPlayer('p2', 'Player2', 100, ['X♠', 'X♥', 'A♠'], 'ACTIVE', ['A♠'])
        ];

        const bringInIndex = dealer.determineBringIn(players, true); // isRazz = true

        // Razzでは高いカード（A♠）がBring-In
        expect(bringInIndex).toBe(2);
    });

    it('collectBringIn: Bring-In額を正しく徴収', () => {
        const players = [
            createPlayer('p0', 'Player0', 100, null, 'ACTIVE'),
            createPlayer('p1', 'Player1', 100, null, 'ACTIVE')
        ];
        const room = createRoom(players);

        dealer.collectBringIn(room, 1, 2); // Player1がBring-In 2を支払い

        expect(players[1]!.stack).toBe(98);
        expect(players[1]!.bet).toBe(2);
        expect(room.gameState.pot.main).toBe(2);
        expect(room.gameState.currentBet).toBe(2);
    });
});

describe('Dealer - Stud Street Dealing (V-ST2)', () => {
    const dealer = new Dealer();

    it('dealStudInitial: 3rd Street（2 down + 1 up）', () => {
        const deck = dealer.createDeck();
        const players = [
            createPlayer('p0', 'Player0', 100),
            createPlayer('p1', 'Player1', 100)
        ];

        dealer.dealStudInitial(deck, players);

        // 各プレイヤーが3枚持っている
        expect(players[0]!.hand!.length).toBe(3);
        expect(players[1]!.hand!.length).toBe(3);

        // アップカードが1枚記録されている
        expect(players[0]!.studUpCards!.length).toBe(1);
        expect(players[1]!.studUpCards!.length).toBe(1);
    });

    it('dealStudStreet: アップカード配布', () => {
        const deck = dealer.createDeck();
        const players = [
            createPlayer('p0', 'Player0', 100, ['A♠', 'K♠', 'Q♠'], 'ACTIVE', ['Q♠']),
            createPlayer('p1', 'Player1', 100, ['A♥', 'K♥', 'Q♥'], 'ACTIVE', ['Q♥'])
        ];

        dealer.dealStudStreet(deck, players, false);

        // 4枚目が配られた
        expect(players[0]!.hand!.length).toBe(4);
        expect(players[1]!.hand!.length).toBe(4);

        // アップカードが2枚に
        expect(players[0]!.studUpCards!.length).toBe(2);
        expect(players[1]!.studUpCards!.length).toBe(2);
    });

    it('dealStudStreet: 7th Streetはダウンカード', () => {
        const deck = dealer.createDeck();
        const players = [
            createPlayer('p0', 'Player0', 100, ['A♠', 'K♠', 'Q♠', 'J♠', 'T♠', '9♠'], 'ACTIVE', ['Q♠', 'J♠', 'T♠', '9♠'])
        ];

        dealer.dealStudStreet(deck, players, true); // isLastStreet = true

        // 7枚目が配られた
        expect(players[0]!.hand!.length).toBe(7);

        // アップカードは増えない（ダウンカード）
        expect(players[0]!.studUpCards!.length).toBe(4);
    });
});

describe('Dealer - Draw Exchange (V-27, V-BAD)', () => {
    const dealer = new Dealer();

    it('exchangeDrawCards: 指定カードを交換', () => {
        // Create a custom deck without A♠ and Q♠ to ensure they can't be redrawn
        const deck = ['2♥', '3♥', '4♥', '5♥', '6♥', '7♥', '8♥', '9♥'];
        const player = createPlayer('p0', 'Player0', 100, ['A♠', 'K♠', 'Q♠', 'J♠', 'T♠']);

        // インデックス0と2のカードを交換 (A♠とQ♠)
        dealer.exchangeDrawCards(deck, player, [0, 2]);

        // 手札は5枚のまま
        expect(player.hand!.length).toBe(5);

        // A♠とQ♠が除去され、新しいカードに置き換わる
        expect(player.hand!.includes('A♠')).toBe(false);
        expect(player.hand!.includes('Q♠')).toBe(false);

        // 元のカードは残っている
        expect(player.hand!.includes('K♠')).toBe(true);
        expect(player.hand!.includes('J♠')).toBe(true);
        expect(player.hand!.includes('T♠')).toBe(true);
    });

    it('exchangeDrawCards: 交換枚数が正しい', () => {
        const deck = dealer.createDeck();
        const initialDeckCount = deck.length;
        const player = createPlayer('p0', 'Player0', 100, ['A♠', 'K♠', 'Q♠', 'J♠', 'T♠']);

        dealer.exchangeDrawCards(deck, player, [0, 1, 2]); // 3枚交換

        // デッキから3枚減っている
        expect(deck.length).toBe(initialDeckCount - 3);
    });

    it('exchangeDrawCards: 0枚交換（スタンドパット）', () => {
        const deck = dealer.createDeck();
        const player = createPlayer('p0', 'Player0', 100, ['A♠', 'K♠', 'Q♠', 'J♠', 'T♠']);
        const originalHand = [...player.hand!];

        dealer.exchangeDrawCards(deck, player, []); // 0枚交換

        // 手札は変わらない
        expect(player.hand).toEqual(originalHand);
    });
});

describe('Dealer - Utility Methods', () => {
    const dealer = new Dealer();

    it('getActivePlayerCount: アクティブプレイヤー数を正しくカウント', () => {
        const players = [
            createPlayer('p0', 'Player0', 100, null, 'ACTIVE'),
            createPlayer('p1', 'Player1', 100, null, 'FOLDED'),
            createPlayer('p2', 'Player2', 100, null, 'ALL_IN'),
            null
        ];
        const room = createRoom(players);

        const count = dealer.getActivePlayerCount(room);

        // ACTIVE + ALL_IN = 2
        expect(count).toBe(2);
    });

    it('clearHands: ハンド終了後のクリーンアップ', () => {
        const players = [
            createPlayer('p0', 'Player0', 100, ['A♠', 'K♠'], 'FOLDED'),
            createPlayer('p1', 'Player1', 100, ['Q♠', 'J♠'], 'ACTIVE')
        ];
        players[0]!.bet = 10;
        players[0]!.totalBet = 50;
        players[1]!.bet = 20;
        players[1]!.totalBet = 100;

        const room = createRoom(players);
        room.gameState.board = ['2♠', '3♠', '4♠', '5♠', '6♠'];
        room.gameState.pot = { main: 150, side: [] };

        dealer.clearHands(room);

        // 手札がクリア
        expect(players[0]!.hand).toBeNull();
        expect(players[1]!.hand).toBeNull();

        // ベットがリセット
        expect(players[0]!.bet).toBe(0);
        expect(players[0]!.totalBet).toBe(0);

        // FOLDEDプレイヤーがACTIVEに戻る
        expect(players[0]!.status).toBe('ACTIVE');

        // ボードがクリア
        expect(room.gameState.board.length).toBe(0);

        // ポットがリセット
        expect(room.gameState.pot.main).toBe(0);
    });
});
