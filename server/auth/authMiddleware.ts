/**
 * JWT認証ミドルウェア
 * Express REST APIエンドポイント用
 */

import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from './authService.js';

// Expressリクエストにuser情報を追加
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}

/**
 * JWT認証ミドルウェア
 * Authorization: Bearer <token> ヘッダーからトークンを検証
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ message: '認証が必要です' });
        return;
    }

    const token = authHeader.slice(7);
    const user = verifyToken(token);

    if (!user) {
        res.status(401).json({ message: 'トークンが無効または期限切れです' });
        return;
    }

    req.user = user;
    next();
}
