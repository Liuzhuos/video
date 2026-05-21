import { Router, Response } from 'express';
import prisma from '../services/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const mediaRouter = Router();

// 所有媒体路由需要登录
mediaRouter.use(authMiddleware);

// GET /api/media - 获取当前用户的媒体资源列表
mediaRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { type, page = '1', pageSize = '20' } = req.query;

    const where: any = { userId };
    if (type === 'IMAGE' || type === 'VIDEO') {
      where.type = type;
    }

    const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const take = parseInt(pageSize as string);

    const [items, total] = await Promise.all([
      prisma.media.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.media.count({ where }),
    ]);

    res.json({
      items,
      total,
      page: parseInt(page as string),
      pageSize: parseInt(pageSize as string),
      totalPages: Math.ceil(total / take),
    });
  } catch (error: any) {
    console.error('[媒体列表] 查询失败:', error.message);
    res.status(500).json({ error: '获取资源列表失败' });
  }
});

// DELETE /api/media/:id - 删除媒体资源
mediaRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const mediaId = parseInt(req.params.id as string);

    const media = await prisma.media.findUnique({ where: { id: mediaId } });

    if (!media) {
      res.status(404).json({ error: '资源不存在' });
      return;
    }

    // 只能删除自己的资源（管理员可以删除任何人的）
    if (media.userId !== userId && req.userRole !== 'ADMIN') {
      res.status(403).json({ error: '无权删除此资源' });
      return;
    }

    await prisma.media.delete({ where: { id: mediaId } });
    res.json({ success: true });
  } catch (error: any) {
    console.error('[媒体删除] 失败:', error.message);
    res.status(500).json({ error: '删除资源失败' });
  }
});
