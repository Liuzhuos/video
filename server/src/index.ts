import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { chatRouter } from './routes/chat';
import { storyboardRouter } from './routes/storyboard';
import { imageRouter } from './routes/image';
import { videoRouter } from './routes/video';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// 路由
app.use('/api/chat', chatRouter);
app.use('/api/storyboard', storyboardRouter);
app.use('/api/image', imageRouter);
app.use('/api/video', videoRouter);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
});
