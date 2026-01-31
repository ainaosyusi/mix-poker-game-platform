/**
 * 座席位置計算ユーティリティ
 * チップ・ディーラーボタン・スタッドカードの位置を計算
 */

// チップ位置を座席に応じて計算（テーブル中央寄りに配置）
export function getChipPosition(seatIndex: number, maxPlayers: 6 | 8): React.CSSProperties {
  if (maxPlayers === 6) {
    switch (seatIndex) {
      case 0: return { bottom: '100%', marginBottom: 55, left: '50%', transform: 'translateX(-50%)' };
      case 1: return { bottom: '90%', right: '-70%' };
      case 2: return { top: '90%', right: '-70%' };
      case 3: return { top: '100%', marginTop: 55, left: '50%', transform: 'translateX(-50%)' };
      case 4: return { top: '90%', left: '-70%' };
      case 5: return { bottom: '90%', left: '-70%' };
      default: return { top: '100%', marginTop: 55 };
    }
  }
  switch (seatIndex) {
    case 0: return { bottom: '100%', marginBottom: 55, left: '50%', transform: 'translateX(-50%)' };
    case 1: return { bottom: '70%', right: '-60%' };
    case 2: return { top: '50%', right: '-70%', transform: 'translateY(-50%)' };
    case 3: return { top: '70%', right: '-60%' };
    case 4: return { top: '100%', marginTop: 55, left: '50%', transform: 'translateX(-50%)' };
    case 5: return { top: '70%', left: '-60%' };
    case 6: return { top: '50%', left: '-70%', transform: 'translateY(-50%)' };
    case 7: return { bottom: '70%', left: '-60%' };
    default: return { top: '100%', marginTop: 55 };
  }
}

// Stud用アップカード位置（テーブル中央寄り、チップと重ならない位置）
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

// ポートレート用チップ位置（テーブル中心方向にオフセット縮小）
export function getChipPositionPortrait(seatIndex: number, maxPlayers: 6 | 8): React.CSSProperties {
  if (maxPlayers === 6) {
    switch (seatIndex) {
      case 0: return { bottom: '100%', marginBottom: 30, left: '50%', transform: 'translateX(-50%)' };
      case 1: return { bottom: '70%', right: '-50%' };
      case 2: return { top: '70%', right: '-50%' };
      case 3: return { top: '100%', marginTop: 30, left: '50%', transform: 'translateX(-50%)' };
      case 4: return { top: '70%', left: '-50%' };
      case 5: return { bottom: '70%', left: '-50%' };
      default: return { top: '100%', marginTop: 30 };
    }
  }
  switch (seatIndex) {
    case 0: return { bottom: '100%', marginBottom: 30, left: '50%', transform: 'translateX(-50%)' };
    case 1: return { bottom: '60%', right: '-45%' };
    case 2: return { top: '50%', right: '-50%', transform: 'translateY(-50%)' };
    case 3: return { top: '60%', right: '-45%' };
    case 4: return { top: '100%', marginTop: 30, left: '50%', transform: 'translateX(-50%)' };
    case 5: return { top: '60%', left: '-45%' };
    case 6: return { top: '50%', left: '-50%', transform: 'translateY(-50%)' };
    case 7: return { bottom: '60%', left: '-45%' };
    default: return { top: '100%', marginTop: 30 };
  }
}

// ディーラーボタン位置を座席に応じて計算（チップと重ならない位置）
export function getDealerButtonPosition(seatIndex: number, maxPlayers: 6 | 8): React.CSSProperties {
  if (maxPlayers === 6) {
    switch (seatIndex) {
      case 0: return { bottom: '100%', marginBottom: 25, left: '20%' };
      case 1: return { bottom: '60%', right: '-35%' };
      case 2: return { top: '60%', right: '-35%' };
      case 3: return { top: '100%', marginTop: 25, left: '20%' };
      case 4: return { top: '60%', left: '-35%' };
      case 5: return { bottom: '60%', left: '-35%' };
      default: return { top: '100%', marginTop: 25 };
    }
  }
  switch (seatIndex) {
    case 0: return { bottom: '100%', marginBottom: 25, left: '20%' };
    case 1: return { bottom: '40%', right: '-35%' };
    case 2: return { top: '20%', right: '-40%' };
    case 3: return { top: '40%', right: '-35%' };
    case 4: return { top: '100%', marginTop: 25, left: '20%' };
    case 5: return { top: '40%', left: '-35%' };
    case 6: return { top: '20%', left: '-40%' };
    case 7: return { bottom: '40%', left: '-35%' };
    default: return { top: '100%', marginTop: 25 };
  }
}

// ポートレート用ディーラーボタン位置
export function getDealerButtonPositionPortrait(seatIndex: number, maxPlayers: 6 | 8): React.CSSProperties {
  if (maxPlayers === 6) {
    switch (seatIndex) {
      case 0: return { bottom: '100%', marginBottom: 10, left: '20%' };
      case 1: return { bottom: '50%', right: '-25%' };
      case 2: return { top: '50%', right: '-25%' };
      case 3: return { top: '100%', marginTop: 10, left: '20%' };
      case 4: return { top: '50%', left: '-25%' };
      case 5: return { bottom: '50%', left: '-25%' };
      default: return { top: '100%', marginTop: 10 };
    }
  }
  switch (seatIndex) {
    case 0: return { bottom: '100%', marginBottom: 10, left: '20%' };
    case 1: return { bottom: '35%', right: '-25%' };
    case 2: return { top: '20%', right: '-30%' };
    case 3: return { top: '35%', right: '-25%' };
    case 4: return { top: '100%', marginTop: 10, left: '20%' };
    case 5: return { top: '35%', left: '-25%' };
    case 6: return { top: '20%', left: '-30%' };
    case 7: return { bottom: '35%', left: '-25%' };
    default: return { top: '100%', marginTop: 10 };
  }
}
