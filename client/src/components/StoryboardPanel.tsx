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
  Pencil,
  Check,
} from 'lucide-react';
import type { Storyboard, Scene, ProjectPhase } from '../types';
import { uploadImage, generateImage } from '../api/image';

interface StoryboardPanelProps {
  storyboard: Storyboard;
  phase: ProjectPhase;
  onConfirm: () => void;
  onSceneImageUpdate?: (sceneId: number, imageUrl: string) => void;
  onProceedToVideo?: () => void;
  onStoryboardChange?: (storyboard: Storyboard) => void;
}

export default function StoryboardPanel({
  storyboard,
  phase,
  onConfirm,
  onSceneImageUpdate,
  onProceedToVideo,
  onStoryboardChange,
}: StoryboardPanelProps) {
  const allScenesHaveImages = storyboard.scenes.every((s) => s.imageUrl);

  const handleSceneChange = (sceneId: number, updates: Partial<Scene>) => {
    if (!onStoryboardChange) return;
    onStoryboardChange({
      ...storyboard,
      scenes: storyboard.scenes.map((s) =>
        s.id === sceneId ? { ...s, ...updates } : s
      ),
    });
  };

  return (
    <div className="flex flex-col h-full bg-runway-black">
      {/* 标题栏 */}
      <div className="px-6 py-4 border-b border-runway-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-card-title text-white">{storyboard.title}</h2>
            <div className="flex items-center gap-4 mt-2 text-small text-runway-slate">
              <span className="flex items-center gap-1">
                <Palette className="w-3 h-3" />
                {storyboard.style}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {storyboard.duration}
              </span>
              <span>{storyboard.scenes.length} 个分镜</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {phase === 'chat' && (
              <button
                onClick={onConfirm}
                className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-sharp text-xs font-semibold hover:bg-runway-cloud transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                确认脚本
              </button>
            )}
            {phase === 'images' && allScenesHaveImages && onProceedToVideo && (
              <button
                onClick={onProceedToVideo}
                className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-sharp text-xs font-semibold hover:bg-runway-cloud transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                生成视频
              </button>
            )}
          </div>
        </div>

        {phase === 'images' && (
          <div className="mt-3 text-xs text-runway-muted bg-runway-surface border border-runway-border rounded-sharp px-3 py-2">
            为每个分镜上传参考图或使用 AI 生成图片
            {!allScenesHaveImages && (
              <span className="ml-1 text-white font-medium">
                · 还有 {storyboard.scenes.filter((s) => !s.imageUrl).length} 个待处理
              </span>
            )}
          </div>
        )}
      </div>

      {/* 分镜列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {storyboard.scenes.map((scene) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            phase={phase}
            onImageUpdate={onSceneImageUpdate}
            onSceneChange={handleSceneChange}
          />
        ))}
      </div>
    </div>
  );
}

function SceneCard({
  scene,
  phase,
  onImageUpdate,
  onSceneChange,
}: {
  scene: Scene;
  phase: ProjectPhase;
  onImageUpdate?: (sceneId: number, imageUrl: string) => void;
  onSceneChange?: (sceneId: number, updates: Partial<Scene>) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editDesc, setEditDesc] = useState(scene.description);
  const [editCamera, setEditCamera] = useState(scene.cameraType);
  const [editMovement, setEditMovement] = useState(scene.cameraMovement);
  const [editStyle, setEditStyle] = useState(scene.visualStyle);
  const [editDuration, setEditDuration] = useState(scene.duration);
  const [editNarration, setEditNarration] = useState(scene.narration || '');

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
        setError(result.message || '文生图功能尚未接入');
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

  const startEdit = () => {
    setEditDesc(scene.description);
    setEditCamera(scene.cameraType);
    setEditMovement(scene.cameraMovement);
    setEditStyle(scene.visualStyle);
    setEditDuration(scene.duration);
    setEditNarration(scene.narration || '');
    setEditing(true);
  };

  const saveEdit = () => {
    onSceneChange?.(scene.id, {
      description: editDesc,
      cameraType: editCamera,
      cameraMovement: editMovement,
      visualStyle: editStyle,
      duration: editDuration,
      narration: editNarration,
    });
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const isWorking = uploading || generating;

  return (
    <div className="bg-runway-surface rounded-comfortable border border-runway-border overflow-hidden hover:border-runway-charcoal transition-colors">
      <div className="flex">
        {/* 图片区域 */}
        <div className="w-48 flex-shrink-0 border-r border-runway-border relative group">
          {scene.imageUrl ? (
            <div className="relative w-full h-full min-h-[9rem]">
              <img
                src={scene.imageUrl}
                alt={`分镜 ${scene.id}`}
                className="w-full h-full object-cover"
              />
              {phase === 'images' && (
                <button
                  onClick={handleRemoveImage}
                  className="absolute top-1.5 right-1.5 bg-black/70 text-white rounded-sharp p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="移除图片"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ) : (
            <div className="w-full h-full min-h-[9rem] bg-runway-deep flex flex-col items-center justify-center gap-2 p-3">
              {isWorking ? (
                <>
                  <Loader2 className="w-5 h-5 text-runway-slate animate-spin" />
                  <span className="text-micro text-runway-slate">
                    {uploading ? '上传中' : '生成中'}
                  </span>
                </>
              ) : phase === 'images' ? (
                <>
                  <Image className="w-5 h-5 text-runway-charcoal" />
                  <div className="flex gap-1">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-micro bg-runway-border text-runway-silver px-2 py-1 rounded-sharp hover:bg-runway-charcoal transition-colors"
                    >
                      <Upload className="w-3 h-3 inline mr-0.5" />
                      上传
                    </button>
                    <button
                      onClick={handleGenerate}
                      className="text-micro bg-runway-border text-runway-silver px-2 py-1 rounded-sharp hover:bg-runway-charcoal transition-colors"
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
                <div className="text-center">
                  <Image className="w-6 h-6 text-runway-charcoal mx-auto mb-1" />
                  <span className="text-micro text-runway-slate">待生成</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 分镜信息 */}
        <div className="flex-1 p-4">
          {/* 顶部标签行 */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-micro bg-runway-border text-runway-silver px-2 py-0.5 rounded-sharp">
                #{scene.id}
              </span>
              <span className="text-micro text-runway-slate flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {scene.duration}s
              </span>
              {scene.imageUrl && (
                <span className="text-micro text-white flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  就绪
                </span>
              )}
            </div>
            {/* 编辑按钮 */}
            {!editing ? (
              <button
                onClick={startEdit}
                className="text-runway-slate hover:text-white transition-colors p-1"
                title="编辑分镜"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={saveEdit}
                  className="text-white bg-runway-border hover:bg-runway-charcoal p-1 rounded-sharp transition-colors"
                  title="保存"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={cancelEdit}
                  className="text-runway-slate hover:text-white p-1 transition-colors"
                  title="取消"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {editing ? (
            /* 编辑模式 */
            <div className="space-y-2">
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full bg-runway-deep border border-runway-border rounded-sharp px-3 py-2 text-sm text-white placeholder-runway-slate focus:outline-none focus:border-runway-charcoal resize-none"
                rows={2}
                placeholder="场景描述"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  value={editCamera}
                  onChange={(e) => setEditCamera(e.target.value)}
                  className="bg-runway-deep border border-runway-border rounded-sharp px-2 py-1.5 text-xs text-runway-silver focus:outline-none focus:border-runway-charcoal"
                  placeholder="镜头类型"
                />
                <input
                  value={editMovement}
                  onChange={(e) => setEditMovement(e.target.value)}
                  className="bg-runway-deep border border-runway-border rounded-sharp px-2 py-1.5 text-xs text-runway-silver focus:outline-none focus:border-runway-charcoal"
                  placeholder="运镜方式"
                />
                <input
                  value={editStyle}
                  onChange={(e) => setEditStyle(e.target.value)}
                  className="bg-runway-deep border border-runway-border rounded-sharp px-2 py-1.5 text-xs text-runway-silver focus:outline-none focus:border-runway-charcoal"
                  placeholder="画面风格"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  className="bg-runway-deep border border-runway-border rounded-sharp px-2 py-1.5 text-xs text-runway-silver focus:outline-none focus:border-runway-charcoal"
                  placeholder="时长(秒)"
                />
                <input
                  value={editNarration}
                  onChange={(e) => setEditNarration(e.target.value)}
                  className="bg-runway-deep border border-runway-border rounded-sharp px-2 py-1.5 text-xs text-runway-silver focus:outline-none focus:border-runway-charcoal"
                  placeholder="旁白/配文"
                />
              </div>
            </div>
          ) : (
            /* 展示模式 */
            <>
              <p className="text-sm text-runway-silver mb-3 tracking-body leading-relaxed">
                {scene.description}
              </p>

              <div className="flex flex-wrap gap-1.5 text-runway-slate">
                <span className="text-micro flex items-center gap-1 bg-runway-deep px-2 py-0.5 rounded-sharp">
                  <Camera className="w-3 h-3" />
                  {scene.cameraType}
                </span>
                <span className="text-micro flex items-center gap-1 bg-runway-deep px-2 py-0.5 rounded-sharp">
                  <Move className="w-3 h-3" />
                  {scene.cameraMovement}
                </span>
                <span className="text-micro flex items-center gap-1 bg-runway-deep px-2 py-0.5 rounded-sharp">
                  <Palette className="w-3 h-3" />
                  {scene.visualStyle}
                </span>
              </div>

              {scene.narration && (
                <p className="text-micro text-runway-muted mt-2 italic normal-case">
                  🎙️ {scene.narration}
                </p>
              )}
            </>
          )}

          {error && (
            <p className="text-micro text-red-400 mt-2 normal-case">⚠️ {error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
