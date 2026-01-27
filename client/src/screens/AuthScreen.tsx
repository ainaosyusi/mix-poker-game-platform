/**
 * AuthScreen - ログイン/新規登録画面
 */
import { useState } from 'react';
import { apiPost, setToken } from '../api';

interface AuthScreenProps {
  onAuthenticated: (user: AuthUser) => void;
}

export interface AuthUser {
  userId: string;
  username: string;
  displayName: string;
  avatarIcon: string;
  token: string;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password) return;
    setError('');
    setLoading(true);
    try {
      const data = await apiPost<{ token: string; user: any }>('/api/auth/login', {
        username: username.trim(),
        password,
      });
      setToken(data.token);
      onAuthenticated({
        userId: data.user.id,
        username: data.user.username,
        displayName: data.user.displayName,
        avatarIcon: data.user.avatarIcon,
        token: data.token,
      });
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!username.trim() || !password || !displayName.trim()) return;
    setError('');
    setLoading(true);
    try {
      const data = await apiPost<{ token: string; user: any }>('/api/auth/register', {
        username: username.trim(),
        password,
        displayName: displayName.trim(),
      });
      setToken(data.token);
      onAuthenticated({
        userId: data.user.id,
        username: data.user.username,
        displayName: data.user.displayName,
        avatarIcon: data.user.avatarIcon,
        token: data.token,
      });
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'login') {
      handleLogin();
    } else {
      handleRegister();
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a1628 0%, #1a2a4a 50%, #0d1f3c 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎰</div>
          <h1 style={{
            color: '#fff',
            fontSize: '28px',
            fontWeight: 700,
            margin: 0,
            letterSpacing: '1px',
          }}>Mix Poker</h1>
          <p style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '13px',
            marginTop: '4px',
          }}>Texas Hold'em to Mix Games</p>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '24px',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '10px',
          padding: '4px',
        }}>
          {(['login', 'register'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setError(''); }}
              style={{
                flex: 1,
                padding: '10px',
                border: 'none',
                borderRadius: '8px',
                background: activeTab === tab ? 'rgba(59,130,246,0.8)' : 'transparent',
                color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.5)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {tab === 'login' ? 'Login' : 'Register'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', marginBottom: '4px', display: 'block' }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                autoComplete="username"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '15px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {activeTab === 'register' && (
              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', marginBottom: '4px', display: 'block' }}>
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '15px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            <div>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', marginBottom: '4px', display: 'block' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                autoComplete={activeTab === 'login' ? 'current-password' : 'new-password'}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '15px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {error && (
            <div style={{
              marginTop: '14px',
              padding: '10px 14px',
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '13px',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password || (activeTab === 'register' && !displayName.trim())}
            style={{
              width: '100%',
              padding: '14px',
              marginTop: '20px',
              background: loading ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '16px',
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              opacity: (!username.trim() || !password || (activeTab === 'register' && !displayName.trim())) ? 0.5 : 1,
              transition: 'all 0.2s',
            }}
          >
            {loading ? '...' : (activeTab === 'login' ? 'Login' : 'Create Account')}
          </button>
        </form>
      </div>
    </div>
  );
}
