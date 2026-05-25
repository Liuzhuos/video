import { useRef, useState, useEffect, useCallback } from 'react';
import { Upload, Image as ImageIcon, Wand2, Film, ChevronRight, Check, X, Loader2, History, RefreshCw, Eye, Download, Layers } from 'lucide-react';
import PromptEditor, { type Asset } from '../PromptEditor';
import ImageGroupCard from './ImageGroupCard';
import { AspectRatioSelector, ResolutionSelector, ModelSelector } from './FissionControls';
import type { PreparedImage, ImageModel, CompareVariant } from './types';
import { fetchImageHistory, type HistoryImageItem } from '../../api/image';

// ── 图片预览弹窗 ──────────────────────────────────────────
function PreviewModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
      >
        <X className="w-5 h-5 text-white" />
      </button>
      <img
        src={url}
        alt="预览"
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ── iOS 风格圆形操作按钮 ──────────────────────────────────
interface ActionBtnProps {
  icon: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void | Promise<void>;
  variant?: 'default' | 'active';
  disabled?: boolean;
}
function ActionBtn({ icon, label, onClick, variant = 'default', disabled }: ActionBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`
        flex flex-col items-center gap-1 group/btn disabled:opacity-40 disabled:cursor-not-allowed
      `}
    >
      <span className={`
        w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150
        shadow-lg backdrop-blur-md
        ${variant === 'active'
          ? 'bg-white text-black'
          : 'bg-black/50 text-white hover:bg-white/90 hover:text-black border border-white/20'
        }
      `}>
        {icon}
      </span>
      <span className="text-[10px] text-white/80 leading-none font-medium drop-shadow">{label}</span>
    </button>
  );
}

