/**
 * セッショントラッカー
 * プレイヤーのバイイン/アドオン/キャッシュアウトをDBに記録
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// socketId → sessionId のマッピング（インメモリ）
const activeSessionMap = new Map<string, string>();

/**
 * 新しいセッションを開始（quick-join時）
 */
export async function startSession(
  socketId: string,
  userId: string,
  roomId: string,
  gameVariant: string,
  buyIn: number
): Promise<string | null> {
  try {
    const session = await prisma.playerSession.create({
      data: { userId, roomId, gameVariant, buyIn },
    });
    activeSessionMap.set(socketId, session.id);
    return session.id;
  } catch (error) {
    console.error('Failed to start session:', error);
    return null;
  }
}

/**
 * アドオン/リバイを記録
 */
export async function recordAddOn(socketId: string, amount: number): Promise<void> {
  const sessionId = activeSessionMap.get(socketId);
  if (!sessionId) return;
  try {
    await prisma.playerSession.update({
      where: { id: sessionId },
      data: { addOns: { increment: amount } },
    });
  } catch (error) {
    console.error('Failed to record add-on:', error);
  }
}

/**
 * セッション終了（leave-room / disconnect時）
 */
export async function endSession(socketId: string, cashOut: number): Promise<void> {
  const sessionId = activeSessionMap.get(socketId);
  if (!sessionId) return;
  try {
    await prisma.playerSession.update({
      where: { id: sessionId },
      data: { cashOut, endedAt: new Date() },
    });
    activeSessionMap.delete(socketId);
  } catch (error) {
    console.error('Failed to end session:', error);
  }
}

/**
 * ハンド完了時のカウント更新（バッチ）
 * winners: socketIdの配列、allPlayers: socketIdの配列
 */
export async function recordHandResult(
  winnerSocketIds: string[],
  allPlayerSocketIds: string[]
): Promise<void> {
  // handsPlayed をインクリメント
  const playedSessionIds = allPlayerSocketIds
    .map(sid => activeSessionMap.get(sid))
    .filter((id): id is string => !!id);

  // handsWon をインクリメント
  const wonSessionIds = winnerSocketIds
    .map(sid => activeSessionMap.get(sid))
    .filter((id): id is string => !!id);

  try {
    if (playedSessionIds.length > 0) {
      await prisma.playerSession.updateMany({
        where: { id: { in: playedSessionIds } },
        data: { handsPlayed: { increment: 1 } },
      });
    }
    if (wonSessionIds.length > 0) {
      await prisma.playerSession.updateMany({
        where: { id: { in: wonSessionIds } },
        data: { handsWon: { increment: 1 } },
      });
    }
  } catch (error) {
    console.error('Failed to record hand result:', error);
  }
}

/**
 * socketId変更時にセッションマッピングを移行（リコネクト対応）
 */
export function migrateSession(oldSocketId: string, newSocketId: string): void {
  const sessionId = activeSessionMap.get(oldSocketId);
  if (sessionId) {
    activeSessionMap.delete(oldSocketId);
    activeSessionMap.set(newSocketId, sessionId);
  }
}

/**
 * アクティブセッションがあるか確認
 */
export function hasActiveSession(socketId: string): boolean {
  return activeSessionMap.has(socketId);
}
