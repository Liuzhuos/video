/**
 * PromptEditor — contenteditable 富文本提示词编辑器
 *
 * 内部用 contenteditable div，chip 作为 inline 不可编辑 span 插入。
 * 序列化时把 chip 转为 refTag 文本输出给父组件。
 */
import { useRef, useEffect, useCallback, useState } from 'react';
import { Image as ImageIcon, Film, Music, Sparkles, Loader2 } from 'lucide-react';
import ReactDOM from 'react-dom/client';
import { polishPrompt } from '../api/chat';

export type AssetType = 'image' | 'video' | 'audio';

export interface Asset {
  type: AssetType;
  label: string;
  /** RunningHub @-reference 格式，如 "@Image 1" */
  refTag: string;
  thumbnailUrl: string | null;
}

const TYPE_COLOR: Record<AssetType, string> = {
  image: '#3b82f6',
  video: '#a855f7',
  audio: '#22c55e',
};
const TYPE_BG: Record<AssetType, string> = {
  image: 'rgba(59,130,246,0.18)',
  video: 'rgba(168,85,247,0.18)',
  audio: 'rgba(34,197,94,0.18)',
};

function AssetIcon({ type }: { type: AssetType }) {
  if (type === 'image') return <ImageIcon className="w-3 h-3 inline" />;
  if (type === 'video') return <Film className="w-3 h-3 inline" />;
  return <Music className="w-3 h-3 inline" />;
}

interface PromptEditorProps {
  value: string;
  onChange: (plain: string) => void;
  assets: Asset[];
  placeholder?: string;
  minHeight?: string;
  /** 用于 AI 润色的图片 URL 列表 */
  polishImageUrls?: string[];
  /** 用于 AI 润色的视频 URL 列表 */
  polishVideoUrls?: string[];
  /** 润色模式：image=图片生成润色，video=视频生成润色 */
  polishMode?: 'image' | 'video';
  /** 是否始终显示润色按钮（即使没有图片/视频，也可以纯文本润色） */
  showPolishButton?: boolean;
}

// ── 序列化：把 contenteditable 内容转为纯文本 ──────────────
function serialize(el: HTMLElement): string {
  let text = '';
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? '';
    } else if (node instanceof HTMLElement) {
      const ref = node.dataset.ref;
      if (ref) {
        text += ref;
      } else if (node.tagName === 'BR') {
        text += '\n';
      } else {
        text += node.textContent ?? '';
      }
    }
  });
  return text;
}

// ── 创建 chip DOM 元素 ────────────────────────────────────
function createChipEl(asset: Asset, onRemove: () => void): HTMLElement {
  const color = TYPE_COLOR[asset.type];
  const bg = TYPE_BG[asset.type];

  const span = document.createElement('span');
  span.contentEditable = 'false';
  span.dataset.ref = asset.refTag;
  span.dataset.chip = '1';
  span.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    color: ${color};
    background: ${bg};
    border: 1px solid ${color}50;
    user-select: none;
    cursor: default;
    vertical-align: baseline;
    line-height: 1.5rem;
    height: 1.5rem;
    margin: 0 1px;
  `;

  // 缩略图或图标
  if (asset.thumbnailUrl) {
    const img = document.createElement('img');
    img.src = asset.thumbnailUrl;
    img.style.cssText = 'width:1em;height:1em;border-radius:2px;object-fit:cover;flex-shrink:0;';
    span.appendChild(img);
  } else {
    const iconWrap = document.createElement('span');
    iconWrap.style.cssText = `display:inline-flex;align-items:center;color:${color}`;
    // 用 SVG 直接写，避免 React 渲染
    const svgMap: Record<AssetType, string> = {
      image: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
      video: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`,
      audio: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    };
    iconWrap.innerHTML = svgMap[asset.type];
    span.appendChild(iconWrap);
  }

  // 标签文字
  const label = document.createElement('span');
  label.textContent = asset.label;
  span.appendChild(label);

  // 删除按钮
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '×';
  btn.style.cssText = `
    background:none;border:none;padding:0;margin-left:2px;
    cursor:pointer;color:${color};opacity:0.7;font-size:14px;line-height:1;
  `;
  btn.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
  btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.7'; });
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove();
  });
  span.appendChild(btn);

  return span;
}

