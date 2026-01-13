import { useState, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';

interface Player {
    socketId: string;
    name: string;
    stack: number;
    bet: number;
    totalBet: number;
    status: string;
    hand?: string[] | null;
}

interface GameState {
    status: string;
    gameVariant: string;
    pot: { main: number; side: { amount: number }[] };
    board: string[];
    currentBet: number;
    minRaise: number;
    handNumber: number;
}

interface Room {
    id: string;
    config: {
        maxPlayers: number;
        smallBlind: number;
        bigBlind: number;
        buyInMin: number;
        buyInMax: number;
    };
    players: (Player | null)[];
    gameState: GameState;
    dealerBtnIndex: number;
    activePlayerIndex: number;
}

type ActionType = 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'ALL_IN';

interface TableProps {
    socket: Socket | null;
    roomId: string;
    initialRoomData: Room | null;
    yourSocketId: string;
    onLeaveRoom: () => void;
}

// カードをレンダリング
function Card({ card }: { card: string }) {
    const suit = card.slice(1);
    const rank = card[0] === 'T' ? '10' : card[0];
    const isRed = suit === '♥' || suit === '♦';

    return (
        <div style={{
            background: 'white',
            color: isRed ? 'red' : 'black',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '18px',
            fontWeight: 'bold',
            minWidth: '40px',
            textAlign: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }}>
            {rank}{suit}
        </div>
    );
}

export function Table({ socket, roomId, initialRoomData, yourSocketId, onLeaveRoom }: TableProps) {
    const [room, setRoom] = useState<Room | null>(initialRoomData);
    const [buyInAmount, setBuyInAmount] = useState(500);
    const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
    const [yourHand, setYourHand] = useState<string[]>([]);
    const [isYourTurn, setIsYourTurn] = useState(false);
    const [validActions, setValidActions] = useState<ActionType[]>([]);
    const [betAmount, setBetAmount] = useState(0);
    const [showdownResult, setShowdownResult] = useState<any>(null);

    useEffect(() => {
        if (!socket) return;

        socket.on('room-state-update', (updatedRoom: Room) => {
            setRoom(updatedRoom);
        });

        socket.on('room-joined', (data: { room: Room }) => {
            setRoom(data.room);
        });

        socket.on('game-started', (data: { room: Room; yourHand: string[] }) => {
            setRoom(data.room);
            setYourHand(data.yourHand || []);
            setShowdownResult(null);
        });

        socket.on('your-turn', (data: { validActions: ActionType[]; currentBet: number; minRaise: number }) => {
            setIsYourTurn(true);
            setValidActions(data.validActions);
            setBetAmount(data.minRaise);
        });

        socket.on('showdown-result', (result: any) => {
            setShowdownResult(result);
            setYourHand([]);
        });

        socket.on('action-invalid', (data: { reason: string }) => {
            alert(`無効なアクション: ${data.reason}`);
        });

        return () => {
            socket.off('room-state-update');
            socket.off('room-joined');
            socket.off('game-started');
            socket.off('your-turn');
            socket.off('showdown-result');
            socket.off('action-invalid');
        };
    }, [socket]);

    const handleAction = useCallback((type: ActionType, amount?: number) => {
        if (!socket) return;
        socket.emit('player-action', { type, amount });
        setIsYourTurn(false);
    }, [socket]);

    const handleStartGame = useCallback(() => {
        if (!socket) return;
        socket.emit('start-game');
    }, [socket]);

    const handleSitDown = (seatIndex: number) => {
        if (!socket || !room) return;
        socket.emit('sit-down', { seatIndex, buyIn: buyInAmount });
    };

    const handleLeaveRoom = () => {
        if (!socket) return;
        socket.emit('leave-seat');
        onLeaveRoom();
    };

    if (!room) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <h3>部屋のデータを取得中...</h3>
                <p>ルームID: {roomId}</p>
                <button onClick={onLeaveRoom} style={{ padding: '10px 20px', marginTop: '20px' }}>
                    ロビーに戻る
                </button>
            </div>
        );
    }

    const yourSeatIndex = room.players.findIndex(p => p?.socketId === yourSocketId);
    const isSeated = yourSeatIndex !== -1;
    const seatedPlayerCount = room.players.filter(p => p !== null).length;
    const isWaiting = room.gameState.status === 'WAITING';
    const totalPot = room.gameState.pot.main + room.gameState.pot.side.reduce((sum, s) => sum + s.amount, 0);

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* ヘッダー */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h1 style={{ margin: 0 }}>🎰 Room {roomId}</h1>
                    <p style={{ margin: 0, color: '#bbb' }}>
                        {room.gameState.gameVariant} | {room.config.smallBlind}/{room.config.bigBlind} | Hand #{room.gameState.handNumber}
                    </p>
                </div>
                <button onClick={handleLeaveRoom} style={{ padding: '10px 20px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    ロビーに戻る
                </button>
            </div>

            {/* ポット表示 */}
            {totalPot > 0 && (
                <div style={{ textAlign: 'center', marginBottom: '20px', fontSize: '24px', fontWeight: 'bold' }}>
                    🏆 POT: {totalPot}
                </div>
            )}

            {/* コミュニティカード - Always show when available */}
            {room.gameState.board.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', marginRight: '10px', alignSelf: 'center' }}>Board:</span>
                    {room.gameState.board.map((card, i) => (
                        <Card key={i} card={card} />
                    ))}
                </div>
            )}

            {/* テーブル */}
            <div style={{
                background: '#1a4d1a',
                borderRadius: '120px',
                padding: '40px',
                position: 'relative',
                minHeight: '300px',
                border: '8px solid #8B4513',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '20px'
            }}>
                {room.players.map((player, index) => {
                    const isDealer = index === room.dealerBtnIndex;
                    const isActive = index === room.activePlayerIndex;
                    const isYou = player?.socketId === yourSocketId;

                    return (
                        <div key={index} style={{
                            background: isActive ? '#ff9800' : isYou ? '#2196F3' : player ? '#2d2d2d' : 'rgba(0,0,0,0.3)',
                            padding: '15px',
                            borderRadius: '8px',
                            minHeight: '80px',
                            position: 'relative'
                        }}>
                            {isDealer && (
                                <span style={{ position: 'absolute', top: '-10px', left: '-10px', background: '#ff5722', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>D</span>
                            )}
                            {player ? (
                                <>
                                    <div style={{ fontWeight: 'bold' }}>{player.name} {isYou && '(you)'}</div>
                                    <div style={{ fontSize: '14px' }}>💰 {player.stack}</div>
                                    {player.bet > 0 && <div style={{ fontSize: '14px', color: '#ff9800' }}>Bet: {player.bet} (Total: {player.totalBet})</div>}
                                    <div style={{ fontSize: '12px', color: '#888' }}>{player.status}</div>
                                </>
                            ) : (
                                <div
                                    onClick={() => !isSeated && setSelectedSeat(index)}
                                    style={{ cursor: isSeated ? 'default' : 'pointer', textAlign: 'center', color: '#888' }}
                                >
                                    {selectedSeat === index ? '✓ 選択中' : `空席 ${index + 1}`}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 自分の手札 */}
            {yourHand.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '20px' }}>
                    <span style={{ alignSelf: 'center', marginRight: '10px' }}>Your Hand:</span>
                    {yourHand.map((card, i) => <Card key={i} card={card} />)}
                </div>
            )}

            {/* アクションボタン */}
            {isYourTurn && (
                <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
                    <h3 style={{ marginTop: 0 }}>🎯 あなたの番です！</h3>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {validActions.includes('FOLD') && (
                            <button onClick={() => handleAction('FOLD')} style={{ padding: '12px 24px', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>FOLD</button>
                        )}
                        {validActions.includes('CHECK') && (
                            <button onClick={() => handleAction('CHECK')} style={{ padding: '12px 24px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>CHECK</button>
                        )}
                        {validActions.includes('CALL') && (
                            <button onClick={() => handleAction('CALL')} style={{ padding: '12px 24px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                CALL {room.gameState.currentBet - (room.players[yourSeatIndex]?.bet || 0)}
                            </button>
                        )}
                        {validActions.includes('ALL_IN') && (
                            <button onClick={() => handleAction('ALL_IN')} style={{ padding: '12px 24px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>ALL IN</button>
                        )}
                    </div>
                    {(validActions.includes('BET') || validActions.includes('RAISE')) && (
                        <div style={{ marginTop: '15px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input
                                type="range"
                                min={room.gameState.minRaise}
                                max={room.players[yourSeatIndex]?.stack || 0}
                                value={betAmount}
                                onChange={(e) => setBetAmount(Number(e.target.value))}
                                style={{ flex: 1 }}
                            />
                            <input
                                type="number"
                                value={betAmount}
                                onChange={(e) => setBetAmount(Number(e.target.value))}
                                style={{ width: '80px', padding: '8px', background: '#1a1a1a', color: 'white', border: '1px solid #555', borderRadius: '4px' }}
                            />
                            <button onClick={() => handleAction(validActions.includes('BET') ? 'BET' : 'RAISE', betAmount)} style={{ padding: '12px 24px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                {validActions.includes('BET') ? `BET ${betAmount}` : `RAISE to ${(room.players[yourSeatIndex]?.bet || 0) + betAmount}`}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ショーダウン結果 - PokerStars style */}
            {showdownResult && (
                <div style={{
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
                    padding: '30px',
                    borderRadius: '12px',
                    marginTop: '20px',
                    textAlign: 'center',
                    border: '3px solid #60a5fa',
                    boxShadow: '0 8px 16px rgba(0,0,0,0.3)'
                }}>
                    <h2 style={{ margin: '0 0 20px 0', fontSize: '28px', color: '#fbbf24' }}>🏆 SHOWDOWN</h2>

                    {/* Winners */}
                    <div style={{ marginBottom: '20px' }}>
                        <h3 style={{ color: '#10b981', fontSize: '20px' }}>Winners</h3>
                        {showdownResult.winners.map((w: any, i: number) => (
                            <div key={i} style={{
                                background: 'rgba(16, 185, 129, 0.2)',
                                padding: '15px',
                                borderRadius: '8px',
                                margin: '10px 0',
                                border: '2px solid #10b981'
                            }}>
                                <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#fff' }}>
                                    {w.playerName}
                                </div>
                                <div style={{ fontSize: '16px', color: '#d1d5db', margin: '5px 0' }}>
                                    {w.handRank}
                                </div>
                                <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', margin: '10px 0' }}>
                                    {w.hand && w.hand.map((card: string, ci: number) => (
                                        <Card key={ci} card={card} />
                                    ))}
                                </div>
                                <div style={{ fontSize: '20px', color: '#fbbf24', fontWeight: 'bold' }}>
                                    +{w.amount} chips
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Other players' hands */}
                    {showdownResult.allHands && showdownResult.allHands.length > 0 && (
                        <div>
                            <h3 style={{ color: '#9ca3af', fontSize: '16px' }}>Other Players</h3>
                            {showdownResult.allHands
                                .filter((h: any) => !showdownResult.winners.some((w: any) => w.playerId === h.playerId))
                                .map((h: any, i: number) => (
                                    <div key={i} style={{
                                        background: 'rgba(55, 65, 81, 0.5)',
                                        padding: '10px',
                                        borderRadius: '6px',
                                        margin: '5px 0'
                                    }}>
                                        <div style={{ fontSize: '16px', color: '#9ca3af' }}>{h.playerName}</div>
                                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', margin: '5px 0' }}>
                                            {h.hand && h.hand.map((card: string, ci: number) => (
                                                <Card key={ci} card={card} />
                                            ))}
                                        </div>
                                        {h.handRank && <div style={{ fontSize: '14px', color: '#6b7280' }}>{h.handRank}</div>}
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            )}

            {/* 着席/ゲーム開始コントロール */}
            {!isSeated && (
                <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
                    <h3>着席する</h3>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <input type="number" value={buyInAmount} onChange={(e) => setBuyInAmount(Number(e.target.value))} min={room.config.buyInMin} max={room.config.buyInMax} style={{ padding: '8px', width: '120px', background: '#1a1a1a', color: 'white', border: '1px solid #555', borderRadius: '4px' }} />
                        <button onClick={() => selectedSeat !== null && handleSitDown(selectedSeat)} disabled={selectedSeat === null} style={{ padding: '10px 20px', background: selectedSeat !== null ? '#4CAF50' : '#555', color: 'white', border: 'none', borderRadius: '4px', cursor: selectedSeat !== null ? 'pointer' : 'not-allowed' }}>
                            着席
                        </button>
                    </div>
                </div>
            )}

            {isSeated && isWaiting && seatedPlayerCount >= 2 && (
                <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '8px', marginTop: '20px', textAlign: 'center' }}>
                    <button onClick={handleStartGame} style={{ padding: '15px 40px', fontSize: '18px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                        🎮 ゲーム開始
                    </button>
                </div>
            )}

            {isSeated && isWaiting && seatedPlayerCount < 2 && (
                <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '8px', marginTop: '20px', textAlign: 'center', color: '#888' }}>
                    ゲーム開始には2人以上のプレイヤーが必要です
                </div>
            )}
        </div>
    );
}
