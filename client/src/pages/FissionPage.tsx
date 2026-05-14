import { useState, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import { uploadImage } from '../api/image';
import { uploadVideo, generateFissionVideo, checkFissionTask } from '../api/fission';

type FissionStep = 'prepare' | 'configure' | 'generate';
type ImageSource = 'frame' | 'text2img' | 'img2img';
type ImageModel = 'g' | 'v2' | 'pro';

interface PreparedImage {
  id: string;
  url: string;
  source: ImageSource;
  label: string;
  aspectRatio?: number;
}

// 截帧弹窗中的临时帧
interface CapturedFrame {
  id: string;
  localUrl: string; // canvas blob URL，仅用于预览
  blob: Blob;
  label: string;
}

// ==================== 截帧弹窗 ====================
function CaptureFrameModal({
  onConfirm,
  onClose,
}: {
  onConfirm: (frames: CapturedFrame[]) => void;
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
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
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

  const removeFrame = (id: string) => {
    setFrames((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-runway-surface border border-runway-border rounded-xl w-[720px] max-w-[95vw] max-h-[90vh] flex flex-col shadow-2xl">
        {/* 标题栏 */}
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
          {/* 上传区 */}
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
                  <Camera className="w-4 h-4" />
                  截取当前帧
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

          {/* 已截取的帧预览 */}
          {frames.length > 0 && (
            <div>
              <p className="text-xs text-runway-slate mb-2">已截取 {frames.length} 帧，点击确认后加入源图列表</p>
              <div className="grid grid-cols-4 gap-2">
                {frames.map((f) => (
                  <div key={f.id} className="relative rounded-md overflow-hidden border border-runway-border group">
                    <img src={f.localUrl} alt={f.label} className="w-full aspect-video object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                      <span className="text-xs text-white">{f.label}</span>
                    </div>
                    <button
                      onClick={() => removeFrame(f.id)}
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

        {/* 底部按钮 */}
        <div className="flex gap-3 px-5 py-4 border-t border-runway-border flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 border border-runway-border text-runway-slate text-sm rounded-md hover:text-white hover:border-runway-charcoal transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => frames.length > 0 && onConfirm(frames)}
            disabled={frames.length === 0}
            className="flex-1 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-runway-cloud transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            确认（{frames.length} 张）
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== 主页面 ====================
export default function FissionPage() {
  const [step, setStep] = useState<FissionStep>('prepare');
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [referenceVideoUrl, setReferenceVideoUrl] = useState<string | null>(null);
  const [useReferenceVideo, setUseReferenceVideo] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [textToImagePrompt, setTextToImagePrompt] = useState('');
  const [img2imgPrompt, setImg2imgPrompt] = useState('');
  // 图生图源图：支持多张
  const [img2imgSources, setImg2imgSources] = useState<{ url: string; label: string }[]>([]);
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [resolution, setResolution] = useState<'1k' | '2k' | '4k'>('1k');
  const [t2iModel, setT2iModel] = useState<ImageModel>('g');
  const [i2iModel, setI2iModel] = useState<ImageModel>('g');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCaptureModal, setShowCaptureModal] = useState(false);

  const selectedImage = images.find((img) => img.id === selectedImageId);

  // 上传视频（用于参考视频）
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const localUrl = URL.createObjectURL(file);
    setVideoUrl(localUrl);
    try {
      setLoading(true);
      setLoadingMsg('上传视频中...');
      const result = await uploadVideo(file);
      setReferenceVideoUrl(result.url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  // 截帧弹窗确认：上传所有帧并加入源图列表
  const handleCaptureConfirm = async (frames: CapturedFrame[]) => {
    setShowCaptureModal(false);
    try {
      setLoading(true);
      setLoadingMsg(`上传截帧中 (0/${frames.length})...`);
      setError(null);
      const uploaded: { url: string; label: string }[] = [];
      for (let i = 0; i < frames.length; i++) {
        setLoadingMsg(`上传截帧中 (${i + 1}/${frames.length})...`);
        const file = new File([frames[i].blob], `frame_${Date.now()}.png`, { type: 'image/png' });
        const result = await uploadImage(file);
        uploaded.push({ url: result.url, label: `截帧 ${frames[i].label}` });
      }
      setImg2imgSources((prev) => [...prev, ...uploaded]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  // 上传图片（多张）
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

  // 文生图
  const handleTextToImage = async () => {
    if (!textToImagePrompt.trim()) return;
    try {
      setLoading(true);
      setLoadingMsg('AI 生成图片中...');
      setError(null);
      const response = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textToImagePrompt.trim(), aspectRatio, resolution, model: t2iModel }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '文生图失败');
      }
      const result = await response.json();
      const newImage: PreparedImage = {
        id: `t2i_${Date.now()}`,
        url: result.url,
        source: 'text2img',
        label: textToImagePrompt.trim().slice(0, 20) + '...',
      };
      setImages((prev) => [...prev, newImage]);
      setSelectedImageId(newImage.id);
      setTextToImagePrompt('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  // 图生图（使用第一张源图，或逐张生成）
  const handleImageToImage = async () => {
    if (img2imgSources.length === 0 || !img2imgPrompt.trim()) return;
    // 只用第一张源图做图生图（如需批量可扩展）
    const sourceUrl = img2imgSources[0].url;
    if (!sourceUrl.startsWith('http')) {
      setError('源图片必须是公网URL，请使用AI生图或上传后重试');
      return;
    }
    try {
      setLoading(true);
      setLoadingMsg('AI 图生图中...');
      setError(null);
      const response = await fetch('/api/fission/image-to-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: sourceUrl,
          prompt: img2imgPrompt.trim(),
          aspectRatio,
          resolution,
          model: i2iModel,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '图生图失败');
      }
      const result = await response.json();
      const newImage: PreparedImage = {
        id: `i2i_${Date.now()}`,
        url: result.url,
        source: 'img2img',
        label: `图生图: ${img2imgPrompt.trim().slice(0, 15)}...`,
      };
      setImages((prev) => [...prev, newImage]);
      setSelectedImageId(newImage.id);
      setImg2imgPrompt('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const next = prev.filter((img) => img.id !== id);
      if (selectedImageId === id) {
        setSelectedImageId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  };

  const removeSource = (idx: number) => {
    setImg2imgSources((prev) => prev.filter((_, i) => i !== idx));
  };

  // 生成视频
  const handleGenerateVideo = async () => {
    if (!selectedImage || !prompt.trim()) return;
    try {
      setLoading(true);
      setLoadingMsg('提交视频生成任务...');
      setError(null);
      setGeneratedVideoUrl(null);
      const result = await generateFissionVideo({
        imageUrl: selectedImage.url,
        prompt: prompt.trim(),
        referenceVideoUrl: useReferenceVideo && referenceVideoUrl ? referenceVideoUrl : undefined,
      });
      setLoadingMsg('视频生成中，请耐心等待...');
      const pollInterval = 5000;
      const maxWait = 10 * 60 * 1000;
      const startTime = Date.now();
      const poll = async () => {
        while (Date.now() - startTime < maxWait) {
          const status = await checkFissionTask(result.taskId);
          if (status.status === 'success' && status.url) {
            setGeneratedVideoUrl(status.url);
            setStep('generate');
            return;
          }
          if (status.status === 'failed') throw new Error('视频生成失败');
          await new Promise((r) => setTimeout(r, pollInterval));
        }
        throw new Error('视频生成超时');
      };
      await poll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 步骤指示器 */}
      <div className="border-b border-runway-border bg-runway-deep px-6 py-3">
        <div className="flex items-center gap-2 text-sm">
          {[
            { key: 'prepare', label: '准备垫图' },
            { key: 'configure', label: '配置参数' },
            { key: 'generate', label: '生成视频' },
          ].map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="w-4 h-4 text-runway-mid-slate" />}
              <button
                onClick={() => setStep(s.key as FissionStep)}
                className={`px-3 py-1 rounded-md transition-colors ${
                  step === s.key ? 'bg-white text-black font-medium' : 'text-runway-slate hover:text-white'
                }`}
              >
                {s.label}
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {loading && (
        <div className="mx-6 mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-md text-blue-400 text-sm flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{loadingMsg}</span>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col">
        {step === 'prepare' && (
          <div className="flex-1 min-h-0 p-6 flex flex-col">
            <PrepareStep
              images={images}
              selectedImageId={selectedImageId}
              textToImagePrompt={textToImagePrompt}
              img2imgPrompt={img2imgPrompt}
              img2imgSources={img2imgSources}
              aspectRatio={aspectRatio}
              resolution={resolution}
              t2iModel={t2iModel}
              i2iModel={i2iModel}
              loading={loading}
              onTextToImage={handleTextToImage}
              onImageUpload={handleImageUpload}
              onImageToImage={handleImageToImage}
              onSelectImage={setSelectedImageId}
              onRemoveImage={removeImage}
              onRemoveSource={removeSource}
              onTextToImagePromptChange={setTextToImagePrompt}
              onImg2imgPromptChange={setImg2imgPrompt}
              onAspectRatioChange={setAspectRatio}
              onResolutionChange={setResolution}
              onT2iModelChange={setT2iModel}
              onI2iModelChange={setI2iModel}
              onOpenCaptureModal={() => setShowCaptureModal(true)}
              onNext={() => setStep('configure')}
            />
          </div>
        )}
        {step === 'configure' && (
          <div className="flex-1 overflow-y-auto p-6">
            <ConfigureStep
              images={images}
              selectedImageId={selectedImageId}
              selectedImage={selectedImage}
              prompt={prompt}
              useReferenceVideo={useReferenceVideo}
              referenceVideoUrl={referenceVideoUrl}
              videoUrl={videoUrl}
              loading={loading}
              onSelectImage={setSelectedImageId}
              onPromptChange={setPrompt}
              onUseReferenceVideoChange={setUseReferenceVideo}
              onVideoUpload={handleVideoUpload}
              onGenerate={handleGenerateVideo}
              onBack={() => setStep('prepare')}
            />
          </div>
        )}
        {step === 'generate' && (
          <div className="flex-1 overflow-y-auto p-6">
            <GenerateStep
              generatedVideoUrl={generatedVideoUrl}
              loading={loading}
              loadingMsg={loadingMsg}
              onBack={() => setStep('configure')}
            />
          </div>
        )}
      </div>

      {showCaptureModal && (
        <CaptureFrameModal
          onConfirm={handleCaptureConfirm}
          onClose={() => setShowCaptureModal(false)}
        />
      )}
    </div>
  );
}

// ==================== 步骤1：准备垫图 ====================
function PrepareStep({
  images,
  selectedImageId,
  textToImagePrompt,
  img2imgPrompt,
  img2imgSources,
  aspectRatio,
  resolution,
  t2iModel,
  i2iModel,
  loading,
  onTextToImage,
  onImageUpload,
  onImageToImage,
  onSelectImage,
  onRemoveImage,
  onRemoveSource,
  onTextToImagePromptChange,
  onImg2imgPromptChange,
  onAspectRatioChange,
  onResolutionChange,
  onT2iModelChange,
  onI2iModelChange,
  onOpenCaptureModal,
  onNext,
}: {
  images: PreparedImage[];
  selectedImageId: string | null;
  textToImagePrompt: string;
  img2imgPrompt: string;
  img2imgSources: { url: string; label: string }[];
  aspectRatio: string;
  resolution: '1k' | '2k' | '4k';
  t2iModel: ImageModel;
  i2iModel: ImageModel;
  loading: boolean;
  onTextToImage: () => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageToImage: () => void;
  onSelectImage: (id: string) => void;
  onRemoveImage: (id: string) => void;
  onRemoveSource: (idx: number) => void;
  onTextToImagePromptChange: (v: string) => void;
  onImg2imgPromptChange: (v: string) => void;
  onAspectRatioChange: (v: string) => void;
  onResolutionChange: (v: '1k' | '2k' | '4k') => void;
  onT2iModelChange: (v: ImageModel) => void;
  onI2iModelChange: (v: ImageModel) => void;
  onOpenCaptureModal: () => void;
  onNext: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'text2img' | 'img2img'>('text2img');
  const imageInputRef = useRef<HTMLInputElement>(null!);

  return (
    <div className="h-full flex gap-6 min-h-0">
      {/* 左侧操作区 */}
      <div className="w-80 flex-shrink-0 flex flex-col bg-runway-surface border border-runway-border rounded-lg overflow-hidden">
        {/* Tab 切换 */}
        <div className="flex border-b border-runway-border flex-shrink-0">
          <button
            onClick={() => setActiveTab('text2img')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'text2img'
                ? 'text-white border-b-2 border-white bg-runway-deep'
                : 'text-runway-slate hover:text-white'
            }`}
          >
            <Wand2 className="w-4 h-4" />
            文生图
          </button>
          <button
            onClick={() => setActiveTab('img2img')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'img2img'
                ? 'text-white border-b-2 border-white bg-runway-deep'
                : 'text-runway-slate hover:text-white'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            图生图
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* ── 文生图 ── */}
          {activeTab === 'text2img' && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-runway-slate">输入描述，AI 直接生成图片作为垫图。</p>
              <textarea
                value={textToImagePrompt}
                onChange={(e) => onTextToImagePromptChange(e.target.value)}
                placeholder="描述你想要的图片，例如：一只在草地上奔跑的金毛犬，阳光明媚..."
                rows={4}
                className="w-full bg-runway-black border border-runway-border rounded-md px-3 py-2 text-sm text-white placeholder-runway-slate focus:outline-none focus:border-runway-charcoal resize-none"
              />
              <AspectRatioSelector value={aspectRatio} onChange={onAspectRatioChange} />
              <ResolutionSelector value={resolution} onChange={onResolutionChange} />
              <ModelSelector label="模型" value={t2iModel} onChange={onT2iModelChange} />
              <button
                onClick={onTextToImage}
                disabled={loading || !textToImagePrompt.trim()}
                className="w-full py-2.5 bg-white text-black text-sm font-medium rounded-md hover:bg-runway-cloud transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                生成图片
              </button>
            </div>
          )}

          {/* ── 图生图 ── */}
          {activeTab === 'img2img' && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-runway-slate">上传或截取源图，AI 根据提示词对其进行变换。</p>

              {/* 源图区域 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-runway-slate">源图（{img2imgSources.length} 张）</p>
                  <div className="flex gap-1.5">
                    {/* 本地上传 */}
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={onImageUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => imageInputRef.current?.click()}
                      disabled={loading}
                      className="flex items-center gap-1 px-2 py-1 text-xs border border-runway-border text-runway-slate rounded-md hover:text-white hover:border-runway-charcoal transition-colors disabled:opacity-50"
                    >
                      <Upload className="w-3 h-3" />
                      上传
                    </button>
                    {/* 视频截帧 */}
                    <button
                      onClick={onOpenCaptureModal}
                      disabled={loading}
                      className="flex items-center gap-1 px-2 py-1 text-xs border border-runway-border text-runway-slate rounded-md hover:text-white hover:border-runway-charcoal transition-colors disabled:opacity-50"
                    >
                      <Film className="w-3 h-3" />
                      截帧
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
                      <div key={idx} className="relative rounded-md overflow-hidden border border-runway-border group aspect-square">
                        <img
                          src={src.url.startsWith('http') ? src.url : `http://localhost:3001${src.url}`}
                          alt={src.label}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                        <button
                          onClick={() => onRemoveSource(idx)}
                          className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                        >
                          <X className="w-2.5 h-2.5 text-white" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-xs text-white truncate block">{src.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 提示词 */}
              <textarea
                value={img2imgPrompt}
                onChange={(e) => onImg2imgPromptChange(e.target.value)}
                placeholder="描述想要的变化，例如：将背景改为夜晚城市..."
                rows={3}
                className="w-full bg-runway-black border border-runway-border rounded-md px-3 py-2 text-sm text-white placeholder-runway-slate focus:outline-none focus:border-runway-charcoal resize-none"
              />
              <AspectRatioSelector value={aspectRatio} onChange={onAspectRatioChange} />
              <ResolutionSelector value={resolution} onChange={onResolutionChange} />
              <ModelSelector label="模型" value={i2iModel} onChange={onI2iModelChange} />
              <button
                onClick={onImageToImage}
                disabled={loading || !img2imgPrompt.trim() || img2imgSources.length === 0}
                className="w-full py-2.5 bg-white text-black text-sm font-medium rounded-md hover:bg-runway-cloud transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                生成图片
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 右侧垫图展示区 */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div>
            <h3 className="text-base font-semibold text-white">准备垫图</h3>
            <p className="text-xs text-runway-slate mt-0.5">已准备 {images.length} 张，生成视频时选择一张使用</p>
          </div>
          {images.length > 0 && (
            <button
              onClick={onNext}
              disabled={!selectedImageId}
              className="px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-runway-cloud transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              下一步：配置参数
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
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
              {images.map((img) => (
                <div
                  key={img.id}
                  onClick={() => onSelectImage(img.id)}
                  className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                    selectedImageId === img.id
                      ? 'border-white shadow-lg'
                      : 'border-runway-border hover:border-runway-charcoal'
                  }`}
                >
                  {img.aspectRatio ? (
                    <div style={{ paddingBottom: `${(1 / img.aspectRatio) * 100}%` }} className="relative w-full">
                      <img
                        src={img.url.startsWith('http') ? img.url : `http://localhost:3001${img.url}`}
                        alt={img.label}
                        className="absolute inset-0 w-full h-full object-contain bg-black"
                      />
                    </div>
                  ) : (
                    <img
                      src={img.url.startsWith('http') ? img.url : `http://localhost:3001${img.url}`}
                      alt={img.label}
                      className="w-full aspect-video object-cover"
                    />
                  )}
                  {selectedImageId === img.id && (
                    <div className="absolute top-2 left-2 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-black" />
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveImage(img.id); }}
                    className="absolute top-2 right-2 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80"
                  >
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

// ==================== 步骤2：配置参数 ====================
function ConfigureStep({
  images,
  selectedImageId,
  selectedImage,
  prompt,
  useReferenceVideo,
  referenceVideoUrl,
  videoUrl,
  loading,
  onSelectImage,
  onPromptChange,
  onUseReferenceVideoChange,
  onVideoUpload,
  onGenerate,
  onBack,
}: {
  images: PreparedImage[];
  selectedImageId: string | null;
  selectedImage: PreparedImage | undefined;
  prompt: string;
  useReferenceVideo: boolean;
  referenceVideoUrl: string | null;
  videoUrl: string | null;
  loading: boolean;
  onSelectImage: (id: string) => void;
  onPromptChange: (v: string) => void;
  onUseReferenceVideoChange: (v: boolean) => void;
  onVideoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGenerate: () => void;
  onBack: () => void;
}) {
  const videoInputRef = useRef<HTMLInputElement>(null!);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h3 className="text-lg font-semibold text-white">配置生成参数</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-runway-slate">选择垫图</h4>
          <div className="grid grid-cols-2 gap-3">
            {images.map((img) => (
              <div
                key={img.id}
                onClick={() => onSelectImage(img.id)}
                className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                  selectedImageId === img.id ? 'border-white shadow-lg' : 'border-runway-border hover:border-runway-charcoal'
                }`}
              >
                <img
                  src={img.url.startsWith('http') ? img.url : `http://localhost:3001${img.url}`}
                  alt={img.label}
                  className="w-full aspect-video object-cover"
                />
                {selectedImageId === img.id && (
                  <div className="absolute top-2 left-2 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-black" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-runway-slate mb-2">视频提示词</label>
            <textarea
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              placeholder="描述你想要生成的视频效果..."
              rows={4}
              className="w-full bg-runway-surface border border-runway-border rounded-md px-4 py-3 text-sm text-white placeholder-runway-slate focus:outline-none focus:border-runway-charcoal resize-none"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-runway-slate mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useReferenceVideo}
                onChange={(e) => onUseReferenceVideoChange(e.target.checked)}
                className="rounded border-runway-border"
              />
              使用参考视频
            </label>
            {useReferenceVideo && (
              <div className="mt-2">
                <input ref={videoInputRef} type="file" accept="video/*" onChange={onVideoUpload} className="hidden" />
                {referenceVideoUrl || videoUrl ? (
                  <div className="bg-runway-surface border border-runway-border rounded-md p-3">
                    <p className="text-xs text-runway-slate mb-1">已关联参考视频</p>
                    {videoUrl && (
                      <video src={videoUrl} controls className="w-full rounded-md" style={{ maxHeight: '120px' }} />
                    )}
                    <button
                      onClick={() => videoInputRef.current?.click()}
                      className="mt-2 text-xs text-runway-slate hover:text-white transition-colors"
                    >
                      更换视频
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-runway-border rounded-md p-4 flex flex-col items-center gap-2 hover:border-runway-charcoal transition-colors"
                  >
                    <Film className="w-5 h-5 text-runway-mid-slate" />
                    <span className="text-xs text-runway-mid-slate">点击上传参考视频</span>
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={onBack}
              className="px-5 py-2.5 border border-runway-border text-runway-slate text-sm rounded-md hover:text-white hover:border-runway-charcoal transition-colors"
            >
              返回
            </button>
            <button
              onClick={onGenerate}
              disabled={loading || !selectedImage || !prompt.trim()}
              className="flex-1 py-2.5 bg-white text-black font-medium text-sm rounded-md hover:bg-runway-cloud transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />生成中...</>
              ) : (
                <><Play className="w-4 h-4" />生成视频</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== 步骤3：生成结果 ====================
function GenerateStep({
  generatedVideoUrl,
  loading,
  loadingMsg,
  onBack,
}: {
  generatedVideoUrl: string | null;
  loading: boolean;
  loadingMsg: string;
  onBack: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h3 className="text-lg font-semibold text-white">生成结果</h3>
      {loading ? (
        <div className="bg-runway-surface border border-runway-border rounded-lg p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-runway-slate mx-auto mb-4" />
          <p className="text-sm text-runway-slate">{loadingMsg || '视频生成中...'}</p>
          <p className="text-xs text-runway-mid-slate mt-2">通常需要 2-5 分钟，请耐心等待</p>
        </div>
      ) : generatedVideoUrl ? (
        <div className="bg-runway-surface border border-runway-border rounded-lg p-6">
          <video src={generatedVideoUrl} controls autoPlay className="w-full rounded-md bg-black" />
          <div className="mt-4 flex gap-3">
            <a
              href={generatedVideoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 bg-white text-black text-sm font-medium rounded-md hover:bg-runway-cloud transition-colors"
            >
              下载视频
            </a>
            <button
              onClick={onBack}
              className="px-5 py-2.5 border border-runway-border text-runway-slate text-sm rounded-md hover:text-white hover:border-runway-charcoal transition-colors"
            >
              重新生成
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-runway-surface border border-runway-border rounded-lg p-12 text-center">
          <Film className="w-8 h-8 text-runway-mid-slate mx-auto mb-3" />
          <p className="text-sm text-runway-mid-slate">还没有生成视频</p>
          <button
            onClick={onBack}
            className="mt-4 px-5 py-2 border border-runway-border text-runway-slate text-sm rounded-md hover:text-white hover:border-runway-charcoal transition-colors"
          >
            返回配置
          </button>
        </div>
      )}
    </div>
  );
}

// ==================== 比例选择器 ====================
const ASPECT_RATIOS: { value: string; label: string; w: number; h: number }[] = [
  { value: '1:1',  label: '1:1',  w: 1,  h: 1  },
  { value: '16:9', label: '16:9', w: 16, h: 9  },
  { value: '9:16', label: '9:16', w: 9,  h: 16 },
  { value: '4:3',  label: '4:3',  w: 4,  h: 3  },
  { value: '3:4',  label: '3:4',  w: 3,  h: 4  },
  { value: '3:2',  label: '3:2',  w: 3,  h: 2  },
  { value: '2:3',  label: '2:3',  w: 2,  h: 3  },
  { value: '5:4',  label: '5:4',  w: 5,  h: 4  },
  { value: '4:5',  label: '4:5',  w: 4,  h: 5  },
  { value: '21:9', label: '21:9', w: 21, h: 9  },
];

function AspectRatioIcon({ w, h }: { w: number; h: number }) {
  const maxSize = 14;
  const ratio = w / h;
  const rw = ratio >= 1 ? maxSize : Math.round(maxSize * ratio);
  const rh = ratio <= 1 ? maxSize : Math.round(maxSize / ratio);
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" className="flex-shrink-0">
      <rect
        x={(20 - rw) / 2}
        y={(20 - rh) / 2}
        width={rw}
        height={rh}
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function AspectRatioSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-xs text-runway-slate mb-2">比例</p>
      <div className="grid grid-cols-4 gap-1.5">
        {ASPECT_RATIOS.map((r) => (
          <button
            key={r.value}
            onClick={() => onChange(r.value)}
            className={`flex flex-col items-center gap-1 py-2 px-1 rounded-md text-xs transition-colors border ${
              value === r.value
                ? 'bg-white text-black border-white'
                : 'border-runway-border text-runway-slate hover:text-white hover:border-runway-charcoal'
            }`}
          >
            <AspectRatioIcon w={r.w} h={r.h} />
            <span className="leading-none">{r.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ==================== 分辨率选择器 ====================
function ResolutionSelector({
  value,
  onChange,
}: {
  value: '1k' | '2k' | '4k';
  onChange: (v: '1k' | '2k' | '4k') => void;
}) {
  return (
    <div>
      <p className="text-xs text-runway-slate mb-2">分辨率</p>
      <div className="flex gap-2">
        {(['1k', '2k', '4k'] as const).map((r) => (
          <button
            key={r}
            onClick={() => onChange(r)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors border ${
              value === r
                ? 'bg-white text-black border-white'
                : 'border-runway-border text-runway-slate hover:text-white hover:border-runway-charcoal'
            }`}
          >
            {r.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

// ==================== 模型选择器（下拉框） ====================
const IMAGE_MODELS: { value: ImageModel; label: string }[] = [
  { value: 'g',   label: 'GPT-Image-2' },
  { value: 'v2',  label: 'Nano Banana V2' },
  { value: 'pro', label: 'Nano Banana Pro' },
];

function ModelSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ImageModel;
  onChange: (v: ImageModel) => void;
}) {
  return (
    <div>
      <p className="text-xs text-runway-slate mb-2">{label}</p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ImageModel)}
        className="w-full bg-runway-black border border-runway-border rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-runway-charcoal appearance-none cursor-pointer"
      >
        {IMAGE_MODELS.map((m) => (
          <option key={m.value} value={m.value} className="bg-runway-black text-white">
            {m.label}
          </option>
        ))}
      </select>
    </div>
  );
}