export default function PromptEditor({
  value,
  onChange,
  assets,
  placeholder = '描述你想要生成的视频效果...',
  minHeight = '7.5rem',
  polishImageUrls = [],
  polishVideoUrls = [],
  polishMode = 'video',
  showPolishButton = false,
}: PromptEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuFilter, setMenuFilter] = useState('');
  const [menuIndex, setMenuIndex] = useState(0);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const savedRange = useRef<Range | null>(null);
  const isComposing = useRef(false);
  const suppressChange = useRef(false);
  const [polishing, setPolishing] = useState(false);

  // 外部清空时清除编辑器
  useEffect(() => {
    if (!value && editorRef.current) {
      suppressChange.current = true;
      editorRef.current.innerHTML = '';
      suppressChange.current = false;
    }
  }, [value]);

  // 组件挂载时，如果有初始 value 则同步到编辑器
  useEffect(() => {
    if (value && editorRef.current && !editorRef.current.textContent) {
      suppressChange.current = true;
      editorRef.current.textContent = value;
      suppressChange.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emitChange = useCallback(() => {
    if (suppressChange.current) return;
    if (editorRef.current) onChange(serialize(editorRef.current));
  }, [onChange]);

  // 保存当前光标位置
  const saveRange = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  // 恢复光标位置
  const restoreRange = () => {
    const sel = window.getSelection();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  // 删除 chip：找到对应 span 并移除
  const removeChip = useCallback((chipEl: HTMLElement) => {
    chipEl.remove();
    emitChange();
  }, [emitChange]);

  // 插入 chip 到当前光标位置
  const insertChip = useCallback((asset: Asset) => {
    const editor = editorRef.current;
    if (!editor) return;

    restoreRange();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);

    // 删除 @ 及其后面的过滤词
    // 找到光标所在文本节点，往前找 @
    let node = range.startContainer;
    let offset = range.startOffset;
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      const atIdx = text.lastIndexOf('@', offset - 1);
      if (atIdx !== -1) {
        // 删除从 @ 到当前光标的内容
        const deleteRange = document.createRange();
        deleteRange.setStart(node, atIdx);
        deleteRange.setEnd(node, offset);
        deleteRange.deleteContents();
        // 更新 range
        range.setStart(node, atIdx);
        range.collapse(true);
      }
    }

    const chipEl = createChipEl(asset, () => removeChip(chipEl));
    range.insertNode(chipEl);

    // 光标移到 chip 后面
    range.setStartAfter(chipEl);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    setMenuOpen(false);
    setMenuFilter('');
    emitChange();
    editor.focus();
  }, [emitChange, removeChip]);

  const candidates = assets.filter((a) =>
    a.label.toLowerCase().includes(menuFilter.toLowerCase()) ||
    a.refTag.toLowerCase().includes(menuFilter.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isComposing.current) return;

    if (menuOpen) {
      if (e.key === 'ArrowUp') { e.preventDefault(); setMenuIndex((i) => Math.max(i - 1, 0)); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setMenuIndex((i) => Math.min(i + 1, candidates.length - 1)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (candidates[menuIndex]) insertChip(candidates[menuIndex]);
        return;
      }
      if (e.key === 'Escape') { setMenuOpen(false); return; }
    }

    if (e.key === '@') {
      saveRange();
      // 计算光标在视口中的位置（用 fixed 定位菜单，不受父容器 overflow 影响）
      setTimeout(() => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const editorRect = editorRef.current?.getBoundingClientRect();
          if (editorRect) {
            let top = rect.bottom + 4;
            let left = rect.left;

            // 如果 rect 是空的（第一个字符时），用编辑器左上角
            if (rect.width === 0 && rect.height === 0 && rect.top === 0) {
              top = editorRect.top + 24;
              left = editorRect.left;
            }

            // 防止超出右边界（菜单宽度 240px）
            const maxLeft = window.innerWidth - 250;
            if (left > maxLeft) left = Math.max(0, maxLeft);

            // 防止超出底部（菜单高度约 200px），改为向上弹
            if (top + 200 > window.innerHeight) {
              top = rect.top - 200 - 4;
              if (top < 0) top = rect.bottom + 4;
            }

            setMenuPos({ top, left });
          }
        }
        setMenuOpen(true);
        setMenuFilter('');
        setMenuIndex(0);
      }, 0);
    }
  };

  const handleInput = () => {
    if (isComposing.current) return;
    emitChange();

    if (menuOpen) {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) { setMenuOpen(false); return; }
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? '';
        const offset = range.startOffset;
        const atIdx = text.lastIndexOf('@', offset - 1);
        if (atIdx !== -1) {
          setMenuFilter(text.slice(atIdx + 1, offset));
          setMenuIndex(0);
        } else {
          setMenuOpen(false);
        }
      } else {
        setMenuOpen(false);
      }
    }
  };

  // 点击外部关闭菜单
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        editorRef.current && !editorRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // AI 润色处理
  const handlePolish = async () => {
    const hasMedia = polishImageUrls.length > 0 || polishVideoUrls.length > 0;
    if (!hasMedia && !value.trim()) return;

    try {
      setPolishing(true);
      const result = await polishPrompt(polishImageUrls, polishVideoUrls, value, polishMode);
      // 将润色结果写入编辑器
      onChange(result);
      if (editorRef.current) {
        suppressChange.current = true;
        editorRef.current.textContent = result;
        suppressChange.current = false;
      }
    } catch (err: any) {
      console.error('润色失败:', err);
    } finally {
      setPolishing(false);
    }
  };

  const canPolish = polishImageUrls.length > 0 || polishVideoUrls.length > 0 || (showPolishButton && value.trim().length > 0);

  return (
    <div className="relative">
      {/* AI 润色按钮 */}
      {canPolish && (
        <button
          type="button"
          onClick={handlePolish}
          disabled={polishing}
          title="AI 润色提示词"
          className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all duration-200 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 text-purple-300 hover:from-purple-500/30 hover:to-blue-500/30 hover:border-purple-400/50 hover:text-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {polishing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          <span>{polishing ? '润色中...' : 'AI润色'}</span>
        </button>
      )}

      {/* contenteditable 编辑区 */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onCompositionStart={() => { isComposing.current = true; }}
        onCompositionEnd={() => { isComposing.current = false; setTimeout(emitChange, 0); }}
        onMouseUp={saveRange}
        onKeyUp={saveRange}
        onBlur={() => { setTimeout(() => setMenuOpen(false), 150); }}
        data-placeholder={placeholder}
        className="w-full bg-runway-black border border-runway-border rounded-md px-3 py-3 text-sm text-white focus:outline-none focus:border-runway-charcoal leading-6 break-words"
        style={{
          minHeight,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      />

      {/* placeholder（CSS 实现） */}
      <style>{`
        [data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #6b7280;
          pointer-events: none;
        }
      `}</style>

      {/* @ 候选菜单（跟随光标位置） */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="fixed z-[9999] w-60 bg-runway-surface border border-runway-border rounded-lg shadow-xl overflow-hidden"
          style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
        >
          {candidates.length === 0 ? (
            <div className="px-3 py-2 text-xs text-runway-mid-slate">暂无可用资源</div>
          ) : (
            candidates.map((asset, i) => {
              const color = TYPE_COLOR[asset.type];
              const bg = TYPE_BG[asset.type];
              return (
                <button
                  key={asset.refTag}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); insertChip(asset); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${i === menuIndex ? 'bg-runway-deep' : 'hover:bg-runway-deep'}`}
                >
                  <span
                    className="w-6 h-6 rounded flex-shrink-0 overflow-hidden flex items-center justify-center"
                    style={{ backgroundColor: bg }}
                  >
                    {asset.thumbnailUrl ? (
                      <img src={asset.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span style={{ color }}><AssetIcon type={asset.type} /></span>
                    )}
                  </span>
                  <span style={{ color }} className="font-medium">{asset.label}</span>
                  <span className="ml-auto text-runway-mid-slate opacity-60">{asset.refTag}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
