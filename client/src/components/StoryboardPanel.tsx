import { useRef, useState } from 'react';
import {
  CheckCircle,
  Image,
  Clock,
  Camera,
  Move,
  Palette,
  Upload,
  Sparkles,
  Loader2,
  X,
  ArrowRight,
} from 'lucide-react';
import type { Storyboard, Scene, ProjectPhase } from '../types';
import { uploadImage, generateImage } from '../api/image';

interface StoryboardPanelProps {
  storyboard: Storyboard;
  phase: ProjectPhase;
  onConfirm: () => void;
  onSceneImageUpdate?: (sceneId: number, imageUrl: string) => void;
  onProceedToVideo?: () => void;
}

export default function StoryboardPanel({
  storyboard,
  phase,
  onConfirm,
  onSceneImageUpdate,
  onProceedToVideo,
}: StoryboardPanelProps) {
  const allScenesHaveImages = storyboard.scenes.every((s) => s.imageUrl);

  return (
    <div className="flex flex-col h-full">
      {/* 标题栏 */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {storyboard.title}
            </h2>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Palette className="w-3.5 h-3.5" />
                {storyboard.style}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {storyboard.duration}
              </span>
              <span>{storyboard.scenes.length} 个分镜</span>
            </div>
          </div>

          {/* 阶段操作按钮 */}
          <div className="flex items-center gap-2">
            {phase === 'chat' && (
              <button
                onClick={onConfirm}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                确认脚本
              </button>
            )}
            {phase === 'images' && allScenesHaveImages && onProceedToVideo && (
              <button
                onClick={onProceedToVideo}
                className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
              >
                <ArrowRight className="w-4 h-4" />
                开始生成视频
              </button>
            )}
          </div>
        </div>

        {/* images 阶段提示 */}
        {phase === 'images' && (
          <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            📷 请为每个分镜上传参考图或使用 AI 生成图片。
            {!allScenesHaveImages && (
              <span className="ml-1 font-medium">
                还有 {storyboard.scenes.filter((s) => !s.imageUrl).length} 个分镜需要图片。
              </span>
            )}
          </div>
        )}
      </div>

      {/* 分镜列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {storyboard.scenes.map((scene) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            phase={phase}
            onImageUpdate={onSceneImageUpdate}
          />
        ))}
      </div>
    </div>
  );
}

// ---- 单个分镜卡片 ----

function SceneCard({
  scene,
  phase,
  onImageUpdate,
}: {
  scene: Scene;
  phase: ProjectPhase;
  onImageUpdate?: (sceneId: number, imageUrl: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const result = await uploadImage(file);
      onImageUpdate?.(scene.id, result.url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      // 重置 input 以便重复上传同一文件
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    if (!scene.imagePrompt) {
      setError('该分镜没有图片提示词');
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const result = await generateImage(scene.imagePrompt, scene.id);
      if (result.url) {
        onImageUpdate?.(scene.id, result.url);
      } else {
        setError(result.message || '文生图功能尚未接入，请先上传图片');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleRemoveImage = () => {
    onImageUpdate?.(scene.id, '');
  };

  const isWorking = uploading || generating;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow">
      <div className="flex">
        {/* 图片区域 */}
        <div className="w-44 flex-shrink-0 border-r border-gray-200 relative group">
          {scene.imageUrl ? (
            <div className="relative w-full h-full min-h-[8rem]">
              <img
                src={scene.imageUrl}
                alt={`分镜 ${scene.id}`}
                className="w-full h-full object-cover"
              />
              {/* images 阶段可以移除图片 */}
              {phase === 'images' && (
                <button
                  onClick={handleRemoveImage}
                  className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="移除图片"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ) : (
            <div className="w-full h-full min-h-[8rem] bg-gray-50 flex flex-col items-center justify-center gap-2 p-3">
              {isWorking ? (
                <>
                  <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                  <span className="text-xs text-gray-400">
                    {uploading ? '上传中...' : '生成中...'}
                  </span>
                </>
              ) : phase === 'images' ? (
                <>
                  <Image className="w-6 h-6 text-gray-300" />
                  <div className="flex gap-1">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                      title="上传图片"
                    >
                      <Upload className="w-3 h-3 inline mr-0.5" />
                      上传
                    </button>
                    <button
                      onClick={handleGenerate}
                      className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded hover:bg-purple-100 transition-colors"
                      title="AI 生成图片"
                    >
                      <Sparkles className="w-3 h-3 inline mr-0.5" />
                      生图
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleUpload}
                    className="hidden"
                  />
                </>
              ) : (
                <div className="text-center text-gray-300">
                  <Image className="w-8 h-8 mx-auto mb-1" />
                  <span className="text-xs">待生成</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 分镜信息 */}
        <div className="flex-1 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
              #{scene.id}
            </span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {scene.duration}s
            </span>
            {scene.imageUrl && (
              <span className="text-xs text-green-500 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                已就绪
              </span>
            )}
          </div>

          <p className="text-sm text-gray-800 mb-2 line-clamp-2">
            {scene.description}
          </p>

          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
            <span className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded">
              <Camera className="w-3 h-3" />
              {scene.cameraType}
            </span>
            <span className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded">
              <Move className="w-3 h-3" />
              {scene.cameraMovement}
            </span>
            <span className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded">
              <Palette className="w-3 h-3" />
              {scene.visualStyle}
            </span>
          </div>

          {scene.narration && (
            <p className="text-xs text-gray-400 mt-2 italic">
              🎙️ {scene.narration}
            </p>
          )}

          {/* 错误提示 */}
          {error && (
            <p className="text-xs text-red-500 mt-2 bg-red-50 px-2 py-1 rounded">
              ⚠️ {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
