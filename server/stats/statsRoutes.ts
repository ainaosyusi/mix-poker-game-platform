/**
 * プレイヤー統計 REST API
 * GET /api/stats/me - 自分の統計情報取得
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../auth/authMiddleware.js';

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /api/stats/me
 * 認証済みユーザーの統計情報を返す
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;

    // 完了済みセッション集計
    const completedSessions = await prisma.playerSession.findMany({
      where: { userId, endedAt: { not: null } },
      orderBy: { startedAt: 'desc' },
    });

    // 今日の開始時刻（UTC）
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let totalBuyIn = 0;
    let totalCashOut = 0;
    let totalHandsPlayed = 0;
    let totalHandsWon = 0;
    let todayProfit = 0;
    let todaySessions = 0;

    for (const s of completedSessions) {
      const buyInTotal = s.buyIn + s.addOns;
      const cashOut = s.cashOut ?? 0;
      totalBuyIn += buyInTotal;
      totalCashOut += cashOut;
      totalHandsPlayed += s.handsPlayed;
      totalHandsWon += s.handsWon;

      if (s.startedAt >= todayStart) {
        todayProfit += cashOut - buyInTotal;
        todaySessions++;
      }
    }

    const totalProfit = totalCashOut - totalBuyIn;
    const winRate = totalHandsPlayed > 0
      ? Math.round((totalHandsWon / totalHandsPlayed) * 1000) / 10
      : 0;

    // 直近10セッション
    const recentSessions = completedSessions.slice(0, 10).map(s => ({
      id: s.id,
      roomId: s.roomId,
      gameVariant: s.gameVariant,
      buyIn: s.buyIn,
      addOns: s.addOns,
      cashOut: s.cashOut,
      profit: s.cashOut !== null ? s.cashOut - (s.buyIn + s.addOns) : null,
      handsPlayed: s.handsPlayed,
      handsWon: s.handsWon,
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt?.toISOString() ?? null,
    }));

    res.json({
      totalSessions: completedSessions.length,
      totalBuyIn,
      totalCashOut,
      totalProfit,
      totalHandsPlayed,
      totalHandsWon,
      winRate,
      todayProfit,
      todaySessions,
      recentSessions,
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

export default router;
