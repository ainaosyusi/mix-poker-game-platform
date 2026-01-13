import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Lobby } from './Lobby';
import { Table } from './Table';

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
      <div style={{
        padding: '40px',
        textAlign: 'center',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        background: '#1a1a1a',
        color: 'white'
      }}>
        <h1 style={{ marginBottom: '20px', color: '#ffcc00' }}>🎰 Mix Poker Game Platform</h1>
        <h2 style={{ marginBottom: '30px', color: '#bbb' }}>Phase 3-A: Room Management</h2>
        <div style={{ maxWidth: '400px', margin: '0 auto' }}>
          <input
            type="text"
            placeholder="あなたの名前を入力..."
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSetName()}
            style={{
              padding: '12px',
              fontSize: '16px',
              width: '100%',
              marginBottom: '15px',
              background: '#2d2d2d',
              color: 'white',
              border: '1px solid #555',
              borderRadius: '4px'
            }}
          />
          <button
            onClick={handleSetName}
            disabled={!playerName.trim()}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              background: playerName.trim() ? '#4CAF50' : '#555',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: playerName.trim() ? 'pointer' : 'not-allowed',
              width: '100%'
            }}
          >
            ロビーに入る
          </button>
        </div>
      </div>
    );
  }

  // ロビー画面
  if (currentView === 'lobby') {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#1a1a1a',
        color: 'white'
      }}>
        <Lobby
          socket={socketRef.current}
          playerName={playerName}
          onJoinRoom={handleJoinRoom}
        />
      </div>
    );
  }

  // テーブル画面
  return (
    <div style={{
      minHeight: '100vh',
      background: '#1a1a1a',
      color: 'white'
    }}>
      <Table
        socket={socketRef.current}
        roomId={currentRoomId || ''}
        initialRoomData={initialRoomData}
        yourSocketId={myId}
        onLeaveRoom={handleLeaveRoom}
      />
    </div>
  );
}

export default App;