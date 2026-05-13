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
      const imageUrls = storyboard.scenes
        .filter((s) => s.imageUrl)
        .map((s) => s.imageUrl!);

      if (imageUrls.length === 0) {
        onVideoError('没有可用的分镜图片');
        setGenerating(false);
        return;
      }

      const videoPrompt = storyboard.scenes
        .map((s, i) => `图${i + 1}：${s.description}`)
        .join('。');

      const result = await generateVideoAsync({
        imageUrls,
        prompt: videoPrompt,
        duration: '6',
        resolution: '720p',
      });

      setTaskId(result.taskId);
      setProgress('任务已提交，正在生成视频...');
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
        console.error('轮询出错:', err.message);
      }

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
    <div className="flex flex-col h-full bg-runway-black">
      {/* 标题栏 */}
      <div className="px-6 py-4 border-b border-runway-border">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-white" />
          <h2 className="text-feature-title text-white">视频生成</h2>
        </div>
        <p className="text-small text-runway-slate mt-1">
          {storyboard.title} · {storyboard.scenes.length} 个分镜
        </p>
      </div>

      {/* 内容区 */}
      <div className="flex-1 flex items-center justify-center p-8">
        {videoUrl ? (
          <div className="text-center space-y-6 w-full max-w-lg">
            <div className="flex items-center justify-center gap-2 text-white mb-4">
              <CheckCircle className="w-5 h-5" />
              <span className="text-feature-title">视频生成完成</span>
            </div>
            <video
              src={videoUrl}
              controls
              className="w-full rounded-comfortable border border-runway-border"
              autoPlay
              loop
            />
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-small text-runway-slate hover:text-white underline underline-offset-4 transition-colors"
            >
              在新窗口打开
            </a>
          </div>
        ) : videoError ? (
          <div className="text-center space-y-5">
            <AlertCircle className="w-8 h-8 text-runway-muted mx-auto" />
            <div>
              <p className="text-feature-title text-white mb-2">生成失败</p>
              <p className="text-small text-runway-slate max-w-md">{videoError}</p>
            </div>
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-2 bg-white text-black px-5 py-2 rounded-sharp text-xs font-semibold hover:bg-runway-cloud transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              重新生成
            </button>
          </div>
        ) : (
          <div className="text-center space-y-5">
            <Loader2 className="w-10 h-10 text-runway-slate animate-spin mx-auto" />
            <div>
              <p className="text-feature-title text-white">视频生成中</p>
              <p className="text-small text-runway-slate mt-2">{progress}</p>
              {taskId && (
                <p className="text-micro text-runway-charcoal mt-3 normal-case">ID: {taskId}</p>
              )}
            </div>
            <p className="text-micro text-runway-charcoal max-w-sm mx-auto normal-case">
              视频生成通常需要 1-5 分钟，请耐心等待
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
