import { Router, Request, Response } from 'express';
import {
  createReferenceToVideoTask,
  waitForVideoResult,
  queryV2Task,
  getApiKeyByTaskId,
  getKeyIdByTaskId,
} from '../services/runninghub';
import { releaseKey } from '../services/apiKeyPool';
import prisma from '../services/prisma';
import { optionalAuth, AuthRequest } from '../middleware/auth';

export const videoRouter = Router();

// 所有视频路由使用可选认证
videoRouter.use(optionalAuth);

interface VideoGenerateRequest {
  imageUrls: string[];
  prompt: string;
  duration?: string;
  resolution?: string;
}

// POST /api/video/generate - 生成视频（同步等待结果）
videoRouter.post('/generate', async (req: AuthRequest, res: Response) => {
  try {
    const { imageUrls, prompt, duration, resolution } = req.body as VideoGenerateRequest;

    if (!imageUrls || imageUrls.length === 0) {
      res.status(400).json({ error: '请提供至少一张参考图片URL' });
      return;
    }

    if (!prompt) {
      res.status(400).json({ error: '请提供视频描述提示词' });
      return;
    }

    console.log(`[视频生成] 图片数: ${imageUrls.length}, prompt: ${prompt}`);

    // 1. 创建任务
    const { taskId, keyId } = await createReferenceToVideoTask(
      imageUrls,
      prompt,
      duration || '6',
      resolution || '720p'
    );
    console.log(`[视频生成] 任务已创建: ${taskId}`);

    // 2. 轮询等待结果
    const videoUrl = await waitForVideoResult(taskId, undefined, undefined, keyId);
    console.log(`[视频生成] 生成完成: ${videoUrl}`);

    // 保存到数据库
    if (req.userId) {
      await prisma.media.create({
        data: {
          type: 'VIDEO',
          filename: `video_${taskId}.mp4`,
          url: videoUrl,
          prompt,
          duration: parseFloat(duration || '6'),
          userId: req.userId,
        },
      });
    }

    res.json({
      url: videoUrl,
      taskId,
      status: 'success',
    });
  } catch (error: any) {
    console.error('Video generate error:', error);
    res.status(500).json({
      error: error.message || '视频生成失败',
      detail: error.message,
    });
  }
});

// 内存中缓存异步任务的元数据（prompt、duration、userId），供轮询时保存数据库使用
const asyncTaskMeta = new Map<string, { prompt: string; duration: string; userId?: number }>();

// POST /api/video/generate-async - 异步生成视频（立即返回taskId）
videoRouter.post('/generate-async', async (req: AuthRequest, res: Response) => {
  try {
    const { imageUrls, prompt, duration, resolution } = req.body as VideoGenerateRequest;

    if (!imageUrls || imageUrls.length === 0) {
      res.status(400).json({ error: '请提供至少一张参考图片URL' });
      return;
    }

    if (!prompt) {
      res.status(400).json({ error: '请提供视频描述提示词' });
      return;
    }

    // 过滤掉本地路径的图片（/uploads/xxx），只保留有效的公网URL
    const validUrls = imageUrls.filter((url) => url.startsWith('http'));
    console.log('[视频生成] 原始 imageUrls:', imageUrls);
    console.log('[视频生成] 有效公网 URLs:', validUrls);

    if (validUrls.length === 0) {
      res.status(400).json({
        error: '没有可用的公网图片URL。本地上传的图片无法用于视频生成，请使用AI生图功能生成图片。',
      });
      return;
    }

    const { taskId, keyId } = await createReferenceToVideoTask(
      validUrls,
      prompt,
      duration || '6',
      resolution || '720p'
    );

    // 任务已提交，立即释放 Key slot
    if (keyId) await releaseKey(keyId);

    // 缓存任务元数据，供轮询成功时保存到数据库
    asyncTaskMeta.set(taskId, {
      prompt,
      duration: duration || '6',
      userId: req.userId,
    });

    res.json({
      taskId,
      status: 'running',
    });
  } catch (error: any) {
    console.error('Video generate-async error:', error);
    res.status(500).json({
      error: error.message || '创建视频任务失败',
      detail: error.message,
    });
  }
});

// GET /api/video/task/:taskId - 查询视频任务状态和结果
videoRouter.get('/task/:taskId', async (req: AuthRequest, res: Response) => {
  try {
    const taskId = req.params.taskId as string;
    // 使用创建任务时的同一个 Key 来查询
    const apiKey = await getApiKeyByTaskId(taskId);
    const result = await queryV2Task(taskId, apiKey);

    if (result.status === 'SUCCESS') {
      // Key 已在提交时释放，无需再次释放

      const videoOutput = result.results?.find(
        (r) => r.url && r.outputType && ['mp4', 'mov', 'webm', 'avi'].includes(r.outputType.toLowerCase())
      ) ?? result.results?.find((r) => r.url);

      const videoUrl = videoOutput?.url;

      // 保存到数据库
      const meta = asyncTaskMeta.get(taskId);
      const userId = req.userId || meta?.userId;
      if (userId && videoUrl) {
        // 避免重复保存：检查是否已存在
        const existing = await prisma.media.findFirst({
          where: { url: videoUrl, userId },
        });
        if (!existing) {
          await prisma.media.create({
            data: {
              type: 'VIDEO',
              filename: `video_${taskId}.mp4`,
              url: videoUrl,
              prompt: meta?.prompt || '',
              duration: parseFloat(meta?.duration || '6'),
              userId,
            },
          });
          console.log(`[视频生成] 已保存到数据库: taskId=${taskId}, userId=${userId}`);
        }
        // 清理缓存
        asyncTaskMeta.delete(taskId);
      }

      res.json({
        taskId,
        status: 'success',
        url: videoUrl,
      });
    } else if (result.status === 'FAILED') {
      // Key 已在提交时释放，无需再次释放
      asyncTaskMeta.delete(taskId);
      res.json({ taskId, status: 'failed', error: result.errorMessage });
    } else {
      res.json({ taskId, status: 'running' });
    }
  } catch (error: any) {
    console.error('Video task status error:', error);
    res.status(500).json({
      error: error.message || '查询视频任务状态失败',
    });
  }
});
