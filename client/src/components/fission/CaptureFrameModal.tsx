import { useState, useRef } from 'react';
import { Film, Camera, X } from 'lucide-react';
import type { CapturedFrame } from './types';

interface CaptureFrameModalProps {
  onConfirm: (frames: CapturedFrame[], destination: 'source' | 'pad') => void;
  onClose: () => void;
}

export default function CaptureFrameModal({ onConfirm, onClose }: CaptureFrameModalProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [frames, setFrames] = useState<CapturedFrame[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null!);
  const fileInputRef = useRef<HTMLInputElement>(null!);

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setVideoUrl(URL.createObjectURL(file));
    setFrames([]);
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const localUrl = URL.createObjectURL(blob);
      const time = video.currentTime.toFixed(2);
      setFrames((prev) => [
        ...prev,
        { id: `frame_${Date.now()}`, localUrl, blob, label: `${time}s` },
      ]);
    }, 'image/png');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-runway-surface border border-runway-border rounded-xl w-[720px] max-w-[95vw] max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-runway-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-runway-slate" />
            <span className="text-sm font-semibold text-white">视频截帧</span>
          </div>
          <button onClick={onClose} className="text-runway-slate hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 min-h-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleVideoSelect}
            className="hidden"
          />

          {!videoUrl ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-runway-border rounded-lg p-10 flex flex-col items-center gap-3 hover:border-runway-charcoal transition-colors"
            >
              <Film className="w-8 h-8 text-runway-mid-slate" />
              <span className="text-sm text-runway-slate">点击上传视频</span>
              <span className="text-xs text-runway-mid-slate">支持 MP4、MOV、WebM</span>
            </button>
          ) : (
            <div className="space-y-3">
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                className="w-full rounded-lg bg-black"
                style={{ maxHeight: '300px' }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCapture}
                  className="flex-1 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-runway-cloud transition-colors flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />截取当前帧
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 border border-runway-border text-runway-slate text-sm rounded-md hover:text-white hover:border-runway-charcoal transition-colors"
                >
                  换视频
                </button>
              </div>
            </div>
          )}

          {frames.length > 0 && (
            <div>
              <p className="text-xs text-runway-slate mb-2">已截取 {frames.length} 帧</p>
              <div className="grid grid-cols-4 gap-2">
                {frames.map((f) => (
                  <div
                    key={f.id}
                    className="relative rounded-md overflow-hidden border border-runway-border group"
                  >
                    <img
                      src={f.localUrl}
                      alt={f.label}
                      className="w-full aspect-video object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                      <span className="text-xs text-white">{f.label}</span>
                    </div>
                    <button
                      onClick={() => setFrames((p) => p.filter((x) => x.id !== f.id))}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-runway-border flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 border border-runway-border text-runway-slate text-sm rounded-md hover:text-white hover:border-runway-charcoal transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => frames.length > 0 && onConfirm(frames, 'source')}
            disabled={frames.length === 0}
            className="flex-1 py-2 border border-runway-border text-runway-slate text-sm font-medium rounded-md hover:text-white hover:border-runway-charcoal transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            加入图生图源图（{frames.length} 张）
          </button>
          <button
            onClick={() => frames.length > 0 && onConfirm(frames, 'pad')}
            disabled={frames.length === 0}
            className="flex-1 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-runway-cloud transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            直接加入垫图区（{frames.length} 张）
          </button>
        </div>
      </div>
    </div>
  );
}
