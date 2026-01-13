import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface Card {
  suit: string;
  rank: string;
  faceUp?: boolean;
}

interface Player {
  id: string;
  name: string;
  chips: number;
  bet: number;
  status: 'active' | 'folded' | 'waiting';
}

interface GameState {
  players: Player[];
  pot: number;
  currentTurn: number;
  currentBet: number;
}

interface ShowdownResult {
  winner: {
    id: string;
    name: string;
    hand: Card[];
    handRank: string;
    wonChips: number;
  };
  allHands: Array<{
    playerId: string;
    playerName: string;
    hand: Card[];
    handRank: string;
  }>;
}

interface GameSettings {
  handSize: number;
  allowRedraw: boolean;
  gameMode: string;
  visibleCards: number;
}

interface OpponentCards {
  playerId: string;
  playerName: string;
  visibleCards: Card[];
  totalCards: number;
}

function App() {
  const [serverMsg, setServerMsg] = useState('Disconnected');
  const [myId, setMyId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [hand, setHand] = useState<Card[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [betAmount, setBetAmount] = useState(10);
  const [showdownResult, setShowdownResult] = useState<ShowdownResult | null>(null);
  const [currentSettings, setCurrentSettings] = useState<GameSettings>({
    handSize: 5,
    allowRedraw: false,
    gameMode: '5-Card Draw',
    visibleCards: 0
  });
  const [selectedPreset, setSelectedPreset] = useState('5-card-draw');
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [opponentCards, setOpponentCards] = useState<OpponentCards[]>([]);
  const socketRef = useRef<Socket | null>(null);

  // This useEffect handles the initial connection and socket event listeners
  useEffect(() => {
    // Connect to server using environment variable
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
    console.log('Connecting to server:', serverUrl);
    const socket = io(serverUrl);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Connected to server');
      setIsConnected(true);
      setServerMsg('Connected'); // Update server message on successful connection
    });

    socket.on('welcome', (data) => {
      console.log('Message from server:', data);
      setServerMsg(data.message);
      setMyId(data.id);
    });

    // ゲームステート更新
    socket.on('game-state-update', (data: GameState) => {
      console.log('Game state updated:', data);
      setGameState(data);
    });

    // カードが配られた時の処理
    socket.on('cards-dealt', (data: { hand: Card[] }) => {
      console.log('Received cards:', data.hand);
      setHand(data.hand);
    });

    // ショーダウン結果
    socket.on('showdown-result', (data: ShowdownResult) => {
      console.log('Showdown result:', data);
      setShowdownResult(data);
    });

    // 設定更新
    socket.on('settings-update', (data: GameSettings) => {
      console.log('Settings updated:', data);
      setCurrentSettings(data);
      setHand([]); // 設定変更時に手札をクリア
      setSelectedCards([]); // 選択もクリア
    });

    // 対戦相手のカード更新
    socket.on('opponent-cards-update', (data: OpponentCards) => {
      console.log('Opponent cards updated:', data);
      setOpponentCards(prev => {
        const filtered = prev.filter(p => p.playerId !== data.playerId);
        return [...filtered, data];
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setServerMsg('Disconnected');
      setMyId('');
      setHand([]);
      setGameState(null);
      setHasJoined(false);
      setShowdownResult(null);
    });
  };

  const disconnectFromServer = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const joinGame = () => {
    if (socketRef.current && playerName) {
      socketRef.current.emit('player-join', { name: playerName });
      setHasJoined(true);
    }
  };

  const drawCards = () => {
    if (socketRef.current) {
      socketRef.current.emit('draw-cards');
      setSelectedCards([]); // カード配布時に選択をクリア
    }
  };

  const handleBet = () => {
    if (socketRef.current) {
      socketRef.current.emit('player-bet', { amount: betAmount });
    }
  };

  const handleCall = () => {
    if (socketRef.current) {
      socketRef.current.emit('player-call');
    }
  };

  const handleFold = () => {
    if (socketRef.current) {
      socketRef.current.emit('player-fold');
    }
  };

  const handleShowdown = () => {
    if (socketRef.current) {
      socketRef.current.emit('showdown');
      setShowdownResult(null); // リセット
    }
  };

  const startNewRound = () => {
    setHand([]);
    setShowdownResult(null);
    setSelectedCards([]);
  };

  const changeSettings = (preset: string) => {
    if (socketRef.current) {
      socketRef.current.emit('change-settings', { preset });
      setSelectedPreset(preset);
    }
  };

  const toggleCardSelection = (index: number) => {
    setSelectedCards(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const exchangeCards = () => {
    if (socketRef.current && selectedCards.length > 0) {
      socketRef.current.emit('exchange-cards', { discardIndexes: selectedCards });
      setSelectedCards([]); // 選択をクリア
    }
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const currentPlayer = gameState?.players.find(p => p.id === myId);
  const isMyTurn = gameState && gameState.players[gameState.currentTurn]?.id === myId;

  return (
    <div style={{ padding: '50px', fontFamily: 'sans-serif', textAlign: 'center', backgroundColor: '#1a1a1a', color: '#fff', minHeight: '100vh' }}>
      <h1 style={{ color: '#ffcc00' }}>🃏 Mix Poker Dev Client</h1>

      {/* Connection Controls */}
      <div style={{ marginBottom: '30px', display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {!isConnected ? (
          <button
            onClick={connectToServer}
            style={buttonStyle('#4CAF50', '#2e7d32')}
          >
            Connect to Server
          </button>
        ) : !hasJoined ? (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Your Name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              style={inputStyle}
            />
            <button
              onClick={joinGame}
              style={buttonStyle('#4CAF50', '#2e7d32')}
              disabled={!playerName}
            >
              Join Game
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={drawCards}
              style={buttonStyle('#2196F3', '#1976D2')}
            >
              Deal Cards
            </button>
            {hand.length > 0 && (
              <button
                onClick={handleShowdown}
                style={buttonStyle('#FF9800', '#F57C00')}
              >
                Showdown
              </button>
            )}
            <button
              onClick={disconnectFromServer}
              style={buttonStyle('#f44336', '#c62828')}
            >
              Disconnect
            </button>
          </>
        )}
      </div>

      {/* Game Settings (only when joined) */}
      {hasJoined && !showdownResult && (
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#2d2d2d', borderRadius: '10px', maxWidth: '500px', margin: '0 auto 20px' }}>
          <h3 style={{ color: '#ffcc00', marginBottom: '10px' }}>🎮 Game Mode: {currentSettings.gameMode}</h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center' }}>
            <select
              value={selectedPreset}
              onChange={(e) => changeSettings(e.target.value)}
              style={{ ...inputStyle, width: '200px' }}
            >
              <option value="5-card-draw">5-Card Draw (5 cards)</option>
              <option value="texas-holdem">Texas Hold'em (2 cards)</option>
              <option value="omaha">Omaha (4 cards)</option>
              <option value="7-card-stud">7-Card Stud (7 cards, 4 visible)</option>
            </select>
          </div>
        </div>
      )}

      {/* Showdown Result */}
      {showdownResult && (
        <div style={{
          backgroundColor: '#2d5d2d',
          border: '3px solid #4CAF50',
          borderRadius: '15px',
          padding: '30px',
          marginBottom: '30px',
          maxWidth: '600px',
          margin: '0 auto 30px'
        }}>
          <h2 style={{ color: '#ffcc00', marginBottom: '20px' }}>
            🏆 {showdownResult.winner.name} Wins!
          </h2>
          <p style={{ fontSize: '20px', marginBottom: '10px' }}>
            <strong>{showdownResult.winner.handRank}</strong>
          </p>
          <p style={{ fontSize: '18px', color: '#4CAF50' }}>
            Won {showdownResult.winner.wonChips} chips!
          </p>

          {/* Winner's Hand */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
            {showdownResult.winner.hand.map((card, idx) => (
              <div key={idx} style={{ ...cardStyle(card.suit), width: '70px', height: '100px' }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{card.rank}</div>
                <div style={{ fontSize: '32px' }}>{card.suit}</div>
              </div>
            ))}
          </div>

          <button
            onClick={startNewRound}
            style={{ ...buttonStyle('#4CAF50', '#2e7d32'), marginTop: '20px' }}
          >
            New Round
          </button>
        </div>
      )}

      {/* Game State Display */}
      {gameState && hasJoined && !showdownResult && (
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ color: '#ffcc00' }}>💰 Pot: {gameState.pot} chips</h2>
          <p style={{ color: '#aaa' }}>Current Bet: {gameState.currentBet} chips</p>

          {/* Player Info */}
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '20px', flexWrap: 'wrap' }}>
            {gameState.players.map((player, idx) => (
              <div key={player.id} style={{
                ...playerCardStyle,
                backgroundColor: player.id === myId ? '#2d5d2d' : '#2d2d2d',
                border: idx === gameState.currentTurn ? '3px solid #ffcc00' : '2px solid #444',
              }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{player.name} {player.id === myId && '(You)'}</div>
                <div style={{ fontSize: '14px', color: '#aaa' }}>Chips: {player.chips}</div>
                <div style={{ fontSize: '14px', color: '#aaa' }}>Bet: {player.bet}</div>
                <div style={{ fontSize: '12px', color: player.status === 'folded' ? '#f44336' : '#4CAF50' }}>
                  {player.status.toUpperCase()}
                </div>
              </div>
            ))}
          </div>

          {/* Betting Controls */}
          {isMyTurn && currentPlayer?.status === 'active' && (
            <div style={{ marginTop: '30px', display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  min={gameState.currentBet + 1}
                  max={currentPlayer.chips}
                  style={inputStyle}
                />
                <button onClick={handleBet} style={buttonStyle('#4CAF50', '#2e7d32')}>
                  Bet
                </button>
              </div>
              <button onClick={handleCall} style={buttonStyle('#2196F3', '#1976D2')}>
                Call ({gameState.currentBet - currentPlayer.bet})
              </button>
              <button onClick={handleFold} style={buttonStyle('#f44336', '#c62828')}>
                Fold
              </button>
            </div>
          )}

          {!isMyTurn && (
            <div style={{ marginTop: '20px', color: '#ffcc00', fontSize: '18px' }}>
              Waiting for {gameState.players[gameState.currentTurn]?.name}'s turn...
            </div>
          )}
        </div>
      )}

      {/* Cards Display */}
      {hand.length > 0 && !showdownResult && (
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {hand.map((card, idx) => (
              <div
                key={idx}
                onClick={() => currentSettings.allowRedraw && toggleCardSelection(idx)}
                style={{
                  ...cardStyle(card.suit),
                  cursor: currentSettings.allowRedraw ? 'pointer' : 'default',
                  border: selectedCards.includes(idx) ? '4px solid #ffcc00' : '2px solid #444',
                  transform: selectedCards.includes(idx) ? 'translateY(-10px)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{card.rank}</div>
                <div style={{ fontSize: '48px' }}>{card.suit}</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', alignSelf: 'flex-end', transform: 'rotate(180deg)' }}>{card.rank}</div>
              </div>
            ))}
          </div>

          {/* Exchange Cards Button */}
          {currentSettings.allowRedraw && selectedCards.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <button onClick={exchangeCards} style={buttonStyle('#9C27B0', '#7B1FA2')}>
                Exchange {selectedCards.length} Card{selectedCards.length > 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Status Box */}
      <div style={{
        border: '2px solid #444',
        padding: '20px',
        borderRadius: '10px',
        backgroundColor: '#2d2d2d',
        maxWidth: '400px',
        margin: '0 auto'
      }}>
        <h2>Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</h2>
        <p>Server says: <strong>{serverMsg}</strong></p>
        {myId && <p>Your ID: <code>{myId}</code></p>}
        {currentPlayer && <p>Your Chips: <strong>{currentPlayer.chips}</strong></p>}
      </div>
    </div>
  );
}

// スタイル定義
const buttonStyle = (bg: string, shadow: string) => ({
  padding: '12px 24px',
  fontSize: '16px',
  cursor: 'pointer',
  backgroundColor: bg,
  color: 'white',
  border: 'none',
  borderRadius: '5px',
  boxShadow: `0 4px ${shadow}`,
  fontWeight: 'bold' as const
});

const inputStyle = {
  padding: '12px',
  fontSize: '16px',
  borderRadius: '5px',
  border: '2px solid #444',
  backgroundColor: '#2d2d2d',
  color: '#fff',
  width: '150px'
};

const cardStyle = (suit: string) => ({
  width: '100px',
  height: '150px',
  backgroundColor: 'white',
  color: (suit === '♥' || suit === '♦') ? '#e91e63' : '#333',
  borderRadius: '10px',
  display: 'flex',
  flexDirection: 'column' as const,
  justifyContent: 'space-between',
  padding: '10px',
  boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
});

const playerCardStyle = {
  padding: '15px',
  borderRadius: '10px',
  minWidth: '150px',
  textAlign: 'center' as const
};

export default App;