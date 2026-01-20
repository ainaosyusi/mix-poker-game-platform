import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Lobby } from './Lobby';
import { Table } from './Table';

// アプリバージョン
const APP_VERSION = 'v0.3.3';

function App() {
  // Phase 3-A: Routing State
  const [currentView, setCurrentView] = useState<'name' | 'lobby' | 'table'>(() => {
    const storedName = localStorage.getItem('mgp-player-name');
    return storedName ? 'lobby' : 'name';
  });
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [initialRoomData, setInitialRoomData] = useState<any>(null);
  const [initialHand, setInitialHand] = useState<string[] | null>(null);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('mgp-player-name') || '');
  const [myId, setMyId] = useState('');

  const socketRef = useRef<Socket | null>(null);

  // Socket.IO接続の初期化
  useEffect(() => {
    // 本番環境では同一オリジン（空文字）、開発環境ではlocalhostを使用
    const serverUrl = import.meta.env.VITE_SERVER_URL ||
      (import.meta.env.PROD ? '' : 'http://localhost:3000');
    console.log('Connecting to server:', serverUrl || '(same origin)');
    const socket = io(serverUrl);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Connected to server');
      setMyId(socket.id || '');
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
    });

    // Cleanup
    return () => {
      socket.disconnect();
    };
  }, []);

  // Routing Handlers
  const handleJoinRoom = (roomId: string, roomData?: any, yourHand?: string[] | null) => {
    setCurrentRoomId(roomId);
    setInitialRoomData(roomData || null);
    setInitialHand(yourHand || null);
    setCurrentView('table');
  };

  const handleLeaveRoom = () => {
    setCurrentRoomId(null);
    setInitialRoomData(null);
    setInitialHand(null);
    setCurrentView('lobby');
  };

  const handleSetName = () => {
    if (playerName.trim()) {
      localStorage.setItem('mgp-player-name', playerName.trim());
      setCurrentView('lobby');
    }
  };

  // 注: 自動遷移は削除。handleSetNameでの明示的な操作のみで遷移する

  // 名前入力画面
  if (currentView === 'name') {
    return (
      <div className="name-input-page">
        <div className="name-input-card">
          <div className="name-input-icon">🎰</div>
          <h1 className="name-input-title">Mix Poker</h1>
          <p className="name-input-subtitle">テキサスホールデムからミックスゲームまで</p>
          <input
            type="text"
            className="name-input-field"
            placeholder="プレイヤー名を入力..."
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSetName()}
          />
          <button
            className="name-input-btn"
            onClick={handleSetName}
            disabled={!playerName.trim()}
          >
            ロビーに入る
          </button>
          <div className="version-info">{APP_VERSION}</div>
        </div>
      </div>
    );
  }

  // ロビー画面
  if (currentView === 'lobby') {
    return (
      <Lobby
        socket={socketRef.current}
        playerName={playerName}
        onJoinRoom={handleJoinRoom}
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
