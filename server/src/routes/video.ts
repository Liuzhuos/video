import { Router, Request, Response } from 'express';
import {
  createReferenceToVideoTask,
  waitForVideoResult,
  checkTaskStatus,
  getTaskOutput,
} from '../services/runninghub';

export const videoRouter = Router();

interface VideoGenerateRequest {
  imageUrls: string[];
  prompt: string;
  duration?: string;
  resolution?: string;
}

// POST /api/video/generate - 生成视频（同步等待结果）
videoRouter.post('/generate', async (req: Request, res: Response) => {
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
    const taskId = await createReferenceToVideoTask(
      imageUrls,
      prompt,
      duration || '6',
      resolution || '720p'
    );
    console.log(`[视频生成] 任务已创建: ${taskId}`);

    // 2. 轮询等待结果
    const videoUrl = await waitForVideoResult(taskId);
    console.log(`[视频生成] 生成完成: ${videoUrl}`);

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

// POST /api/video/generate-async - 异步生成视频（立即返回taskId）
videoRouter.post('/generate-async', async (req: Request, res: Response) => {
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

    const taskId = await createReferenceToVideoTask(
      validUrls,
      prompt,
      duration || '6',
      resolution || '720p'
    );

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
videoRouter.get('/task/:taskId', async (req: Request, res: Response) => {
  try {
    const taskId = req.params.taskId as string;
    const status = await checkTaskStatus(taskId);

    if (status === 'SUCCESS' || status === 'COMPLETED') {
      const outputs = await getTaskOutput(taskId);
      const videoOutput = outputs.find((o: any) =>
        ['mp4', 'mov', 'webm', 'avi'].includes(o.fileType)
      );

      res.json({
        taskId,
        status: 'success',
        url: videoOutput?.fileUrl || outputs[0]?.fileUrl,
        outputs,
      });
    } else if (status === 'FAILED' || status === 'ERROR') {
      res.json({ taskId, status: 'failed' });
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
