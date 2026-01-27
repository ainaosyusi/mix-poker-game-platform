/**
 * RoomSelect - ルーム選択画面
 * NLH/Mixカテゴリ + バイインダイアログ
 */
import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface RoomListItem {
  id: string;
  playerCount: number;
  maxPlayers: number;
  gameVariant: string;
  blinds: string;
  isPrivate: boolean;
  buyInMin?: number;
  buyInMax?: number;
  displayName?: string;
  category?: 'nlh' | 'mix';
  rotationGames?: string[];
}

interface RoomSelectProps {
  socket: Socket | null;
  onJoinRoom: (roomId: string, roomData?: any, yourHand?: string[] | null) => void;
  onBack: () => void;
}

// ゲームバリアントの表示名
const GAME_SHORT_NAMES: Record<string, string> = {
  NLH: "Hold'em",
  PLO: 'Omaha',
  PLO8: 'Omaha Hi-Lo',
  '7CS': 'Stud',
  '7CS8': 'Stud Hi-Lo',
  RAZZ: 'Razz',
  '2-7_TD': '2-7 TD',
  BADUGI: 'Badugi',
  BIG_O: '5-Card PLO',
  FLO8: 'FL Omaha8',
  PLO_OCEAN: 'PLO Ocean',
  PLO8_OCEAN: 'PLO8 Ocean',
  PLO_DB: 'PLO DB',
  FL_DRAMAHA_27: 'Dramaha 2-7',
  FL_DRAMAHA_HI: 'Dramaha Hi',
  FL_DRAMAHA_BADUGI: 'Dramaha Badugi',
  FL_DRAMAHA_HIDUGI: 'Dramaha Hidugi',
  FL_DRAMAHA_49: 'Dramaha 49',
  FL_DRAMAHA_0: 'Dramaha 0',
  FL_DRAMAHA_PICKEM: "Dramaha Pick'em",
  PL_CMRIVER1: 'CMR (1)',
  PL_CMRIVER2: 'CMR (2)',
  FL_STUD_27: 'Stud 2-7',
  FL_STUD_RAZZDUGI: 'Razzdugi',
  FL_SS_HI: 'SS Hi',
  FL_SS_RAZZ: 'SS Razz',
  FL_SS_HILO8: 'SS Hi-Lo8',
  FL_SS_HILOR: 'SS Hi-Lo',
  FL_SS_27: 'SS 2-7',
  FL_SS_RAZZDUGI: 'SS Razzdugi',
  NL_27_SD_NA: 'NL 2-7 SD',
  NL_27_SD_15A: 'NL 2-7 SD',
  FL_A5_TD: 'A-5 TD',
  FL_HIDUGI: 'Hidugi',
  FL_BADUECEY: 'Baduecey',
  FL_BADACEY: 'Badacey',
  FL_ARCHIE: 'Archie',
  NL_5HI_SD: 'NL 5-Hi SD',
  PL_BADUGI: 'PL Badugi',
};

