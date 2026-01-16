// ========================================
// Mix Poker - Lobby Component
// カジノ風ロビー画面
// ========================================

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
  onJoinRoom: (roomId: string, roomData?: any) => void;
}

// ゲームバリアントの表示名
const GAME_VARIANT_NAMES: Record<string, string> = {
  NLH: 'No Limit Hold\'em',
  PLO: 'Pot Limit Omaha',
  PLO8: 'PLO Hi-Lo',
  '2-7TD': '2-7 Triple Draw',
  '7CS': '7 Card Stud',
  '7CS8': '7 Card Stud Hi-Lo',
  RAZZ: 'Razz',
  BADUGI: 'Badugi',
};

export function Lobby({ socket, playerName, onJoinRoom }: LobbyProps) {
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [customRoomId, setCustomRoomId] = useState('');
  const [activeTab, setActiveTab] = useState<'open' | 'private'>('open');
  const [privateRoomId, setPrivateRoomId] = useState('');
  const [roomConfig, setRoomConfig] = useState<RoomConfig>({
    maxPlayers: 6,
    smallBlind: 5,
    bigBlind: 10,
    buyInMin: 100,
    buyInMax: 1000,
    allowedGames: ['NLH'],
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
      socket.emit('join-room', { roomId: data.room.id, playerName });
    });

    // 部屋参加成功 - テーブルに遷移
    socket.on('room-joined', (data: { room: any; yourSocketId: string }) => {
      console.log('✅ Joined room:', data.room.id);
      onJoinRoom(data.room.id, data.room);
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
  }, [socket, onJoinRoom, playerName]);

  const handleCreateRoom = () => {
    if (!socket || !playerName) return;

    const payload = {
      playerName,
      config: roomConfig,
      isPrivate,
      customRoomId: isPrivate && customRoomId ? customRoomId : undefined,
    };

    console.log('📤 Creating room:', payload);
    socket.emit('create-room', payload);
  };

  const handleJoinRoom = (roomId: string) => {
    if (!socket || !playerName) return;
    socket.emit('join-room', { roomId, playerName });
  };

  // プライベート部屋に参加
  const handleJoinPrivateRoom = () => {
    if (!socket || !playerName || privateRoomId.length !== 6) return;
    socket.emit('join-room', { roomId: privateRoomId, playerName });
  };

  return (
    <div className="lobby-container">
      {/* ヘッダー */}
      <header className="lobby-header">
        <h1 className="lobby-title">Mix Poker</h1>
        <p className="lobby-subtitle">テキサスホールデムからミックスゲームまで</p>
      </header>

      {/* プレイヤー情報 */}
      <div className="player-info-card">
        <div className="player-welcome">
          <span className="player-welcome-avatar">👤</span>
          <p className="player-welcome-text">
            ようこそ、<span className="player-welcome-name">{playerName}</span>さん
          </p>
        </div>
      </div>

      {/* 部屋作成ボタン */}
      <div className="create-room-section">
        <button
          className={`create-room-btn ${showCreateRoom ? 'active' : ''}`}
          onClick={() => setShowCreateRoom(!showCreateRoom)}
        >
          {showCreateRoom ? '✕ 閉じる' : '＋ 新しい部屋を作成'}
        </button>
      </div>

      {/* 部屋作成フォーム */}
      {showCreateRoom && (
        <div className="create-room-form">
          <h3 className="form-title">部屋設定</h3>

          {/* Private設定 */}
          <div className="form-row">
            <label className="form-checkbox-label">
              <input
                type="checkbox"
                className="form-checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              <span className="form-checkbox-text">プライベート卓（招待制）</span>
            </label>
          </div>

          {/* カスタム部屋ID（Private時のみ） */}
          {isPrivate && (
            <div className="form-row">
              <label className="form-label">部屋ID（6桁の数字）</label>
              <input
                type="text"
                className="form-input"
                maxLength={6}
                pattern="[0-9]{6}"
                value={customRoomId}
                onChange={(e) => setCustomRoomId(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
              />
            </div>
          )}

          {/* ブラインド設定 */}
          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">スモールブラインド</label>
              <input
                type="number"
                className="form-input"
                value={roomConfig.smallBlind}
                onChange={(e) =>
                  setRoomConfig({ ...roomConfig, smallBlind: Number(e.target.value) })
                }
              />
            </div>
            <div className="form-row">
              <label className="form-label">ビッグブラインド</label>
              <input
                type="number"
                className="form-input"
                value={roomConfig.bigBlind}
                onChange={(e) =>
                  setRoomConfig({ ...roomConfig, bigBlind: Number(e.target.value) })
                }
              />
            </div>
          </div>

          {/* バイイン設定 */}
          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">最小バイイン</label>
              <input
                type="number"
                className="form-input"
                value={roomConfig.buyInMin}
                onChange={(e) =>
                  setRoomConfig({ ...roomConfig, buyInMin: Number(e.target.value) })
                }
              />
            </div>
            <div className="form-row">
              <label className="form-label">最大バイイン</label>
              <input
                type="number"
                className="form-input"
                value={roomConfig.buyInMax}
                onChange={(e) =>
                  setRoomConfig({ ...roomConfig, buyInMax: Number(e.target.value) })
                }
              />
            </div>
          </div>

          {/* 最大人数 */}
          <div className="form-row">
            <label className="form-label">最大プレイヤー数</label>
            <select
              className="form-input"
              value={roomConfig.maxPlayers}
              onChange={(e) =>
                setRoomConfig({ ...roomConfig, maxPlayers: Number(e.target.value) })
              }
            >
              <option value={6}>6人</option>
              <option value={8}>8人</option>
            </select>
          </div>

          {/* 作成ボタン */}
          <button
            className="form-submit-btn"
            onClick={handleCreateRoom}
            disabled={isPrivate && customRoomId.length !== 6}
          >
            部屋を作成
          </button>
        </div>
      )}

      {/* タブ切り替え */}
      <div className="lobby-tabs">
        <button
          className={`lobby-tab ${activeTab === 'open' ? 'active' : ''}`}
          onClick={() => setActiveTab('open')}
        >
          🎰 オープン卓
        </button>
        <button
          className={`lobby-tab ${activeTab === 'private' ? 'active' : ''}`}
          onClick={() => setActiveTab('private')}
        >
          🔒 プライベート参加
        </button>
      </div>

      {/* オープン卓タブ */}
      {activeTab === 'open' && (
        <section className="room-list-section">
          <div className="room-list-header">
            <h2 className="room-list-title">部屋一覧</h2>
            <span className="room-count">{rooms.length} 部屋</span>
          </div>

          {rooms.length === 0 ? (
            <div className="room-list-empty">
              <div className="room-list-empty-icon">🎴</div>
              <p className="room-list-empty-text">
                現在、部屋がありません。<br />
                新しい部屋を作成してゲームを始めましょう！
              </p>
            </div>
          ) : (
            <div className="room-list-grid">
              {rooms.map((room) => (
                <div key={room.id} className="room-card">
                  <div className="room-card-info">
                    <div className="room-card-header">
                      <h3 className="room-card-title">Room {room.id}</h3>
                    </div>
                    <div className="room-card-details">
                      <span className="room-detail-item">
                        <span className="room-detail-icon">🎰</span>
                        {GAME_VARIANT_NAMES[room.gameVariant] || room.gameVariant}
                      </span>
                      <span className="room-detail-item">
                        <span className="room-detail-icon">💰</span>
                        {room.blinds}
                      </span>
                      <span className="room-detail-item">
                        <span className="room-detail-icon">👥</span>
                        {room.playerCount}/{room.maxPlayers}
                      </span>
                    </div>
                  </div>
                  <button
                    className={`room-join-btn ${room.playerCount >= room.maxPlayers ? 'full' : ''}`}
                    onClick={() => handleJoinRoom(room.id)}
                    disabled={room.playerCount >= room.maxPlayers}
                  >
                    {room.playerCount >= room.maxPlayers ? '満席' : '参加'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* プライベート参加タブ */}
      {activeTab === 'private' && (
        <section className="private-join-section">
          <div className="private-join-card">
            <h3 className="private-join-title">🔒 プライベート部屋に参加</h3>
            <p className="private-join-description">
              友達から教えてもらった6桁の部屋番号を入力してください
            </p>
            <div className="private-join-input-row">
              <input
                type="text"
                className="private-room-input"
                placeholder="123456"
                maxLength={6}
                value={privateRoomId}
                onChange={(e) => setPrivateRoomId(e.target.value.replace(/\D/g, ''))}
                onKeyPress={(e) => e.key === 'Enter' && handleJoinPrivateRoom()}
              />
              <button
                className="private-join-btn"
                onClick={handleJoinPrivateRoom}
                disabled={privateRoomId.length !== 6}
              >
                参加
              </button>
            </div>
          </div>
        </section>
      )}

      {/* バージョン表示 */}
      <div className="version-badge">v0.3.3</div>
    </div>
  );
}

export default Lobby;
