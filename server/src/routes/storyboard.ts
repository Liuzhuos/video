import { Router, Request, Response } from 'express';

export const storyboardRouter = Router();

// 内存存储（后续可替换为数据库）
const storyboards = new Map<string, any>();

// POST /api/storyboard - 保存分镜脚本
storyboardRouter.post('/', (req: Request, res: Response) => {
  try {
    const { storyboard } = req.body;

    if (!storyboard) {
      res.status(400).json({ error: '请提供分镜脚本数据' });
      return;
    }

    const id = `sb_${Date.now()}`;
    const record = {
      id,
      ...storyboard,
      createdAt: new Date().toISOString(),
      status: 'draft', // draft -> images_ready -> video_generating -> completed
    };

    storyboards.set(id, record);

    res.json({ id, storyboard: record });
  } catch (error: any) {
    console.error('Storyboard save error:', error);
    res.status(500).json({ error: '保存分镜脚本失败', detail: error.message });
  }
});

// GET /api/storyboard/:id - 获取分镜脚本
storyboardRouter.get('/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const storyboard = storyboards.get(id);

  if (!storyboard) {
    res.status(404).json({ error: '分镜脚本不存在' });
    return;
  }

  res.json({ storyboard });
});

// GET /api/storyboard - 获取所有分镜脚本列表
storyboardRouter.get('/', (_req: Request, res: Response) => {
  const list = Array.from(storyboards.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  res.json({ storyboards: list });
});
