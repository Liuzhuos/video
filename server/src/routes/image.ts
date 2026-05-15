import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { createTextToImageTask, waitForTextToImageResult, waitForTaskResult, type ImageModel } from '../services/runninghub';
import { uploadBufferToOSS } from '../services/oss';

export const imageRouter = Router();

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
imageRouter.post('/upload', upload.single('image'), async (req: Request, res: Response) => {
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

// POST /api/image/generate - 文生图（调用 RunningHub 全能图片，支持模型选择）
imageRouter.post('/generate', async (req: Request, res: Response) => {
  try {
    const { prompt, sceneId, aspectRatio, resolution, model } = req.body;

    if (!prompt) {
      res.status(400).json({ error: '请提供图片生成提示词' });
      return;
    }

    const imageModel: ImageModel = (['g', 'v2', 'pro'].includes(model) ? model : 'g') as ImageModel;
    console.log(`[文生图] 场景 ${sceneId}, model: ${imageModel}, prompt: ${prompt}`);

    const taskId = await createTextToImageTask(
      prompt,
      aspectRatio || '16:9',
      resolution || '1k',
      imageModel
    );
    console.log(`[文生图] 任务已创建: ${taskId}`);

    const imageUrl = await waitForTextToImageResult(taskId);
    console.log(`[文生图] 生成完成: ${imageUrl}`);

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
    const { prompt, sceneId } = req.body;

    if (!prompt) {
      res.status(400).json({ error: '请提供图片生成提示词' });
      return;
    }

    const taskId = await createTextToImageTask(prompt);

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

    const { checkTaskStatus, getTaskOutput } = await import('../services/runninghub');
    const status = await checkTaskStatus(taskId);

    if (status === 'SUCCESS' || status === 'COMPLETED') {
      const outputs = await getTaskOutput(taskId);
      const imageOutput = outputs.find(
        (o) => ['png', 'jpg', 'jpeg', 'webp'].includes(o.fileType)
      );

      res.json({
        taskId,
        status: 'success',
        url: imageOutput?.fileUrl || outputs[0]?.fileUrl,
        outputs,
      });
    } else if (status === 'FAILED' || status === 'ERROR') {
      res.json({ taskId, status: 'failed' });
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
