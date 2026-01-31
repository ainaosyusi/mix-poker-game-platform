/**
 * 座席位置計算ユーティリティ
 * チップ・ディーラーボタン・スタッドカードの位置を計算
 *
 * 配置原則（重なり防止）:
 *   カード: プレイヤーパネルのすぐ上（最も近い）
 *   ディーラーボタン: パネルの横方向にオフセット（カードと異なる軸）
 *   チップ: テーブル中央方向に最も遠い位置
 */

// ============================
// ランドスケープ: チップ位置
// ============================
export function getChipPosition(seatIndex: number, maxPlayers: 6 | 8): React.CSSProperties {
  if (maxPlayers === 6) {
    switch (seatIndex) {
      case 0: return { bottom: '100%', marginBottom: 70, left: '50%', transform: 'translateX(-50%)' };
      case 1: return { bottom: '80%', right: '-90%' };
      case 2: return { top: '80%', right: '-90%' };
      case 3: return { top: '100%', marginTop: 70, left: '50%', transform: 'translateX(-50%)' };
      case 4: return { top: '80%', left: '-90%' };
      case 5: return { bottom: '80%', left: '-90%' };
      default: return { top: '100%', marginTop: 70 };
    }
  }
  switch (seatIndex) {
    case 0: return { bottom: '100%', marginBottom: 70, left: '50%', transform: 'translateX(-50%)' };
    case 1: return { bottom: '65%', right: '-85%' };
    case 2: return { top: '50%', right: '-95%', transform: 'translateY(-50%)' };
    case 3: return { top: '65%', right: '-85%' };
    case 4: return { top: '100%', marginTop: 70, left: '50%', transform: 'translateX(-50%)' };
    case 5: return { top: '65%', left: '-85%' };
    case 6: return { top: '50%', left: '-95%', transform: 'translateY(-50%)' };
    case 7: return { bottom: '65%', left: '-85%' };
    default: return { top: '100%', marginTop: 70 };
  }
}

// ============================
// ランドスケープ: Studアップカード位置
// ============================
export function getStudUpCardsPosition(seatIndex: number, maxPlayers: 6 | 8): React.CSSProperties {
  if (maxPlayers === 6) {
    switch (seatIndex) {
      case 0: return { bottom: '100%', marginBottom: 20, left: '50%', transform: 'translateX(-50%)' };
      case 1: return { bottom: '70%', right: '-55%' };
      case 2: return { top: '70%', right: '-55%' };
      case 3: return { top: '100%', marginTop: 20, left: '50%', transform: 'translateX(-50%)' };
      case 4: return { top: '70%', left: '-55%' };
      case 5: return { bottom: '70%', left: '-55%' };
      default: return { bottom: '100%', marginBottom: 20, left: '50%', transform: 'translateX(-50%)' };
    }
  }
  switch (seatIndex) {
    case 0: return { bottom: '100%', marginBottom: 20, left: '50%', transform: 'translateX(-50%)' };
    case 1: return { bottom: '50%', right: '-45%' };
    case 2: return { top: '30%', right: '-55%' };
    case 3: return { top: '50%', right: '-45%' };
    case 4: return { top: '100%', marginTop: 20, left: '50%', transform: 'translateX(-50%)' };
    case 5: return { top: '50%', left: '-45%' };
    case 6: return { top: '30%', left: '-55%' };
    case 7: return { bottom: '50%', left: '-45%' };
    default: return { bottom: '100%', marginBottom: 20, left: '50%', transform: 'translateX(-50%)' };
  }
}

// ============================
// ポートレート: Studアップカード位置
// ============================
export function getStudUpCardsPositionPortrait(seatIndex: number, maxPlayers: 6 | 8): React.CSSProperties {
  if (maxPlayers === 6) {
    switch (seatIndex) {
      case 0: return { bottom: '100%', marginBottom: 10, left: '50%', transform: 'translateX(-50%)' };
      case 1: return { bottom: '55%', right: '-40%' };
      case 2: return { top: '55%', right: '-40%' };
      case 3: return { top: '100%', marginTop: 10, left: '50%', transform: 'translateX(-50%)' };
      case 4: return { top: '55%', left: '-40%' };
      case 5: return { bottom: '55%', left: '-40%' };
      default: return { bottom: '100%', marginBottom: 10, left: '50%', transform: 'translateX(-50%)' };
    }
  }
  switch (seatIndex) {
    case 0: return { bottom: '100%', marginBottom: 10, left: '50%', transform: 'translateX(-50%)' };
    case 1: return { bottom: '40%', right: '-35%' };
    case 2: return { top: '25%', right: '-40%' };
    case 3: return { top: '40%', right: '-35%' };
    case 4: return { top: '100%', marginTop: 10, left: '50%', transform: 'translateX(-50%)' };
    case 5: return { top: '40%', left: '-35%' };
    case 6: return { top: '25%', left: '-40%' };
    case 7: return { bottom: '40%', left: '-35%' };
    default: return { bottom: '100%', marginBottom: 10, left: '50%', transform: 'translateX(-50%)' };
  }
}

