/**
 * 视频裂变页面共用的小型 UI 控件
 * - AspectRatioSelector
 * - ResolutionSelector
 * - ModelSelector
 * - ToggleRow
 */
import type { ImageModel } from './types';

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

export function AspectRatioSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
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
export function ResolutionSelector({
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

// ==================== 模型选择器 ====================
const IMAGE_MODELS: { value: ImageModel; label: string }[] = [
  { value: 'g', label: 'GPT-Image-2' },
  { value: 'v2', label: 'Nano Banana V2' },
  { value: 'pro', label: 'Nano Banana Pro' },
];

export function ModelSelector({
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

// ==================== Toggle 开关行 ====================
export function ToggleRow({
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
      className={`w-full flex items-center justify-between px-4 py-3 bg-runway-surface hover:bg-runway-deep transition-colors ${
        border ? 'border-t border-runway-border' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        {icon && <span className="text-runway-slate">{icon}</span>}
        <span className="text-xs text-runway-slate">{label}</span>
      </div>
      {/* Toggle pill */}
      <div
        className={`relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${
          checked ? 'bg-white' : 'bg-runway-charcoal'
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full shadow transition-all duration-200 ${
            checked ? 'left-[18px] bg-black' : 'left-0.5 bg-runway-slate'
          }`}
        />
      </div>
    </button>
  );
}
