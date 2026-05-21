import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { chatRouter } from './routes/chat';
import { storyboardRouter } from './routes/storyboard';
import { imageRouter } from './routes/image';
import { videoRouter } from './routes/video';
import { fissionRouter } from './routes/fission';
import { authRouter } from './routes/auth';
import { mediaRouter } from './routes/media';
import { adminRouter } from './routes/admin';
import { resetAllLoads } from './services/apiKeyPool';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 路由
app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);
app.use('/api/storyboard', storyboardRouter);
app.use('/api/image', imageRouter);
app.use('/api/video', videoRouter);
app.use('/api/fission', fissionRouter);
app.use('/api/media', mediaRouter);
app.use('/api/admin', adminRouter);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, async () => {
  // 服务启动时重置所有 Key 的负载计数（防止上次异常退出导致计数泄漏）
  try {
    await resetAllLoads('runninghub');
  } catch (e) {
    console.warn('[启动] 重置 Key 负载计数失败（数据库可能未就绪）:', e);
  }
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
});
