/**
 * PrivateRoom - プライベートルーム作成/参加画面
 */
import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { GAME_OPTIONS, BLIND_PRESETS } from '../constants/gameConfig';

interface PrivateRoomProps {
  socket: Socket | null;
  onJoinRoom: (roomId: string, roomData?: any, yourHand?: string[] | null) => void;
  onBack: () => void;
}

export function PrivateRoom({ socket, onJoinRoom, onBack }: PrivateRoomProps) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [error, setError] = useState('');

  // === Create Room State ===
  const [roomNumber, setRoomNumber] = useState('');
  const [password, setPassword] = useState('');
  const [blindIndex, setBlindIndex] = useState(0);
  const [maxPlayers, setMaxPlayers] = useState<6 | 8>(6);
  const [selectedGames, setSelectedGames] = useState<string[]>(['NLH']);
  const [rotationEnabled, setRotationEnabled] = useState(false);
  const [creating, setCreating] = useState(false);

  // === Join Room State ===
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joinBuyIn, setJoinBuyIn] = useState(200);
  const [joining, setJoining] = useState(false);

  // === Buy-in dialog after room creation ===
  const [createdRoom, setCreatedRoom] = useState<any>(null);
  const [hostBuyIn, setHostBuyIn] = useState(200);

  useEffect(() => {
    if (!socket) return;

    const handleCreated = (data: { roomId: string; room: any; yourSocketId: string }) => {
      setCreating(false);
      setError('');
      // ルーム作成後、バイインダイアログを表示
      const bb = data.room.config.bigBlind || 2;
      setHostBuyIn(bb * 100);
      setCreatedRoom(data);
    };

    const handleJoined = (data: { room: any; yourSocketId: string; yourHand: string[] | null }) => {
      setJoining(false);
      setError('');
      onJoinRoom(data.room.id, data.room, data.yourHand);
    };

    const handleSitDown = () => {
      // sit-down成功後にテーブル画面に遷移
      if (createdRoom) {
        onJoinRoom(createdRoom.roomId, createdRoom.room, null);
        setCreatedRoom(null);
      }
    };

    const handleError = (err: { message: string }) => {
      setCreating(false);
      setJoining(false);
      setError(err.message);
    };

    socket.on('private-room-created', handleCreated);
    socket.on('room-joined', handleJoined);
    socket.on('sit-down-success', handleSitDown);
    socket.on('error', handleError);

    return () => {
      socket.off('private-room-created', handleCreated);
      socket.off('room-joined', handleJoined);
      socket.off('sit-down-success', handleSitDown);
      socket.off('error', handleError);
    };
  }, [socket, onJoinRoom, createdRoom]);

  const handleCreate = () => {
    if (!socket || creating) return;
    setError('');
    setCreating(true);

    const blind = BLIND_PRESETS[blindIndex];
    socket.emit('create-private-room', {
      config: {
        maxPlayers,
        smallBlind: blind.sb,
        bigBlind: blind.bb,
        allowedGames: selectedGames,
      },
      password: password || undefined,
      customRoomId: roomNumber || undefined,
    });
  };

  const handleJoin = () => {
    if (!socket || joining || !joinRoomId) return;
    setError('');
    setJoining(true);
    socket.emit('join-private-room', {
      roomId: joinRoomId,
      password: joinPassword || undefined,
      buyIn: joinBuyIn,
    });
  };

  const handleHostSitDown = () => {
    if (!socket || !createdRoom) return;
    socket.emit('sit-down', {
      seatIndex: 0,
      buyIn: hostBuyIn,
    });
  };

  const toggleGame = (gameId: string) => {
    setSelectedGames(prev => {
      if (prev.includes(gameId)) {
        if (prev.length <= 1) return prev;
        return prev.filter(g => g !== gameId);
      }
      return [...prev, gameId];
    });
  };

  const blind = BLIND_PRESETS[blindIndex];
  const buyInMin = blind.bb * 50;
  const buyInMax = blind.bb * 200;

  // バイインダイアログ（ルーム作成後）
  if (createdRoom) {
    const roomBB = createdRoom.room.config.bigBlind || 2;
    const min = roomBB * 50;
    const max = roomBB * 200;
    return (
      <div style={{
        minHeight: '100vh', background: 'linear-gradient(135deg, #0a1628, #1a1a2e)',
        color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '20px',
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.05)', borderRadius: '16px',
          padding: '32px', maxWidth: '400px', width: '100%',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Room Created!</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', margin: '0 0 24px', fontSize: '14px' }}>
            Room #{createdRoom.roomId} - Choose your buy-in
          </p>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '8px' }}>
              Buy-in: {hostBuyIn} chips ({Math.round(hostBuyIn / roomBB)} BB)
            </label>
            <input
              type="range"
              min={min}
              max={max}
              step={roomBB}
              value={hostBuyIn}
              onChange={e => setHostBuyIn(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#8b5cf6' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
              <span>{min}</span>
              <span>{max}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {[min, Math.round((min + max) / 2 / roomBB) * roomBB, max].map(val => (
              <button
                key={val}
                onClick={() => setHostBuyIn(val)}
                style={{
                  flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                  background: hostBuyIn === val ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
                  color: '#fff', cursor: 'pointer', fontSize: '12px',
                }}
              >
                {val}
              </button>
            ))}
          </div>

          <button
            onClick={handleHostSitDown}
            style={{
              width: '100%', marginTop: '20px', padding: '14px', borderRadius: '12px',
              border: 'none', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              color: '#fff', fontWeight: 700, fontSize: '16px', cursor: 'pointer',
            }}
          >
            Sit Down
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #0a1628, #1a1a2e)',
      color: '#fff', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', color: '#fff', fontSize: '20px',
            cursor: 'pointer', padding: '4px 8px',
          }}
        >
          ←
        </button>
        <h1 style={{ margin: '0 0 0 12px', fontSize: '20px', fontWeight: 700 }}>
          Private Room
        </h1>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', padding: '0 20px', gap: '4px', marginTop: '16px',
      }}>
        {(['create', 'join'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setMode(tab); setError(''); }}
            style={{
              flex: 1, padding: '12px', borderRadius: '10px 10px 0 0',
              border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
              background: mode === tab ? 'rgba(139,92,246,0.2)' : 'transparent',
              color: mode === tab ? '#a78bfa' : 'rgba(255,255,255,0.4)',
              borderBottom: mode === tab ? '2px solid #8b5cf6' : '2px solid transparent',
            }}
          >
            {tab === 'create' ? 'Create Room' : 'Join Room'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '10px', padding: '12px', marginBottom: '16px',
            color: '#fca5a5', fontSize: '13px',
          }}>
            {error}
          </div>
        )}

        {mode === 'create' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Room Number */}
            <div>
              <label style={labelStyle}>Room Number (optional, 4-6 digits)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="Auto-generated if empty"
                value={roomNumber}
                onChange={e => setRoomNumber(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={inputStyle}
              />
            </div>

            {/* Password */}
            <div>
              <label style={labelStyle}>Password (optional)</label>
              <input
                type="text"
                placeholder="No password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Blinds */}
            <div>
              <label style={labelStyle}>Blinds</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {BLIND_PRESETS.map((bp, i) => (
                  <button
                    key={bp.label}
                    onClick={() => setBlindIndex(i)}
                    style={{
                      padding: '10px 16px', borderRadius: '10px', border: 'none',
                      background: blindIndex === i ? '#8b5cf6' : 'rgba(255,255,255,0.08)',
                      color: blindIndex === i ? '#fff' : 'rgba(255,255,255,0.6)',
                      cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                    }}
                  >
                    {bp.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '6px' }}>
                Buy-in: {buyInMin} - {buyInMax}
              </div>
            </div>

            {/* Games */}
            <div>
              <label style={labelStyle}>Games</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {GAME_OPTIONS.map(game => {
                  const selected = selectedGames.includes(game.id);
                  return (
                    <button
                      key={game.id}
                      onClick={() => toggleGame(game.id)}
                      style={{
                        padding: '8px 14px', borderRadius: '20px',
                        border: selected ? '1px solid #8b5cf6' : '1px solid rgba(255,255,255,0.15)',
                        background: selected ? 'rgba(139,92,246,0.25)' : 'transparent',
                        color: selected ? '#c4b5fd' : 'rgba(255,255,255,0.5)',
                        cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                      }}
                    >
                      {game.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rotation toggle */}
            {selectedGames.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Rotation</label>
                <button
                  onClick={() => setRotationEnabled(!rotationEnabled)}
                  style={{
                    width: '48px', height: '26px', borderRadius: '13px', border: 'none',
                    background: rotationEnabled ? '#8b5cf6' : 'rgba(255,255,255,0.15)',
                    cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: '3px',
                    left: rotationEnabled ? '25px' : '3px',
                    transition: 'left 0.2s',
                  }} />
                </button>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                  {rotationEnabled ? '8 hands per game' : 'Off'}
                </span>
              </div>
            )}

            {/* Max Players */}
            <div>
              <label style={labelStyle}>Max Players</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {([6, 8] as const).map(n => (
                  <button
                    key={n}
                    onClick={() => setMaxPlayers(n)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                      background: maxPlayers === n ? '#8b5cf6' : 'rgba(255,255,255,0.08)',
                      color: maxPlayers === n ? '#fff' : 'rgba(255,255,255,0.6)',
                      cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                    }}
                  >
                    {n} Players
                  </button>
                ))}
              </div>
            </div>

            {/* Create Button */}
            <button
              onClick={handleCreate}
              disabled={creating}
              style={{
                width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
                background: creating ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                color: '#fff', fontWeight: 700, fontSize: '16px',
                cursor: creating ? 'not-allowed' : 'pointer',
              }}
            >
              {creating ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        ) : (
          /* Join Room Tab */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Room Number */}
            <div>
              <label style={labelStyle}>Room Number</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="Enter room number"
                value={joinRoomId}
                onChange={e => setJoinRoomId(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={inputStyle}
                autoFocus
              />
            </div>

            {/* Password */}
            <div>
              <label style={labelStyle}>Password</label>
              <input
                type="text"
                placeholder="Enter password (if required)"
                value={joinPassword}
                onChange={e => setJoinPassword(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Buy-in */}
            <div>
              <label style={labelStyle}>Buy-in: {joinBuyIn} chips</label>
              <input
                type="range"
                min={100}
                max={2000}
                step={10}
                value={joinBuyIn}
                onChange={e => setJoinBuyIn(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#8b5cf6' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                <span>100</span>
                <span>2000</span>
              </div>
            </div>

            {/* Join Button */}
            <button
              onClick={handleJoin}
              disabled={joining || !joinRoomId}
              style={{
                width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
                background: (joining || !joinRoomId) ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                color: '#fff', fontWeight: 700, fontSize: '16px',
                cursor: (joining || !joinRoomId) ? 'not-allowed' : 'pointer',
              }}
            >
              {joining ? 'Joining...' : 'Join Room'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: '13px',
  color: 'rgba(255,255,255,0.5)',
  display: 'block',
  marginBottom: '8px',
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.05)',
  color: '#fff',
  fontSize: '16px',
  outline: 'none',
  boxSizing: 'border-box',
};
