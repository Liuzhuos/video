import { useRef } from 'react';
import { Upload, Image as ImageIcon, Wand2, Film, ChevronRight, Check, X, Loader2 } from 'lucide-react';
import PromptEditor, { type Asset } from '../PromptEditor';
import ImageGroupCard from './ImageGroupCard';
import { AspectRatioSelector, ResolutionSelector, ModelSelector } from './FissionControls';
import type { PreparedImage, ImageModel, CompareVariant } from './types';

export interface PrepareStepProps {
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
  t2iCompareVariants: CompareVariant[];
  i2iCompareVariants: CompareVariant[];
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
  onUpdateGroupSelectedUrls: (groupId: string, urls: string[]) => void;
  onT2iCompareVariantsChange: (v: CompareVariant[]) => void;
  onI2iCompareVariantsChange: (v: CompareVariant[]) => void;
  onNext: () => void;
}

export default function PrepareStep({
  images, selectedPadIds, textToImagePrompt, img2imgPrompt, img2imgSources,
  aspectRatio, resolution, t2iModel, i2iModel, loading, loadingMsg,
  activeTab, t2iCompareVariants, i2iCompareVariants,
  onActiveTabChange, onTogglePadSelect, onRemoveImage, onTextToImage,
  onImageUpload, onImageToImage, onRemoveSource, onTextToImagePromptChange,
  onImg2imgPromptChange, onAspectRatioChange, onResolutionChange,
  onT2iModelChange, onI2iModelChange, onOpenCaptureModal, onAddToImg2imgSource,
  onEditImg2imgSource, onUpdateGroupSelectedUrls,
  onT2iCompareVariantsChange, onI2iCompareVariantsChange, onNext,
}: PrepareStepProps) {
  const imageInputRef = useRef<HTMLInputElement>(null!);

  const img2imgAssets: Asset[] = img2imgSources.map((src, i) => ({
    type: 'image' as const,
    label: `图片${i + 1}`,
    refTag: `@Image ${i + 1}`,
    thumbnailUrl: src.url.startsWith('http') ? src.url : `http://localhost:3001${src.url}`,
  }));

  const totalSelected =
    selectedPadIds.length +
    images.reduce(
      (sum, img) => sum + (img.isGroup && img.selectedGroupUrls ? img.selectedGroupUrls.length : 0),
      0
    );

  return (
    <div className="h-full flex gap-0 overflow-hidden">
      {/* 左侧操作区 */}
      <div className="w-96 flex-shrink-0 flex flex-col bg-runway-surface border-r border-runway-border min-h-0">
        {/* Tab 切换 */}
        <div className="flex border-b border-runway-border flex-shrink-0">
          <button
            onClick={() => onActiveTabChange('text2img')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'text2img'
                ? 'text-white border-b-2 border-white bg-runway-deep'
                : 'text-runway-slate hover:text-white'
            }`}
          >
            <Wand2 className="w-4 h-4" />文生图
          </button>
          <button
            onClick={() => onActiveTabChange('img2img')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'img2img'
                ? 'text-white border-b-2 border-white bg-runway-deep'
                : 'text-runway-slate hover:text-white'
            }`}
          >
            <ImageIcon className="w-4 h-4" />图生图
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* 文生图 Tab */}
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
                compareVariants={t2iCompareVariants}
                onCompareVariantsChange={onT2iCompareVariantsChange}
              />
              <AspectRatioSelector value={aspectRatio} onChange={onAspectRatioChange} />
              <ResolutionSelector value={resolution} onChange={onResolutionChange} />
              <ModelSelector label="模型" value={t2iModel} onChange={onT2iModelChange} />
            </div>
          )}

          {/* 图生图 Tab */}
          {activeTab === 'img2img' && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-runway-slate">上传或截取源图，AI 根据提示词对其进行变换。</p>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-runway-slate">源图（{img2imgSources.length} 张）</p>
                  <div className="flex gap-1.5">
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
                      <Upload className="w-3 h-3" />上传
                    </button>
                    <button
                      onClick={onOpenCaptureModal}
                      disabled={loading}
                      className="flex items-center gap-1 px-2 py-1 text-xs border border-runway-border text-runway-slate rounded-md hover:text-white hover:border-runway-charcoal transition-colors disabled:opacity-50"
                    >
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
                      <div
                        key={idx}
                        className="relative rounded-md overflow-hidden border border-runway-border group aspect-square cursor-pointer"
                        onClick={() => onEditImg2imgSource(idx, src.url, src.label, src.originalUrl ?? src.url)}
                      >
                        <img
                          src={src.url.startsWith('http') ? src.url : `http://localhost:3001${src.url}`}
                          alt={src.label}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-black/70 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-white leading-none">{idx + 1}</span>
                        </div>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-xs text-white font-medium">点击编辑</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemoveSource(idx); }}
                          className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                        >
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
                compareVariants={i2iCompareVariants}
                onCompareVariantsChange={onI2iCompareVariantsChange}
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
            <button
              onClick={onTextToImage}
              disabled={loading || !textToImagePrompt.trim()}
              className="w-full py-2.5 bg-white text-black text-sm font-medium rounded-md hover:bg-runway-cloud transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              生成图片
            </button>
          ) : (
            <button
              onClick={onImageToImage}
              disabled={loading || !img2imgPrompt.trim() || img2imgSources.length === 0}
              className="w-full py-2.5 bg-white text-black text-sm font-medium rounded-md hover:bg-runway-cloud transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
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
              已准备 {images.filter((i) => !i.pending).length} 张，已选 {totalSelected} 张用于生成视频
            </p>
          </div>
          <button
            onClick={onNext}
            className="px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-runway-cloud transition-colors flex items-center gap-2"
          >
            返回生成视频<ChevronRight className="w-4 h-4" />
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
              {images.map((img) =>
                img.isGroup ? (
                  <ImageGroupCard
                    key={img.id}
                    img={img}
                    isSelected={selectedPadIds.includes(img.id)}
                    isDisabled={!selectedPadIds.includes(img.id) && selectedPadIds.length >= 9}
                    onToggleSelect={() => onTogglePadSelect(img.id)}
                    onRemove={() => onRemoveImage(img.id)}
                    onUpdateSelectedUrls={(urls) => onUpdateGroupSelectedUrls(img.id, urls)}
                  />
                ) : img.pending ? (
                  <div
                    key={img.id}
                    className="relative rounded-lg overflow-hidden border-2 border-runway-border aspect-video"
                  >
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
                    className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                      selectedPadIds.includes(img.id)
                        ? 'border-white shadow-lg'
                        : 'border-runway-border hover:border-runway-charcoal'
                    } group`}
                  >
                    <div className="relative w-full aspect-video bg-black">
                      <img
                        src={img.url.startsWith('http') ? img.url : `http://localhost:3001${img.url}`}
                        alt={img.label}
                        className="absolute inset-0 w-full h-full object-contain"
                      />
                    </div>
                    {selectedPadIds.includes(img.id) && (
                      <div className="absolute top-2 left-2 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-black" />
                      </div>
                    )}
                    {!selectedPadIds.includes(img.id) && selectedPadIds.length >= 9 && (
                      <div className="absolute inset-0 bg-black/50" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToImg2imgSource(img.url, img.label);
                        onActiveTabChange('img2img');
                      }}
                      className="absolute bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-1 bg-black/80 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black flex items-center gap-1.5 border border-white/20"
                    >
                      <ImageIcon className="w-3 h-3" />用于图生图
                    </button>
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
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
