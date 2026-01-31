/**
 * HostControlsPanel - ホスト設定パネル
 * プライベートルームのホストが設定を変更するためのモーダル
 */
import { useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { Room } from '../types/table';
import { GAME_OPTIONS, BLIND_PRESETS } from '../constants/gameConfig';

interface HostControlsPanelProps {
  room: Room;
  socket: Socket | null;
  onClose: () => void;
}

export function HostControlsPanel({ room, socket, onClose }: HostControlsPanelProps) {
  const currentBlindIndex = BLIND_PRESETS.findIndex(
    bp => bp.sb === room.config.smallBlind && bp.bb === room.config.bigBlind
  );
  const [blindIndex, setBlindIndex] = useState(currentBlindIndex >= 0 ? currentBlindIndex : 0);
  const [variant, setVariant] = useState(room.gameState.gameVariant);
  const [rotationEnabled, setRotationEnabled] = useState(room.rotation?.gamesList?.length > 1);
  const [selectedGames, setSelectedGames] = useState<string[]>(
    room.rotation?.gamesList || [room.gameState.gameVariant]
  );
  const [password, setPassword] = useState(room.config.password || '');

  const isGameInProgress = room.gameState.status !== 'WAITING';

  const toggleGame = (gameId: string) => {
    setSelectedGames(prev => {
      if (prev.includes(gameId)) {
        if (prev.length <= 1) return prev;
        return prev.filter(g => g !== gameId);
      }
      return [...prev, gameId];
    });
  };

  const handleApply = () => {
    if (!socket) return;

    const blind = BLIND_PRESETS[blindIndex];
    const payload: any = {};

    // ブラインド変更検出
    if (blind.sb !== room.config.smallBlind || blind.bb !== room.config.bigBlind) {
      payload.smallBlind = blind.sb;
      payload.bigBlind = blind.bb;
      payload.buyInMin = blind.bb * 50;
      payload.buyInMax = blind.bb * 200;
    }

    // ゲームバリアント変更検出
    if (!rotationEnabled && variant !== room.gameState.gameVariant) {
      payload.gameVariant = variant;
    }

    // ローテーション変更検出
    if (rotationEnabled && selectedGames.length > 1) {
      payload.rotation = {
        enabled: true,
        gamesList: selectedGames,
        handsPerGame: 8,
      };
    } else if (!rotationEnabled && room.rotation?.gamesList?.length > 1) {
      payload.rotation = { enabled: false };
    }

    // パスワード変更検出
    if (password !== (room.config.password || '')) {
      payload.password = password;
    }

    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    socket.emit('update-private-room-config', payload);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.7)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
          borderRadius: '16px', padding: '24px', maxWidth: '420px',
          width: '100%', maxHeight: '80vh', overflowY: 'auto',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '18px' }}>Room Settings</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
              fontSize: '20px', cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {isGameInProgress && (
          <div style={{
            background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
            color: '#fbbf24', fontSize: '12px',
          }}>
            Changes will apply after this hand
          </div>
        )}

        {/* Blinds */}
        <div style={{ marginBottom: '18px' }}>
          <label style={sectionLabel}>Blinds</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {BLIND_PRESETS.map((bp, i) => (
              <button
                key={bp.label}
                onClick={() => setBlindIndex(i)}
                style={{
                  padding: '8px 14px', borderRadius: '8px', border: 'none',
                  background: blindIndex === i ? '#8b5cf6' : 'rgba(255,255,255,0.08)',
                  color: blindIndex === i ? '#fff' : 'rgba(255,255,255,0.5)',
                  cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                }}
              >
                {bp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Game / Rotation */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <label style={{ ...sectionLabel, marginBottom: 0 }}>Games</label>
            <button
              onClick={() => setRotationEnabled(!rotationEnabled)}
              style={{
                fontSize: '11px', padding: '3px 10px', borderRadius: '12px', border: 'none',
                background: rotationEnabled ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.08)',
                color: rotationEnabled ? '#c4b5fd' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
              }}
            >
              {rotationEnabled ? 'Rotation ON' : 'Single Game'}
            </button>
          </div>

          {rotationEnabled ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {GAME_OPTIONS.map(game => {
                const selected = selectedGames.includes(game.id);
                return (
                  <button
                    key={game.id}
                    onClick={() => toggleGame(game.id)}
                    style={{
                      padding: '6px 12px', borderRadius: '16px',
                      border: selected ? '1px solid #8b5cf6' : '1px solid rgba(255,255,255,0.12)',
                      background: selected ? 'rgba(139,92,246,0.2)' : 'transparent',
                      color: selected ? '#c4b5fd' : 'rgba(255,255,255,0.4)',
                      cursor: 'pointer', fontSize: '12px',
                    }}
                  >
                    {game.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {GAME_OPTIONS.map(game => (
                <button
                  key={game.id}
                  onClick={() => setVariant(game.id)}
                  style={{
                    padding: '6px 12px', borderRadius: '16px',
                    border: variant === game.id ? '1px solid #8b5cf6' : '1px solid rgba(255,255,255,0.12)',
                    background: variant === game.id ? 'rgba(139,92,246,0.2)' : 'transparent',
                    color: variant === game.id ? '#c4b5fd' : 'rgba(255,255,255,0.4)',
                    cursor: 'pointer', fontSize: '12px',
                  }}
                >
                  {game.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Password */}
        <div style={{ marginBottom: '20px' }}>
          <label style={sectionLabel}>Password</label>
          <input
            type="text"
            placeholder="No password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)',
              color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '12px', borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
              color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              color: '#fff', cursor: 'pointer', fontWeight: 600,
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  fontSize: '12px',
  color: 'rgba(255,255,255,0.5)',
  display: 'block',
  marginBottom: '8px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};
