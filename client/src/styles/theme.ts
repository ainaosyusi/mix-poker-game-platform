/**
 * 共有スタイル定数
 * 全コンポーネントで使用するカラー・スタイルパターンを集約
 */

// ========== カラーパレット ==========

export const COLORS = {
  // 背景
  bgDark: '#0a1628',
  bgCard: 'rgba(255,255,255,0.05)',
  bgCardHover: 'rgba(255,255,255,0.08)',
  bgPanel: 'rgba(255,255,255,0.03)',
  bgOverlay: 'rgba(0,0,0,0.7)',

  // テキスト
  textPrimary: '#fff',
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.4)',
  textDisabled: 'rgba(255,255,255,0.3)',

  // ボーダー
  border: 'rgba(255,255,255,0.1)',
  borderLight: 'rgba(255,255,255,0.06)',
  borderMedium: 'rgba(255,255,255,0.15)',

  // アクセント
  purple: '#8b5cf6',
  purpleLight: '#c4b5fd',
  purpleBg: 'rgba(139,92,246,0.2)',
  purpleBorder: 'rgba(139,92,246,0.4)',
  purpleGradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',

  green: '#10b981',
  greenBg: 'rgba(16,185,129,0.15)',
  greenBorder: 'rgba(16,185,129,0.3)',

  red: '#dc2626',
  redBg: 'rgba(239,68,68,0.15)',
  redBorder: 'rgba(239,68,68,0.3)',
  redText: '#fca5a5',

  yellow: '#fbbf24',
  yellowBg: 'rgba(245,158,11,0.15)',
  yellowBorder: 'rgba(245,158,11,0.3)',

  blue: '#3b82f6',
  blueBg: 'rgba(59,130,246,0.15)',
} as const;

// ========== コンポーネントスタイル ==========

export const STYLES = {
  // カード / パネル
  card: {
    background: COLORS.bgCard,
    borderRadius: '16px',
    border: `1px solid ${COLORS.border}`,
    padding: '20px 24px',
  } as React.CSSProperties,

  // モーダルオーバーレイ
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 100,
    background: COLORS.bgOverlay,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  } as React.CSSProperties,

  // モーダルパネル
  modalPanel: {
    background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
    borderRadius: '16px',
    padding: '24px',
    maxWidth: '420px',
    width: '100%',
    maxHeight: '80vh',
    overflowY: 'auto' as const,
    border: `1px solid ${COLORS.border}`,
  } as React.CSSProperties,

  // 入力フィールド
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    border: `1px solid ${COLORS.borderMedium}`,
    background: COLORS.bgCard,
    color: COLORS.textPrimary,
    fontSize: '16px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  // ラベル
  label: {
    fontSize: '13px',
    color: COLORS.textMuted,
    display: 'block',
    marginBottom: '8px',
    fontWeight: 500,
  } as React.CSSProperties,

  // セクションラベル（大文字）
  sectionLabel: {
    fontSize: '12px',
    color: COLORS.textMuted,
    display: 'block',
    marginBottom: '8px',
    fontWeight: 500,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  } as React.CSSProperties,

  // エラーバナー
  errorBanner: {
    background: COLORS.redBg,
    border: `1px solid ${COLORS.redBorder}`,
    borderRadius: '10px',
    padding: '12px',
    marginBottom: '16px',
    color: COLORS.redText,
    fontSize: '13px',
  } as React.CSSProperties,

  // 警告バナー
  warningBanner: {
    background: COLORS.yellowBg,
    border: `1px solid ${COLORS.yellowBorder}`,
    borderRadius: '8px',
    padding: '10px 14px',
    color: COLORS.yellow,
    fontSize: '12px',
  } as React.CSSProperties,
} as const;

// ========== ページ背景 ==========

export const PAGE_BG: React.CSSProperties = {
  minHeight: '100vh',
  background: `linear-gradient(135deg, ${COLORS.bgDark}, #1a1a2e)`,
  color: COLORS.textPrimary,
};
