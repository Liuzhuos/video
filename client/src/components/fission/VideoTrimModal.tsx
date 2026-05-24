import { useState, useRef, useCallback, useEffect } from 'react';
import { Film, Play, Loader2, X, Scissors } from 'lucide-react';
import { authFetch } from '../../api/request';

interface VideoTrimModalProps {
  onConfirm: (fileOrUrl: File | string, localUrl: string) => void;
  onClose: () => void;
}

export default function VideoTrimModal({ onConfirm, onClose }: VideoTrimModalProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);
  const [trimming, setTrimming] = useState(false);
  const [trimProgress, setTrimProgress] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null!);
  const fileInputRef = useRef<HTMLInputElement>(null!);
  const trackRef = useRef<HTMLDivElement>(null!);

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setOriginalFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setStartTime(0);
    setEndTime(0);
    setCurrentTime(0);
    setDuration(0);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    setEndTime(video.duration);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    if (video.currentTime >= endTime) {
      video.pause();
      video.currentTime = endTime;
    }
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(1).padStart(4, '0');
    return `${m}:${s}`;
  };

  const posToTime = useCallback(
    (clientX: number): number => {
      const track = trackRef.current;
      if (!track || duration === 0) return 0;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration]
  );

  const handleMouseDown = (e: React.MouseEvent, handle: 'start' | 'end') => {
    e.preventDefault();
    setDragging(handle);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const t = posToTime(e.clientX);
      if (dragging === 'start') {
        const newStart = Math.min(t, endTime - 0.5);
        setStartTime(Math.max(0, newStart));
        if (videoRef.current) videoRef.current.currentTime = Math.max(0, newStart);
      } else {
        const newEnd = Math.max(t, startTime + 0.5);
        setEndTime(Math.min(duration, newEnd));
        if (videoRef.current) videoRef.current.currentTime = Math.min(duration, newEnd);
      }
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, startTime, endTime, duration, posToTime]);

  const handleTrackClick = (e: React.MouseEvent) => {
    if (dragging) return;
    const t = posToTime(e.clientX);
    if (videoRef.current) videoRef.current.currentTime = t;
  };

  const handlePreview = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = startTime;
    video.play();
  };

  const handleTrim = async () => {
    if (!originalFile) return;
    setTrimming(true);
    setTrimProgress('上传并裁剪中...');
    try {
      const noTrim = startTime <= 0.1 && endTime >= duration - 0.1;
      if (noTrim) {
        onConfirm(originalFile, URL.createObjectURL(originalFile));
        return;
      }
      const formData = new FormData();
      formData.append('video', originalFile);
      formData.append('startTime', String(startTime));
      formData.append('endTime', String(endTime));
      const response = await authFetch('/api/fission/trim-video', { method: 'POST', body: formData });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '裁剪失败');
      }
      const result = await response.json();
      onConfirm(result.url, result.url);
    } catch (err: any) {
      console.error('裁剪失败:', err);
      setTrimProgress(`失败: ${err.message}`);
      setTrimming(false);
    }
  };

  const trimDuration = endTime - startTime;
  const startPct = duration > 0 ? (startTime / duration) * 100 : 0;
  const endPct = duration > 0 ? (endTime / duration) * 100 : 100;
  const currentPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-runway-surface border border-runway-border rounded-xl w-[680px] max-w-[95vw] max-h-[90vh] flex flex-col shadow-2xl">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-runway-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-runway-slate" />
            <span className="text-sm font-semibold text-white">上传并裁剪参考视频</span>
          </div>
          <button onClick={onClose} className="text-runway-slate hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 min-h-0">
          <input ref={fileInputRef} type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />

          {!videoUrl ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-runway-border rounded-lg p-12 flex flex-col items-center gap-3 hover:border-runway-charcoal transition-colors"
            >
              <Film className="w-8 h-8 text-runway-mid-slate" />
              <span className="text-sm text-runway-slate">点击上传视频</span>
              <span className="text-xs text-runway-mid-slate">支持 MP4、MOV、WebM</span>
            </button>
          ) : (
            <div className="space-y-4">
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full"
                  style={{ maxHeight: '280px' }}
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                />
              </div>

              {duration > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-runway-slate">
                    <span>起点：<span className="text-white font-mono">{formatTime(startTime)}</span></span>
                    <span className="text-runway-mid-slate">
                      选区时长：<span className="text-white font-mono">{formatTime(trimDuration)}</span>
                    </span>
                    <span>终点：<span className="text-white font-mono">{formatTime(endTime)}</span></span>
                  </div>

                  {/* 滑块轨道 */}
                  <div className="relative h-10 flex items-center select-none">
                    <div
                      ref={trackRef}
                      className="absolute inset-x-0 h-2 bg-runway-charcoal rounded-full cursor-pointer"
                      onClick={handleTrackClick}
                    />
                    <div
                      className="absolute h-2 bg-white/30 rounded-full pointer-events-none"
                      style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
                    />
                    <div
                      className="absolute w-0.5 h-5 bg-blue-400 rounded-full pointer-events-none"
                      style={{ left: `${currentPct}%`, transform: 'translateX(-50%)' }}
                    />
                    <div
                      className="absolute w-4 h-8 bg-white rounded-sm cursor-ew-resize flex items-center justify-center shadow-lg z-10 hover:bg-runway-cloud transition-colors"
                      style={{ left: `${startPct}%`, transform: 'translateX(-50%)' }}
                      onMouseDown={(e) => handleMouseDown(e, 'start')}
                    >
                      <div className="w-0.5 h-4 bg-black/40 rounded-full" />
                    </div>
                    <div
                      className="absolute w-4 h-8 bg-white rounded-sm cursor-ew-resize flex items-center justify-center shadow-lg z-10 hover:bg-runway-cloud transition-colors"
                      style={{ left: `${endPct}%`, transform: 'translateX(-50%)' }}
                      onMouseDown={(e) => handleMouseDown(e, 'end')}
                    >
                      <div className="w-0.5 h-4 bg-black/40 rounded-full" />
                    </div>
                  </div>

                  <div className="flex justify-between text-xs text-runway-mid-slate">
                    <span>{formatTime(0)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handlePreview}
                      disabled={trimming}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-runway-border text-runway-slate text-xs rounded-md hover:text-white hover:border-runway-charcoal transition-colors disabled:opacity-50"
                    >
                      <Play className="w-3 h-3" />预览选区
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={trimming}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-runway-border text-runway-slate text-xs rounded-md hover:text-white hover:border-runway-charcoal transition-colors disabled:opacity-50"
                    >
                      换视频
                    </button>
                  </div>
                </div>
              )}

              {trimming && (
                <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-md">
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
                  <span className="text-xs text-blue-400">{trimProgress}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex gap-3 px-5 py-4 border-t border-runway-border flex-shrink-0">
          <button
            onClick={onClose}
            disabled={trimming}
            className="px-5 py-2 border border-runway-border text-runway-slate text-sm rounded-md hover:text-white hover:border-runway-charcoal transition-colors disabled:opacity-40"
          >
            取消
          </button>
          <button
            onClick={handleTrim}
            disabled={!videoUrl || duration === 0 || trimming}
            className="flex-1 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-runway-cloud transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {trimming ? (
              <><Loader2 className="w-4 h-4 animate-spin" />{trimProgress}</>
            ) : (
              <><Scissors className="w-4 h-4" />确认裁剪并使用</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
