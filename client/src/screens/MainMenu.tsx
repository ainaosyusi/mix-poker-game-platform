/**
 * MainMenu - メインメニュー画面
 * アカウント設定、ゲームモード選択、プレイヤー統計表示
 */
import { useState, useEffect } from 'react';
import { apiPut, apiGet, setToken, clearToken } from '../api';
import { useCardPreferencesContext } from '../contexts/CardPreferencesContext';
import type { AuthUser } from './AuthScreen';

const AVATAR_ICONS = [
  'default', 'cat', 'dog', 'bear', 'fox', 'owl',
  'fish', 'star', 'moon', 'fire', 'diamond', 'crown',
];

const AVATAR_EMOJIS: Record<string, string> = {
  default: '👤', cat: '🐱', dog: '🐶', bear: '🐻', fox: '🦊', owl: '🦉',
  fish: '🐟', star: '⭐', moon: '🌙', fire: '🔥', diamond: '💎', crown: '👑',
};

interface PlayerStats {
  totalSessions: number;
  totalBuyIn: number;
  totalCashOut: number;
  totalProfit: number;
  totalHandsPlayed: number;
  totalHandsWon: number;
  winRate: number;
  todayProfit: number;
  todaySessions: number;
  recentSessions: Array<{
    id: string;
    roomId: string;
    gameVariant: string;
    buyIn: number;
    addOns: number;
    cashOut: number | null;
    profit: number | null;
    handsPlayed: number;
    handsWon: number;
    startedAt: string;
    endedAt: string | null;
  }>;
}

interface MainMenuProps {
  user: AuthUser;
  onNavigate: (view: 'roomSelect') => void;
  onLogout: () => void;
  onUserUpdate: (user: AuthUser) => void;
}

