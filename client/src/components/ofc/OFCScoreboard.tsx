// ========================================
// OFC Scoreboard - スコア表示
// ========================================

import { memo } from 'react';
import type { OFCRoundScore } from '../../types/table';

interface OFCScoreboardProps {
  scores: OFCRoundScore[];
  cumulativeScores: Record<string, number>;
  yourSocketId: string;
}

export const OFCScoreboard = memo(function OFCScoreboard({
  scores,
  cumulativeScores,
  yourSocketId,
}: OFCScoreboardProps) {
  return (
    <div style={{
      background: 'rgba(0, 0, 0, 0.7)',
      borderRadius: 10,
      padding: 12,
      border: '1px solid rgba(255, 255, 255, 0.1)',
      minWidth: 280,
    }}>
      <div style={{
        fontSize: 13,
        fontWeight: 700,
        color: '#fbbf24',
        textAlign: 'center',
        marginBottom: 8,
      }}>
        Scoring Results
      </div>

      {scores.map(score => {
        const isYou = score.playerId === yourSocketId;
        const isPositive = score.totalPoints > 0;
        const totalRoyalties = score.topRoyalties + score.middleRoyalties + score.bottomRoyalties;

        return (
          <div
            key={score.playerId}
            style={{
              background: isYou ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.03)',
              borderRadius: 6,
              padding: 8,
              marginBottom: 6,
              border: isYou ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(255,255,255,0.05)',
            }}
          >
            {/* Player name + total */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 4,
            }}>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: isYou ? '#22c55e' : '#fff',
              }}>
                {score.playerName}{isYou ? ' (You)' : ''}
              </span>
              <span style={{
                fontSize: 14,
                fontWeight: 700,
                color: score.isFouled ? '#ef4444' :
                       isPositive ? '#22c55e' : score.totalPoints < 0 ? '#ef4444' : '#fff',
              }}>
                {score.isFouled ? 'FOUL' :
                 `${isPositive ? '+' : ''}${score.totalPoints} pts`}
              </span>
            </div>

            {/* Hand details */}
            {!score.isFouled && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Top: {score.topHand}</span>
                  {score.topRoyalties > 0 && (
                    <span style={{ color: '#fbbf24' }}>+{score.topRoyalties}</span>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Mid: {score.middleHand}</span>
                  {score.middleRoyalties > 0 && (
                    <span style={{ color: '#fbbf24' }}>+{score.middleRoyalties}</span>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Bot: {score.bottomHand}</span>
                  {score.bottomRoyalties > 0 && (
                    <span style={{ color: '#fbbf24' }}>+{score.bottomRoyalties}</span>
                  )}
                </div>
                {totalRoyalties > 0 && (
                  <div style={{ color: '#fbbf24', fontWeight: 600, marginTop: 2 }}>
                    Royalties: +{totalRoyalties}
                  </div>
                )}
              </div>
            )}

            {/* Chip change */}
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: score.chipChange > 0 ? '#22c55e' :
                     score.chipChange < 0 ? '#ef4444' : 'rgba(255,255,255,0.5)',
              marginTop: 3,
              textAlign: 'right',
            }}>
              {score.chipChange > 0 ? '+' : ''}{score.chipChange.toLocaleString()} chips
            </div>
          </div>
        );
      })}

      {/* Cumulative scores */}
      {Object.keys(cumulativeScores).length > 0 && (
        <div style={{
          marginTop: 8,
          paddingTop: 8,
          borderTop: '1px solid rgba(255,255,255,0.1)',
          fontSize: 10,
          color: 'rgba(255,255,255,0.4)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 3 }}>Cumulative</div>
          {Object.entries(cumulativeScores).map(([id, pts]) => {
            const playerScore = scores.find(s => s.playerId === id);
            return (
              <div key={id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{playerScore?.playerName || id}</span>
                <span>{pts > 0 ? '+' : ''}{pts}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
