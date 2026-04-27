import { useState, useEffect, useRef } from 'react';
import { Film, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import type { Storyboard } from '../types';
import { generateVideoAsync, checkVideoTask } from '../api/video';

interface VideoPanelProps {
  storyboard: Storyboard;
  videoUrl: string | null;
  videoError: string | null;
  onVideoComplete: (url: string) => void;
  onVideoError: (error: string) => void;
}

export default function VideoPanel({
  storyboard,
  videoUrl,
  videoError,
  onVideoComplete,
  onVideoError,
}: VideoPanelProps) {
  const [generating, setGenerating] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState('准备中...');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  // 组件挂载时自动开始生成
  useEffect(() => {
    if (!startedRef.current && !videoUrl && !videoError) {
      startedRef.current = true;
      startGeneration();
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const startGeneration = async () => {
    setGenerating(true);
    setProgress('正在提交视频生成任务...');

    try {
      // 收集所有分镜的图片URL
      const imageUrls = storyboard.scenes
        .filter((s) => s.imageUrl)
        .map((s) => s.imageUrl!);

      if (imageUrls.length === 0) {
        onVideoError('没有可用的分镜图片');
        setGenerating(false);
        return;
      }

      // 构建视频描述 prompt
      const videoPrompt = storyboard.scenes
        .map((s, i) => `图${i + 1}：${s.description}`)
        .join('。');

      // 提交异步任务
      const result = await generateVideoAsync({
        imageUrls,
        prompt: videoPrompt,
        duration: '6',
        resolution: '720p',
      });

      setTaskId(result.taskId);
      setProgress('任务已提交，正在生成视频...');

      // 开始轮询
      startPolling(result.taskId);
    } catch (err: any) {
      onVideoError(err.message);
      setGenerating(false);
    }
  };

  const startPolling = (tid: string) => {
    let elapsed = 0;

    pollingRef.current = setInterval(async () => {
      elapsed += 5;
      setProgress(`正在生成视频... 已等待 ${elapsed} 秒`);

      try {
        const result = await checkVideoTask(tid);

        if (result.status === 'success' && result.url) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setGenerating(false);
          onVideoComplete(result.url);
        } else if (result.status === 'failed') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setGenerating(false);
          onVideoError('视频生成失败，请重试');
        }
      } catch (err: any) {
        // 轮询出错不立即停止，继续重试
        console.error('轮询出错:', err.message);
      }

      // 超时保护 10 分钟
      if (elapsed > 600) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setGenerating(false);
        onVideoError('视频生成超时，请稍后重试');
      }
    }, 5000);
  };

  const handleRetry = () => {
    startedRef.current = false;
    setTaskId(null);
    onVideoError('');
    startGeneration();
  };

  return (
    <div className="flex flex-col h-full">
      {/* 标题栏 */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          <Film className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">视频生成</h2>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {storyboard.title} · {storyboard.scenes.length} 个分镜
        </p>
      </div>

      {/* 内容区 */}
      <div className="flex-1 flex items-center justify-center p-8">
        {videoUrl ? (
          // 视频生成完成
          <div className="text-center space-y-4 w-full max-w-lg">
            <div className="flex items-center justify-center gap-2 text-green-600 mb-4">
              <CheckCircle className="w-6 h-6" />
              <span className="text-lg font-medium">视频生成完成！</span>
            </div>
            <video
              src={videoUrl}
              controls
              className="w-full rounded-xl shadow-lg border border-gray-200"
              autoPlay
              loop
            />
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-4 text-sm text-blue-600 hover:text-blue-700 underline"
            >
              在新窗口打开视频
            </a>
          </div>
        ) : videoError ? (
          // 生成失败
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-red-500">
              <AlertCircle className="w-6 h-6" />
              <span className="text-lg font-medium">生成失败</span>
            </div>
            <p className="text-sm text-gray-500 max-w-md">{videoError}</p>
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              重新生成
            </button>
          </div>
        ) : (
          // 生成中
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto" />
            <div>
              <p className="text-lg font-medium text-gray-800">视频生成中</p>
              <p className="text-sm text-gray-500 mt-1">{progress}</p>
              {taskId && (
                <p className="text-xs text-gray-400 mt-2">任务ID: {taskId}</p>
              )}
            </div>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              视频生成通常需要 1-5 分钟，请耐心等待。生成过程中请不要关闭页面。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