export function MainMenu({ user, onNavigate, onLogout, onUserUpdate }: MainMenuProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(user.displayName);
  const [editAvatar, setEditAvatar] = useState(user.avatarIcon);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const { colorMode, toggleColorMode } = useCardPreferencesContext();

  // 統計情報を取得
  useEffect(() => {
    apiGet<PlayerStats>('/api/stats/me')
      .then(setStats)
      .catch(() => { /* stats unavailable */ });
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const data = await apiPut<{ user: any; token: string }>('/api/auth/profile', {
        displayName: editDisplayName.trim(),
        avatarIcon: editAvatar,
      });
      if (data.token) {
        setToken(data.token);
      }
      onUserUpdate({
        ...user,
        displayName: data.user.displayName,
        avatarIcon: data.user.avatarIcon,
        token: data.token || user.token,
      });
      setShowSettings(false);
    } catch (err: any) {
      setSaveError(err.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    localStorage.removeItem('mgp-last-room');
    onLogout();
  };

  const formatProfit = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toLocaleString()}`;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a1628 0%, #1a2a4a 50%, #0d1f3c 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '40px 20px',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ fontSize: '40px', marginBottom: '8px' }}>🎰</div>
        <h1 style={{
          color: '#fff', fontSize: '32px', fontWeight: 700, margin: 0,
        }}>Mix Poker</h1>
      </div>

      {/* User Info */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '20px 24px',
        width: '100%',
        maxWidth: '400px',
        marginBottom: '30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'rgba(59,130,246,0.2)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '24px',
          }}>
            {AVATAR_EMOJIS[user.avatarIcon] || '👤'}
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: '16px', fontWeight: 600 }}>
              {user.displayName}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
              @{user.username}
            </div>
          </div>
        </div>
        <button
          onClick={() => { setShowSettings(!showSettings); setEditDisplayName(user.displayName); setEditAvatar(user.avatarIcon); }}
          style={{
            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px',
            padding: '8px 14px', color: 'rgba(255,255,255,0.7)', fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Settings
        </button>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '24px',
          width: '100%',
          maxWidth: '400px',
          marginBottom: '30px',
        }}>
          <h3 style={{ color: '#fff', margin: '0 0 16px', fontSize: '16px' }}>Account Settings</h3>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Display Name
            </label>
            <input
              type="text"
              value={editDisplayName}
              onChange={(e) => setEditDisplayName(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px',
                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
              Avatar
            </label>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px',
            }}>
              {AVATAR_ICONS.map((icon) => (
                <button
                  key={icon}
                  onClick={() => setEditAvatar(icon)}
                  style={{
                    width: '100%', aspectRatio: '1', border: editAvatar === icon ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px', background: editAvatar === icon ? 'rgba(59,130,246,0.2)' : 'rgba(0,0,0,0.2)',
                    fontSize: '22px', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {AVATAR_EMOJIS[icon]}
                </button>
              ))}
            </div>
          </div>

          {/* カードカラーモード */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
              Card Colors
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => toggleColorMode('2-color')}
                style={{
                  flex: 1, padding: '10px',
                  border: colorMode === '2-color' ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  background: colorMode === '2-color' ? 'rgba(59,130,246,0.2)' : 'rgba(0,0,0,0.2)',
                  color: '#fff', cursor: 'pointer', fontSize: '13px',
                }}
              >
                <div style={{ fontSize: '18px', letterSpacing: '2px' }}>
                  <span style={{ color: '#1a1a2e' }}>♠</span>
                  <span style={{ color: '#dc2626' }}>♥</span>
                  <span style={{ color: '#dc2626' }}>♦</span>
                  <span style={{ color: '#1a1a2e' }}>♣</span>
                </div>
                <div style={{ marginTop: '4px' }}>2-Color</div>
              </button>
              <button
                onClick={() => toggleColorMode('4-color')}
                style={{
                  flex: 1, padding: '10px',
                  border: colorMode === '4-color' ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  background: colorMode === '4-color' ? 'rgba(59,130,246,0.2)' : 'rgba(0,0,0,0.2)',
                  color: '#fff', cursor: 'pointer', fontSize: '13px',
                }}
              >
                <div style={{ fontSize: '18px', letterSpacing: '2px' }}>
                  <span style={{ color: '#1a1a2e' }}>♠</span>
                  <span style={{ color: '#dc2626' }}>♥</span>
                  <span style={{ color: '#2563eb' }}>♦</span>
                  <span style={{ color: '#16a34a' }}>♣</span>
                </div>
                <div style={{ marginTop: '4px' }}>4-Color</div>
              </button>
            </div>
          </div>

          {saveError && (
            <div style={{
              padding: '8px 12px', background: 'rgba(239,68,68,0.15)',
              borderRadius: '6px', color: '#f87171', fontSize: '12px', marginBottom: '10px',
            }}>
              {saveError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleSaveProfile}
              disabled={saving || !editDisplayName.trim()}
              style={{
                flex: 1, padding: '10px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px',
                fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setShowSettings(false)}
              style={{
                padding: '10px 16px', background: 'rgba(255,255,255,0.1)',
                border: 'none', borderRadius: '8px', color: 'rgba(255,255,255,0.7)',
                fontSize: '14px', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>

          <button
            onClick={handleLogout}
            style={{
              width: '100%', marginTop: '16px', padding: '10px',
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px', color: '#f87171', fontSize: '13px', cursor: 'pointer',
            }}
          >
            Logout
          </button>
        </div>
      )}

      {/* Player Stats */}
      {stats && stats.totalSessions > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '20px 24px',
          width: '100%',
          maxWidth: '400px',
          marginBottom: '20px',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '16px',
          }}>
            <h3 style={{ color: '#fff', margin: 0, fontSize: '14px' }}>Stats</h3>
            {stats.recentSessions.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                style={{
                  background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
                  fontSize: '12px', cursor: 'pointer',
                }}
              >
                {showHistory ? 'Hide History' : 'History'}
              </button>
            )}
          </div>

          {/* Summary Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '18px', fontWeight: 700,
                color: stats.totalProfit >= 0 ? '#10b981' : '#ef4444',
              }}>
                {formatProfit(stats.totalProfit)}
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                Total Profit
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '18px', fontWeight: 700,
                color: stats.todayProfit >= 0 ? '#10b981' : '#ef4444',
              }}>
                {formatProfit(stats.todayProfit)}
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                Today
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>
                {stats.winRate}%
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                Win Rate
              </div>
            </div>
          </div>

          {/* Detail Row */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.06)',
            fontSize: '12px', color: 'rgba(255,255,255,0.5)',
          }}>
            <span>{stats.totalSessions} sessions</span>
            <span>{stats.totalHandsPlayed} hands</span>
            <span>{stats.totalHandsWon} won</span>
          </div>

          {/* Recent Sessions */}
          {showHistory && stats.recentSessions.length > 0 && (
            <div style={{
              marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)',
              paddingTop: '12px',
            }}>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>
                Recent Sessions
              </div>
              {stats.recentSessions.map((s) => {
                const profit = s.profit ?? 0;
                const date = new Date(s.startedAt);
                const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
                return (
                  <div key={s.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)',
                    fontSize: '12px',
                  }}>
                    <div>
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>{dateStr}</span>
                      <span style={{ color: 'rgba(255,255,255,0.3)', marginLeft: '8px' }}>
                        {s.gameVariant}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                    }}>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {s.handsPlayed}h
                      </span>
                      <span style={{
                        fontWeight: 600, minWidth: '60px', textAlign: 'right',
                        color: profit >= 0 ? '#10b981' : '#ef4444',
                      }}>
                        {formatProfit(profit)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Game Mode Buttons */}
      <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <button
          onClick={() => onNavigate('roomSelect')}
          style={{
            padding: '24px', background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.2))',
            border: '1px solid rgba(16,185,129,0.3)', borderRadius: '16px',
            color: '#fff', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🃏</div>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>Cash Game</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
            NLH, PLO, Mix Games
          </div>
        </button>

        <button
          disabled
          style={{
            padding: '24px', background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px',
            color: 'rgba(255,255,255,0.3)', cursor: 'not-allowed', textAlign: 'left',
            opacity: 0.5,
          }}
        >
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🏆</div>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>Tournament</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
            Coming Soon
          </div>
        </button>

        <button
          disabled
          style={{
            padding: '24px', background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px',
            color: 'rgba(255,255,255,0.3)', cursor: 'not-allowed', textAlign: 'left',
            opacity: 0.5,
          }}
        >
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔒</div>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>Private Room</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
            Coming Soon
          </div>
        </button>
      </div>
    </div>
  );
}
