import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { createTextToImageTask, waitForTextToImageResult, registerTaskKey, type ImageModel } from '../services/runninghub';
import { releaseKey } from '../services/apiKeyPool';
import { uploadBufferToOSS } from '../services/oss';
import prisma from '../services/prisma';
import { optionalAuth, AuthRequest } from '../middleware/auth';

export const imageRouter = Router();

// 所有图片路由使用可选认证（有登录就记录用户，没登录也能用）
imageRouter.use(optionalAuth);

// 内存存储，不写磁盘
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 JPG、PNG、WebP 格式的图片'));
    }
  },
});

// POST /api/image/upload - 上传图片到 OSS，返回公网 URL
imageRouter.post('/upload', upload.single('image'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: '请上传图片文件' });
    return;
  }
  try {
    const ext = path.extname(req.file.originalname) || '.png';
    const filename = `img_${Date.now()}${ext}`;
    const ossUrl = await uploadBufferToOSS(req.file.buffer, filename);

    res.json({ url: ossUrl, filename, originalName: req.file.originalname, size: req.file.size });
  } catch (err: any) {
    console.error('[图片上传] OSS 失败:', err.message);
    res.status(500).json({ error: '图片上传失败，请重试' });
  }
});

// GET /api/image/proxy - 代理外部图片（解决 CORS 问题）
imageRouter.get('/proxy', async (req: Request, res: Response) => {
  const url = req.query.url as string;
  if (!url || !url.startsWith('http')) {
    res.status(400).json({ error: '无效的 URL' });
    return;
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      res.status(response.status).json({ error: '获取图片失败' });
      return;
    }
    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (err: any) {
    console.error('[图片代理] 失败:', err.message);
    res.status(500).json({ error: '图片代理失败' });
  }
});

// POST /api/image/generate - 文生图（调用 RunningHub 全能图片，支持模型选择）
imageRouter.post('/generate', async (req: AuthRequest, res: Response) => {
  try {
    const { prompt, sceneId, aspectRatio, resolution, model } = req.body;

    if (!prompt) {
      res.status(400).json({ error: '请提供图片生成提示词' });
      return;
    }

    const imageModel: ImageModel = (['g', 'v2', 'pro'].includes(model) ? model : 'g') as ImageModel;
    console.log(`[文生图] 场景 ${sceneId}, model: ${imageModel}, prompt: ${prompt}`);

    const { taskId, keyId } = await createTextToImageTask(
      prompt,
      aspectRatio || '16:9',
      resolution || '1k',
      imageModel
    );
    console.log(`[文生图] 任务已创建: ${taskId}`);

    const imageUrl = await waitForTextToImageResult(taskId, undefined, undefined, keyId);
    console.log(`[文生图] 生成完成: ${imageUrl}`);

    // 保存到数据库
    if (req.userId) {
      await prisma.media.create({
        data: {
          type: 'IMAGE',
          filename: `gen_${taskId}.png`,
          url: imageUrl,
          prompt,
          userId: req.userId,
        },
      });
    }

    res.json({
      url: imageUrl,
      taskId,
      sceneId,
      status: 'success',
    });
  } catch (error: any) {
    console.error('Image generate error:', error);
    res.status(500).json({
      error: error.message || '图片生成失败',
      detail: error.message,
    });
  }
});

// POST /api/image/generate-async - 异步文生图（立即返回taskId，前端轮询）
imageRouter.post('/generate-async', async (req: Request, res: Response) => {
  try {
    const { prompt, sceneId, aspectRatio, resolution, model } = req.body;

    if (!prompt) {
      res.status(400).json({ error: '请提供图片生成提示词' });
      return;
    }

    const imageModel: ImageModel = (['g', 'v2', 'pro'].includes(model) ? model : 'g') as ImageModel;

    const { taskId, keyId } = await createTextToImageTask(
      prompt,
      aspectRatio || '16:9',
      resolution || '1k',
      imageModel
    );

    // 注册映射，供前端轮询时使用同一个 Key 查询
    registerTaskKey(taskId, keyId);

    // 任务已提交给 RunningHub，立即释放 Key slot
    // 轮询查询不需要占用 Key，Key 只在提交阶段使用
    if (keyId) await releaseKey(keyId);

    res.json({
      taskId,
      sceneId,
      status: 'running',
    });
  } catch (error: any) {
    console.error('Image generate-async error:', error);
    res.status(500).json({
      error: error.message || '创建图片生成任务失败',
      detail: error.message,
    });
  }
});

// GET /api/image/task/:taskId - 查询任务状态和结果
imageRouter.get('/task/:taskId', async (req: Request, res: Response) => {
  try {
    const taskId = req.params.taskId as string;

    const { queryV2Task, getApiKeyByTaskId, getKeyIdByTaskId } = await import('../services/runninghub');
    const { releaseKey, recordKeyError } = await import('../services/apiKeyPool');

    // 使用创建任务时的同一个 Key 来查询
    const apiKey = await getApiKeyByTaskId(taskId);
    const result = await queryV2Task(taskId, apiKey);

    if (result.status === 'SUCCESS') {
      // Key 已在提交时释放，无需再次释放

      const imageOutput = result.results?.find(
        (r) => r.url && r.outputType && ['png', 'jpg', 'jpeg', 'webp'].includes(r.outputType.toLowerCase())
      ) ?? result.results?.find((r) => r.url);

      res.json({
        taskId,
        status: 'success',
        url: imageOutput?.url,
      });
    } else if (result.status === 'FAILED') {
      // Key 已在提交时释放，无需再次释放
      res.json({ taskId, status: 'failed', error: result.errorMessage });
    } else {
      res.json({ taskId, status: 'running' });
    }
  } catch (error: any) {
    console.error('Task status error:', error);
    res.status(500).json({
      error: error.message || '查询任务状态失败',
    });
  }
});