// ── 通用图片卡片 ──────────────────────────────────────────
interface ImageCardProps {
  url: string;
  label: string;
  isSelected: boolean;
  isDisabled?: boolean;
  subLabel?: string;
  onSelect: () => void;
  onImg2img: () => void;
  onRemove?: () => void;
  extraTopLeft?: React.ReactNode;
}
function ImageCard({
  url, label, isSelected, isDisabled, subLabel,
  onSelect, onImg2img, onRemove, extraTopLeft,
}: ImageCardProps) {
  const [showPreview, setShowPreview] = useState(false);
  const resolvedUrl = url.startsWith('http') ? url : `http://localhost:3001${url}`;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(resolvedUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${label || 'image'}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // 跨域 fallback：直接新标签打开
      window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      <div
        onClick={() => !isDisabled && onSelect()}
        className={`
          relative rounded-xl overflow-hidden border-2 transition-all duration-200 group
          ${isDisabled ? 'cursor-default' : 'cursor-pointer'}
          ${isSelected ? 'border-white shadow-[0_0_0_1px_rgba(255,255,255,0.4)] shadow-lg' : 'border-runway-border hover:border-white/40'}
        `}
      >
        {/* 图片主体 */}
        <div className="relative w-full aspect-video bg-black">
          <img
            src={resolvedUrl}
            alt={label}
            className="absolute inset-0 w-full h-full object-contain"
          />
        </div>

        {/* 渐变遮罩（hover 或选中时显示） */}
        <div className={`absolute inset-0 transition-opacity duration-200 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />

        {/* 左上角：选中勾 / 自定义内容 */}
        <div className="absolute top-2 left-2 pointer-events-none">
          {isSelected ? (
            <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center shadow">
              <Check className="w-3 h-3 text-black" />
            </span>
          ) : extraTopLeft}
        </div>

        {/* 右上角：删除 */}
        {onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80 backdrop-blur-sm"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        )}

        {/* 底部：三个 iOS 圆形按钮 + 标签 */}
        <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2.5 pt-6 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex items-end justify-between">
            {/* 标签 */}
            <span className="text-xs text-white/90 truncate max-w-[45%] leading-tight drop-shadow">
              {label}
              {subLabel && <span className="block text-white/50 text-[10px]">{subLabel}</span>}
            </span>
            {/* 三个按钮 */}
            <div className="flex items-end gap-2" onClick={(e) => e.stopPropagation()}>
              <ActionBtn
                icon={<Eye className="w-4 h-4" />}
                label="预览"
                onClick={(e) => { e.stopPropagation(); setShowPreview(true); }}
              />
              <ActionBtn
                icon={<Download className="w-4 h-4" />}
                label="下载"
                onClick={handleDownload}
              />
              <ActionBtn
                icon={<Layers className="w-4 h-4" />}
                label="图生图"
                onClick={(e) => { e.stopPropagation(); onImg2img(); }}
              />
            </div>
          </div>
        </div>
      </div>

      {showPreview && <PreviewModal url={resolvedUrl} onClose={() => setShowPreview(false)} />}
    </>
  );
}

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
  onOpenCompositor: () => void;
  onAddToImg2imgSource: (url: string, label: string) => void;
  onEditImg2imgSource: (index: number, url: string, label: string, originalUrl: string) => void;
  onEditPadImage: (id: string, url: string, label: string, originalUrl: string) => void;
  onUpdateGroupSelectedUrls: (groupId: string, urls: string[]) => void;
  onT2iCompareVariantsChange: (v: CompareVariant[]) => void;
  onI2iCompareVariantsChange: (v: CompareVariant[]) => void;
  onAddImage: (img: PreparedImage) => void;
  onNext: () => void;
}

export default function PrepareStep({
  images, selectedPadIds, textToImagePrompt, img2imgPrompt, img2imgSources,
  aspectRatio, resolution, t2iModel, i2iModel, loading, loadingMsg,
  activeTab, t2iCompareVariants, i2iCompareVariants,
  onActiveTabChange, onTogglePadSelect, onRemoveImage, onTextToImage,
  onImageUpload, onImageToImage, onRemoveSource, onTextToImagePromptChange,
  onImg2imgPromptChange, onAspectRatioChange, onResolutionChange,
  onT2iModelChange, onI2iModelChange, onOpenCaptureModal, onOpenCompositor, onAddToImg2imgSource,
  onEditImg2imgSource, onUpdateGroupSelectedUrls,
  onT2iCompareVariantsChange, onI2iCompareVariantsChange, onAddImage, onNext,
}: PrepareStepProps) {
  const imageInputRef = useRef<HTMLInputElement>(null!);

  // 右侧区域 Tab：当前垫图 / 历史素材
  const [rightTab, setRightTab] = useState<'current' | 'history'>('current');
  const [historyItems, setHistoryItems] = useState<HistoryImageItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const result = await fetchImageHistory(1, 9999);
      setHistoryItems(result.items);
    } catch (err) {
      console.error('加载历史图片失败:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // 切换到历史 tab 时自动加载
  useEffect(() => {
    if (rightTab === 'history' && historyItems.length === 0) {
      loadHistory();
    }
  }, [rightTab, historyItems.length, loadHistory]);
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
                    <button
                      onClick={onOpenCompositor}
                      disabled={loading}
                      className="flex items-center gap-1 px-2 py-1 text-xs border border-runway-border text-runway-slate rounded-md hover:text-white hover:border-runway-charcoal transition-colors disabled:opacity-50"
                    >
                      <Layers className="w-3 h-3" />融合
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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* 右侧 Tab 栏 */}
        <div className="flex items-center justify-between px-6 pt-4 pb-0 flex-shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setRightTab('current')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                rightTab === 'current'
                  ? 'bg-white text-black'
                  : 'text-runway-slate hover:text-white hover:bg-runway-charcoal'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              当前垫图
            </button>
            <button
              onClick={() => setRightTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                rightTab === 'history'
                  ? 'bg-white text-black'
                  : 'text-runway-slate hover:text-white hover:bg-runway-charcoal'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              历史素材
            </button>
          </div>
          {rightTab === 'current' ? (
            <div className="flex items-center gap-3">
              <p className="text-xs text-runway-slate">
                已准备 {images.filter((i) => !i.pending).length} 张，已选 {totalSelected} 张
              </p>
              <button
                onClick={onNext}
                className="px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-runway-cloud transition-colors flex items-center gap-2"
              >
                返回生成视频<ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => loadHistory()}
              disabled={historyLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-runway-slate hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          )}
        </div>

        {/* 当前垫图 Tab */}
        {rightTab === 'current' && (
          <div className="flex-1 overflow-y-auto p-6 pt-4">
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
                      className="relative rounded-xl overflow-hidden border-2 border-runway-border aspect-video"
                    >
                      <div className="absolute inset-0 bg-runway-surface shimmer-placeholder" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                        <Wand2 className="w-5 h-5 text-runway-slate animate-pulse" />
                        <span className="text-xs text-runway-slate">AI 生成中...</span>
                      </div>
                    </div>
                  ) : (
                    <ImageCard
                      key={img.id}
                      url={img.url}
                      label={img.label}
                      isSelected={selectedPadIds.includes(img.id)}
                      isDisabled={!selectedPadIds.includes(img.id) && selectedPadIds.length >= 9}
                      onSelect={() => onTogglePadSelect(img.id)}
                      onImg2img={() => {
                        onAddToImg2imgSource(img.url, img.label);
                        onActiveTabChange('img2img');
                      }}
                      onRemove={() => onRemoveImage(img.id)}
                    />
                  )
                )}
              </div>
            )}
          </div>
        )}

        {/* 历史素材 Tab */}
        {rightTab === 'history' && (
          <div className="flex-1 overflow-y-auto p-6 pt-4">
            {historyLoading && historyItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-runway-slate animate-spin" />
                <p className="text-sm text-runway-slate">加载历史素材...</p>
              </div>
            ) : historyItems.length === 0 ? (
              <div className="h-full border-2 border-dashed border-runway-border rounded-lg flex flex-col items-center justify-center">
                <History className="w-10 h-10 text-runway-mid-slate mb-3" />
                <p className="text-sm text-runway-mid-slate">暂无历史图片素材</p>
                <p className="text-xs text-runway-mid-slate mt-1">生成图片后会自动保存到这里</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 content-start">
                {historyItems.map((item) => {
                    const alreadyAdded = images.some((img) => img.url === item.url);
                    const label = item.prompt
                      ? item.prompt.slice(0, 20) + (item.prompt.length > 20 ? '...' : '')
                      : '历史图片';
                    const subLabel = new Date(item.createdAt).toLocaleDateString('zh-CN', {
                      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                    });
                    return (
                      <ImageCard
                        key={item.id}
                        url={item.url}
                        label={label}
                        subLabel={subLabel}
                        isSelected={false}
                        isDisabled={alreadyAdded}
                        onSelect={() => {
                          if (alreadyAdded) return;
                          const newId = `history_${item.id}_${Date.now()}`;
                          onAddImage({
                            id: newId,
                            url: item.url,
                            originalUrl: item.url,
                            source: 'text2img',
                            label,
                          });
                          setRightTab('current');
                        }}
                        onImg2img={() => {
                          onAddToImg2imgSource(item.url, label);
                          onActiveTabChange('img2img');
                          setRightTab('current');
                        }}
                        extraTopLeft={
                          alreadyAdded ? (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white/90 text-black text-[10px] font-semibold shadow">
                              <Check className="w-2.5 h-2.5" />已添加
                            </span>
                          ) : undefined
                        }
                      />
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
