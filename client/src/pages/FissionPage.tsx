import { useState, useRef, useCallback } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Wand2,
  Film,
  Play,
  Loader2,
  X,
  Plus,
  ChevronRight,
  Check,
} from 'lucide-react';
import { uploadImage } from '../api/image';
import { uploadVideo, generateFissionVideo, checkFissionTask } from '../api/fission';

type FissionStep = 'prepare' | 'configure' | 'generate';
type ImageSource = 'frame' | 'text2img' | 'img2img';

interface PreparedImage {
  id: string;
  url: string;
  source: ImageSource;
  label: string;
}

export default function FissionPage() {
  const [step, setStep] = useState<FissionStep>('prepare');
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [referenceVideoUrl, setReferenceVideoUrl] = useState<string | null>(null);
  const [useReferenceVideo, setUseReferenceVideo] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [textToImagePrompt, setTextToImagePrompt] = useState('');
  const [img2imgPrompt, setImg2imgPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoInputRef = useRef<HTMLInputElement>(null!);
  const imageInputRef = useRef<HTMLInputElement>(null!);
  const videoElementRef = useRef<HTMLVideoElement>(null!);

  const selectedImage = images.find((img) => img.id === selectedImageId);

  // 上传视频
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoFile(file);
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

  // 从视频截取当前帧
  const captureFrame = useCallback(() => {
    const video = videoElementRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) return;

      const file = new File([blob], `frame_${Date.now()}.png`, { type: 'image/png' });

      try {
        setLoading(true);
        setLoadingMsg('上传截帧...');
        const result = await uploadImage(file);
        const newImage: PreparedImage = {
          id: `frame_${Date.now()}`,
          url: result.url,
          source: 'frame',
          label: `截帧 ${new Date().toLocaleTimeString()}`,
        };
        setImages((prev) => [...prev, newImage]);
        setSelectedImageId(newImage.id);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
        setLoadingMsg('');
      }
    }, 'image/png');
  }, []);

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
        body: JSON.stringify({ prompt: textToImagePrompt.trim() }),
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

  // 上传图片（用于图生图的源图）
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setLoadingMsg('上传图片...');
      const result = await uploadImage(file);
      const newImage: PreparedImage = {
        id: `upload_${Date.now()}`,
        url: result.url,
        source: 'img2img',
        label: file.name.slice(0, 20),
      };
      setImages((prev) => [...prev, newImage]);
      setSelectedImageId(newImage.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  // 图生图
  const handleImageToImage = async () => {
    if (!selectedImage || !img2imgPrompt.trim()) return;

    try {
      setLoading(true);
      setLoadingMsg('AI 图生图中...');
      setError(null);

      const response = await fetch('/api/fission/image-to-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: selectedImage.url,
          prompt: img2imgPrompt.trim(),
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

  // 删除图片
  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    if (selectedImageId === id) {
      setSelectedImageId(images.length > 1 ? images.find((img) => img.id !== id)?.id || null : null);
    }
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

      // 轮询任务状态
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
          if (status.status === 'failed') {
            throw new Error('视频生成失败');
          }
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
                  step === s.key
                    ? 'bg-white text-black font-medium'
                    : 'text-runway-slate hover:text-white'
                }`}
              >
                {s.label}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading 遮罩 */}
      {loading && (
        <div className="mx-6 mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-md text-blue-400 text-sm flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{loadingMsg}</span>
        </div>
      )}

      {/* 主内容区 */}
      <div className="flex-1 overflow-y-auto p-6">
        {step === 'prepare' && (
          <PrepareStep
            videoUrl={videoUrl}
            videoElementRef={videoElementRef}
            videoInputRef={videoInputRef}
            imageInputRef={imageInputRef}
            images={images}
            selectedImageId={selectedImageId}
            textToImagePrompt={textToImagePrompt}
            img2imgPrompt={img2imgPrompt}
            selectedImage={selectedImage}
            loading={loading}
            onVideoUpload={handleVideoUpload}
            onCaptureFrame={captureFrame}
            onTextToImage={handleTextToImage}
            onImageUpload={handleImageUpload}
            onImageToImage={handleImageToImage}
            onSelectImage={setSelectedImageId}
            onRemoveImage={removeImage}
            onTextToImagePromptChange={setTextToImagePrompt}
            onImg2imgPromptChange={setImg2imgPrompt}
            onNext={() => setStep('configure')}
          />
        )}

        {step === 'configure' && (
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
            onGenerate={handleGenerateVideo}
            onBack={() => setStep('prepare')}
          />
        )}

        {step === 'generate' && (
          <GenerateStep
            generatedVideoUrl={generatedVideoUrl}
            loading={loading}
            loadingMsg={loadingMsg}
            onBack={() => setStep('configure')}
          />
        )}
      </div>
    </div>
  );
}


// ==================== 步骤1：准备垫图 ====================
function PrepareStep({
  videoUrl,
  videoElementRef,
  videoInputRef,
  imageInputRef,
  images,
  selectedImageId,
  textToImagePrompt,
  img2imgPrompt,
  selectedImage,
  loading,
  onVideoUpload,
  onCaptureFrame,
  onTextToImage,
  onImageUpload,
  onImageToImage,
  onSelectImage,
  onRemoveImage,
  onTextToImagePromptChange,
  onImg2imgPromptChange,
  onNext,
}: {
  videoUrl: string | null;
  videoElementRef: React.RefObject<HTMLVideoElement>;
  videoInputRef: React.RefObject<HTMLInputElement>;
  imageInputRef: React.RefObject<HTMLInputElement>;
  images: PreparedImage[];
  selectedImageId: string | null;
  textToImagePrompt: string;
  img2imgPrompt: string;
  selectedImage: PreparedImage | undefined;
  loading: boolean;
  onVideoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCaptureFrame: () => void;
  onTextToImage: () => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageToImage: () => void;
  onSelectImage: (id: string) => void;
  onRemoveImage: (id: string) => void;
  onTextToImagePromptChange: (v: string) => void;
  onImg2imgPromptChange: (v: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h3 className="text-lg font-semibold text-white">准备垫图</h3>
      <p className="text-sm text-runway-slate">通过以下方式准备垫图，可以准备多张，生成视频时选择一张使用。</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：操作区 */}
        <div className="space-y-5">
          {/* 方式1：上传视频截帧 */}
          <div className="bg-runway-surface border border-runway-border rounded-lg p-5">
            <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Film className="w-4 h-4" />
              上传视频截取关键帧
            </h4>

            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              onChange={onVideoUpload}
              className="hidden"
            />

            {!videoUrl ? (
              <button
                onClick={() => videoInputRef.current?.click()}
                disabled={loading}
                className="w-full border-2 border-dashed border-runway-border rounded-lg p-8 text-center hover:border-runway-charcoal transition-colors"
              >
                <Upload className="w-6 h-6 text-runway-slate mx-auto mb-2" />
                <span className="text-sm text-runway-slate">点击上传视频</span>
              </button>
            ) : (
              <div className="space-y-3">
                <video
                  ref={videoElementRef}
                  src={videoUrl}
                  controls
                  className="w-full rounded-md bg-black"
                  style={{ maxHeight: '200px' }}
                />
                <button
                  onClick={onCaptureFrame}
                  disabled={loading}
                  className="w-full py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-runway-cloud transition-colors disabled:opacity-50"
                >
                  截取当前帧
                </button>
              </div>
            )}
          </div>

          {/* 方式2：文生图 */}
          <div className="bg-runway-surface border border-runway-border rounded-lg p-5">
            <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Wand2 className="w-4 h-4" />
              文生图
            </h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={textToImagePrompt}
                onChange={(e) => onTextToImagePromptChange(e.target.value)}
                placeholder="描述你想要的图片..."
                className="flex-1 bg-runway-black border border-runway-border rounded-md px-3 py-2 text-sm text-white placeholder-runway-slate focus:outline-none focus:border-runway-charcoal"
              />
              <button
                onClick={onTextToImage}
                disabled={loading || !textToImagePrompt.trim()}
                className="px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-runway-cloud transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                生成
              </button>
            </div>
          </div>

          {/* 方式3：图生图 */}
          <div className="bg-runway-surface border border-runway-border rounded-lg p-5">
            <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              图生图
            </h4>

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={onImageUpload}
              className="hidden"
            />

            <div className="space-y-3">
              <button
                onClick={() => imageInputRef.current?.click()}
                disabled={loading}
                className="w-full border border-dashed border-runway-border rounded-md p-4 text-center hover:border-runway-charcoal transition-colors text-sm text-runway-slate"
              >
                <Plus className="w-4 h-4 mx-auto mb-1" />
                上传源图片
              </button>

              {selectedImage && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={img2imgPrompt}
                    onChange={(e) => onImg2imgPromptChange(e.target.value)}
                    placeholder="描述想要的变化..."
                    className="flex-1 bg-runway-black border border-runway-border rounded-md px-3 py-2 text-sm text-white placeholder-runway-slate focus:outline-none focus:border-runway-charcoal"
                  />
                  <button
                    onClick={onImageToImage}
                    disabled={loading || !img2imgPrompt.trim()}
                    className="px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-runway-cloud transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    生成
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧：图片列表 */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-runway-slate">已准备的垫图 ({images.length})</h4>

          {images.length === 0 ? (
            <div className="border-2 border-dashed border-runway-border rounded-lg p-12 text-center">
              <ImageIcon className="w-8 h-8 text-runway-mid-slate mx-auto mb-3" />
              <p className="text-sm text-runway-mid-slate">还没有垫图</p>
              <p className="text-xs text-runway-mid-slate mt-1">使用左侧工具生成或上传图片</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveImage(img.id);
                    }}
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

          {images.length > 0 && (
            <button
              onClick={onNext}
              disabled={!selectedImageId}
              className="w-full py-3 bg-white text-black font-medium rounded-md hover:bg-runway-cloud transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              下一步：配置参数
              <ChevronRight className="w-4 h-4" />
            </button>
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
  onGenerate: () => void;
  onBack: () => void;
}) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h3 className="text-lg font-semibold text-white">配置生成参数</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：选择垫图 */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-runway-slate">选择垫图</h4>
          <div className="grid grid-cols-2 gap-3">
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

        {/* 右侧：参数配置 */}
        <div className="space-y-5">
          {/* 提示词 */}
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

          {/* 参考视频 */}
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
                {referenceVideoUrl || videoUrl ? (
                  <div className="bg-runway-surface border border-runway-border rounded-md p-3">
                    <p className="text-xs text-runway-slate mb-1">已关联上传的视频</p>
                    {videoUrl && (
                      <video src={videoUrl} controls className="w-full rounded-md" style={{ maxHeight: '120px' }} />
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-runway-mid-slate">请先在"准备垫图"步骤中上传视频</p>
                )}
              </div>
            )}
          </div>

          {/* 操作按钮 */}
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
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  生成视频
                </>
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
          <video
            src={generatedVideoUrl}
            controls
            autoPlay
            className="w-full rounded-md bg-black"
          />
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
