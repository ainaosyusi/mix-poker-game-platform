/**
 * 認証REST APIルート
 * POST /api/auth/register - 新規登録
 * POST /api/auth/login    - ログイン
 * GET  /api/auth/me        - 現在のユーザー情報
 * PUT  /api/auth/profile   - プロフィール更新
 */

import { Router } from 'express';
import { register, login, updateProfile, getUserById } from './authService.js';
import { authMiddleware } from './authMiddleware.js';

const router = Router();

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
    try {
        const { username, password, displayName } = req.body;
        const result = await register(username, password, displayName);

        if (!result.success) {
            res.status(400).json({ message: result.error });
            return;
        }

        res.json({ token: result.token, user: result.user });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'サーバーエラーが発生しました' });
    }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await login(username, password);

        if (!result.success) {
            res.status(401).json({ message: result.error });
            return;
        }

        res.json({ token: result.token, user: result.user });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'サーバーエラーが発生しました' });
    }
});

/**
 * GET /api/auth/me
 */
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await getUserById(req.user!.userId);
        if (!user) {
            res.status(404).json({ message: 'ユーザーが見つかりません' });
            return;
        }
        res.json({ user });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ message: 'サーバーエラーが発生しました' });
    }
});

/**
 * PUT /api/auth/profile
 */
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const { displayName, avatarIcon } = req.body;
        const result = await updateProfile(req.user!.userId, { displayName, avatarIcon });

        if (!result.success) {
            res.status(400).json({ message: result.error });
            return;
        }

        res.json({ token: result.token, user: result.user });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'サーバーエラーが発生しました' });
    }
});

export default router;
