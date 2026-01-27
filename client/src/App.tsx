import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Table } from './Table';
import { AuthScreen } from './screens/AuthScreen';
import type { AuthUser } from './screens/AuthScreen';
import { MainMenu } from './screens/MainMenu';
import { RoomSelect } from './screens/RoomSelect';
import { hasToken, apiGet, setToken, clearToken } from './api';

type ViewType = 'auth' | 'mainMenu' | 'roomSelect' | 'table';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('auth');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [initialRoomData, setInitialRoomData] = useState<any>(null);
  const [initialHand, setInitialHand] = useState<string[] | null>(null);
  const [myId, setMyId] = useState('');
  const [user, setUser] = useState<AuthUser | null>(null);

  const socketRef = useRef<Socket | null>(null);

  // トークン検証 + 自動ログイン
  useEffect(() => {
    if (!hasToken()) return;

    apiGet<{ user: any }>('/api/auth/me')
      .then((data) => {
        const token = localStorage.getItem('mgp-jwt-token') || '';
        setUser({
          userId: data.user.id,
          username: data.user.username,
          displayName: data.user.displayName,
          avatarIcon: data.user.avatarIcon,
          token,
        });
        setCurrentView('mainMenu');
      })
      .catch(() => {
        clearToken();
      });
  }, []);

  // Socket.IO接続（認証済み時のみ）
  const connectSocket = useCallback((token: string) => {
    // 既存の接続があれば切断
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const serverUrl = import.meta.env.VITE_SERVER_URL ||
      (import.meta.env.PROD ? '' : 'http://localhost:3000');
    const socket = io(serverUrl, {
      auth: { token },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to server');
      setMyId(socket.id || '');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // 認証成功
  const handleAuthenticated = useCallback((authUser: AuthUser) => {
    setUser(authUser);
    connectSocket(authUser.token);
    setCurrentView('mainMenu');
  }, [connectSocket]);

  // ルーム参加
  const handleJoinRoom = useCallback((roomId: string, roomData?: any, yourHand?: string[] | null) => {
    setCurrentRoomId(roomId);
    setInitialRoomData(roomData || null);
    setInitialHand(yourHand || null);
    setCurrentView('table');
  }, []);

  // ルーム離脱 → メインメニューに戻る
  const handleLeaveRoom = useCallback(() => {
    setCurrentRoomId(null);
    setInitialRoomData(null);
    setInitialHand(null);
    setCurrentView('mainMenu');
  }, []);

  // ログアウト
  const handleLogout = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setUser(null);
    setCurrentView('auth');
  }, []);

  // ユーザー情報更新
  const handleUserUpdate = useCallback((updatedUser: AuthUser) => {
    setUser(updatedUser);
    // ソケットを再接続（新しいトークンで）
    connectSocket(updatedUser.token);
  }, [connectSocket]);

  // 認証画面
  if (currentView === 'auth') {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  // Socket未接続なら接続
  if (!socketRef.current && user) {
    connectSocket(user.token);
  }

  // メインメニュー
  if (currentView === 'mainMenu' && user) {
    return (
      <MainMenu
        user={user}
        onNavigate={(view) => setCurrentView(view)}
        onLogout={handleLogout}
        onUserUpdate={handleUserUpdate}
      />
    );
  }

  // ルーム選択
  if (currentView === 'roomSelect') {
    return (
      <RoomSelect
        socket={socketRef.current}
        onJoinRoom={handleJoinRoom}
        onBack={() => setCurrentView('mainMenu')}
      />
    );
  }

  // テーブル画面
  return (
    <Table
      socket={socketRef.current}
      roomId={currentRoomId || ''}
      initialRoomData={initialRoomData}
      initialHand={initialHand}
      yourSocketId={myId}
      onLeaveRoom={handleLeaveRoom}
    />
  );
}

export default App;
