/**
 * MainMenu - メインメニュー画面
 * アカウント設定、ゲームモード選択
 */
import { useState } from 'react';
import { apiPut, setToken, clearToken } from '../api';
import type { AuthUser } from './AuthScreen';

const AVATAR_ICONS = [
  'default', 'cat', 'dog', 'bear', 'fox', 'owl',
  'fish', 'star', 'moon', 'fire', 'diamond', 'crown',
];

const AVATAR_EMOJIS: Record<string, string> = {
  default: '👤', cat: '🐱', dog: '🐶', bear: '🐻', fox: '🦊', owl: '🦉',
  fish: '🐟', star: '⭐', moon: '🌙', fire: '🔥', diamond: '💎', crown: '👑',
};

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
