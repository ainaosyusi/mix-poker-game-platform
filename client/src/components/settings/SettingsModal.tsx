/**
 * SettingsModal - アカウント設定モーダル
 * 表示名、アバター、カードカラーモードの変更
 */
import { useState } from 'react';
import { apiPut, setToken, clearToken } from '../../api';
import { useCardPreferencesContext } from '../../contexts/CardPreferencesContext';
import type { AuthUser } from '../../screens/AuthScreen';

const AVATAR_ICONS = [
  'default', 'cat', 'dog', 'bear', 'fox', 'owl',
  'fish', 'star', 'moon', 'fire', 'diamond', 'crown',
];

const AVATAR_EMOJIS: Record<string, string> = {
  default: '\u{1F464}', cat: '\u{1F431}', dog: '\u{1F436}', bear: '\u{1F43B}', fox: '\u{1F98A}', owl: '\u{1F989}',
  fish: '\u{1F41F}', star: '\u2B50', moon: '\u{1F319}', fire: '\u{1F525}', diamond: '\u{1F48E}', crown: '\u{1F451}',
};

export { AVATAR_EMOJIS };

interface SettingsModalProps {
  user: AuthUser;
  onUserUpdate: (user: AuthUser) => void;
  onLogout: () => void;
  onClose: () => void;
}

export function SettingsModal({ user, onUserUpdate, onLogout, onClose }: SettingsModalProps) {
  const [editDisplayName, setEditDisplayName] = useState(user.displayName);
  const [editAvatar, setEditAvatar] = useState(user.avatarIcon);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const { colorMode, toggleColorMode } = useCardPreferencesContext();

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
      onClose();
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

      {/* Card Color Mode */}
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
              <span style={{ color: '#1a1a2e' }}>{'\u2660'}</span>
              <span style={{ color: '#dc2626' }}>{'\u2665'}</span>
              <span style={{ color: '#dc2626' }}>{'\u2666'}</span>
              <span style={{ color: '#1a1a2e' }}>{'\u2663'}</span>
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
              <span style={{ color: '#1a1a2e' }}>{'\u2660'}</span>
              <span style={{ color: '#dc2626' }}>{'\u2665'}</span>
              <span style={{ color: '#2563eb' }}>{'\u2666'}</span>
              <span style={{ color: '#16a34a' }}>{'\u2663'}</span>
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
          onClick={onClose}
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
  );
}
