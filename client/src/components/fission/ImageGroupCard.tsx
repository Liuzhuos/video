import { useState } from 'react';
import { Loader2, Check, X, Image as ImageIcon } from 'lucide-react';
import type { PreparedImage } from './types';

// ==================== 对比组预览弹窗 ====================
function ImageGroupPreviewModal({
  images,
  title,
  isPending,
  initialSelectedUrls,
  onClose,
  onConfirm,
}: {
  images: { url: string; label: string; variantDesc: string }[];
  title: string;
  isPending?: boolean;
  initialSelectedUrls: string[];
  onClose: () => void;
  onConfirm: (selectedUrls: string[]) => void;
}) {
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(
    new Set(initialSelectedUrls)
  );

  const toggleSelect = (url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-runway-surface border border-runway-border rounded-xl w-[800px] max-w-[95vw] max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-runway-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-white">{title}</span>
            <span className="text-xs text-runway-mid-slate">
              ({images.length} 张对比{isPending ? '，生成中...' : ''})
            </span>
          </div>
          <button onClick={onClose} className="text-runway-slate hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className={`grid gap-4 ${images.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {images.map((img, idx) => (
              <div key={idx} className="flex flex-col gap-2">
                <div
                  onClick={() => toggleSelect(img.url)}
                  className={`relative rounded-lg overflow-hidden border-2 bg-black aspect-video cursor-pointer transition-all ${
                    selectedUrls.has(img.url)
                      ? 'border-white shadow-lg'
                      : 'border-runway-border hover:border-runway-charcoal'
                  }`}
                >
                  <img
                    src={img.url.startsWith('http') ? img.url : `http://localhost:3001${img.url}`}
                    alt={img.label}
                    className="w-full h-full object-contain"
                  />
                  {selectedUrls.has(img.url) && (
                    <div className="absolute top-2 left-2 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-black" />
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <span className="text-xs text-amber-300 font-medium">
                    {img.variantDesc || `变体 ${idx + 1}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-runway-border flex-shrink-0">
          <span className="text-xs text-runway-slate">
            {selectedUrls.size > 0
              ? `已选 ${selectedUrls.size} 张用于视频生成`
              : '点击图片选中，选中后直接用于视频生成'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 border border-runway-border text-runway-slate text-xs rounded-md hover:text-white hover:border-runway-charcoal transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => onConfirm(Array.from(selectedUrls))}
              className="px-4 py-1.5 bg-white text-black text-xs font-medium rounded-md hover:bg-runway-cloud transition-colors"
            >
              确认选择 ({selectedUrls.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== 对比组卡片 ====================
interface ImageGroupCardProps {
  img: PreparedImage;
  isSelected: boolean;
  isDisabled: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
  onUpdateSelectedUrls: (urls: string[]) => void;
}

export default function ImageGroupCard({
  img,
  isSelected,
  isDisabled,
  onToggleSelect,
  onRemove,
  onUpdateSelectedUrls,
}: ImageGroupCardProps) {
  const [showPreview, setShowPreview] = useState(false);
  const groupImages = img.groupImages ?? [];
  const displayImages = groupImages.slice(0, 9);
  const selectedUrls = img.selectedGroupUrls ?? [];

  const computeFanAngles = (count: number): number[] => {
    if (count === 0) return [];
    if (count === 1) return [0];
    const maxSpread = Math.min(60, count * 10);
    const step = maxSpread / (count - 1);
    const startAngle = -maxSpread / 2;
    return Array.from({ length: count }, (_, i) => startAngle + step * i);
  };

  const fanAngles = computeFanAngles(displayImages.length);

  return (
    <>
      <div
        className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
          isSelected
            ? 'border-amber-400 shadow-lg shadow-amber-500/20'
            : 'border-runway-border hover:border-amber-500/50'
        } group`}
      >
        {/* 扇形展开缩略图 */}
        <div
          className="relative w-full aspect-video bg-runway-deep flex items-center justify-center"
          onClick={() => groupImages.length > 0 && setShowPreview(true)}
        >
          {displayImages.length > 0 ? (
            <div className="relative w-[50%] h-[65%]">
              {displayImages.map((gImg, idx) => (
                <div
                  key={idx}
                  className="absolute inset-0 rounded-sm overflow-hidden border border-white/20 shadow-md bg-black"
                  style={{
                    transform: `rotate(${fanAngles[idx]}deg)`,
                    transformOrigin: 'bottom center',
                    zIndex: idx,
                  }}
                >
                  <img
                    src={gImg.url.startsWith('http') ? gImg.url : `http://localhost:3001${gImg.url}`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          ) : (
            <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
          )}
        </div>

        {/* 对比组标记 */}
        <div className="absolute top-2 right-8 px-1.5 py-0.5 bg-amber-500/80 rounded text-xs font-bold text-black">
          {groupImages.length}张
        </div>

        {/* 已选中数量标记 */}
        {selectedUrls.length > 0 && (
          <div className="absolute top-2 left-8 px-1.5 py-0.5 bg-white/90 rounded text-xs font-bold text-black">
            选{selectedUrls.length}
          </div>
        )}

        {/* 选中角标 */}
        <div
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
          className={`absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
            isSelected ? 'bg-amber-400' : 'bg-black/50 hover:bg-black/70 border border-white/30'
          }`}
        >
          {isSelected && <Check className="w-3 h-3 text-black" />}
        </div>

        {/* 禁用遮罩 */}
        {isDisabled && <div className="absolute inset-0 bg-black/50 pointer-events-none" />}

        {/* 删除按钮 */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-2 right-2 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-3 h-3 text-white" />
        </button>

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-r from-amber-900/80 to-black/60 px-2 py-1">
          <span className="text-xs text-amber-200 truncate block">
            {img.pending ? `生成中 (${groupImages.length}张完成)...` : img.label}
          </span>
        </div>
      </div>

      {showPreview && (
        <ImageGroupPreviewModal
          images={groupImages}
          title={img.label}
          isPending={img.pending}
          initialSelectedUrls={selectedUrls}
          onClose={() => setShowPreview(false)}
          onConfirm={(urls) => {
            onUpdateSelectedUrls(urls);
            setShowPreview(false);
          }}
        />
      )}
    </>
  );
}
