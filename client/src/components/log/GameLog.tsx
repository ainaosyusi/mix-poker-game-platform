// ========================================
// Mix Poker - GameLog Component
// ゲームアクション履歴ログ
// ========================================

import { memo, useRef, useEffect, useState } from 'react';

// ログエントリの型
export interface LogEntry {
  id: string;
  timestamp: number;
  type: 'action' | 'event' | 'system';
  action?: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin';
  event?: 'deal' | 'flop' | 'turn' | 'river' | 'showdown' | 'win' | 'newhand' | 'join' | 'leave' | 'rebuy' | 'info';
  playerName?: string;
  amount?: number;
  message: string;
  cards?: string[];  // 勝者のカード表示用（例: ["AS", "KH"]）
}

interface GameLogProps {
  entries: LogEntry[];
  isCollapsed?: boolean;
  onToggle?: () => void;
}

// ログエントリのCSSクラスを取得
function getEntryClass(entry: LogEntry): string {
  if (entry.type === 'action' && entry.action) {
    return `action-${entry.action}`;
  }
  if (entry.type === 'event' && entry.event) {
    return `event-${entry.event}`;
  }
  return '';
}

// タイムスタンプをフォーマット
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// カードのスートを絵文字に変換
function getSuitEmoji(suit: string): string {
  switch (suit.toUpperCase()) {
    case 'S': return '♠';
    case 'H': return '♥';
    case 'D': return '♦';
    case 'C': return '♣';
    default: return '';
  }
}

// カードのランクを表示用に変換
function formatRank(rank: string): string {
  return rank === 'T' ? '10' : rank;
}

// カード文字列をパース（例: "AS" → { rank: "A", suit: "S" }）
function parseCardString(cardStr: string): { rank: string; suit: string } | null {
  if (!cardStr || cardStr.length < 2) return null;
  const rank = cardStr.slice(0, -1);
  const suit = cardStr.slice(-1);
  return { rank, suit };
}

// ミニカードコンポーネント
function MiniCard({ cardStr }: { cardStr: string }) {
  const card = parseCardString(cardStr);
  if (!card) return null;

  const isRed = card.suit === 'H' || card.suit === 'D';
  const suitEmoji = getSuitEmoji(card.suit);

  return (
    <span
      className="mini-card"
      style={{
        color: isRed ? '#e74c3c' : '#2c3e50',
        backgroundColor: '#fff',
        border: '1px solid #ccc',
        borderRadius: '2px',
        padding: '0 2px',
        marginLeft: '2px',
        fontSize: '10px',
        fontWeight: 'bold',
        display: 'inline-block',
      }}
    >
      {formatRank(card.rank)}{suitEmoji}
    </span>
  );
}

export const GameLog = memo(function GameLog({
  entries,
  isCollapsed = false,
  onToggle,
}: GameLogProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isMinimized, setIsMinimized] = useState(isCollapsed);

  // 新しいエントリが追加されたら自動スクロール
  useEffect(() => {
    if (contentRef.current && !isMinimized) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [entries, isMinimized]);

  const handleToggle = () => {
    setIsMinimized(!isMinimized);
    onToggle?.();
  };

  return (
    <div className={`game-log ${isMinimized ? 'minimized' : ''}`}>
      <div className="game-log-header" onClick={handleToggle}>
        <h4 className="game-log-title">📋 ゲームログ</h4>
        <button className="game-log-toggle">
          {isMinimized ? '▲' : '▼'}
        </button>
      </div>

      {!isMinimized && (
        <div className="game-log-content" ref={contentRef}>
          {entries.length === 0 ? (
            <div className="game-log-empty">
              アクションを待機中...
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className={`game-log-entry ${getEntryClass(entry)}`}
              >
                <span className="log-time">{formatTime(entry.timestamp)}</span>
                <span className="log-message">
                  {entry.message}
                  {entry.cards && entry.cards.length > 0 && (
                    <span className="log-cards" style={{ marginLeft: '4px' }}>
                      {entry.cards.map((card, i) => (
                        <MiniCard key={i} cardStr={card} />
                      ))}
                    </span>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
});

// ログエントリを生成するヘルパー関数
export function createLogEntry(
  type: LogEntry['type'],
  message: string,
  options?: Partial<LogEntry>
): LogEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    type,
    message,
    ...options,
  };
}

// アクションログを生成
export function createActionLog(
  playerName: string,
  action: LogEntry['action'],
  amount?: number
): LogEntry {
  let message = `${playerName}`;

  switch (action) {
    case 'fold':
      message += ' がフォールド';
      break;
    case 'check':
      message += ' がチェック';
      break;
    case 'call':
      message += ` がコール (${amount?.toLocaleString()})`;
      break;
    case 'bet':
      message += ` がベット ${amount?.toLocaleString()}`;
      break;
    case 'raise':
      message += ` がレイズ to ${amount?.toLocaleString()}`;
      break;
    case 'allin':
      message += ` がオールイン ${amount?.toLocaleString()}`;
      break;
  }

  return createLogEntry('action', message, { action, playerName, amount });
}

// イベントログを生成
export function createEventLog(
  event: LogEntry['event'],
  details?: string,
  cards?: string[]
): LogEntry {
  let message = '';

  switch (event) {
    case 'newhand':
      message = '--- 新しいハンド開始 ---';
      break;
    case 'deal':
      message = 'カードを配布';
      break;
    case 'flop':
      message = `フロップ: ${details || ''}`;
      break;
    case 'turn':
      message = `ターン: ${details || ''}`;
      break;
    case 'river':
      message = `リバー: ${details || ''}`;
      break;
    case 'showdown':
      message = '--- ショーダウン ---';
      break;
    case 'win':
      message = details || '勝者決定';
      break;
    case 'join':
      message = details || 'プレイヤーが参加';
      break;
    case 'leave':
      message = details || 'プレイヤーが退出';
      break;
    case 'rebuy':
      message = details || 'リバイ';
      break;
    case 'info':
      message = details || '';
      break;
  }

  return createLogEntry('event', message, { event, cards });
}

export default GameLog;
