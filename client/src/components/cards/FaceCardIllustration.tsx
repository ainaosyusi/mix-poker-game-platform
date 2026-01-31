// 絵札の中央イラスト（伝統的トランプ風SVG）
export function FaceCardIllustration({ rank, color, size }: { rank: string; color: string; size: number }) {
  const s = Math.round(size * 0.75);
  if (rank === 'J') {
    // ジャック: 若い従者 - 羽根帽子、横顔、斧を持つ
    return (
      <svg width={s} height={s} viewBox="0 0 60 80" fill="none">
        {/* 胴体・衣装 */}
        <path d="M20 45 L20 70 Q20 75 30 75 Q40 75 40 70 L40 45 Z" fill={color} opacity="0.15" />
        <path d="M22 45 L22 68 Q22 72 30 72 Q38 72 38 68 L38 45 Z" fill={color} opacity="0.1" />
        {/* 衣装の襟 */}
        <path d="M22 42 L30 50 L38 42" stroke={color} strokeWidth="1.5" fill={color} opacity="0.12" />
        <path d="M24 44 L30 48 L36 44" stroke={color} strokeWidth="0.8" opacity="0.3" />
        {/* 顔 */}
        <ellipse cx="30" cy="30" rx="8" ry="10" fill={color} opacity="0.12" />
        <ellipse cx="30" cy="30" rx="7.5" ry="9.5" stroke={color} strokeWidth="1" opacity="0.4" fill="none" />
        {/* 目 */}
        <ellipse cx="27" cy="28" rx="1.5" ry="1" fill={color} opacity="0.5" />
        <ellipse cx="33" cy="28" rx="1.5" ry="1" fill={color} opacity="0.5" />
        <circle cx="27" cy="28" r="0.6" fill={color} opacity="0.7" />
        <circle cx="33" cy="28" r="0.6" fill={color} opacity="0.7" />
        {/* 眉 */}
        <path d="M25 26 Q27 24.5 29 26" stroke={color} strokeWidth="0.8" opacity="0.4" fill="none" />
        <path d="M31 26 Q33 24.5 35 26" stroke={color} strokeWidth="0.8" opacity="0.4" fill="none" />
        {/* 鼻 */}
        <path d="M30 29 L29 33 L31 33" stroke={color} strokeWidth="0.7" opacity="0.35" fill="none" />
        {/* 口 */}
        <path d="M27 35 Q30 37 33 35" stroke={color} strokeWidth="0.8" opacity="0.4" fill="none" />
        {/* 帽子（ベレー帽＋羽根） */}
        <path d="M20 22 Q20 14 30 14 Q40 14 40 22 L38 22 Q36 18 30 17 Q24 18 22 22 Z" fill={color} opacity="0.2" />
        <path d="M21 22 Q21 15 30 15 Q39 15 39 22" stroke={color} strokeWidth="1.2" opacity="0.4" fill="none" />
        {/* 帽子の羽根飾り */}
        <path d="M36 16 Q42 8 44 4" stroke={color} strokeWidth="1.5" opacity="0.5" fill="none" />
        <path d="M36 16 Q40 10 45 7" stroke={color} strokeWidth="0.8" opacity="0.3" fill="none" />
        <path d="M36 16 Q43 11 44 4" fill={color} opacity="0.08" />
        {/* 髪 */}
        <path d="M22 22 Q22 24 24 26" stroke={color} strokeWidth="1" opacity="0.3" fill="none" />
        <path d="M38 22 Q38 24 36 26" stroke={color} strokeWidth="1" opacity="0.3" fill="none" />
        {/* 衣装の装飾線 */}
        <line x1="30" y1="50" x2="30" y2="70" stroke={color} strokeWidth="0.8" opacity="0.2" />
        <path d="M24 55 L36 55" stroke={color} strokeWidth="0.6" opacity="0.15" />
        <path d="M25 60 L35 60" stroke={color} strokeWidth="0.6" opacity="0.15" />
        {/* 斧（右手） */}
        <line x1="40" y1="38" x2="48" y2="58" stroke={color} strokeWidth="1.5" opacity="0.35" />
        <path d="M46 52 Q52 48 48 58 Q44 56 46 52Z" fill={color} opacity="0.25" />
      </svg>
    );
  }
  if (rank === 'Q') {
    // クイーン: 王冠、花を持つ、長い髪
    return (
      <svg width={s} height={s} viewBox="0 0 60 80" fill="none">
        {/* 胴体・ドレス */}
        <path d="M18 48 Q16 70 18 75 Q30 78 42 75 Q44 70 42 48 Z" fill={color} opacity="0.12" />
        <path d="M20 48 Q19 68 21 73 Q30 76 39 73 Q41 68 40 48 Z" fill={color} opacity="0.08" />
        {/* ドレスの装飾 */}
        <path d="M30 48 L30 73" stroke={color} strokeWidth="0.6" opacity="0.15" />
        <path d="M25 52 Q30 55 35 52" stroke={color} strokeWidth="0.6" opacity="0.15" />
        <path d="M24 58 Q30 61 36 58" stroke={color} strokeWidth="0.6" opacity="0.15" />
        <path d="M23 64 Q30 67 37 64" stroke={color} strokeWidth="0.6" opacity="0.15" />
        {/* 首・デコルテ */}
        <path d="M26 42 Q30 46 34 42" stroke={color} strokeWidth="0.8" opacity="0.25" fill="none" />
        {/* 顔 */}
        <ellipse cx="30" cy="28" rx="8" ry="10" fill={color} opacity="0.12" />
        <ellipse cx="30" cy="28" rx="7.5" ry="9.5" stroke={color} strokeWidth="1" opacity="0.4" fill="none" />
        {/* 目（少し大きめ、まつ毛付き） */}
        <ellipse cx="27" cy="26" rx="1.8" ry="1.2" fill={color} opacity="0.45" />
        <ellipse cx="33" cy="26" rx="1.8" ry="1.2" fill={color} opacity="0.45" />
        <circle cx="27" cy="26" r="0.6" fill={color} opacity="0.7" />
        <circle cx="33" cy="26" r="0.6" fill={color} opacity="0.7" />
        {/* まつ毛 */}
        <path d="M25 25 Q27 23.5 29 25" stroke={color} strokeWidth="0.7" opacity="0.35" fill="none" />
        <path d="M31 25 Q33 23.5 35 25" stroke={color} strokeWidth="0.7" opacity="0.35" fill="none" />
        {/* 鼻 */}
        <path d="M30 27.5 L29 31 L31 31" stroke={color} strokeWidth="0.6" opacity="0.3" fill="none" />
        {/* 口（少し微笑み） */}
        <path d="M27 33 Q30 35.5 33 33" stroke={color} strokeWidth="0.8" opacity="0.4" fill="none" />
        <path d="M28.5 33.5 Q30 34.5 31.5 33.5" fill={color} opacity="0.15" />
        {/* 髪（長い波打つ髪） */}
        <path d="M22 20 Q18 28 16 40 Q15 44 17 48" stroke={color} strokeWidth="1.5" opacity="0.3" fill="none" />
        <path d="M38 20 Q42 28 44 40 Q45 44 43 48" stroke={color} strokeWidth="1.5" opacity="0.3" fill="none" />
        <path d="M21 22 Q17 30 16 42" stroke={color} strokeWidth="0.8" opacity="0.15" fill="none" />
        <path d="M39 22 Q43 30 44 42" stroke={color} strokeWidth="0.8" opacity="0.15" fill="none" />
        {/* 王冠 */}
        <path d="M21 18 L21 12 L25 15 L30 9 L35 15 L39 12 L39 18 Z" fill={color} opacity="0.2" />
        <path d="M21 18 L21 12 L25 15 L30 9 L35 15 L39 12 L39 18" stroke={color} strokeWidth="1.2" opacity="0.5" fill="none" />
        <rect x="21" y="17" width="18" height="3" rx="0.5" fill={color} opacity="0.15" />
        <rect x="21" y="17" width="18" height="3" rx="0.5" stroke={color} strokeWidth="0.8" opacity="0.35" fill="none" />
        {/* 王冠の宝石 */}
        <circle cx="30" cy="10.5" r="1.5" fill={color} opacity="0.45" />
        <circle cx="25" cy="15" r="1" fill={color} opacity="0.35" />
        <circle cx="35" cy="15" r="1" fill={color} opacity="0.35" />
        <circle cx="26" cy="18.5" r="0.8" fill={color} opacity="0.3" />
        <circle cx="30" cy="18.5" r="0.8" fill={color} opacity="0.3" />
        <circle cx="34" cy="18.5" r="0.8" fill={color} opacity="0.3" />
        {/* 花（左手） */}
        <line x1="16" y1="44" x2="12" y2="60" stroke={color} strokeWidth="1" opacity="0.3" />
        <circle cx="12" cy="58" r="3" fill={color} opacity="0.2" />
        <circle cx="12" cy="58" r="1.5" fill={color} opacity="0.35" />
        <circle cx="10" cy="56" r="2" fill={color} opacity="0.12" />
        <circle cx="14" cy="56" r="2" fill={color} opacity="0.12" />
        <circle cx="11" cy="60" r="2" fill={color} opacity="0.12" />
        <circle cx="14" cy="60" r="2" fill={color} opacity="0.12" />
      </svg>
    );
  }
  // K: キング - 大きな王冠、ヒゲ、剣を持つ
  return (
    <svg width={s} height={s} viewBox="0 0 60 80" fill="none">
      {/* 胴体・ローブ */}
      <path d="M16 48 L14 75 Q30 80 46 75 L44 48 Z" fill={color} opacity="0.12" />
      <path d="M18 48 L17 73 Q30 77 43 73 L42 48 Z" fill={color} opacity="0.08" />
      {/* ローブの襟（毛皮風） */}
      <path d="M20 44 Q22 48 30 50 Q38 48 40 44" fill={color} opacity="0.15" />
      <path d="M20 44 Q22 48 30 50 Q38 48 40 44" stroke={color} strokeWidth="1" opacity="0.3" fill="none" />
      {/* 襟の装飾点 */}
      <circle cx="24" cy="46" r="0.6" fill={color} opacity="0.25" />
      <circle cx="27" cy="47.5" r="0.6" fill={color} opacity="0.25" />
      <circle cx="30" cy="48" r="0.6" fill={color} opacity="0.25" />
      <circle cx="33" cy="47.5" r="0.6" fill={color} opacity="0.25" />
      <circle cx="36" cy="46" r="0.6" fill={color} opacity="0.25" />
      {/* ローブの装飾 */}
      <path d="M30 50 L30 73" stroke={color} strokeWidth="0.8" opacity="0.15" />
      <path d="M23 55 L37 55" stroke={color} strokeWidth="0.6" opacity="0.12" />
      <path d="M22 62 L38 62" stroke={color} strokeWidth="0.6" opacity="0.12" />
      {/* 顔 */}
      <ellipse cx="30" cy="28" rx="8.5" ry="10.5" fill={color} opacity="0.12" />
      <ellipse cx="30" cy="28" rx="8" ry="10" stroke={color} strokeWidth="1" opacity="0.4" fill="none" />
      {/* 目（厳格な表情） */}
      <path d="M25 25 L29 25" stroke={color} strokeWidth="1.2" opacity="0.5" />
      <path d="M31 25 L35 25" stroke={color} strokeWidth="1.2" opacity="0.5" />
      <circle cx="27" cy="25.5" r="0.7" fill={color} opacity="0.6" />
      <circle cx="33" cy="25.5" r="0.7" fill={color} opacity="0.6" />
      {/* 眉（太く厳めしい） */}
      <path d="M24.5 23 L29 22.5" stroke={color} strokeWidth="1.2" opacity="0.45" fill="none" />
      <path d="M31 22.5 L35.5 23" stroke={color} strokeWidth="1.2" opacity="0.45" fill="none" />
      {/* 鼻 */}
      <path d="M30 26.5 L28.5 31 L31.5 31" stroke={color} strokeWidth="0.8" opacity="0.35" fill="none" />
      {/* ヒゲ（口髭 + あごひげ） */}
      <path d="M26 33 Q28 31.5 30 33 Q32 31.5 34 33" stroke={color} strokeWidth="0.8" opacity="0.4" fill="none" />
      <path d="M27 34 Q30 38 33 34" stroke={color} strokeWidth="0.8" opacity="0.3" fill="none" />
      <path d="M28 35 Q30 39.5 32 35" fill={color} opacity="0.1" />
      <path d="M25 33 Q24 35 25 37" stroke={color} strokeWidth="0.6" opacity="0.2" fill="none" />
      <path d="M35 33 Q36 35 35 37" stroke={color} strokeWidth="0.6" opacity="0.2" fill="none" />
      {/* 王冠（大きく豪華） */}
      <path d="M18 16 L18 8 L23 12 L26 5 L30 10 L34 5 L37 12 L42 8 L42 16 Z" fill={color} opacity="0.2" />
      <path d="M18 16 L18 8 L23 12 L26 5 L30 10 L34 5 L37 12 L42 8 L42 16" stroke={color} strokeWidth="1.3" opacity="0.5" fill="none" />
      <rect x="18" y="15" width="24" height="4" rx="0.5" fill={color} opacity="0.18" />
      <rect x="18" y="15" width="24" height="4" rx="0.5" stroke={color} strokeWidth="0.8" opacity="0.4" fill="none" />
      {/* 王冠の宝石 */}
      <circle cx="30" cy="11" r="2" fill={color} opacity="0.45" />
      <circle cx="26" cy="6.5" r="1.5" fill={color} opacity="0.4" />
      <circle cx="34" cy="6.5" r="1.5" fill={color} opacity="0.4" />
      <circle cx="23" cy="12.5" r="1" fill={color} opacity="0.3" />
      <circle cx="37" cy="12.5" r="1" fill={color} opacity="0.3" />
      {/* 王冠ベースの宝石 */}
      <circle cx="24" cy="17" r="0.8" fill={color} opacity="0.3" />
      <circle cx="28" cy="17" r="0.8" fill={color} opacity="0.3" />
      <circle cx="32" cy="17" r="0.8" fill={color} opacity="0.3" />
      <circle cx="36" cy="17" r="0.8" fill={color} opacity="0.3" />
      {/* 十字架付き宝珠（王冠の頂上） */}
      <circle cx="30" cy="9" r="1" fill={color} opacity="0.35" />
      <line x1="30" y1="6" x2="30" y2="8" stroke={color} strokeWidth="1" opacity="0.4" />
      <line x1="29" y1="7" x2="31" y2="7" stroke={color} strokeWidth="0.8" opacity="0.35" />
      {/* 剣（右手） */}
      <line x1="44" y1="35" x2="50" y2="70" stroke={color} strokeWidth="2" opacity="0.3" />
      <line x1="44" y1="35" x2="50" y2="70" stroke={color} strokeWidth="0.8" opacity="0.15" />
      {/* 剣の柄 */}
      <line x1="42" y1="34" x2="48" y2="36" stroke={color} strokeWidth="2" opacity="0.35" />
      <circle cx="45" cy="35" r="1.5" fill={color} opacity="0.25" />
      {/* 剣の刃先 */}
      <path d="M49 68 L51 72 L50 73 L48 69 Z" fill={color} opacity="0.25" />
    </svg>
  );
}