// ルームカードの色テーマ
const ROOM_THEMES: Record<string, { bg: string; border: string; accent: string }> = {
  'nlh-1-2': { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', accent: '#10b981' },
  'nlh-2-5': { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', accent: '#3b82f6' },
  'nlh-5-10': { bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.3)', accent: '#a855f7' },
  'mix-plo': { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', accent: '#f59e0b' },
  'mix-8game': { bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.3)', accent: '#ec4899' },
  'mix-10game': { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', accent: '#ef4444' },
  'mix-10game-plus': { bg: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.3)', accent: '#f43f5e' },
};

const DEFAULT_THEME = { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', accent: '#6b7280' };

export function RoomSelect({ socket, onJoinRoom, onBack }: RoomSelectProps) {
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [buyInDialog, setBuyInDialog] = useState<{
    roomId: string;
    min: number;
    max: number;
    displayName: string;
  } | null>(null);
  const [buyInAmount, setBuyInAmount] = useState(0);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!socket) return;

    socket.emit('get-room-list');

    const handleRoomList = (roomList: RoomListItem[]) => {
      setRooms(roomList);
    };

    const handleRoomJoined = (data: { room: any; yourSocketId: string; yourHand?: string[] | null }) => {
      setJoining(false);
      setBuyInDialog(null);
      localStorage.setItem('mgp-last-room', data.room.id);
      onJoinRoom(data.room.id, data.room, data.yourHand || null);
    };

    const handleError = (error: { message: string }) => {
      setJoining(false);
      alert(error.message);
    };

    socket.on('room-list-update', handleRoomList);
    socket.on('room-joined', handleRoomJoined);
    socket.on('error', handleError);

    return () => {
      socket.off('room-list-update', handleRoomList);
      socket.off('room-joined', handleRoomJoined);
      socket.off('error', handleError);
    };
  }, [socket, onJoinRoom]);

  const handleRoomClick = (room: RoomListItem) => {
    if (room.playerCount >= room.maxPlayers) return;

    // バイイン範囲はサーバー設定を優先
    const parts = room.blinds.split('/');
    const bb = parseInt(parts[1]) || 10;
    const min = room.buyInMin ?? bb * 20;
    const max = room.buyInMax ?? bb * 100;
    const defaultBuyIn = Math.floor((min + max) / 2);

    setBuyInAmount(defaultBuyIn);
    setBuyInDialog({
      roomId: room.id,
      min,
      max,
      displayName: room.displayName || `Room ${room.id}`,
    });
  };

  const handleJoin = () => {
    if (!socket || !buyInDialog || joining) return;
    setJoining(true);
    socket.emit('quick-join', {
      roomId: buyInDialog.roomId,
      buyIn: buyInAmount,
    });
  };

  const nlhRooms = rooms.filter(r => r.category === 'nlh');
  const mixRooms = rooms.filter(r => r.category === 'mix');

  const renderRoomCard = (room: RoomListItem) => {
    const theme = ROOM_THEMES[room.id] || DEFAULT_THEME;
    const isFull = room.playerCount >= room.maxPlayers;

    return (
      <button
        key={room.id}
        onClick={() => handleRoomClick(room)}
        disabled={isFull}
        style={{
          padding: '20px',
          background: theme.bg,
          border: `1px solid ${theme.border}`,
          borderRadius: '14px',
          color: '#fff',
          cursor: isFull ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          opacity: isFull ? 0.5 : 1,
          transition: 'transform 0.15s, box-shadow 0.15s',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 700 }}>
              {room.displayName || room.id}
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
              Blinds {room.blinds}
            </div>
          </div>
          <div style={{
            padding: '4px 10px', borderRadius: '20px',
            background: isFull ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
            color: isFull ? '#f87171' : '#34d399',
            fontSize: '12px', fontWeight: 600,
          }}>
            {room.playerCount}/{room.maxPlayers}
          </div>
        </div>

        {room.rotationGames && room.rotationGames.length > 0 && (
          <div style={{
            marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '4px',
          }}>
            {room.rotationGames.slice(0, 6).map((g, i) => (
              <span key={i} style={{
                padding: '2px 6px', borderRadius: '4px',
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.6)', fontSize: '10px',
              }}>
                {GAME_SHORT_NAMES[g] || g}
              </span>
            ))}
            {room.rotationGames.length > 6 && (
              <span style={{
                padding: '2px 6px', borderRadius: '4px',
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.4)', fontSize: '10px',
              }}>
                +{room.rotationGames.length - 6}
              </span>
            )}
          </div>
        )}
      </button>
    );
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a1628 0%, #1a2a4a 50%, #0d1f3c 100%)',
      padding: '20px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        marginBottom: '30px', maxWidth: '500px', margin: '0 auto 30px',
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '10px',
            padding: '10px 14px', color: '#fff', fontSize: '14px', cursor: 'pointer',
          }}
        >
          Back
        </button>
        <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 700, margin: 0 }}>
          Cash Game
        </h1>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        {/* NLH Section */}
        {nlhRooms.length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{
              color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px',
            }}>
              No-Limit Hold'em
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {nlhRooms.map(renderRoomCard)}
            </div>
          </div>
        )}

        {/* Mix Section */}
        {mixRooms.length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{
              color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px',
            }}>
              Mix Games
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {mixRooms.map(renderRoomCard)}
            </div>
          </div>
        )}

        {rooms.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            color: 'rgba(255,255,255,0.4)',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎴</div>
            <p>No rooms available</p>
          </div>
        )}
      </div>

      {/* Buy-in Dialog */}
      {buyInDialog && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px',
        }}>
          <div style={{
            background: '#1a2a4a', borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '30px', width: '100%', maxWidth: '360px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <h3 style={{ color: '#fff', margin: '0 0 4px', fontSize: '18px' }}>
              {buyInDialog.displayName}
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', margin: '0 0 20px', fontSize: '13px' }}>
              Buy-in: {buyInDialog.min} - {buyInDialog.max}
            </p>

            {/* Slider */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                color: 'rgba(255,255,255,0.6)', fontSize: '12px', marginBottom: '8px',
              }}>
                <span>{buyInDialog.min}</span>
                <span style={{ color: '#fff', fontSize: '20px', fontWeight: 700 }}>
                  {buyInAmount}
                </span>
                <span>{buyInDialog.max}</span>
              </div>
              <input
                type="range"
                min={buyInDialog.min}
                max={buyInDialog.max}
                step={buyInDialog.min}
                value={buyInAmount}
                onChange={(e) => setBuyInAmount(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#3b82f6' }}
              />
            </div>

            {/* Quick amounts */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              {[buyInDialog.min, Math.floor((buyInDialog.min + buyInDialog.max) / 2), buyInDialog.max].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setBuyInAmount(amt)}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '8px',
                    background: buyInAmount === amt ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.05)',
                    border: buyInAmount === amt ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', fontSize: '13px', cursor: 'pointer',
                  }}
                >
                  {amt}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setBuyInDialog(null)}
                style={{
                  flex: 1, padding: '14px', background: 'rgba(255,255,255,0.1)',
                  border: 'none', borderRadius: '10px', color: 'rgba(255,255,255,0.7)',
                  fontSize: '15px', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleJoin}
                disabled={joining}
                style={{
                  flex: 2, padding: '14px',
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  border: 'none', borderRadius: '10px', color: '#fff',
                  fontSize: '15px', fontWeight: 600, cursor: joining ? 'wait' : 'pointer',
                  opacity: joining ? 0.6 : 1,
                }}
              >
                {joining ? 'Joining...' : 'Join Table'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