// ============================
// ポートレート: チップ位置
// ============================
export function getChipPositionPortrait(seatIndex: number, maxPlayers: 6 | 8): React.CSSProperties {
  if (maxPlayers === 6) {
    switch (seatIndex) {
      case 0: return { bottom: '100%', marginBottom: 45, left: '50%', transform: 'translateX(-50%)' };
      case 1: return { bottom: '70%', right: '-55%' };
      case 2: return { top: '70%', right: '-55%' };
      case 3: return { top: '100%', marginTop: 45, left: '50%', transform: 'translateX(-50%)' };
      case 4: return { top: '70%', left: '-55%' };
      case 5: return { bottom: '70%', left: '-55%' };
      default: return { top: '100%', marginTop: 45 };
    }
  }
  switch (seatIndex) {
    case 0: return { bottom: '100%', marginBottom: 45, left: '50%', transform: 'translateX(-50%)' };
    case 1: return { bottom: '60%', right: '-50%' };
    case 2: return { top: '50%', right: '-55%', transform: 'translateY(-50%)' };
    case 3: return { top: '60%', right: '-50%' };
    case 4: return { top: '100%', marginTop: 45, left: '50%', transform: 'translateX(-50%)' };
    case 5: return { top: '60%', left: '-50%' };
    case 6: return { top: '50%', left: '-55%', transform: 'translateY(-50%)' };
    case 7: return { bottom: '60%', left: '-50%' };
    default: return { top: '100%', marginTop: 45 };
  }
}

// ============================
// ランドスケープ: ディーラーボタン位置
// カードと同じ垂直ラインを避け、横方向にオフセット
// ============================
export function getDealerButtonPosition(seatIndex: number, maxPlayers: 6 | 8): React.CSSProperties {
  if (maxPlayers === 6) {
    switch (seatIndex) {
      case 0: return { bottom: '100%', marginBottom: 30, right: '-40%' };
      case 1: return { bottom: '40%', right: '-50%' };
      case 2: return { top: '40%', right: '-50%' };
      case 3: return { top: '100%', marginTop: 30, right: '-40%' };
      case 4: return { top: '40%', left: '-50%' };
      case 5: return { bottom: '40%', left: '-50%' };
      default: return { top: '100%', marginTop: 30 };
    }
  }
  switch (seatIndex) {
    case 0: return { bottom: '100%', marginBottom: 30, right: '-40%' };
    case 1: return { bottom: '30%', right: '-50%' };
    case 2: return { top: '15%', right: '-50%' };
    case 3: return { top: '30%', right: '-50%' };
    case 4: return { top: '100%', marginTop: 30, right: '-40%' };
    case 5: return { top: '30%', left: '-50%' };
    case 6: return { top: '15%', left: '-50%' };
    case 7: return { bottom: '30%', left: '-50%' };
    default: return { top: '100%', marginTop: 30 };
  }
}

// ============================
// ポートレート: ディーラーボタン位置
// ============================
export function getDealerButtonPositionPortrait(seatIndex: number, maxPlayers: 6 | 8): React.CSSProperties {
  if (maxPlayers === 6) {
    switch (seatIndex) {
      case 0: return { bottom: '100%', marginBottom: 15, right: '-35%' };
      case 1: return { bottom: '25%', right: '-35%' };
      case 2: return { top: '25%', right: '-35%' };
      case 3: return { top: '100%', marginTop: 15, right: '-35%' };
      case 4: return { top: '25%', left: '-35%' };
      case 5: return { bottom: '25%', left: '-35%' };
      default: return { top: '100%', marginTop: 15 };
    }
  }
  switch (seatIndex) {
    case 0: return { bottom: '100%', marginBottom: 15, right: '-35%' };
    case 1: return { bottom: '20%', right: '-30%' };
    case 2: return { top: '15%', right: '-35%' };
    case 3: return { top: '20%', right: '-30%' };
    case 4: return { top: '100%', marginTop: 15, right: '-35%' };
    case 5: return { top: '20%', left: '-30%' };
    case 6: return { top: '15%', left: '-35%' };
    case 7: return { bottom: '20%', left: '-30%' };
    default: return { top: '100%', marginTop: 15 };
  }
}
