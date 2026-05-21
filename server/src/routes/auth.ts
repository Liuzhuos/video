import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../services/prisma';
import { authMiddleware, generateToken, AuthRequest } from '../middleware/auth';

export const authRouter = Router();

// POST /api/auth/register - 用户注册
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, nickname } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: '用户名和密码不能为空' });
      return;
    }

    if (username.length < 3 || username.length > 50) {
      res.status(400).json({ error: '用户名长度需在 3-50 个字符之间' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: '密码长度不能少于 6 个字符' });
      return;
    }

    // 检查用户名是否已存在
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      res.status(409).json({ error: '用户名已存在' });
      return;
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户（第一个注册的用户为 ADMIN）
    const userCount = await prisma.user.count();
    const role = userCount === 0 ? 'ADMIN' : 'VIEWER';

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        nickname: nickname || username,
        role,
      },
    });

    const token = generateToken(user.id, user.role);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('[注册] 错误:', error);
    res.status(500).json({ error: '注册失败，请重试' });
  }
});

// POST /api/auth/login - 用户登录
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: '用户名和密码不能为空' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      res.status(401).json({ error: '用户名或密码错误' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      res.status(401).json({ error: '用户名或密码错误' });
      return;
    }

    const token = generateToken(user.id, user.role);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('[登录] 错误:', error);
    res.status(500).json({ error: '登录失败，请重试' });
  }
});

// GET /api/auth/me - 获取当前用户信息
authRouter.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, username: true, nickname: true, avatar: true, role: true, createdAt: true },
    });

    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }

    res.json({ user });
  } catch (error: any) {
    console.error('[获取用户信息] 错误:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});
