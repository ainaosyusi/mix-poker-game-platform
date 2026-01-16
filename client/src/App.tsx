import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Lobby } from './Lobby';
import { Table } from './Table';

// アプリバージョン
const APP_VERSION = 'v0.3.3';

function App() {
  // Phase 3-A: Routing State
  const [currentView, setCurrentView] = useState<'name' | 'lobby' | 'table'>('name');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [initialRoomData, setInitialRoomData] = useState<any>(null);
  const [playerName, setPlayerName] = useState('');
  const [myId, setMyId] = useState('');

  const socketRef = useRef<Socket | null>(null);

  // Socket.IO接続の初期化
  useEffect(() => {
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
    console.log('Connecting to server:', serverUrl);
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
  const handleJoinRoom = (roomId: string, roomData?: any) => {
    setCurrentRoomId(roomId);
    setInitialRoomData(roomData || null);
    setCurrentView('table');
  };

  const handleLeaveRoom = () => {
    setCurrentRoomId(null);
    setInitialRoomData(null);
    setCurrentView('lobby');
  };

  const handleSetName = () => {
    if (playerName.trim()) {
      setCurrentView('lobby');
    }
  };

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
      yourSocketId={myId}
      onLeaveRoom={handleLeaveRoom}
    />
  );
}

export default App;