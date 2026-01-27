/**
 * 認証サービス
 * ユーザー登録、ログイン、トークン検証、プロフィール更新
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'mix-poker-dev-secret-key';
const JWT_EXPIRY = '7d';

export interface JwtPayload {
    userId: string;
    username: string;
    displayName: string;
    avatarIcon: string;
}

export interface AuthResult {
    success: boolean;
    token?: string;
    user?: JwtPayload;
    error?: string;
}

/**
 * ユーザー登録
 */
export async function register(username: string, password: string, displayName: string): Promise<AuthResult> {
    // バリデーション
    if (!username || username.length < 3 || username.length > 20) {
        return { success: false, error: 'ユーザー名は3〜20文字で入力してください' };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return { success: false, error: 'ユーザー名は英数字とアンダースコアのみ使用できます' };
    }
    if (!password || password.length < 4) {
        return { success: false, error: 'パスワードは4文字以上で入力してください' };
    }
    if (!displayName || displayName.length < 1 || displayName.length > 20) {
        return { success: false, error: '表示名は1〜20文字で入力してください' };
    }

    // ユーザー名の重複チェック
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
        return { success: false, error: 'このユーザー名は既に使用されています' };
    }

    // パスワードハッシュ化
    const passwordHash = await bcrypt.hash(password, 10);

    // ユーザー作成
    const user = await prisma.user.create({
        data: {
            username,
            passwordHash,
            displayName,
        },
    });

    // JWT生成
    const payload: JwtPayload = {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarIcon: user.avatarIcon,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    return { success: true, token, user: payload };
}

/**
 * ログイン
 */
export async function login(username: string, password: string): Promise<AuthResult> {
    if (!username || !password) {
        return { success: false, error: 'ユーザー名とパスワードを入力してください' };
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
        return { success: false, error: 'ユーザー名またはパスワードが正しくありません' };
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
        return { success: false, error: 'ユーザー名またはパスワードが正しくありません' };
    }

    const payload: JwtPayload = {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarIcon: user.avatarIcon,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    return { success: true, token, user: payload };
}

/**
 * JWTトークンの検証
 */
export function verifyToken(token: string): JwtPayload | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
        return decoded;
    } catch {
        return null;
    }
}

/**
 * プロフィール更新
 */
export async function updateProfile(
    userId: string,
    updates: { displayName?: string; avatarIcon?: string }
): Promise<AuthResult> {
    const data: Record<string, string> = {};

    if (updates.displayName !== undefined) {
        if (updates.displayName.length < 1 || updates.displayName.length > 20) {
            return { success: false, error: '表示名は1〜20文字で入力してください' };
        }
        data.displayName = updates.displayName;
    }

    if (updates.avatarIcon !== undefined) {
        data.avatarIcon = updates.avatarIcon;
    }

    if (Object.keys(data).length === 0) {
        return { success: false, error: '更新する項目がありません' };
    }

    const user = await prisma.user.update({
        where: { id: userId },
        data,
    });

    const payload: JwtPayload = {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarIcon: user.avatarIcon,
    };

    // 更新後の情報で新しいトークンを発行
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    return { success: true, token, user: payload };
}

/**
 * ユーザー情報取得
 */
export async function getUserById(userId: string): Promise<JwtPayload | null> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    return {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarIcon: user.avatarIcon,
    };
}
