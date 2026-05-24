import { Router } from 'express';
import { getAINews } from '../services/news';

export const newsRouter = Router();

/**
 * GET /api/news
 * 获取 AI 领域新闻热点
 */
newsRouter.get('/', async (_req, res) => {
  try {
    const news = await getAINews();
    res.json({ success: true, data: news });
  } catch (error: any) {
    console.error('[News] 获取新闻失败:', error.message);
    res.status(500).json({ success: false, message: '获取新闻失败' });
  }
});
