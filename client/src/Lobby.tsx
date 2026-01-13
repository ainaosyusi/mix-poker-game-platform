import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface RoomListItem {
    id: string;
    playerCount: number;
    maxPlayers: number;
    gameVariant: string;
    blinds: string;
    isPrivate: boolean;
}

interface RoomConfig {
    maxPlayers: number;
    smallBlind: number;
    bigBlind: number;
    buyInMin: number;
    buyInMax: number;
    allowedGames: string[];
}

interface LobbyProps {
    socket: Socket | null;
    playerName: string;
    onJoinRoom: (roomId: string) => void;
}

export function Lobby({ socket, playerName, onJoinRoom }: LobbyProps) {
    const [rooms, setRooms] = useState<RoomListItem[]>([]);
    const [showCreateRoom, setShowCreateRoom] = useState(false);
    const [isPrivate, setIsPrivate] = useState(false);
    const [customRoomId, setCustomRoomId] = useState('');
    const [roomConfig, setRoomConfig] = useState<RoomConfig>({
        maxPlayers: 6,
        smallBlind: 5,
        bigBlind: 10,
        buyInMin: 100,
        buyInMax: 1000,
        allowedGames: ['NLH']
    });

    useEffect(() => {
        if (!socket) return;

        // ロビーに入る
        socket.emit('get-room-list');

        // 部屋リストの更新を受け取る
        socket.on('room-list-update', (roomList: RoomListItem[]) => {
            setRooms(roomList);
        });

        // 部屋作成成功
        socket.on('room-created', (data: { room: any; yourSocketId: string }) => {
            console.log('✅ Room created:', data.room.id);
            // 作成者も join-room 処理を実行してテーブルに遷移させる
            socket.emit('join-room', { roomId: data.room.id, playerName });
        });

        // 部屋参加成功 - テーブルに遷移
        socket.on('room-joined', (data: { room: any; yourSocketId: string }) => {
            console.log('✅ Joined room:', data.room.id);
            onJoinRoom(data.room.id);
        });

        // エラーハンドリング
        socket.on('error', (error: { message: string }) => {
            console.error('❌ Error from server:', error.message);
            alert(`エラー: ${error.message}`);
        });

        return () => {
            socket.off('room-list-update');
            socket.off('room-created');
            socket.off('room-joined');
            socket.off('error');
        };
    }, [socket, onJoinRoom]);

    const handleCreateRoom = () => {
        console.log('🔵 handleCreateRoom called');
        console.log('Socket:', socket);
        console.log('Player name:', playerName);

        if (!socket || !playerName) {
            console.log('⚠️ Socket or playerName is missing');
            return;
        }

        const payload = {
            playerName,
            config: roomConfig,
            isPrivate,
            customRoomId: isPrivate && customRoomId ? customRoomId : undefined
        };

        console.log('📤 Emitting create-room with payload:', payload);
        socket.emit('create-room', payload);
    };

    const handleJoinRoom = (roomId: string) => {
        if (!socket || !playerName) return;
        socket.emit('join-room', { roomId, playerName });
        // 遷移は room-joined イベントで行われる
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>🎰 Mix Poker Lobby</h1>

            {/* プレイヤー情報 */}
            <div style={{
                background: '#2d2d2d',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px'
            }}>
                <p style={{ margin: 0 }}>
                    ようこそ、<strong>{playerName}</strong>さん
                </p>
            </div>

            {/* 部屋作成ボタン */}
            <div style={{ marginBottom: '30px', textAlign: 'center' }}>
                <button
                    onClick={() => setShowCreateRoom(!showCreateRoom)}
                    style={{
                        padding: '12px 24px',
                        fontSize: '16px',
                        background: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer'
                    }}
                >
                    {showCreateRoom ? '閉じる' : '新しい部屋を作成'}
                </button>
            </div>

            {/* 部屋作成フォーム */}
            {showCreateRoom && (
                <div style={{
                    background: '#2d2d2d',
                    padding: '20px',
                    borderRadius: '8px',
                    marginBottom: '30px'
                }}>
                    <h3>部屋設定</h3>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>
                            <input
                                type="checkbox"
                                checked={isPrivate}
                                onChange={(e) => setIsPrivate(e.target.checked)}
                                style={{ marginRight: '8px' }}
                            />
                            Private卓（カスタムIDを指定）
                        </label>
                    </div>

                    {isPrivate && (
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>
                                部屋ID（6桁の数字）:
                            </label>
                            <input
                                type="text"
                                maxLength={6}
                                pattern="[0-9]{6}"
                                value={customRoomId}
                                onChange={(e) => setCustomRoomId(e.target.value.replace(/\D/g, ''))}
                                placeholder="123456"
                                style={{
                                    padding: '8px',
                                    fontSize: '14px',
                                    width: '150px',
                                    background: '#1a1a1a',
                                    color: 'white',
                                    border: '1px solid #555',
                                    borderRadius: '4px'
                                }}
                            />
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px' }}>スモールブラインド:</label>
                            <input
                                type="number"
                                value={roomConfig.smallBlind}
                                onChange={(e) => setRoomConfig({ ...roomConfig, smallBlind: Number(e.target.value) })}
                                style={{
                                    padding: '8px',
                                    width: '100%',
                                    background: '#1a1a1a',
                                    color: 'white',
                                    border: '1px solid #555',
                                    borderRadius: '4px'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px' }}>ビッグブラインド:</label>
                            <input
                                type="number"
                                value={roomConfig.bigBlind}
                                onChange={(e) => setRoomConfig({ ...roomConfig, bigBlind: Number(e.target.value) })}
                                style={{
                                    padding: '8px',
                                    width: '100%',
                                    background: '#1a1a1a',
                                    color: 'white',
                                    border: '1px solid #555',
                                    borderRadius: '4px'
                                }}
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleCreateRoom}
                        disabled={isPrivate && customRoomId.length !== 6}
                        style={{
                            padding: '10px 20px',
                            fontSize: '14px',
                            background: '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            opacity: (isPrivate && customRoomId.length !== 6) ? 0.5 : 1
                        }}
                    >
                        部屋を作成
                    </button>
                </div>
            )}

            {/* 部屋リスト */}
            <div>
                <h2>部屋一覧 ({rooms.length})</h2>
                {rooms.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#888' }}>
                        現在、部屋がありません。新しい部屋を作成してください。
                    </p>
                ) : (
                    <div style={{ display: 'grid', gap: '15px' }}>
                        {rooms.map((room) => (
                            <div
                                key={room.id}
                                style={{
                                    background: '#2d2d2d',
                                    padding: '20px',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                        <h3 style={{ margin: 0, fontSize: '20px' }}>
                                            Room {room.id}
                                        </h3>
                                        {room.isPrivate && (
                                            <span style={{
                                                background: '#9C27B0',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '12px'
                                            }}>
                                                PRIVATE
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ color: '#bbb', fontSize: '14px' }}>
                                        {room.gameVariant} | {room.blinds} | {room.playerCount}/{room.maxPlayers}人
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleJoinRoom(room.id)}
                                    disabled={room.playerCount >= room.maxPlayers}
                                    style={{
                                        padding: '10px 20px',
                                        fontSize: '14px',
                                        background: room.playerCount >= room.maxPlayers ? '#555' : '#4CAF50',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: room.playerCount >= room.maxPlayers ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {room.playerCount >= room.maxPlayers ? '満席' : '参加'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
