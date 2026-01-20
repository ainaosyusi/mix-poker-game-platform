// ========================================
// Mix Poker - Table Component (Refactored)
// メインテーブルページコンポーネント
// ========================================

import { useState, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { PokerTable } from './components/table/PokerTable';
import { ActionPanel } from './components/action/ActionPanel';
import { Card } from './components/cards/Card';
import { GameLog, createActionLog, createEventLog } from './components/log/GameLog';
import type { LogEntry } from './components/log/GameLog';
import { evaluateHandRank } from './handEvaluator';
import type {
  Player,
  GameState,
  Room,
  ActionType,
  ShowdownResult,
} from './types/table';

// ゲームバリアントの表示名マッピング
const GAME_VARIANT_NAMES: Record<string, string> = {
  NLH: "No Limit Hold'em",
  PLO: 'Pot Limit Omaha',
  PLO8: 'PLO Hi-Lo',
  '2-7_TD': '2-7 Triple Draw',
  '7CS': '7 Card Stud',
  '7CS8': '7 Card Stud Hi-Lo',
  RAZZ: 'Razz',
  BADUGI: 'Badugi',
};

function getGameVariantFullName(variantId: string): string {
  return GAME_VARIANT_NAMES[variantId] || variantId;
}

interface TableProps {
  socket: Socket | null;
  roomId: string;
  initialRoomData: Room | null;
  yourSocketId: string;
  onLeaveRoom: () => void;
}

export function Table({
  socket,
  roomId,
  initialRoomData,
  yourSocketId,
  onLeaveRoom
}: TableProps) {
  const [room, setRoom] = useState<Room | null>(initialRoomData);
  const [buyInAmount, setBuyInAmount] = useState(500);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [yourHand, setYourHand] = useState<string[]>([]);
  const [isYourTurn, setIsYourTurn] = useState(false);
  const [validActions, setValidActions] = useState<ActionType[]>([]);
  const [showdownResult, setShowdownResult] = useState<ShowdownResult | null>(null);
  const [currentBetInfo, setCurrentBetInfo] = useState({
    currentBet: 0,
    minRaise: 0,
    maxBet: 0,
    betStructure: 'no-limit' as 'no-limit' | 'pot-limit' | 'fixed',
    isCapped: false,
    raisesRemaining: 4,
    fixedBetSize: undefined as number | undefined,
  });
  const [gameLogs, setGameLogs] = useState<LogEntry[]>([]);
  const [isLogCollapsed, setIsLogCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [rebuyAmount, setRebuyAmount] = useState(500);
  const [showRebuyDialog, setShowRebuyDialog] = useState(false);

  // Draw game用state
  const [isDrawPhase, setIsDrawPhase] = useState(false);
  const [selectedDrawCards, setSelectedDrawCards] = useState<number[]>([]);
  const [hasDrawnThisRound, setHasDrawnThisRound] = useState(false);

  // ランアウト(オールイン)用state
  const [isRunout, setIsRunout] = useState(false);

  // ゲーム設定用state
  const [settingsForm, setSettingsForm] = useState({
    smallBlind: 5,
    bigBlind: 10,
    studAnte: 2, // Studゲームのアンティ/Bring-In
    selectedVariant: 'NLH',
    rotationEnabled: false,
    rotationGames: ['NLH', 'PLO'],
    handsPerGame: 8,
    sevenDeuceEnabled: false,
  });

  // タイマー関連state
  const [timerSeconds, setTimerSeconds] = useState<number | undefined>(undefined);
  const [timeBankChips, setTimeBankChips] = useState(5);
  const maxTimerSeconds = 30;

  // ログを追加するヘルパー
  const addLog = useCallback((entry: LogEntry) => {
    setGameLogs(prev => [...prev.slice(-49), entry]); // 最大50件保持
  }, []);

  // Socket.io イベントハンドリング
  useEffect(() => {
    if (!socket) return;

    socket.on('room-state-update', (updatedRoom: Room) => {
      setRoom(updatedRoom);
    });

    socket.on('room-joined', (data: { room: Room }) => {
      setRoom(data.room);
    });

    socket.on('game-started', (data: { room: Room; yourHand: string[] }) => {
      setRoom(data.room);
      setYourHand(data.yourHand || []);
      setShowdownResult(null);
      // ハンド開始ログは不要（ユーザー要望）
    });

    socket.on('your-turn', (data: {
      validActions: ActionType[];
      currentBet: number;
      minRaise: number;
      maxBet?: number;
      betStructure?: 'no-limit' | 'pot-limit' | 'fixed';
      isCapped?: boolean;
      raisesRemaining?: number;
      fixedBetSize?: number;
    }) => {
      setIsYourTurn(true);
      setValidActions(data.validActions);
      setCurrentBetInfo({
        currentBet: data.currentBet,
        minRaise: data.minRaise,
        maxBet: data.maxBet || 10000,
        betStructure: data.betStructure || 'no-limit',
        isCapped: data.isCapped || false,
        raisesRemaining: data.raisesRemaining ?? 4,
        fixedBetSize: data.fixedBetSize,
      });
      // タイマー開始
      setTimerSeconds(maxTimerSeconds);
    });

    // タイマー更新（サーバーからの同期）
    socket.on('timer-update', (data: { seconds: number }) => {
      setTimerSeconds(data.seconds);
    });

    // タイムバンク更新
    socket.on('timebank-update', (data: { chips: number }) => {
      setTimeBankChips(data.chips);
    });

    socket.on('showdown-result', (result: ShowdownResult) => {
      setShowdownResult(result);
      setYourHand([]);
      setIsYourTurn(false);
      // ショーダウンログは不要、勝者のみ表示
      result.winners.forEach(w => {
        // 役名と獲得額を表示（カードも小さく表示）
        addLog(createEventLog(
          'win',
          `${w.playerName} が ${w.amount.toLocaleString()} を獲得 (${w.handRank})`,
          w.hand && w.hand.length > 0 ? w.hand : undefined
        ));
      });
    });

    socket.on('action-invalid', (data: { reason: string }) => {
      // "Not your turn" の場合はサーバーが既に自動処理済みなので無視
      if (data.reason === 'Not your turn') {
        console.log('⏰ サーバーが自動アクションを処理済み');
        return;
      }
      // その他のエラーは表示
      console.warn(`無効なアクション: ${data.reason}`);
      addLog(createEventLog('info', `無効なアクション: ${data.reason}`));
    });

    // 着席成功時のログ
    socket.on('sit-down-success', (data: { seatIndex: number }) => {
      console.log(`✅ Successfully sat down at seat ${data.seatIndex}`);
      addLog(createEventLog('info', `シート ${data.seatIndex + 1} に着席しました`));
    });

    // リバイ成功時
    socket.on('rebuy-success', (data: { amount: number; newStack: number }) => {
      console.log(`💰 Rebuy successful: +${data.amount} (new stack: ${data.newStack})`);
      addLog(createEventLog('info', `${data.amount} チップを追加しました (合計: ${data.newStack})`));
      setShowRebuyDialog(false);
    });

    // ドロー完了時（自分のカード更新）
    socket.on('draw-complete', (data: { newHand: string[] }) => {
      setYourHand(data.newHand);
      setHasDrawnThisRound(true);
      setSelectedDrawCards([]);
    });

    // 他プレイヤーのドロー情報
    socket.on('player-drew', (data: { playerId: string; playerName: string; cardCount: number }) => {
      addLog(createEventLog('info', `${data.playerName} が ${data.cardCount} 枚交換`));
    });

    // オールインランアウト開始
    socket.on('runout-started', (data: { runoutPhase: string; fullBoard: string[] }) => {
      console.log(`🎬 All-in runout started from ${data.runoutPhase}`);
      setIsRunout(true);
      addLog(createEventLog('info', '⚡ オールイン！ランアウト開始...'));
    });

    // オールインランアウト中のボード更新
    socket.on('runout-board', (data: { board: string[]; phase: string }) => {
      console.log(`🃏 Runout ${data.phase}: ${data.board.join(' ')}`);
      // room stateを直接更新してボードを表示
      setRoom(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          gameState: {
            ...prev.gameState,
            board: data.board,
          }
        };
      });
      // フェーズログ
      if (data.phase === 'FLOP') {
        addLog(createEventLog('flop', data.board.slice(0, 3).join(' ')));
      } else if (data.phase === 'TURN') {
        addLog(createEventLog('turn', data.board[3]));
      } else if (data.phase === 'RIVER') {
        addLog(createEventLog('river', data.board[4]));
        // リバー後にランアウト終了
        setTimeout(() => setIsRunout(false), 500);
      }
    });

    return () => {
      socket.off('room-state-update');
      socket.off('room-joined');
      socket.off('game-started');
      socket.off('your-turn');
      socket.off('showdown-result');
      socket.off('action-invalid');
      socket.off('sit-down-success');
      socket.off('rebuy-success');
      socket.off('draw-complete');
      socket.off('player-drew');
      socket.off('runout-started');
      socket.off('runout-board');
      socket.off('timer-update');
      socket.off('timebank-update');
    };
  }, [socket]);

  // タイマーカウントダウン
  useEffect(() => {
    if (!isYourTurn || timerSeconds === undefined) return;

    const interval = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev === undefined || prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isYourTurn, timerSeconds !== undefined]);

  // タイマーが0になった場合の処理
  // ※サーバー側でタイマー管理と自動アクションを行うため、
  //   クライアントはタイマー表示のリセットのみ行う
  useEffect(() => {
    if (timerSeconds === 0 && isYourTurn) {
      // サーバーが自動アクションを処理するので、クライアントは何もしない
      // タイマー表示をリセットするのみ
      setTimerSeconds(undefined);
    }
  }, [timerSeconds, isYourTurn]);

  // ドローフェーズ検出
  useEffect(() => {
    if (!room) return;

    const gameState = room.gameState as any;
    const isInDrawPhase = gameState.isDrawPhase === true;

    if (isInDrawPhase && !isDrawPhase) {
      // ドローフェーズ開始
      setIsDrawPhase(true);
      setHasDrawnThisRound(false);
      setSelectedDrawCards([]);
    } else if (!isInDrawPhase && isDrawPhase) {
      // ドローフェーズ終了
      setIsDrawPhase(false);
      setHasDrawnThisRound(false);
      setSelectedDrawCards([]);
    }
  }, [room?.gameState]);

  // アクション実行
  const handleAction = useCallback((type: ActionType, amount?: number) => {
    if (!socket) return;
    socket.emit('player-action', { type, amount });
    setIsYourTurn(false);
    setTimerSeconds(undefined);
  }, [socket]);

  // タイムバンク使用
  const handleUseTimeBank = useCallback(() => {
    if (!socket || timeBankChips <= 0) return;
    socket.emit('use-timebank');
    setTimeBankChips(prev => Math.max(0, prev - 1));
    setTimerSeconds(prev => (prev || 0) + 30);
  }, [socket, timeBankChips]);

  // ドローカード選択トグル
  const toggleDrawCard = useCallback((index: number) => {
    setSelectedDrawCards(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index];
      }
    });
  }, []);

  // ドロー実行
  const handleDraw = useCallback(() => {
    if (!socket) return;
    socket.emit('draw-exchange', { discardIndexes: selectedDrawCards });
  }, [socket, selectedDrawCards]);

  // ゲーム開始
  const handleStartGame = useCallback(() => {
    if (!socket) return;
    socket.emit('start-game');
  }, [socket]);

  // 着席
  const handleSitDown = useCallback((seatIndex: number) => {
    if (!socket || !room) return;
    socket.emit('sit-down', { seatIndex, buyIn: buyInAmount });
    setSelectedSeat(null);
  }, [socket, room, buyInAmount]);

  // 離席
  const handleLeaveRoom = useCallback(() => {
    if (!socket) return;
    socket.emit('leave-room');
    onLeaveRoom();
  }, [socket, onLeaveRoom]);

  // リバイ
  const handleRebuy = useCallback(() => {
    if (!socket || rebuyAmount <= 0) return;
    socket.emit('rebuy', { amount: rebuyAmount });
  }, [socket, rebuyAmount]);

  // 座席選択
  const handleSeatClick = useCallback((index: number) => {
    setSelectedSeat(prev => prev === index ? null : index);
  }, []);

  // ゲームバリアント変更
  const handleChangeVariant = useCallback((variant: string) => {
    if (!socket) return;
    socket.emit('set-game-variant', { variant });
    setSettingsForm(prev => ({ ...prev, selectedVariant: variant }));
  }, [socket]);

  // ローテーション設定
  const handleSetRotation = useCallback(() => {
    if (!socket) return;
    socket.emit('set-rotation', {
      enabled: settingsForm.rotationEnabled,
      gamesList: settingsForm.rotationGames,
      handsPerGame: settingsForm.handsPerGame
    });
  }, [socket, settingsForm]);

  // ブラインド変更
  const handleUpdateBlinds = useCallback(() => {
    if (!socket) return;
    socket.emit('update-room-config', {
      smallBlind: settingsForm.smallBlind,
      bigBlind: settingsForm.bigBlind,
      studAnte: settingsForm.studAnte
    });
  }, [socket, settingsForm]);

  // 7-2ゲームトグル
  const handleToggleSevenDeuce = useCallback(() => {
    if (!socket) return;
    const newValue = !settingsForm.sevenDeuceEnabled;
    socket.emit('toggle-meta-game', { game: 'sevenDeuce', enabled: newValue });
    setSettingsForm(prev => ({ ...prev, sevenDeuceEnabled: newValue }));
  }, [socket, settingsForm]);

  // ローテーションゲームリスト切り替え
  const toggleRotationGame = useCallback((game: string) => {
    setSettingsForm(prev => {
      const games = prev.rotationGames.includes(game)
        ? prev.rotationGames.filter(g => g !== game)
        : [...prev.rotationGames, game];
      return { ...prev, rotationGames: games };
    });
  }, []);

  // ローディング中
  if (!room) {
    return (
      <div className="table-loading">
        <div className="loading-content">
          <div className="loading-icon">🎰</div>
          <h3>部屋のデータを取得中...</h3>
          <p className="text-gray">ルームID: {roomId}</p>
          <button className="action-btn fold" onClick={onLeaveRoom}>
            ロビーに戻る
          </button>
        </div>
      </div>
    );
  }

  // 計算
  const yourSeatIndex = room.players.findIndex(p => p?.socketId === yourSocketId);
  const isSeated = yourSeatIndex !== -1;
  const seatedPlayerCount = room.players.filter(p => p !== null).length;
  const isWaiting = room.gameState.status === 'WAITING';

  // 確定ポット（現在のラウンドのベットを除く）
  // 各プレイヤーの現在のベット（player.bet）は手前に表示される
  // 中央のポットは確定分のみ表示する
  const currentRoundBets = room.players.reduce((sum, p) => sum + (p?.bet || 0), 0);
  const totalPotRaw = room.gameState.pot.main + room.gameState.pot.side.reduce((sum, s) => sum + s.amount, 0);
  // 表示用ポット = 全体ポット - 現在のラウンドのベット合計
  // ただし、pot.mainには既にcurrentRoundBetsが含まれている
  // 注: この実装はpot.mainにベットが即座に追加される現在のロジックに対応
  const displayPot = totalPotRaw - currentRoundBets;
  // ActionPanel用にはtotalPotを使用（ベット計算用）
  const totalPot = totalPotRaw;

  const yourBet = isSeated ? (room.players[yourSeatIndex]?.bet || 0) : 0;
  const yourStack = isSeated ? (room.players[yourSeatIndex]?.stack || 0) : 0;
  const maxPlayers = (room.config.maxPlayers as 6 | 8) || 6;

  return (
    <div className="table-page">
      {/* ヘッダー */}
      <header className="table-header">
        <div className="header-left">
          <h1 className="room-title">🎰 Room {roomId}</h1>
          <div className="room-info-row">
            <span className="blinds-info">{room.config.smallBlind}/{room.config.bigBlind}</span>
            <span className="hand-info">Hand #{room.gameState.handNumber}</span>
          </div>
        </div>
        {/* 現在のゲームバリアント表示 */}
        <div className="game-variant-display">
          <span className="game-variant-label">現在のゲーム</span>
          <span className="game-variant-name">{getGameVariantFullName(room.gameState.gameVariant)}</span>
          {room.rotation.gamesList.length > 1 && (
            <span className="rotation-info">
              ({room.rotation.currentGameIndex + 1}/{room.rotation.gamesList.length})
            </span>
          )}
        </div>
        <button className="action-btn check" onClick={() => setShowSettings(!showSettings)}>
          ⚙️ 設定
        </button>
        <button className="action-btn fold" onClick={handleLeaveRoom}>
          ロビーに戻る
        </button>
      </header>

      {/* ゲーム設定パネル */}
      {showSettings && (
        <div className="settings-panel">
          <div className="settings-header">
            <h3>⚙️ ゲーム設定</h3>
            <button className="close-btn" onClick={() => setShowSettings(false)}>✕</button>
          </div>

          {/* ゲームバリアント選択 */}
          <div className="settings-section">
            <h4>🎮 ゲーム選択</h4>
            <div className="variant-buttons">
              {Object.entries(GAME_VARIANT_NAMES).map(([id, name]) => (
                <button
                  key={id}
                  className={`variant-btn ${room.gameState.gameVariant === id ? 'active' : ''}`}
                  onClick={() => handleChangeVariant(id)}
                  disabled={!isWaiting}
                >
                  {name}
                </button>
              ))}
            </div>
            {!isWaiting && <p className="settings-hint">※ ゲーム中は変更できません</p>}
          </div>

          {/* ローテーション設定 */}
          <div className="settings-section">
            <h4>🔄 ミックスゲーム (ローテーション)</h4>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settingsForm.rotationEnabled}
                onChange={(e) => setSettingsForm(prev => ({ ...prev, rotationEnabled: e.target.checked }))}
              />
              ローテーションを有効にする
            </label>

            {settingsForm.rotationEnabled && (
              <>
                <div className="rotation-games">
                  <p>ローテーションに含めるゲーム:</p>
                  <div className="game-checkboxes">
                    {Object.entries(GAME_VARIANT_NAMES).map(([id, name]) => (
                      <label key={id} className="checkbox-label small">
                        <input
                          type="checkbox"
                          checked={settingsForm.rotationGames.includes(id)}
                          onChange={() => toggleRotationGame(id)}
                        />
                        {name}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="hands-per-game">
                  <label>1ゲームあたりのハンド数:</label>
                  <select
                    value={settingsForm.handsPerGame}
                    onChange={(e) => setSettingsForm(prev => ({ ...prev, handsPerGame: Number(e.target.value) }))}
                  >
                    <option value={4}>4ハンド</option>
                    <option value={6}>6ハンド (半周)</option>
                    <option value={8}>8ハンド (1周)</option>
                    <option value={12}>12ハンド (1.5周)</option>
                    <option value={16}>16ハンド (2周)</option>
                  </select>
                </div>

                <button className="action-btn check" onClick={handleSetRotation}>
                  ローテーション設定を適用
                </button>

                <div className="rotation-preview">
                  <p>順序: {settingsForm.rotationGames.join(' → ')}</p>
                </div>
              </>
            )}
          </div>

          {/* ブラインド設定 */}
          <div className="settings-section">
            <h4>💰 ブラインド設定</h4>
            <div className="blinds-inputs">
              <label>
                SB:
                <input
                  type="number"
                  value={settingsForm.smallBlind}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, smallBlind: Number(e.target.value) }))}
                  min={1}
                />
              </label>
              <label>
                BB:
                <input
                  type="number"
                  value={settingsForm.bigBlind}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, bigBlind: Number(e.target.value) }))}
                  min={2}
                />
              </label>
              <label title="Studゲームのブリングイン/アンティ額">
                Ante:
                <input
                  type="number"
                  value={settingsForm.studAnte}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, studAnte: Number(e.target.value) }))}
                  min={1}
                />
              </label>
              <button className="action-btn check" onClick={handleUpdateBlinds} disabled={!isWaiting}>
                適用
              </button>
            </div>
          </div>

          {/* メタゲーム設定 */}
          <div className="settings-section">
            <h4>🎲 サイドゲーム</h4>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settingsForm.sevenDeuceEnabled}
                onChange={handleToggleSevenDeuce}
              />
              7-2ゲーム (7-2で勝つとボーナス)
            </label>
          </div>
        </div>
      )}

      {/* ポーカーテーブル */}
      <PokerTable
        maxPlayers={maxPlayers}
        players={room.players}
        gameState={room.gameState}
        dealerBtnIndex={room.dealerBtnIndex}
        activePlayerIndex={room.activePlayerIndex}
        yourSocketId={yourSocketId}
        selectedSeat={selectedSeat}
        onSeatClick={handleSeatClick}
        showdownResult={showdownResult}
        isRunout={isRunout}
        yourHand={yourHand}
        timerSeconds={timerSeconds}
        maxTimerSeconds={maxTimerSeconds}
      />

      {/* 自分の手札表示は名前領域の上のカードで確認 */}
      {/* 役名はPlayerSeatコンポーネント内で表示 */}

      {/* ドロー交換パネル */}
      {yourHand.length > 0 && isDrawPhase && isSeated && (
        <div className="draw-panel">
          <div className="draw-header">
            <span className="draw-title">
              {hasDrawnThisRound ? '交換完了 - 他のプレイヤーを待っています...' : 'カードを選択して交換'}
            </span>
            <span className="hand-rank-display">
              {evaluateHandRank(yourHand, room.gameState.board, room.gameState.gameVariant)}
            </span>
          </div>
          <div className="draw-cards">
            {yourHand.map((card, i) => (
              <div
                key={i}
                className={`draw-card-wrapper ${selectedDrawCards.includes(i) ? 'selected' : ''} ${hasDrawnThisRound ? 'disabled' : ''}`}
                onClick={() => !hasDrawnThisRound && toggleDrawCard(i)}
              >
                <Card card={card} size="medium" />
                {selectedDrawCards.includes(i) && (
                  <div className="discard-indicator">捨</div>
                )}
              </div>
            ))}
          </div>
          {!hasDrawnThisRound && (
            <div className="draw-actions">
              <button className="draw-button stand-pat" onClick={() => handleDraw()}>
                スタンドパット (0枚)
              </button>
              <button
                className="draw-button draw-selected"
                onClick={handleDraw}
                disabled={selectedDrawCards.length === 0}
              >
                {selectedDrawCards.length}枚交換
              </button>
            </div>
          )}
        </div>
      )}

      {/* アクションパネル - ゲーム中は常時表示 */}
      {isSeated && !isWaiting && !showdownResult && (
        <ActionPanel
          validActions={validActions}
          currentBet={currentBetInfo.currentBet}
          minRaise={currentBetInfo.minRaise}
          maxBet={Math.min(currentBetInfo.maxBet, yourStack + yourBet)}
          yourBet={yourBet}
          pot={totalPot}
          onAction={handleAction}
          isYourTurn={isYourTurn}
          betStructure={currentBetInfo.betStructure}
          isCapped={currentBetInfo.isCapped}
          raisesRemaining={currentBetInfo.raisesRemaining}
          fixedBetSize={currentBetInfo.fixedBetSize}
          timerSeconds={timerSeconds}
          maxTimerSeconds={maxTimerSeconds}
          timeBankChips={timeBankChips}
          onUseTimeBank={handleUseTimeBank}
        />
      )}

      {/* ショーダウン結果 - 青いパネルを廃止、シンプルに勝者のみ表示 */}
      {/* ログに詳細が表示されるため、ここでは最小限の情報のみ */}
      {showdownResult && showdownResult.winners.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 140,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.85)',
            padding: '8px 20px',
            borderRadius: 8,
            border: '2px solid #22c55e',
            zIndex: 100,
            textAlign: 'center',
          }}
        >
          {showdownResult.winners.map((w, i) => (
            <div key={i} style={{ color: '#fff', fontSize: 14 }}>
              <span style={{ color: '#22c55e', fontWeight: 'bold' }}>🏆 {w.playerName}</span>
              {' が '}
              <span style={{ color: '#fbbf24' }}>+{w.amount.toLocaleString()}</span>
              {w.handRank !== 'Uncontested' && (
                <span style={{ color: '#9ca3af' }}> ({w.handRank})</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 着席コントロール */}
      {!isSeated && (
        <div className="action-panel seat-panel">
          <h3 className="seat-panel-title">💺 着席する</h3>
          <div className="seat-controls">
            <label className="text-gray">Buy-in:</label>
            <input
              type="number"
              className="bet-input"
              value={buyInAmount}
              onChange={(e) => setBuyInAmount(Number(e.target.value))}
              min={room.config.buyInMin}
              max={room.config.buyInMax}
            />
            <button
              className="action-btn check"
              onClick={() => selectedSeat !== null && handleSitDown(selectedSeat)}
              disabled={selectedSeat === null}
            >
              着席
            </button>
          </div>
          {selectedSeat === null && (
            <p className="seat-hint">テーブル上の空席をクリックして選択してください</p>
          )}
        </div>
      )}

      {/* ゲーム開始ボタン */}
      {isSeated && isWaiting && seatedPlayerCount >= 2 && (
        <div className="start-game-area">
          <button className="action-btn check start-btn" onClick={handleStartGame}>
            🎮 ゲーム開始
          </button>
        </div>
      )}

      {isSeated && isWaiting && seatedPlayerCount < 2 && yourStack > 0 && (
        <div className="waiting-message">
          ゲーム開始には2人以上のプレイヤーが必要です
        </div>
      )}

      {/* リバイダイアログ - チップが0の場合 */}
      {isSeated && isWaiting && yourStack === 0 && (
        <div className="rebuy-panel">
          <div className="rebuy-header">
            <span className="rebuy-icon">💸</span>
            <h3 className="rebuy-title">チップがありません</h3>
          </div>
          <p className="rebuy-message">ゲームを続けるにはチップを追加してください</p>
          <div className="rebuy-controls">
            <label className="text-gray">追加額:</label>
            <input
              type="number"
              className="bet-input"
              value={rebuyAmount}
              onChange={(e) => setRebuyAmount(Number(e.target.value))}
              min={room.config.buyInMin}
              max={room.config.buyInMax}
            />
            <button
              className="action-btn check"
              onClick={handleRebuy}
              disabled={rebuyAmount < room.config.buyInMin || rebuyAmount > room.config.buyInMax}
            >
              💰 チップ追加
            </button>
          </div>
          <div className="rebuy-options">
            <button className="action-btn fold small" onClick={handleLeaveRoom}>
              🚪 退出する
            </button>
          </div>
        </div>
      )}

      {/* ゲームログ */}
      <GameLog
        entries={gameLogs}
        isCollapsed={isLogCollapsed}
        onToggle={() => setIsLogCollapsed(!isLogCollapsed)}
      />

      {/* バージョン表示 */}
      <div className="version-badge">v0.3.3</div>
    </div>
  );
}

export default Table;
