import { useRef, useState } from 'react';
import {
  Upload, Wand2, Film, Play, Loader2, X,
  Scissors, FileText, Music, Video,
} from 'lucide-react';
import { uploadImage } from '../../api/image';
import { polishPrompt } from '../../api/chat';
import PromptEditor, { type Asset } from '../PromptEditor';
import ScriptModal, { type ScriptScene } from '../ScriptModal';
import { ToggleRow } from './FissionControls';
import type { PreparedImage } from './types';

export interface GenerateStepProps {
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
  onUpdateGroupSelectedUrls: (groupId: string, urls: string[]) => void;
  onGenerate: () => void;
  onBack: () => void;
}

export default function GenerateStep({
  images, selectedPadIds, onTogglePadSelect, onAddImage,
  videoPrompt, videoDuration, videoResolution, videoRatio,
  generateAudio, realPersonMode, useRefVideo, useRefAudio,
  refVideoLocalUrl, refVideoUrl, refAudioLocalName, refAudioUrl,
  generatedVideoUrl, videoGenerating, videoLoadingMsg, loading, loadingMsg,
  scriptScenes, onScriptScenesChange,
  onVideoPromptChange, onVideoDurationChange, onVideoResolutionChange,
  onVideoRatioChange, onGenerateAudioChange, onRealPersonModeChange,
  onUseRefVideoChange, onUseRefAudioChange,
  onRefAudioUpload, onOpenVideoTrimModal, onClearRefVideo,
  onEditPadImage, onUpdateGroupSelectedUrls, onGenerate, onBack,
}: GenerateStepProps) {
  const refAudioInputRef = useRef<HTMLInputElement>(null!);
  const localImageInputRef = useRef<HTMLInputElement>(null!);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [polishing, setPolishing] = useState(false);

  const selectedImages = images.filter((img) => selectedPadIds.includes(img.id) && !img.pending);

  const groupSelectedImages: { url: string; label: string; groupId: string }[] = [];
  images.forEach((img) => {
    if (img.isGroup && img.selectedGroupUrls && img.selectedGroupUrls.length > 0 && img.groupImages) {
      img.selectedGroupUrls.forEach((url) => {
        const found = img.groupImages!.find((g) => g.url === url);
        groupSelectedImages.push({ url, label: found?.variantDesc || '对比图', groupId: img.id });
      });
    }
  });

  const allDisplayImages = [
    ...selectedImages.filter((img) => !img.isGroup).map((img) => ({
      url: img.url, label: img.label, id: img.id, isFromGroup: false,
    })),
    ...groupSelectedImages.map((g, idx) => ({
      url: g.url, label: g.label, id: `grp_${g.groupId}_${idx}`, isFromGroup: true,
    })),
  ];

  const promptAssets: Asset[] = [
    ...allDisplayImages.map((img, i) => ({
      type: 'image' as const,
      label: `图片${i + 1}`,
      refTag: `@Image ${i + 1}`,
      thumbnailUrl: img.url.startsWith('http') ? img.url : `http://localhost:3001${img.url}`,
    })),
    ...(useRefVideo && refVideoLocalUrl ? [{ type: 'video' as const, label: '视频1', refTag: '@Video 1', thumbnailUrl: null }] : []),
    ...(useRefAudio && refAudioLocalName ? [{ type: 'audio' as const, label: '音频1', refTag: '@Audio 1', thumbnailUrl: null }] : []),
  ];

  const handleVideoPolish = async () => {
    const imageUrls = allDisplayImages.map((img) => img.url).filter((u) => u.startsWith('http'));
    const videoUrls = useRefVideo && refVideoUrl ? [refVideoUrl] : [];
    if (imageUrls.length === 0 && videoUrls.length === 0 && !videoPrompt.trim()) return;
    try {
      setPolishing(true);
      const result = await polishPrompt(imageUrls, videoUrls, videoPrompt, 'video');
      let parsed: any = null;
      try {
        const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        onVideoPromptChange(result);
        return;
      }
      if (parsed.prompt) onVideoPromptChange(parsed.prompt);
      if (parsed.scenes && Array.isArray(parsed.scenes)) {
        onScriptScenesChange(parsed.scenes.map((s: any, idx: number) => ({
          id: `scene_${Date.now()}_${idx}`,
          timeStart: s.timeStart || s.time_start || '',
          timeEnd: s.timeEnd || s.time_end || '',
          description: s.description || s.content || '',
          camera: s.camera || s.cameraMovement || '',
          action: s.action || '',
          audio: s.audio || '',
        })));
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

            {/* 垫图选择区 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-runway-slate">垫图（已选 {selectedPadIds.length}/9）</p>
                <button onClick={onBack} className="text-xs text-runway-slate hover:text-white transition-colors">
                  去准备垫图
                </button>
              </div>
              <div className="border border-runway-border rounded-md p-2 bg-runway-black">
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
                {allDisplayImages.length === 0 ? (
                  <button
                    onClick={() => localImageInputRef.current?.click()}
                    className="w-full border border-dashed border-runway-border rounded-md p-5 flex flex-col items-center justify-center gap-2 hover:border-runway-charcoal transition-colors"
                  >
                    <Upload className="w-5 h-5 text-runway-mid-slate" />
                    <span className="text-xs text-runway-mid-slate">上传本地图片</span>
                  </button>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {allDisplayImages.map((img, idx) => (
                      <div
                        key={img.id}
                        className="relative rounded-md overflow-hidden border border-runway-border group aspect-square bg-black cursor-pointer"
                        onClick={() => {
                          if (img.isFromGroup) {
                            onEditPadImage(img.id, img.url, img.label, img.url);
                          } else {
                            const found = selectedImages.find((s) => s.id === img.id);
                            if (found) onEditPadImage(found.id, found.url, found.label, found.originalUrl ?? found.url);
                          }
                        }}
                      >
                        <img
                          src={img.url.startsWith('http') ? img.url : `http://localhost:3001${img.url}`}
                          alt={img.label}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-black/70 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-white leading-none">{idx + 1}</span>
                        </div>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <span className="text-xs text-white font-medium">点击编辑</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (img.isFromGroup) {
                              const group = images.find((g) => g.isGroup && g.selectedGroupUrls?.includes(img.url));
                              if (group) {
                                const newUrls = (group.selectedGroupUrls ?? []).filter((u) => u !== img.url);
                                onUpdateGroupSelectedUrls(group.id, newUrls);
                              }
                            } else {
                              onTogglePadSelect(img.id);
                            }
                          }}
                          className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                        >
                          <X className="w-2.5 h-2.5 text-white" />
                        </button>
                      </div>
                    ))}
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

            {/* 上传进度 */}
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
                    disabled={polishing || (allDisplayImages.length === 0 && !refVideoUrl && !videoPrompt.trim())}
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
                {['4','5','6','7','8','9','10','11','12','13','14','15'].map((d) => (
                  <button key={d} onClick={() => onVideoDurationChange(d)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors border ${videoDuration === d ? 'bg-white text-black border-white' : 'border-runway-border text-runway-slate hover:text-white hover:border-runway-charcoal'}`}>
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
                  <button key={r.value} onClick={() => onVideoResolutionChange(r.value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors border ${videoResolution === r.value ? 'bg-white text-black border-white' : 'border-runway-border text-runway-slate hover:text-white hover:border-runway-charcoal'}`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 宽高比 */}
            <div>
              <p className="text-xs text-runway-slate mb-2">宽高比</p>
              <div className="flex gap-2 flex-wrap">
                {['adaptive','16:9','9:16','1:1','4:3','3:4','21:9'].map((r) => (
                  <button key={r} onClick={() => onVideoRatioChange(r)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors border ${videoRatio === r ? 'bg-white text-black border-white' : 'border-runway-border text-runway-slate hover:text-white hover:border-runway-charcoal'}`}>
                    {r === 'adaptive' ? '自适应' : r}
                  </button>
                ))}
              </div>
            </div>

            {/* 开关 */}
            <div className="flex flex-col gap-0 border border-runway-border rounded-lg overflow-hidden">
              <ToggleRow label="生成视频音频" checked={generateAudio} onChange={onGenerateAudioChange} />
              <ToggleRow label="真人模式" checked={realPersonMode} onChange={onRealPersonModeChange} border />
            </div>

            {/* 参考视频 */}
            <div className="border border-runway-border rounded-lg overflow-hidden">
              <ToggleRow label="参考视频" checked={useRefVideo} onChange={onUseRefVideoChange} icon={<Video className="w-3.5 h-3.5" />} />
              {useRefVideo && (
                <div className="px-4 pb-4 pt-3 border-t border-runway-border bg-runway-black">
                  {refVideoLocalUrl ? (
                    <div className="space-y-2">
                      <video src={refVideoLocalUrl} controls className="w-full rounded-md bg-black" style={{ maxHeight: '180px' }} />
                      <div className="flex gap-2">
                        <button onClick={onOpenVideoTrimModal} className="flex items-center gap-1.5 text-xs text-runway-slate hover:text-white transition-colors">
                          <Scissors className="w-3 h-3" />重新裁剪
                        </button>
                        <span className="text-runway-mid-slate text-xs">·</span>
                        <button onClick={onClearRefVideo} className="text-xs text-runway-slate hover:text-red-400 transition-colors">移除</button>
                      </div>
                      {!refVideoUrl && (
                        <div className="flex items-center gap-1.5 text-xs text-runway-mid-slate">
                          <Loader2 className="w-3 h-3 animate-spin" />上传中...
                        </div>
                      )}
                    </div>
                  ) : (
                    <button onClick={onOpenVideoTrimModal} className="w-full border border-dashed border-runway-border rounded-md p-5 flex flex-col items-center justify-center gap-2 hover:border-runway-charcoal transition-colors">
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
                      <button onClick={() => refAudioInputRef.current?.click()} className="text-xs text-runway-slate hover:text-white transition-colors flex-shrink-0">更换</button>
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

        {/* 底部生成按钮 */}
        <div className="flex-shrink-0 p-4 border-t border-runway-border bg-runway-surface">
          <button
            onClick={onGenerate}
            disabled={videoGenerating || loading || selectedPadIds.length === 0 || !videoPrompt.trim()}
            className="w-full py-3 bg-white text-black font-medium text-sm rounded-md hover:bg-runway-cloud transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {videoGenerating
              ? <><Loader2 className="w-4 h-4 animate-spin" />{videoLoadingMsg || '生成中...'}</>
              : <><Play className="w-4 h-4" />生成视频</>
            }
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
            <video src={generatedVideoUrl} controls autoPlay className="w-full flex-1 min-h-0 rounded-lg bg-black object-contain" />
          ) : (
            <div className="w-full h-full border-2 border-dashed border-runway-border rounded-lg flex flex-col items-center justify-center">
              <Film className="w-10 h-10 text-runway-mid-slate mb-3" />
              <p className="text-sm text-runway-mid-slate">配置左侧参数后点击生成视频</p>
              {selectedPadIds.length === 0 && (
                <p className="text-xs text-runway-mid-slate mt-1">请先添加垫图</p>
              )}
            </div>
          )}
        </div>
      </div>

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
