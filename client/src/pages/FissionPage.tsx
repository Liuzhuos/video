import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Wand2,
  Film,
  Play,
  Loader2,
  X,
  ChevronRight,
  Check,
  Camera,
  Music,
  Video,
  Scissors,
  FileText,
} from 'lucide-react';
import { uploadImage } from '../api/image';
import { uploadVideo } from '../api/fission';
import ImageEditorModal from '../components/ImageEditorModal';
import PromptEditor, { type Asset } from '../components/PromptEditor';
import ScriptModal, { type ScriptScene } from '../components/ScriptModal';
import { polishPrompt } from '../api/chat';
import { authFetch } from '../api/request';

type FissionStep = 'prepare' | 'generate';
type ImageSource = 'frame' | 'text2img' | 'img2img';
type ImageModel = 'g' | 'v2' | 'pro';

interface PreparedImage {
  id: string;
  url: string;
  originalUrl?: string; // 首次上传/生成时的原始 URL，用于恢复
  source: ImageSource;
  label: string;
  pending?: boolean;
}

interface CapturedFrame {
  id: string;
  localUrl: string;
  blob: Blob;
  label: string;
}

// ==================== 视频裁剪弹窗 ====================
function VideoTrimModal({
  onConfirm,
  onClose,
}: {
  onConfirm: (fileOrUrl: File | string, localUrl: string) => void;
  onClose: () => void;
}) {
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
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
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
    // 到达终点时暂停
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

  // 计算拖拽位置对应的时间
  const posToTime = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track || duration === 0) return 0;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  }, [duration]);

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

  // 点击轨道跳转
  const handleTrackClick = (e: React.MouseEvent) => {
    if (dragging) return;
    const t = posToTime(e.clientX);
    if (videoRef.current) videoRef.current.currentTime = t;
  };

  // 预览选区
  const handlePreview = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = startTime;
    video.play();
  };

  // 裁剪视频（后端 ffmpeg 处理）
  const handleTrim = async () => {
    if (!originalFile) return;
    setTrimming(true);
    setTrimProgress('上传并裁剪中...');

    try {
      const noTrim = startTime <= 0.1 && endTime >= duration - 0.1;

      if (noTrim) {
        // 没有实际裁剪，直接用原始文件
        const localUrl = URL.createObjectURL(originalFile);
        onConfirm(originalFile, localUrl);
        return;
      }

      // 发给后端裁剪
      const formData = new FormData();
      formData.append('video', originalFile);
      formData.append('startTime', String(startTime));
      formData.append('endTime', String(endTime));

      const response = await authFetch('/api/fission/trim-video', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '裁剪失败');
      }

      const result = await response.json();
      // 后端返回 OSS URL，直接用于预览和上传
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
              {/* 视频播放器 */}
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

              {/* 裁剪轨道 */}
              {duration > 0 && (
                <div className="space-y-3">
                  {/* 时间信息 */}
                  <div className="flex items-center justify-between text-xs text-runway-slate">
                    <span>起点：<span className="text-white font-mono">{formatTime(startTime)}</span></span>
                    <span className="text-runway-mid-slate">选区时长：<span className="text-white font-mono">{formatTime(trimDuration)}</span></span>
                    <span>终点：<span className="text-white font-mono">{formatTime(endTime)}</span></span>
                  </div>

                  {/* 滑块轨道 */}
                  <div className="relative h-10 flex items-center select-none">
                    {/* 背景轨道 */}
                    <div
                      ref={trackRef}
                      className="absolute inset-x-0 h-2 bg-runway-charcoal rounded-full cursor-pointer"
                      onClick={handleTrackClick}
                    />

                    {/* 选区高亮 */}
                    <div
                      className="absolute h-2 bg-white/30 rounded-full pointer-events-none"
                      style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
                    />

                    {/* 当前播放位置 */}
                    <div
                      className="absolute w-0.5 h-5 bg-blue-400 rounded-full pointer-events-none"
                      style={{ left: `${currentPct}%`, transform: 'translateX(-50%)' }}
                    />

                    {/* 起点手柄 */}
                    <div
                      className="absolute w-4 h-8 bg-white rounded-sm cursor-ew-resize flex items-center justify-center shadow-lg z-10 hover:bg-runway-cloud transition-colors"
                      style={{ left: `${startPct}%`, transform: 'translateX(-50%)' }}
                      onMouseDown={(e) => handleMouseDown(e, 'start')}
                    >
                      <div className="w-0.5 h-4 bg-black/40 rounded-full" />
                    </div>

                    {/* 终点手柄 */}
                    <div
                      className="absolute w-4 h-8 bg-white rounded-sm cursor-ew-resize flex items-center justify-center shadow-lg z-10 hover:bg-runway-cloud transition-colors"
                      style={{ left: `${endPct}%`, transform: 'translateX(-50%)' }}
                      onMouseDown={(e) => handleMouseDown(e, 'end')}
                    >
                      <div className="w-0.5 h-4 bg-black/40 rounded-full" />
                    </div>
                  </div>

                  {/* 总时长标注 */}
                  <div className="flex justify-between text-xs text-runway-mid-slate">
                    <span>{formatTime(0)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>

                  {/* 操作按钮 */}
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

              {/* 裁剪进度 */}
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

// ==================== 截帧弹窗 ====================
function CaptureFrameModal({
  onConfirm,
  onClose,
}: {
  onConfirm: (frames: CapturedFrame[], destination: 'source' | 'pad') => void;
  onClose: () => void;
}) {
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
      setFrames((prev) => [...prev, { id: `frame_${Date.now()}`, localUrl, blob, label: `${time}s` }]);
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
          <input ref={fileInputRef} type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />
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
              <video ref={videoRef} src={videoUrl} controls className="w-full rounded-lg bg-black" style={{ maxHeight: '300px' }} />
              <div className="flex gap-2">
                <button onClick={handleCapture} className="flex-1 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-runway-cloud transition-colors flex items-center justify-center gap-2">
                  <Camera className="w-4 h-4" />截取当前帧
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 border border-runway-border text-runway-slate text-sm rounded-md hover:text-white hover:border-runway-charcoal transition-colors">
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
                  <div key={f.id} className="relative rounded-md overflow-hidden border border-runway-border group">
                    <img src={f.localUrl} alt={f.label} className="w-full aspect-video object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                      <span className="text-xs text-white">{f.label}</span>
                    </div>
                    <button onClick={() => setFrames((p) => p.filter((x) => x.id !== f.id))} className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80">
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-runway-border flex-shrink-0">
          <button onClick={onClose} className="px-5 py-2 border border-runway-border text-runway-slate text-sm rounded-md hover:text-white hover:border-runway-charcoal transition-colors">
            取消
          </button>
          <button onClick={() => frames.length > 0 && onConfirm(frames, 'source')} disabled={frames.length === 0} className="flex-1 py-2 border border-runway-border text-runway-slate text-sm font-medium rounded-md hover:text-white hover:border-runway-charcoal transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            加入图生图源图（{frames.length} 张）
          </button>
          <button onClick={() => frames.length > 0 && onConfirm(frames, 'pad')} disabled={frames.length === 0} className="flex-1 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-runway-cloud transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            直接加入垫图区（{frames.length} 张）
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== 主页面 ====================
export default function FissionPage() {
  const [step, setStep] = useState<FissionStep>('prepare');

  // 准备垫图 tab 状态（提升到父组件以保留切换步骤后的状态）
  const [prepareTab, setPrepareTab] = useState<'text2img' | 'img2img'>('text2img');

  // 垫图列表
  const [images, setImages] = useState<PreparedImage[]>([]);
  // 准备垫图步骤中选中的图片（多选，最多9张）
  const [selectedPadIds, setSelectedPadIds] = useState<string[]>([]);

  // 图生图源图
  const [img2imgSources, setImg2imgSources] = useState<{ url: string; originalUrl?: string; label: string }[]>([]);

  // 文生图/图生图参数
  const [textToImagePrompt, setTextToImagePrompt] = useState('');
  const [img2imgPrompt, setImg2imgPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [resolution, setResolution] = useState<'1k' | '2k' | '4k'>('1k');
  const [t2iModel, setT2iModel] = useState<ImageModel>('g');
  const [i2iModel, setI2iModel] = useState<ImageModel>('g');

  // Seedance 2.0 参数
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoDuration, setVideoDuration] = useState('5');
  const [videoResolution, setVideoResolution] = useState('720p');
  const [videoRatio, setVideoRatio] = useState('adaptive');
  const [generateAudio, setGenerateAudio] = useState(true);
  const [realPersonMode, setRealPersonMode] = useState(true);
  const [useRefVideo, setUseRefVideo] = useState(false);
  const [useRefAudio, setUseRefAudio] = useState(false);
  const [refVideoLocalUrl, setRefVideoLocalUrl] = useState<string | null>(null);
  const [refVideoUrl, setRefVideoUrl] = useState<string | null>(null);
  const [refAudioLocalName, setRefAudioLocalName] = useState<string | null>(null);
  const [refAudioUrl, setRefAudioUrl] = useState<string | null>(null);

  // 生成结果
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [videoGenerating, setVideoGenerating] = useState(false);
  const [videoLoadingMsg, setVideoLoadingMsg] = useState('');

  // 通用 loading（上传类）
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [showVideoTrimModal, setShowVideoTrimModal] = useState(false);

  // 分镜脚本
  const [scriptScenes, setScriptScenes] = useState<ScriptScene[]>([]);

  // 图片编辑器
  const [editingImage, setEditingImage] = useState<{
    type: 'img2img-source';
    index: number;
    url: string;
    originalUrl: string;
    label: string;
  } | {
    type: 'pad-image';
    id: string;
    url: string;
    originalUrl: string;
    label: string;
  } | null>(null);

  // ── 垫图多选逻辑 ──
  const togglePadSelect = (id: string) => {
    setSelectedPadIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 9) return prev; // 最多9张
      return [...prev, id];
    });
  };

  // ── 截帧确认 ──
  const handleCaptureConfirm = async (frames: CapturedFrame[], destination: 'source' | 'pad') => {
    setShowCaptureModal(false);
    try {
      setLoading(true);
      setError(null);
      if (destination === 'source') {
        const uploaded: { url: string; label: string }[] = [];
        for (let i = 0; i < frames.length; i++) {
          setLoadingMsg(`上传截帧中 (${i + 1}/${frames.length})...`);
          const file = new File([frames[i].blob], `frame_${Date.now()}.png`, { type: 'image/png' });
          const result = await uploadImage(file);
          uploaded.push({ url: result.url, label: `截帧 ${frames[i].label}` });
        }
        setImg2imgSources((prev) => [...prev, ...uploaded]);
      } else {
        const slotIds = frames.map(() => `frame_${Date.now()}_${Math.random().toString(36).slice(2)}`);
        setImages((prev) => [
          ...prev,
          ...slotIds.map((id, i) => ({ id, url: '', source: 'frame' as ImageSource, label: `截帧 ${frames[i].label}`, pending: true })),
        ]);
        for (let i = 0; i < frames.length; i++) {
          setLoadingMsg(`上传截帧中 (${i + 1}/${frames.length})...`);
          const file = new File([frames[i].blob], `frame_${Date.now()}.png`, { type: 'image/png' });
          const result = await uploadImage(file);
          const slotId = slotIds[i];
          setImages((prev) => prev.map((img) => img.id === slotId ? { ...img, url: result.url, pending: false } : img));
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  // ── 上传图片（图生图源图，多张）──
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = '';
    try {
      setLoading(true);
      setError(null);
      const uploaded: { url: string; label: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        setLoadingMsg(`上传图片 (${i + 1}/${files.length})...`);
        const result = await uploadImage(files[i]);
        uploaded.push({ url: result.url, label: files[i].name.slice(0, 20) });
      }
      setImg2imgSources((prev) => [...prev, ...uploaded]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  // ── 文生图 ──
  const handleTextToImage = async () => {
    if (!textToImagePrompt.trim()) return;
    const currentPrompt = textToImagePrompt.trim();
    const slotId = `t2i_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setImages((prev) => [...prev, { id: slotId, url: '', source: 'text2img', label: currentPrompt.slice(0, 20) + '...', pending: true }]);
    setError(null);
    try {
      const response = await authFetch('/api/image/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt: currentPrompt, aspectRatio, resolution, model: t2iModel }),
      });
      if (!response.ok) { const err = await response.json(); throw new Error(err.error || '文生图失败'); }
      const result = await response.json();
      setImages((prev) => prev.map((img) => img.id === slotId ? { ...img, url: result.url, pending: false } : img));
    } catch (err: any) {
      setImages((prev) => prev.filter((img) => img.id !== slotId));
      setError(err.message);
    }
  };

  // ── 图生图 ──
  const handleImageToImage = async () => {
    if (img2imgSources.length === 0 || !img2imgPrompt.trim()) return;
    const sourceUrl = img2imgSources[0].url;
    if (!sourceUrl.startsWith('http')) { setError('源图片必须是公网URL，请使用AI生图或上传后重试'); return; }
    const currentPrompt = img2imgPrompt.trim();
    const slotId = `i2i_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setImages((prev) => [...prev, { id: slotId, url: '', source: 'img2img', label: `图生图: ${currentPrompt.slice(0, 15)}...`, pending: true }]);
    setError(null);
    try {
      const response = await authFetch('/api/fission/image-to-image', {
        method: 'POST',
        body: JSON.stringify({ imageUrl: sourceUrl, prompt: currentPrompt, aspectRatio, resolution, model: i2iModel }),
      });
      if (!response.ok) { const err = await response.json(); throw new Error(err.error || '图生图失败'); }
      const result = await response.json();
      setImages((prev) => prev.map((img) => img.id === slotId ? { ...img, url: result.url, pending: false } : img));
    } catch (err: any) {
      setImages((prev) => prev.filter((img) => img.id !== slotId));
      setError(err.message);
    }
  };

  // ── 移除垫图 ──
  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    setSelectedPadIds((prev) => prev.filter((x) => x !== id));
  };

  // ── 上传参考视频（通过裁剪弹窗）──
  const handleVideoTrimConfirm = async (fileOrUrl: File | string, localUrl: string) => {
    setShowVideoTrimModal(false);
    setRefVideoLocalUrl(localUrl);
    try {
      // 后端已裁剪并上传 OSS，直接用返回的 URL
      if (typeof fileOrUrl === 'string') {
        setRefVideoUrl(fileOrUrl);
        return;
      }
      // 未裁剪，上传原始文件
      setLoading(true);
      setLoadingMsg('上传参考视频中...');
      setError(null);
      const result = await uploadVideo(fileOrUrl);
      setRefVideoUrl(result.url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  // ── 上传参考视频 ──
  const handleRefVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setRefVideoLocalUrl(URL.createObjectURL(file));
    try {
      setLoading(true);
      setLoadingMsg('上传参考视频中...');
      setError(null);
      const result = await uploadVideo(file);
      setRefVideoUrl(result.url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  // ── 上传参考音频 ──
  const handleRefAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setRefAudioLocalName(file.name);
    try {
      setLoading(true);
      setLoadingMsg('上传参考音频中...');
      setError(null);
      const formData = new FormData();
      formData.append('audio', file);
      const response = await authFetch('/api/fission/upload-audio', { method: 'POST', body: formData });
      if (!response.ok) { const err = await response.json(); throw new Error(err.error || '音频上传失败'); }
      const result = await response.json();
      setRefAudioUrl(result.url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  // ── 图片编辑保存 ──
  const handleImageEditorSave = async (dataUrl: string) => {
    if (!editingImage) return;
    setEditingImage(null);
    try {
      setLoading(true);
      setLoadingMsg('上传编辑后的图片...');
      setError(null);
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `edited_${Date.now()}.png`, { type: 'image/png' });
      const result = await uploadImage(file);
      if (editingImage.type === 'img2img-source') {
        setImg2imgSources((prev) =>
          prev.map((src, i) =>
            i === editingImage.index
              ? { ...src, url: result.url, originalUrl: src.originalUrl ?? src.url }
              : src
          )
        );
      } else {
        setImages((prev) =>
          prev.map((img) =>
            img.id === editingImage.id
              ? { ...img, url: result.url, originalUrl: img.originalUrl ?? img.url }
              : img
          )
        );
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  // ── 生成视频（Seedance 2.0）──
  const handleGenerateVideo = async () => {
    const selectedImages = images.filter((img) => selectedPadIds.includes(img.id) && !img.pending);
    const validImageUrls = selectedImages.map((img) => img.url).filter((u) => u.startsWith('http'));
    const validVideoUrls = refVideoUrl ? [refVideoUrl] : [];

    if (validImageUrls.length === 0 && validVideoUrls.length === 0) {
      setError('请先选择垫图（需要是已生成的公网图片）');
      return;
    }
    if (!videoPrompt.trim()) { setError('请填写视频提示词'); return; }
    try {
      setVideoGenerating(true);
      setVideoLoadingMsg('提交视频生成任务...');
      setError(null);
      setGeneratedVideoUrl(null);

      // 合并提示词：整体描述 + 分镜脚本
      let fullPrompt = videoPrompt.trim();
      if (scriptScenes.length > 0) {
        const sceneParts = scriptScenes
          .filter((s) => s.description.trim())
          .map((s, i) => {
            const parts: string[] = [];
            if (s.timeStart || s.timeEnd) parts.push(`[${s.timeStart || '0s'}-${s.timeEnd || '?'}]`);
            parts.push(s.description.trim());
            if (s.camera) parts.push(`镜头：${s.camera}`);
            if (s.action) parts.push(`动作：${s.action}`);
            return `镜头${i + 1}：${parts.join('，')}`;
          });
        if (sceneParts.length > 0) {
          fullPrompt += '\n\n' + sceneParts.join('；');
        }
      }

      const body: Record<string, any> = {
        prompt: fullPrompt,
        duration: videoDuration,
        resolution: videoResolution,
        ratio: videoRatio,
        generateAudio,
        realPersonMode,
      };
      if (validImageUrls.length > 0) body.imageUrls = validImageUrls;
      if (useRefVideo && validVideoUrls.length > 0) body.videoUrls = validVideoUrls;
      if (useRefAudio && refAudioUrl) body.audioUrls = [refAudioUrl];

      const response = await authFetch('/api/fission/seedance2', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!response.ok) { const err = await response.json(); throw new Error(err.error || '视频生成失败'); }
      const { taskId } = await response.json();

      setVideoLoadingMsg('视频生成中，请耐心等待...');
      const maxWait = 10 * 60 * 1000;
      const startTime = Date.now();
      while (Date.now() - startTime < maxWait) {
        const statusRes = await authFetch(`/api/fission/task/${taskId}`);
        const status = await statusRes.json();
        if (status.status === 'success' && status.url) {
          setGeneratedVideoUrl(status.url);
          return;
        }
        if (status.status === 'failed') throw new Error('视频生成失败');
        await new Promise((r) => setTimeout(r, 5000));
      }
      throw new Error('视频生成超时');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setVideoGenerating(false);
      setVideoLoadingMsg('');
    }
  };

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col overflow-hidden">
      {/* 步骤指示器 */}
      <div className="border-b border-runway-border bg-runway-deep px-6 py-3 flex-shrink-0">
        <div className="flex items-center gap-2 text-sm">
          {([{ key: 'prepare', label: '准备垫图' }, { key: 'generate', label: '生成视频' }] as const).map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="w-4 h-4 text-runway-mid-slate" />}
              <button
                onClick={() => setStep(s.key)}
                className={`px-3 py-1 rounded-md transition-colors ${step === s.key ? 'bg-white text-black font-medium' : 'text-runway-slate hover:text-white'}`}
              >
                {s.label}
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm flex items-center justify-between flex-shrink-0">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}


      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={step === 'prepare' ? 'h-full' : 'hidden'}>
          <PrepareStep
            images={images}
            selectedPadIds={selectedPadIds}
            textToImagePrompt={textToImagePrompt}
            img2imgPrompt={img2imgPrompt}
            img2imgSources={img2imgSources}
            aspectRatio={aspectRatio}
            resolution={resolution}
            t2iModel={t2iModel}
            i2iModel={i2iModel}
            loading={loading}
            loadingMsg={loadingMsg}
            activeTab={prepareTab}
            onActiveTabChange={setPrepareTab}
            onTogglePadSelect={togglePadSelect}
            onRemoveImage={removeImage}
            onTextToImage={handleTextToImage}
            onImageUpload={handleImageUpload}
            onImageToImage={handleImageToImage}
            onRemoveSource={(idx) => setImg2imgSources((prev) => prev.filter((_, i) => i !== idx))}
            onTextToImagePromptChange={setTextToImagePrompt}
            onImg2imgPromptChange={setImg2imgPrompt}
            onAspectRatioChange={setAspectRatio}
            onResolutionChange={setResolution}
            onT2iModelChange={setT2iModel}
            onI2iModelChange={setI2iModel}
            onOpenCaptureModal={() => setShowCaptureModal(true)}
            onAddToImg2imgSource={(url, label) => setImg2imgSources((prev) => [...prev, { url, label }])}
            onEditImg2imgSource={(index, url, label, originalUrl) => setEditingImage({ type: 'img2img-source', index, url, originalUrl, label })}
            onEditPadImage={(id, url, label, originalUrl) => setEditingImage({ type: 'pad-image', id, url, originalUrl, label })}
            onNext={() => setStep('generate')}
          />
        </div>
        <div className={step === 'generate' ? 'h-full' : 'hidden'}>
          <GenerateStep
            images={images}
            selectedPadIds={selectedPadIds}
            onTogglePadSelect={togglePadSelect}
            onRemoveImage={removeImage}
            onAddImage={(img) => setImages((prev) => [...prev, img])}
            videoPrompt={videoPrompt}
            videoDuration={videoDuration}
            videoResolution={videoResolution}
            videoRatio={videoRatio}
            generateAudio={generateAudio}
            realPersonMode={realPersonMode}
            useRefVideo={useRefVideo}
            useRefAudio={useRefAudio}
            refVideoLocalUrl={refVideoLocalUrl}
            refVideoUrl={refVideoUrl}
            refAudioLocalName={refAudioLocalName}
            refAudioUrl={refAudioUrl}
            generatedVideoUrl={generatedVideoUrl}
            videoGenerating={videoGenerating}
            videoLoadingMsg={videoLoadingMsg}
            loading={loading}
            loadingMsg={loadingMsg}
            scriptScenes={scriptScenes}
            onScriptScenesChange={setScriptScenes}
            onVideoPromptChange={setVideoPrompt}
            onVideoDurationChange={setVideoDuration}
            onVideoResolutionChange={setVideoResolution}
            onVideoRatioChange={setVideoRatio}
            onGenerateAudioChange={setGenerateAudio}
            onRealPersonModeChange={setRealPersonMode}
            onUseRefVideoChange={setUseRefVideo}
            onUseRefAudioChange={setUseRefAudio}
            onRefVideoUpload={handleRefVideoUpload}
            onRefAudioUpload={handleRefAudioUpload}
            onOpenVideoTrimModal={() => setShowVideoTrimModal(true)}
            onClearRefVideo={() => { setRefVideoLocalUrl(null); setRefVideoUrl(null); }}
            onEditPadImage={(id, url, label, originalUrl) => setEditingImage({ type: 'pad-image', id, url, originalUrl, label })}
            onGenerate={handleGenerateVideo}
            onBack={() => setStep('prepare')}
          />
        </div>
      </div>

      {showCaptureModal && (
        <CaptureFrameModal
          onConfirm={handleCaptureConfirm}
          onClose={() => setShowCaptureModal(false)}
        />
      )}
      {showVideoTrimModal && (
        <VideoTrimModal
          onConfirm={handleVideoTrimConfirm}
          onClose={() => setShowVideoTrimModal(false)}
        />
      )}
      {editingImage && (
        <ImageEditorModal
          imageUrl={editingImage.url}
          originalUrl={editingImage.originalUrl}
          label={editingImage.label}
          onSave={handleImageEditorSave}
          onClose={() => setEditingImage(null)}
        />
      )}
    </div>
  );
}

// ==================== 步骤1：准备垫图 ====================
function PrepareStep({
  images, selectedPadIds, textToImagePrompt, img2imgPrompt, img2imgSources,
  aspectRatio, resolution, t2iModel, i2iModel, loading, loadingMsg,
  activeTab, onActiveTabChange,
  onTogglePadSelect, onRemoveImage, onTextToImage, onImageUpload, onImageToImage,
  onRemoveSource, onTextToImagePromptChange, onImg2imgPromptChange,
  onAspectRatioChange, onResolutionChange, onT2iModelChange, onI2iModelChange,
  onOpenCaptureModal, onAddToImg2imgSource, onEditImg2imgSource, onEditPadImage: _onEditPadImage, onNext,
}: {
  images: PreparedImage[];
  selectedPadIds: string[];
  textToImagePrompt: string;
  img2imgPrompt: string;
  img2imgSources: { url: string; originalUrl?: string; label: string }[];
  aspectRatio: string;
  resolution: '1k' | '2k' | '4k';
  t2iModel: ImageModel;
  i2iModel: ImageModel;
  loading: boolean;
  loadingMsg: string;
  activeTab: 'text2img' | 'img2img';
  onActiveTabChange: (tab: 'text2img' | 'img2img') => void;
  onTogglePadSelect: (id: string) => void;
  onRemoveImage: (id: string) => void;
  onTextToImage: () => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageToImage: () => void;
  onRemoveSource: (idx: number) => void;
  onTextToImagePromptChange: (v: string) => void;
  onImg2imgPromptChange: (v: string) => void;
  onAspectRatioChange: (v: string) => void;
  onResolutionChange: (v: '1k' | '2k' | '4k') => void;
  onT2iModelChange: (v: ImageModel) => void;
  onI2iModelChange: (v: ImageModel) => void;
  onOpenCaptureModal: () => void;
  onAddToImg2imgSource: (url: string, label: string) => void;
  onEditImg2imgSource: (index: number, url: string, label: string, originalUrl: string) => void;
  onEditPadImage: (id: string, url: string, label: string, originalUrl: string) => void;
  onNext: () => void;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null!);

  // 构建图生图 @ 引用资源列表
  const img2imgAssets: Asset[] = img2imgSources.map((src, i) => ({
    type: 'image' as const,
    label: `图片${i + 1}`,
    refTag: `@Image ${i + 1}`,
    thumbnailUrl: src.url.startsWith('http') ? src.url : `http://localhost:3001${src.url}`,
  }));

  return (
    <div className="h-full flex gap-0 overflow-hidden">
      {/* 左侧操作区 */}
      <div className="w-96 flex-shrink-0 flex flex-col bg-runway-surface border-r border-runway-border min-h-0">
        <div className="flex border-b border-runway-border flex-shrink-0">
          <button onClick={() => onActiveTabChange('text2img')} className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'text2img' ? 'text-white border-b-2 border-white bg-runway-deep' : 'text-runway-slate hover:text-white'}`}>
            <Wand2 className="w-4 h-4" />文生图
          </button>
          <button onClick={() => onActiveTabChange('img2img')} className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'img2img' ? 'text-white border-b-2 border-white bg-runway-deep' : 'text-runway-slate hover:text-white'}`}>
            <ImageIcon className="w-4 h-4" />图生图
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {activeTab === 'text2img' && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-runway-slate">输入描述，AI 直接生成图片作为垫图。</p>
              <PromptEditor
                value={textToImagePrompt}
                onChange={onTextToImagePromptChange}
                assets={[]}
                placeholder="描述你想要的图片，例如：一只在草地上奔跑的金毛犬，阳光明媚..."
                minHeight="9rem"
                polishMode="image"
                showPolishButton={true}
              />
              <AspectRatioSelector value={aspectRatio} onChange={onAspectRatioChange} />
              <ResolutionSelector value={resolution} onChange={onResolutionChange} />
              <ModelSelector label="模型" value={t2iModel} onChange={onT2iModelChange} />
            </div>
          )}

          {activeTab === 'img2img' && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-runway-slate">上传或截取源图，AI 根据提示词对其进行变换。</p>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-runway-slate">源图（{img2imgSources.length} 张）</p>
                  <div className="flex gap-1.5">
                    <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={onImageUpload} className="hidden" />
                    <button onClick={() => imageInputRef.current?.click()} disabled={loading} className="flex items-center gap-1 px-2 py-1 text-xs border border-runway-border text-runway-slate rounded-md hover:text-white hover:border-runway-charcoal transition-colors disabled:opacity-50">
                      <Upload className="w-3 h-3" />上传
                    </button>
                    <button onClick={onOpenCaptureModal} disabled={loading} className="flex items-center gap-1 px-2 py-1 text-xs border border-runway-border text-runway-slate rounded-md hover:text-white hover:border-runway-charcoal transition-colors disabled:opacity-50">
                      <Film className="w-3 h-3" />截帧
                    </button>
                  </div>
                </div>
                {img2imgSources.length === 0 ? (
                  <div className="border-2 border-dashed border-runway-border rounded-md p-5 flex flex-col items-center gap-2 text-center">
                    <ImageIcon className="w-6 h-6 text-runway-mid-slate" />
                    <span className="text-xs text-runway-mid-slate">点击上传或截帧添加源图</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {img2imgSources.map((src, idx) => (
                      <div key={idx} className="relative rounded-md overflow-hidden border border-runway-border group aspect-square cursor-pointer" onClick={() => onEditImg2imgSource(idx, src.url, src.label, src.originalUrl ?? src.url)}>
                        <img src={src.url.startsWith('http') ? src.url : `http://localhost:3001${src.url}`} alt={src.label} className="w-full h-full object-cover" />
                        {/* 序号 */}
                        <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-black/70 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-white leading-none">{idx + 1}</span>
                        </div>
                        {/* hover 编辑提示 */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-xs text-white font-medium">点击编辑</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); onRemoveSource(idx); }} className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80">
                          <X className="w-2.5 h-2.5 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {loading && loadingMsg && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-blue-400">
                    <Loader2 className="w-3 h-3 animate-spin" />{loadingMsg}
                  </div>
                )}
              </div>
              <PromptEditor
                value={img2imgPrompt}
                onChange={onImg2imgPromptChange}
                assets={img2imgAssets}
                placeholder="描述想要的变化，例如：将背景改为夜晚城市...（输入 @ 引用源图）"
                minHeight="7.5rem"
                polishImageUrls={img2imgSources.map((s) => s.url).filter((u) => u.startsWith('http'))}
                polishMode="image"
                showPolishButton={true}
              />
              <AspectRatioSelector value={aspectRatio} onChange={onAspectRatioChange} />
              <ResolutionSelector value={resolution} onChange={onResolutionChange} />
              <ModelSelector label="模型" value={i2iModel} onChange={onI2iModelChange} />
            </div>
          )}
        </div>

        {/* 底部固定按钮 */}
        <div className="flex-shrink-0 p-4 border-t border-runway-border bg-runway-surface">
          {activeTab === 'text2img' ? (
            <button onClick={onTextToImage} disabled={loading || !textToImagePrompt.trim()} className="w-full py-2.5 bg-white text-black text-sm font-medium rounded-md hover:bg-runway-cloud transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              生成图片
            </button>
          ) : (
            <button onClick={onImageToImage} disabled={loading || !img2imgPrompt.trim() || img2imgSources.length === 0} className="w-full py-2.5 bg-white text-black text-sm font-medium rounded-md hover:bg-runway-cloud transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              生成图片
            </button>
          )}
        </div>
      </div>

      {/* 右侧垫图展示区 */}
      <div className="flex-1 flex flex-col min-w-0 p-6">
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div>
            <h3 className="text-base font-semibold text-white">准备垫图</h3>
            <p className="text-xs text-runway-slate mt-0.5">
              已准备 {images.filter(i => !i.pending).length} 张，已选 {selectedPadIds.length}/9 张用于生成视频
            </p>
          </div>
          <button
            onClick={onNext}
            disabled={selectedPadIds.length === 0}
            className="px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-runway-cloud transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            下一步：生成视频<ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {images.length === 0 ? (
            <div className="h-full border-2 border-dashed border-runway-border rounded-lg flex flex-col items-center justify-center">
              <ImageIcon className="w-10 h-10 text-runway-mid-slate mb-3" />
              <p className="text-sm text-runway-mid-slate">还没有垫图</p>
              <p className="text-xs text-runway-mid-slate mt-1">使用左侧工具生成图片</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 content-start">
              {images.map((img) => img.pending ? (
                <div key={img.id} className="relative rounded-lg overflow-hidden border-2 border-runway-border aspect-video">
                  <div className="absolute inset-0 bg-runway-surface shimmer-placeholder" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <Wand2 className="w-5 h-5 text-runway-slate animate-pulse" />
                    <span className="text-xs text-runway-slate">AI 生成中...</span>
                  </div>
                </div>
              ) : (
                <div
                  key={img.id}
                  onClick={() => onTogglePadSelect(img.id)}
                  className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${selectedPadIds.includes(img.id) ? 'border-white shadow-lg' : 'border-runway-border hover:border-runway-charcoal'} group`}
                >
                  <div className="relative w-full aspect-video bg-black">
                    <img src={img.url.startsWith('http') ? img.url : `http://localhost:3001${img.url}`} alt={img.label} className="absolute inset-0 w-full h-full object-contain" />
                  </div>
                  {/* 选中角标 */}
                  {selectedPadIds.includes(img.id) && (
                    <div className="absolute top-2 left-2 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-black" />
                    </div>
                  )}
                  {/* 未选中但已达9张时显示禁用遮罩 */}
                  {!selectedPadIds.includes(img.id) && selectedPadIds.length >= 9 && (
                    <div className="absolute inset-0 bg-black/50" />
                  )}
                  {/* hover 时显示"用于图生图"按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToImg2imgSource(img.url, img.label);
                      onActiveTabChange('img2img');
                    }}
                    className="absolute bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-1 bg-black/80 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black flex items-center gap-1.5 border border-white/20"
                    title="添加为图生图源图"
                  >
                    <ImageIcon className="w-3 h-3" />用于图生图
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onRemoveImage(img.id); }} className="absolute top-2 right-2 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80">
                    <X className="w-3 h-3 text-white" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                    <span className="text-xs text-white truncate block">{img.label}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== 步骤2：生成视频（Seedance 2.0）====================
function GenerateStep({
  images, selectedPadIds, onTogglePadSelect, onRemoveImage: _onRemoveImage, onAddImage,
  videoPrompt, videoDuration, videoResolution, videoRatio,
  generateAudio, realPersonMode, useRefVideo, useRefAudio,
  refVideoLocalUrl, refVideoUrl, refAudioLocalName, refAudioUrl,
  generatedVideoUrl, videoGenerating, videoLoadingMsg, loading, loadingMsg,
  scriptScenes, onScriptScenesChange,
  onVideoPromptChange, onVideoDurationChange, onVideoResolutionChange,
  onVideoRatioChange, onGenerateAudioChange, onRealPersonModeChange,
  onUseRefVideoChange, onUseRefAudioChange,
  onRefVideoUpload, onRefAudioUpload, onOpenVideoTrimModal, onClearRefVideo,
  onEditPadImage, onGenerate, onBack,
}: {
  images: PreparedImage[];
  selectedPadIds: string[];
  onTogglePadSelect: (id: string) => void;
  onRemoveImage: (id: string) => void;
  onAddImage: (img: PreparedImage) => void;
  videoPrompt: string;
  videoDuration: string;
  videoResolution: string;
  videoRatio: string;
  generateAudio: boolean;
  realPersonMode: boolean;
  useRefVideo: boolean;
  useRefAudio: boolean;
  refVideoLocalUrl: string | null;
  refVideoUrl: string | null;
  refAudioLocalName: string | null;
  refAudioUrl: string | null;
  generatedVideoUrl: string | null;
  videoGenerating: boolean;
  videoLoadingMsg: string;
  loading: boolean;
  loadingMsg: string;
  scriptScenes: ScriptScene[];
  onScriptScenesChange: (scenes: ScriptScene[]) => void;
  onVideoPromptChange: (v: string) => void;
  onVideoDurationChange: (v: string) => void;
  onVideoResolutionChange: (v: string) => void;
  onVideoRatioChange: (v: string) => void;
  onGenerateAudioChange: (v: boolean) => void;
  onRealPersonModeChange: (v: boolean) => void;
  onUseRefVideoChange: (v: boolean) => void;
  onUseRefAudioChange: (v: boolean) => void;
  onRefVideoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRefAudioUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenVideoTrimModal: () => void;
  onClearRefVideo: () => void;
  onEditPadImage: (id: string, url: string, label: string, originalUrl: string) => void;
  onGenerate: () => void;
  onBack: () => void;
}) {
  const refVideoInputRef = useRef<HTMLInputElement>(null!);
  const refAudioInputRef = useRef<HTMLInputElement>(null!);
  const localImageInputRef = useRef<HTMLInputElement>(null!);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [polishing, setPolishing] = useState(false);

  const selectedImages = images.filter((img) => selectedPadIds.includes(img.id) && !img.pending);

  // 构建 @ 引用资源列表
  const promptAssets: Asset[] = [
    ...selectedImages.map((img, i) => ({
      type: 'image' as const,
      label: `图片${i + 1}`,
      refTag: `@Image ${i + 1}`,
      thumbnailUrl: img.url.startsWith('http') ? img.url : `http://localhost:3001${img.url}`,
    })),
    ...(useRefVideo && refVideoLocalUrl ? [{
      type: 'video' as const,
      label: '视频1',
      refTag: '@Video 1',
      thumbnailUrl: null,
    }] : []),
    ...(useRefAudio && refAudioLocalName ? [{
      type: 'audio' as const,
      label: '音频1',
      refTag: '@Audio 1',
      thumbnailUrl: null,
    }] : []),
  ];

  // AI 润色（视频模式）：结果分发到提示词 + 脚本
  const handleVideoPolish = async () => {
    const imageUrls = selectedImages.map((img) => img.url).filter((u) => u.startsWith('http'));
    const videoUrls = useRefVideo && refVideoUrl ? [refVideoUrl] : [];
    if (imageUrls.length === 0 && videoUrls.length === 0 && !videoPrompt.trim()) return;

    try {
      setPolishing(true);
      const result = await polishPrompt(imageUrls, videoUrls, videoPrompt, 'video');

      // 尝试解析 JSON
      let parsed: any = null;
      try {
        // 去除可能的 markdown 代码块包裹
        const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        // 如果不是有效 JSON，直接作为文本填入提示词
        onVideoPromptChange(result);
        return;
      }

      // 填充整体提示词
      if (parsed.prompt) {
        onVideoPromptChange(parsed.prompt);
      }

      // 填充分镜脚本
      if (parsed.scenes && Array.isArray(parsed.scenes)) {
        const newScenes: ScriptScene[] = parsed.scenes.map((s: any, idx: number) => ({
          id: `scene_${Date.now()}_${idx}`,
          timeStart: s.timeStart || s.time_start || '',
          timeEnd: s.timeEnd || s.time_end || '',
          description: s.description || s.content || '',
          camera: s.camera || s.cameraMovement || '',
          action: s.action || '',
          audio: s.audio || '',
        }));
        onScriptScenesChange(newScenes);
      }
    } catch (err: any) {
      console.error('视频润色失败:', err);
    } finally {
      setPolishing(false);
    }
  };

  return (
    <div className="h-full flex gap-0 overflow-hidden">
      {/* 左侧参数区 */}
      <div className="w-96 flex-shrink-0 flex flex-col bg-runway-surface border-r border-runway-border h-full">


        <div className="relative flex-1 min-h-0">
          <div className="absolute inset-0 overflow-y-auto scrollbar-hidden p-4 space-y-4">
          {/* 垫图选择区（缩略图 + 本地上传） */}
          <div>            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-runway-slate">垫图（已选 {selectedPadIds.length}/9）</p>
              <button onClick={onBack} className="text-xs text-runway-slate hover:text-white transition-colors">
                ← 返回添加
              </button>
            </div>
            <div className="border border-runway-border rounded-md p-2 bg-runway-black">
              {/* 共用的隐藏 input */}
              <input
                ref={localImageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length === 0) return;
                  e.target.value = '';
                  for (const file of files) {
                    if (selectedPadIds.length >= 9) break;
                    const result = await uploadImage(file);
                    const newId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                    const newImg: PreparedImage = { id: newId, url: result.url, source: 'frame', label: file.name.slice(0, 20) };
                    onAddImage(newImg);
                    onTogglePadSelect(newId);
                  }
                }}
              />
              {selectedImages.length === 0 ? (
                <button
                  onClick={() => localImageInputRef.current?.click()}
                  className="w-full border border-dashed border-runway-border rounded-md p-5 flex flex-col items-center justify-center gap-2 hover:border-runway-charcoal transition-colors"
                >
                  <Upload className="w-5 h-5 text-runway-mid-slate" />
                  <span className="text-xs text-runway-mid-slate">上传本地图片</span>
                </button>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {selectedImages.map((img, idx) => (
                    <div key={img.id} className="relative rounded-md overflow-hidden border border-runway-border group aspect-square bg-black cursor-pointer" onClick={() => onEditPadImage(img.id, img.url, img.label, img.originalUrl ?? img.url)}>
                      <img src={img.url.startsWith('http') ? img.url : `http://localhost:3001${img.url}`} alt={img.label} className="w-full h-full object-cover" />
                      {/* 序号 */}
                      <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-black/70 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-white leading-none">{idx + 1}</span>
                      </div>
                      {/* hover 编辑提示 */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="text-xs text-white font-medium">点击编辑</span>
                      </div>
                      {/* 移除按钮 */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onTogglePadSelect(img.id); }}
                        className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    </div>
                  ))}
                  {/* 本地上传按钮 */}
                  {selectedPadIds.length < 9 && (
                    <button
                      onClick={() => localImageInputRef.current?.click()}
                      className="aspect-square rounded-md border border-dashed border-runway-border flex flex-col items-center justify-center gap-1 hover:border-runway-charcoal transition-colors"
                    >
                      <Upload className="w-4 h-4 text-runway-mid-slate" />
                      <span className="text-xs text-runway-mid-slate">上传</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 上传进度提示 */}
          {loading && loadingMsg && (
            <div className="flex items-center gap-1.5 text-xs text-blue-400">
              <Loader2 className="w-3 h-3 animate-spin" />{loadingMsg}
            </div>
          )}

          {/* 提示词 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-runway-slate">视频提示词 <span className="text-runway-mid-slate">（输入 @ 引用资源）</span></p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowScriptModal(true)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all border border-runway-border text-runway-slate hover:text-white hover:border-runway-charcoal"
                >
                  <FileText className="w-3 h-3" />
                  <span>脚本{scriptScenes.length > 0 ? `(${scriptScenes.length})` : ''}</span>
                </button>
                <button
                  type="button"
                  onClick={handleVideoPolish}
                  disabled={polishing || (selectedImages.length === 0 && !refVideoUrl && !videoPrompt.trim())}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all duration-200 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 text-purple-300 hover:from-purple-500/30 hover:to-blue-500/30 hover:border-purple-400/50 hover:text-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {polishing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  <span>{polishing ? '润色中...' : 'AI润色'}</span>
                </button>
              </div>
            </div>
            <PromptEditor
              value={videoPrompt}
              onChange={onVideoPromptChange}
              assets={promptAssets}
              placeholder="描述你想要生成的视频效果，例如：镜头缓慢推进，人物微笑转身..."
              minHeight="7.5rem"
            />
          </div>

          {/* 时长 */}
          <div>
            <p className="text-xs text-runway-slate mb-2">时长（秒）</p>
            <div className="flex gap-2 flex-wrap">
              {['4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'].map((d) => (
                <button key={d} onClick={() => onVideoDurationChange(d)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors border ${videoDuration === d ? 'bg-white text-black border-white' : 'border-runway-border text-runway-slate hover:text-white hover:border-runway-charcoal'}`}>
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {/* 分辨率 */}
          <div>
            <p className="text-xs text-runway-slate mb-2">分辨率</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: '480p', label: '480p' },
                { value: '720p', label: '720p' },
                { value: 'native1080p', label: '原生1080p' },
                { value: '1080p', label: '1080p↑' },
                { value: '2k', label: '2K↑' },
                { value: '4k', label: '4K↑' },
              ].map((r) => (
                <button key={r.value} onClick={() => onVideoResolutionChange(r.value)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors border ${videoResolution === r.value ? 'bg-white text-black border-white' : 'border-runway-border text-runway-slate hover:text-white hover:border-runway-charcoal'}`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* 宽高比 */}
          <div>
            <p className="text-xs text-runway-slate mb-2">宽高比</p>
            <div className="flex gap-2 flex-wrap">
              {['adaptive', '16:9', '9:16', '1:1', '4:3', '3:4', '21:9'].map((r) => (
                <button key={r} onClick={() => onVideoRatioChange(r)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors border ${videoRatio === r ? 'bg-white text-black border-white' : 'border-runway-border text-runway-slate hover:text-white hover:border-runway-charcoal'}`}>
                  {r === 'adaptive' ? '自适应' : r}
                </button>
              ))}
            </div>
          </div>

          {/* 开关选项 */}
          <div className="flex flex-col gap-0 border border-runway-border rounded-lg overflow-hidden">
            <ToggleRow label="生成视频音频" checked={generateAudio} onChange={onGenerateAudioChange} />
            <ToggleRow label="真人模式" checked={realPersonMode} onChange={onRealPersonModeChange} border />
          </div>

          {/* 参考视频 */}
          <div className="border border-runway-border rounded-lg overflow-hidden">
            <ToggleRow label="参考视频" checked={useRefVideo} onChange={onUseRefVideoChange} icon={<Video className="w-3.5 h-3.5" />} />
            {useRefVideo && (
              <div className="px-4 pb-4 pt-3 border-t border-runway-border bg-runway-black">
                <input ref={refVideoInputRef} type="file" accept="video/*" onChange={onRefVideoUpload} className="hidden" />
                {refVideoLocalUrl ? (
                  <div className="space-y-2">
                    <video src={refVideoLocalUrl} controls className="w-full rounded-md bg-black" style={{ maxHeight: '180px' }} />
                    <div className="flex gap-2">
                      <button
                        onClick={onOpenVideoTrimModal}
                        className="flex items-center gap-1.5 text-xs text-runway-slate hover:text-white transition-colors"
                      >
                        <Scissors className="w-3 h-3" />重新裁剪
                      </button>
                      <span className="text-runway-mid-slate text-xs">·</span>
                      <button
                        onClick={onClearRefVideo}
                        className="text-xs text-runway-slate hover:text-red-400 transition-colors"
                      >
                        移除
                      </button>
                    </div>
                    {!refVideoUrl && (
                      <div className="flex items-center gap-1.5 text-xs text-runway-mid-slate">
                        <Loader2 className="w-3 h-3 animate-spin" />上传中...
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={onOpenVideoTrimModal}
                    className="w-full border border-dashed border-runway-border rounded-md p-5 flex flex-col items-center justify-center gap-2 hover:border-runway-charcoal transition-colors"
                  >
                    <Scissors className="w-5 h-5 text-runway-mid-slate" />
                    <span className="text-xs text-runway-mid-slate">点击上传并裁剪参考视频</span>
                    <span className="text-xs text-runway-mid-slate opacity-60">支持 MP4、MOV、WebM</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 参考音频 */}
          <div className="border border-runway-border rounded-lg overflow-hidden">
            <ToggleRow label="参考音频" checked={useRefAudio} onChange={onUseRefAudioChange} icon={<Music className="w-3.5 h-3.5" />} />
            {useRefAudio && (
              <div className="px-4 pb-4 pt-3 border-t border-runway-border bg-runway-black">
                <input ref={refAudioInputRef} type="file" accept="audio/*" onChange={onRefAudioUpload} className="hidden" />
                {refAudioLocalName ? (
                  <div className="bg-runway-surface border border-runway-border rounded-md p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-runway-charcoal flex items-center justify-center flex-shrink-0">
                        <Music className="w-4 h-4 text-runway-slate" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs text-white truncate block">{refAudioLocalName}</span>
                        {!refAudioUrl
                          ? <span className="text-xs text-runway-mid-slate flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />上传中...</span>
                          : <span className="text-xs text-runway-mid-slate">已就绪</span>
                        }
                      </div>
                    </div>
                    <button onClick={() => refAudioInputRef.current?.click()} className="text-xs text-runway-slate hover:text-white transition-colors flex-shrink-0">
                      更换
                    </button>
                  </div>
                ) : (
                  <button onClick={() => refAudioInputRef.current?.click()} className="w-full border border-dashed border-runway-border rounded-md p-5 flex flex-col items-center justify-center gap-2 hover:border-runway-charcoal transition-colors">
                    <Music className="w-5 h-5 text-runway-mid-slate" />
                    <span className="text-xs text-runway-mid-slate">点击上传参考音频</span>
                    <span className="text-xs text-runway-mid-slate opacity-60">MP3、WAV、AAC、M4A</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        </div>

        {/* 底部固定按钮 */}
        <div className="flex-shrink-0 p-4 border-t border-runway-border bg-runway-surface">
          <button
            onClick={onGenerate}
            disabled={videoGenerating || loading || selectedPadIds.length === 0 || !videoPrompt.trim()}
            className="w-full py-3 bg-white text-black font-medium text-sm rounded-md hover:bg-runway-cloud transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {videoGenerating ? <><Loader2 className="w-4 h-4 animate-spin" />{videoLoadingMsg || '生成中...'}</> : <><Play className="w-4 h-4" />生成视频</>}
          </button>
        </div>
      </div>

      {/* 右侧视频输出区 */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="px-6 pt-5 pb-3 flex-shrink-0">
          <h3 className="text-base font-semibold text-white">生成结果</h3>
          <p className="text-xs text-runway-slate mt-0.5">使用 Seedance 2.0 模型生成视频</p>
        </div>

        <div className="flex-1 min-h-0 px-6 pb-6 flex flex-col">
          {videoGenerating ? (
            <div className="w-full h-full relative bg-runway-surface border border-runway-border rounded-lg overflow-hidden">
              <div className="absolute inset-0 shimmer-placeholder" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-runway-slate animate-spin" />
                <p className="text-sm text-runway-slate">{videoLoadingMsg || '视频生成中...'}</p>
                <p className="text-xs text-runway-mid-slate">通常需要 2-5 分钟，请耐心等待</p>
              </div>
            </div>
          ) : generatedVideoUrl ? (
            <div className="w-full h-full flex flex-col gap-4">
              <video src={generatedVideoUrl} controls autoPlay className="w-full flex-1 min-h-0 rounded-lg bg-black object-contain" />
            </div>
          ) : (
            <div className="w-full h-full border-2 border-dashed border-runway-border rounded-lg flex flex-col items-center justify-center">
              <Film className="w-10 h-10 text-runway-mid-slate mb-3" />
              <p className="text-sm text-runway-mid-slate">配置左侧参数后点击生成视频</p>
              {selectedPadIds.length === 0 && (
                <p className="text-xs text-runway-mid-slate mt-1">请先在上一步选择垫图</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 分镜脚本弹窗 */}
      {showScriptModal && (
        <ScriptModal
          scenes={scriptScenes}
          onScenesChange={onScriptScenesChange}
          onClose={() => setShowScriptModal(false)}
        />
      )}
    </div>
  );
}

// ==================== 比例选择器 ====================
const ASPECT_RATIOS = [
  { value: '1:1', label: '1:1', w: 1, h: 1 },
  { value: '16:9', label: '16:9', w: 16, h: 9 },
  { value: '9:16', label: '9:16', w: 9, h: 16 },
  { value: '4:3', label: '4:3', w: 4, h: 3 },
  { value: '3:4', label: '3:4', w: 3, h: 4 },
  { value: '3:2', label: '3:2', w: 3, h: 2 },
  { value: '2:3', label: '2:3', w: 2, h: 3 },
  { value: '5:4', label: '5:4', w: 5, h: 4 },
  { value: '4:5', label: '4:5', w: 4, h: 5 },
  { value: '21:9', label: '21:9', w: 21, h: 9 },
];

function AspectRatioIcon({ w, h }: { w: number; h: number }) {
  const maxSize = 14;
  const ratio = w / h;
  const rw = ratio >= 1 ? maxSize : Math.round(maxSize * ratio);
  const rh = ratio <= 1 ? maxSize : Math.round(maxSize / ratio);
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" className="flex-shrink-0">
      <rect x={(20 - rw) / 2} y={(20 - rh) / 2} width={rw} height={rh} rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function AspectRatioSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-xs text-runway-slate mb-2">比例</p>
      <div className="grid grid-cols-4 gap-1.5">
        {ASPECT_RATIOS.map((r) => (
          <button key={r.value} onClick={() => onChange(r.value)} className={`flex flex-col items-center gap-1 py-2 px-1 rounded-md text-xs transition-colors border ${value === r.value ? 'bg-white text-black border-white' : 'border-runway-border text-runway-slate hover:text-white hover:border-runway-charcoal'}`}>
            <AspectRatioIcon w={r.w} h={r.h} />
            <span className="leading-none">{r.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ResolutionSelector({ value, onChange }: { value: '1k' | '2k' | '4k'; onChange: (v: '1k' | '2k' | '4k') => void }) {
  return (
    <div>
      <p className="text-xs text-runway-slate mb-2">分辨率</p>
      <div className="flex gap-2">
        {(['1k', '2k', '4k'] as const).map((r) => (
          <button key={r} onClick={() => onChange(r)} className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors border ${value === r ? 'bg-white text-black border-white' : 'border-runway-border text-runway-slate hover:text-white hover:border-runway-charcoal'}`}>
            {r.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

const IMAGE_MODELS: { value: ImageModel; label: string }[] = [
  { value: 'g', label: 'GPT-Image-2' },
  { value: 'v2', label: 'Nano Banana V2' },
  { value: 'pro', label: 'Nano Banana Pro' },
];

function ModelSelector({ label, value, onChange }: { label: string; value: ImageModel; onChange: (v: ImageModel) => void }) {
  return (
    <div>
      <p className="text-xs text-runway-slate mb-2">{label}</p>
      <select value={value} onChange={(e) => onChange(e.target.value as ImageModel)} className="w-full bg-runway-black border border-runway-border rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-runway-charcoal appearance-none cursor-pointer">
        {IMAGE_MODELS.map((m) => (
          <option key={m.value} value={m.value} className="bg-runway-black text-white">{m.label}</option>
        ))}
      </select>
    </div>
  );
}

// ==================== Toggle 开关行 ====================
function ToggleRow({
  label,
  checked,
  onChange,
  icon,
  border,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon?: React.ReactNode;
  border?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center justify-between px-4 py-3 bg-runway-surface hover:bg-runway-deep transition-colors ${border ? 'border-t border-runway-border' : ''}`}
    >
      <div className="flex items-center gap-2">
        {icon && <span className="text-runway-slate">{icon}</span>}
        <span className="text-xs text-runway-slate">{label}</span>
      </div>
      {/* Toggle pill */}
      <div className={`relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${checked ? 'bg-white' : 'bg-runway-charcoal'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full shadow transition-all duration-200 ${checked ? 'left-[18px] bg-black' : 'left-0.5 bg-runway-slate'}`} />
      </div>
    </button>
  );
}
