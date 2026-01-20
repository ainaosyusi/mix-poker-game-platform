// ========================================
// Mix Poker - GameLog Component
// ゲームアクション履歴ログ（インラインスタイル版）
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
  cards?: string[];
}

interface GameLogProps {
  entries: LogEntry[];
  isCollapsed?: boolean;
  onToggle?: () => void;
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

// カード文字列をパース
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
      style={{
        color: isRed ? '#ef4444' : '#1e293b',
        backgroundColor: '#fff',
        border: '1px solid #d1d5db',
        borderRadius: 2,
        padding: '0 2px',
        marginLeft: 2,
        fontSize: 10,
        fontWeight: 'bold',
        display: 'inline-block',
      }}
    >
      {formatRank(card.rank)}{suitEmoji}
    </span>
  );
}

// エントリの背景色取得
function getEntryBgColor(entry: LogEntry): string {
  if (entry.type === 'action') {
    switch (entry.action) {
      case 'fold': return 'rgba(239, 68, 68, 0.1)';
      case 'check': return 'rgba(16, 185, 129, 0.1)';
      case 'call': return 'rgba(59, 130, 246, 0.1)';
      case 'bet': return 'rgba(251, 191, 36, 0.1)';
      case 'raise': return 'rgba(251, 191, 36, 0.15)';
      case 'allin': return 'rgba(124, 58, 237, 0.15)';
    }
  }
  if (entry.type === 'event') {
    switch (entry.event) {
      case 'win': return 'rgba(34, 197, 94, 0.15)';
      case 'flop':
      case 'turn':
      case 'river': return 'rgba(99, 102, 241, 0.1)';
    }
  }
  return 'transparent';
}

export const GameLog = memo(function GameLog({
  entries,
  isCollapsed = false,
  onToggle,
}: GameLogProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isMinimized, setIsMinimized] = useState(isCollapsed);

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
    <div
      style={{
        position: 'fixed',
        bottom: 80, // アクションバーの上に配置
        right: 16,
        width: 280,
        maxHeight: isMinimized ? 36 : 200,
        background: 'rgba(17, 24, 39, 0.95)',
        backdropFilter: 'blur(8px)',
        borderRadius: 8,
        border: '1px solid #374151',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: 40,
        overflow: 'hidden',
        transition: 'max-height 0.2s ease-out',
      }}
    >
      <div
        onClick={handleToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'rgba(31, 41, 55, 0.8)',
          cursor: 'pointer',
          borderBottom: isMinimized ? 'none' : '1px solid #374151',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 'bold', color: '#d1d5db' }}>
          📋 ログ
        </span>
        <span style={{ fontSize: 10, color: '#6b7280' }}>
          {isMinimized ? '▲' : '▼'}
        </span>
      </div>

      {!isMinimized && (
        <div
          ref={contentRef}
          style={{
            maxHeight: 160,
            overflowY: 'auto',
            padding: '4px 0',
          }}
        >
          {entries.length === 0 ? (
            <div
              style={{
                padding: '12px',
                textAlign: 'center',
                color: '#6b7280',
                fontSize: 11,
              }}
            >
              アクションを待機中...
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  padding: '4px 12px',
                  fontSize: 11,
                  borderBottom: '1px solid rgba(55, 65, 81, 0.5)',
                  background: getEntryBgColor(entry),
                }}
              >
                <span style={{ color: '#6b7280', marginRight: 8 }}>
                  {formatTime(entry.timestamp)}
                </span>
                <span style={{ color: '#d1d5db' }}>
                  {entry.message}
                  {entry.cards && entry.cards.length > 0 && (
                    <span style={{ marginLeft: 4 }}>
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
