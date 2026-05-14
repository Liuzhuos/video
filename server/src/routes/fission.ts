import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import {
  createTextToImageTask,
  waitForTextToImageResult,
  createReferenceToVideoTask,
  waitForVideoResult,
  checkTaskStatus,
  getTaskOutput,
  createImageToImageTask,
  waitForImageToImageResult,
  type ImageModel,
} from '../services/runninghub';

export const fissionRouter = Router();

// 视频上传配置
const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `video_${Date.now()}${ext}`);
  },
});

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 MP4、MOV、WebM、AVI 格式的视频'));
    }
  },
});

// 图片上传配置（用于图生图的源图）
const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `fission_img_${Date.now()}${ext}`);
  },
});

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 JPG、PNG、WebP 格式的图片'));
    }
  },
});

// POST /api/fission/upload-video - 上传视频
fissionRouter.post('/upload-video', videoUpload.single('video'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: '请上传视频文件' });
    return;
  }

  res.json({
    url: `/uploads/${req.file.filename}`,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
  });
});

// POST /api/fission/upload-frame - 上传截取的关键帧图片
fissionRouter.post('/upload-frame', imageUpload.single('image'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: '请上传图片' });
    return;
  }

  res.json({
    url: `/uploads/${req.file.filename}`,
    filename: req.file.filename,
  });
});

// POST /api/fission/text-to-image - 文生图
fissionRouter.post('/text-to-image', async (req: Request, res: Response) => {
  try {
    const { prompt, aspectRatio, resolution, model } = req.body;

    if (!prompt) {
      res.status(400).json({ error: '请提供图片生成提示词' });
      return;
    }

    const imageModel: ImageModel = (['g', 'v2', 'pro'].includes(model) ? model : 'g') as ImageModel;
    console.log(`[裂变-文生图] model: ${imageModel}, prompt: ${prompt}, aspectRatio: ${aspectRatio}, resolution: ${resolution}`);

    const taskId = await createTextToImageTask(
      prompt,
      aspectRatio || '16:9',
      resolution || '1k',
      imageModel
    );
    const imageUrl = await waitForTextToImageResult(taskId);

    res.json({
      url: imageUrl,
      taskId,
      status: 'success',
    });
  } catch (error: any) {
    console.error('[裂变-文生图] 错误:', error);
    res.status(500).json({ error: error.message || '文生图失败' });
  }
});

// POST /api/fission/image-to-image - 图生图（廉价版，支持模型选择）
fissionRouter.post('/image-to-image', async (req: Request, res: Response) => {
  try {
    const { imageUrl, prompt, aspectRatio, resolution, model } = req.body;

    if (!imageUrl || !prompt) {
      res.status(400).json({ error: '请提供源图片URL和提示词' });
      return;
    }

    // 必须是公网 URL
    if (!imageUrl.startsWith('http')) {
      res.status(400).json({ error: '源图片必须是公网URL' });
      return;
    }

    const imageModel: ImageModel = (['g', 'v2', 'pro'].includes(model) ? model : 'g') as ImageModel;
    console.log(`[裂变-图生图] model: ${imageModel}, imageUrl: ${imageUrl}, prompt: ${prompt}`);

    const taskId = await createImageToImageTask(
      [imageUrl],
      prompt,
      aspectRatio || '16:9',
      resolution || '1k',
      imageModel
    );
    const resultUrl = await waitForImageToImageResult(taskId);

    res.json({
      url: resultUrl,
      taskId,
      status: 'success',
    });
  } catch (error: any) {
    console.error('[裂变-图生图] 错误:', error);
    res.status(500).json({ error: error.message || '图生图失败' });
  }
});

// POST /api/fission/generate-video - 生成裂变视频
fissionRouter.post('/generate-video', async (req: Request, res: Response) => {
  try {
    const { imageUrl, prompt, referenceVideoUrl, duration, resolution } = req.body;

    if (!imageUrl) {
      res.status(400).json({ error: '请提供垫图URL' });
      return;
    }

    if (!prompt) {
      res.status(400).json({ error: '请提供视频提示词' });
      return;
    }

    // 只使用公网URL
    const validImageUrl = imageUrl.startsWith('http') ? imageUrl : null;
    if (!validImageUrl) {
      res.status(400).json({ error: '垫图必须是公网URL，请使用AI生图功能生成图片' });
      return;
    }

    const imageUrls = [validImageUrl];

    console.log(`[裂变-视频生成] imageUrl: ${validImageUrl}, prompt: ${prompt}, refVideo: ${referenceVideoUrl || '无'}`);

    const taskId = await createReferenceToVideoTask(
      imageUrls,
      prompt,
      duration || '6',
      resolution || '720p'
    );

    res.json({
      taskId,
      status: 'running',
    });
  } catch (error: any) {
    console.error('[裂变-视频生成] 错误:', error);
    res.status(500).json({ error: error.message || '视频生成失败' });
  }
});

// GET /api/fission/task/:taskId - 查询任务状态
fissionRouter.get('/task/:taskId', async (req: Request, res: Response) => {
  try {
    const taskId = req.params.taskId;
    const status = await checkTaskStatus(taskId);

    if (status === 'SUCCESS' || status === 'COMPLETED') {
      const outputs = await getTaskOutput(taskId);
      const videoOutput = outputs.find((o) =>
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
    console.error('[裂变-任务查询] 错误:', error);
    res.status(500).json({ error: error.message || '查询任务状态失败' });
  }
});
