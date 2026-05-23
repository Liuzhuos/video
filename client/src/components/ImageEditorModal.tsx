import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Pen, Type, ImageIcon, RotateCcw, RotateCw, Save, Minus, Plus, Crop } from 'lucide-react';

type Tool = 'pen' | 'text' | 'crop';

const COLORS = [
  '#ffffff', '#000000', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#06b6d4',
];

interface ImageEditorModalProps {
  /** 当前图片 URL（可能已经是编辑过的版本） */
  imageUrl: string;
  /** 最原始的图片 URL，用于"恢复原图" */
  originalUrl: string;
  /** 图片标签，用于显示 */
  label?: string;
  /** 保存后回调，传回新的 dataURL */
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}

export default function ImageEditorModal({ imageUrl, originalUrl, label, onSave, onClose }: ImageEditorModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null!);
  const overlayRef = useRef<HTMLCanvasElement>(null!); // 绘制层
  const containerRef = useRef<HTMLDivElement>(null!);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#ef4444');
  const [brushSize, setBrushSize] = useState(4);
  const [pendingText, setPendingText] = useState<{ x: number; y: number } | null>(null);
  const [pendingValue, setPendingValue] = useState('');
  const [fontSize, setFontSize] = useState(20);
  const [rotation, setRotation] = useState(0); // 实际累计旋转角度（用于 transform，不限范围）

  // 显示用的归一化角度 (-180, 180]
  const displayRotation = ((((rotation % 360) + 540) % 360) - 180);

  // 裁剪相关状态
  const [cropMode, setCropMode] = useState(false);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const isCropping = useRef(false);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null!); // 裁剪遮罩层

  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  // 保存绘制历史（overlay canvas 的 imageData）用于撤销
  const history = useRef<ImageData[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const resolvedUrl = imageUrl.startsWith('http') ? imageUrl : `http://localhost:3001${imageUrl}`;
  const resolvedOriginalUrl = originalUrl.startsWith('http') ? originalUrl : `http://localhost:3001${originalUrl}`;

  // 通过代理加载图片避免 CORS 问题
  const proxyUrl = (url: string) => {
    if (url.startsWith('http')) {
      return `/api/image/proxy?url=${encodeURIComponent(url)}`;
    }
    return `http://localhost:3001${url}`;
  };

  // 将指定 URL 的图片绘制到 base canvas，并清空 overlay
  const loadImageToCanvas = useCallback((url: string, resetHistory = false) => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const maxW = 800;
      const maxH = 560;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }

      canvas.width = w;
      canvas.height = h;
      overlay.width = w;
      overlay.height = h;

      // 同步裁剪遮罩层尺寸
      const cropCanvas = cropCanvasRef.current;
      if (cropCanvas) {
        cropCanvas.width = w;
        cropCanvas.height = h;
      }

      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      overlay.getContext('2d')!.clearRect(0, 0, w, h);

      if (resetHistory) {
        history.current = [];
        setCanUndo(false);
      }
    };
    img.onerror = () => {
      // CORS 失败时不带 crossOrigin 重试（仅用于显示，保存时走 fetch）
      const img2 = new Image();
      img2.onload = () => {
        const maxW = 800;
        const maxH = 560;
        let w = img2.naturalWidth;
        let h = img2.naturalHeight;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
        canvas.width = w;
        canvas.height = h;
        overlay.width = w;
        overlay.height = h;
        const cropCanvas = cropCanvasRef.current;
        if (cropCanvas) {
          cropCanvas.width = w;
          cropCanvas.height = h;
        }
        canvas.getContext('2d')!.drawImage(img2, 0, 0, w, h);
        overlay.getContext('2d')!.clearRect(0, 0, w, h);
        if (resetHistory) { history.current = []; setCanUndo(false); }
      };
      img2.src = url;
    };
    img.src = proxyUrl(url);
  }, []);

  // 初始化：加载当前图片
  useEffect(() => {
    loadImageToCanvas(resolvedUrl, true);
  }, [resolvedUrl, loadImageToCanvas]);

  // 获取 overlay 上的坐标
  const getPos = (e: React.MouseEvent): { x: number; y: number } => {
    const rect = overlayRef.current.getBoundingClientRect();
    const scaleX = overlayRef.current.width / rect.width;
    const scaleY = overlayRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const saveHistory = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d')!;
    history.current.push(ctx.getImageData(0, 0, overlay.width, overlay.height));
    if (history.current.length > 50) history.current.shift();
    setCanUndo(true);
  }, []);

  const handleUndo = () => {
    const overlay = overlayRef.current;
    if (!overlay || history.current.length === 0) return;
    const ctx = overlay.getContext('2d')!;
    const prev = history.current.pop()!;
    ctx.putImageData(prev, 0, 0);
    setCanUndo(history.current.length > 0);
  };

  const handleClear = () => {
    // 恢复到最原始的图片，清空所有涂抹痕迹，重置旋转
    loadImageToCanvas(resolvedOriginalUrl, true);
    setRotation(0);
  };

  // ── 画笔事件 ──
  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool !== 'pen') return;
    saveHistory();
    isDrawing.current = true;
    lastPos.current = getPos(e);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing.current || tool !== 'pen') return;
    const overlay = overlayRef.current;
    const ctx = overlay.getContext('2d')!;
    const pos = getPos(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
    lastPos.current = null;
  };

  // ── 文字工具点击 ──
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (tool !== 'text') return;
    // 如果有正在编辑的文字，先提交
    if (pendingText) {
      commitPendingText();
      return;
    }
    const pos = getPos(e);
    setPendingText(pos);
    setPendingValue('');
  };

  const commitPendingText = useCallback(() => {
    if (!pendingText || !pendingValue.trim()) {
      setPendingText(null);
      setPendingValue('');
      return;
    }
    saveHistory();
    const overlay = overlayRef.current;
    const ctx = overlay.getContext('2d')!;
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = color;
    ctx.fillText(pendingValue, pendingText.x, pendingText.y);
    setPendingText(null);
    setPendingValue('');
  }, [pendingText, pendingValue, color, fontSize, saveHistory]);

  // ── 裁剪模式 ──
  // 拖拽类型：创建新选区 / 移动整体 / 调整边角
  type CropDragType = 'create' | 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';
  const cropDragType = useRef<CropDragType>('create');
  const cropDragStart = useRef<{ x: number; y: number; rect: { x: number; y: number; w: number; h: number } } | null>(null);

  // 进入裁剪模式
  const enterCropMode = () => {
    setCropMode(true);
    setCropRect(null);
  };

  // 退出裁剪模式
  const exitCropMode = () => {
    setCropMode(false);
    setCropRect(null);
    // 清除裁剪遮罩层
    const cropCanvas = cropCanvasRef.current;
    if (cropCanvas) {
      const ctx = cropCanvas.getContext('2d')!;
      ctx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
    }
  };

  // 绘制裁剪遮罩（暗色遮罩 + 选区透明）
  const drawCropOverlay = useCallback((rect: { x: number; y: number; w: number; h: number } | null) => {
    const cropCanvas = cropCanvasRef.current;
    if (!cropCanvas) return;
    const ctx = cropCanvas.getContext('2d')!;
    const w = cropCanvas.width;
    const h = cropCanvas.height;
    ctx.clearRect(0, 0, w, h);

    // 绘制半透明暗色遮罩覆盖整个画布
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, w, h);

    if (rect && rect.w > 0 && rect.h > 0) {
      // 清除选区部分（让选区恢复正常亮度）
      ctx.clearRect(rect.x, rect.y, rect.w, rect.h);

      // 绘制选区边框
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.setLineDash([]);

      // 绘制四角手柄
      const handleSize = 8;
      ctx.fillStyle = '#ffffff';
      const corners = [
        { x: rect.x, y: rect.y },
        { x: rect.x + rect.w, y: rect.y },
        { x: rect.x, y: rect.y + rect.h },
        { x: rect.x + rect.w, y: rect.y + rect.h },
      ];
      corners.forEach(({ x, y }) => {
        ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
      });

      // 绘制四边中点手柄
      const midHandles = [
        { x: rect.x + rect.w / 2, y: rect.y },           // 上中
        { x: rect.x + rect.w / 2, y: rect.y + rect.h },  // 下中
        { x: rect.x, y: rect.y + rect.h / 2 },           // 左中
        { x: rect.x + rect.w, y: rect.y + rect.h / 2 },  // 右中
      ];
      midHandles.forEach(({ x, y }) => {
        ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
      });
    }
  }, []);

  // 裁剪模式下获取坐标（基于 cropCanvas）
  const getCropPos = (e: React.MouseEvent): { x: number; y: number } => {
    const cropCanvas = cropCanvasRef.current;
    if (!cropCanvas) return { x: 0, y: 0 };
    const rect = cropCanvas.getBoundingClientRect();
    const scaleX = cropCanvas.width / rect.width;
    const scaleY = cropCanvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // 判断鼠标位置对应的拖拽类型
  const getHitZone = (pos: { x: number; y: number }, rect: { x: number; y: number; w: number; h: number }): CropDragType => {
    const threshold = 10; // 手柄命中范围（canvas 像素）

    const { x, y, w, h } = rect;
    const px = pos.x;
    const py = pos.y;

    // 检测四角
    if (Math.abs(px - x) < threshold && Math.abs(py - y) < threshold) return 'nw';
    if (Math.abs(px - (x + w)) < threshold && Math.abs(py - y) < threshold) return 'ne';
    if (Math.abs(px - x) < threshold && Math.abs(py - (y + h)) < threshold) return 'sw';
    if (Math.abs(px - (x + w)) < threshold && Math.abs(py - (y + h)) < threshold) return 'se';

    // 检测四边
    if (Math.abs(py - y) < threshold && px > x + threshold && px < x + w - threshold) return 'n';
    if (Math.abs(py - (y + h)) < threshold && px > x + threshold && px < x + w - threshold) return 's';
    if (Math.abs(px - x) < threshold && py > y + threshold && py < y + h - threshold) return 'w';
    if (Math.abs(px - (x + w)) < threshold && py > y + threshold && py < y + h - threshold) return 'e';

    // 检测内部（移动）
    if (px > x && px < x + w && py > y && py < y + h) return 'move';

    // 外部：创建新选区
    return 'create';
  };

  // 根据拖拽类型返回 CSS cursor
  const getCropCursor = (pos: { x: number; y: number }): string => {
    if (!cropRect || cropRect.w < 5 || cropRect.h < 5) return 'crosshair';
    const zone = getHitZone(pos, cropRect);
    switch (zone) {
      case 'nw': case 'se': return 'nwse-resize';
      case 'ne': case 'sw': return 'nesw-resize';
      case 'n': case 's': return 'ns-resize';
      case 'e': case 'w': return 'ew-resize';
      case 'move': return 'move';
      default: return 'crosshair';
    }
  };

  // 裁剪鼠标按下
  const handleCropMouseDown = (e: React.MouseEvent) => {
    if (!cropMode) return;
    e.preventDefault();
    const pos = getCropPos(e);

    if (cropRect && cropRect.w > 5 && cropRect.h > 5) {
      const zone = getHitZone(pos, cropRect);
      cropDragType.current = zone;
      cropDragStart.current = { x: pos.x, y: pos.y, rect: { ...cropRect } };
    } else {
      cropDragType.current = 'create';
      cropDragStart.current = { x: pos.x, y: pos.y, rect: { x: pos.x, y: pos.y, w: 0, h: 0 } };
    }

    isCropping.current = true;
  };

  // 裁剪鼠标移动
  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!cropMode) return;
    const pos = getCropPos(e);

    // 更新 cursor
    const cropCanvas = cropCanvasRef.current;
    if (cropCanvas) {
      cropCanvas.style.cursor = isCropping.current ? '' : getCropCursor(pos);
    }

    if (!isCropping.current || !cropDragStart.current) return;

    const canvasW = cropCanvas?.width ?? 800;
    const canvasH = cropCanvas?.height ?? 560;
    const { x: startX, y: startY, rect: startRect } = cropDragStart.current;
    const dx = pos.x - startX;
    const dy = pos.y - startY;

    let newRect: { x: number; y: number; w: number; h: number };

    switch (cropDragType.current) {
      case 'create': {
        const x = Math.max(0, Math.min(startX, pos.x));
        const y = Math.max(0, Math.min(startY, pos.y));
        const w = Math.min(Math.abs(pos.x - startX), canvasW - x);
        const h = Math.min(Math.abs(pos.y - startY), canvasH - y);
        newRect = { x, y, w, h };
        break;
      }
      case 'move': {
        let nx = startRect.x + dx;
        let ny = startRect.y + dy;
        // 限制不超出画布
        nx = Math.max(0, Math.min(nx, canvasW - startRect.w));
        ny = Math.max(0, Math.min(ny, canvasH - startRect.h));
        newRect = { x: nx, y: ny, w: startRect.w, h: startRect.h };
        break;
      }
      case 'n': {
        const newY = Math.max(0, Math.min(startRect.y + dy, startRect.y + startRect.h - 10));
        const newH = startRect.h - (newY - startRect.y);
        newRect = { x: startRect.x, y: newY, w: startRect.w, h: newH };
        break;
      }
      case 's': {
        const newH = Math.max(10, Math.min(startRect.h + dy, canvasH - startRect.y));
        newRect = { x: startRect.x, y: startRect.y, w: startRect.w, h: newH };
        break;
      }
      case 'w': {
        const newX = Math.max(0, Math.min(startRect.x + dx, startRect.x + startRect.w - 10));
        const newW = startRect.w - (newX - startRect.x);
        newRect = { x: newX, y: startRect.y, w: newW, h: startRect.h };
        break;
      }
      case 'e': {
        const newW = Math.max(10, Math.min(startRect.w + dx, canvasW - startRect.x));
        newRect = { x: startRect.x, y: startRect.y, w: newW, h: startRect.h };
        break;
      }
      case 'nw': {
        const newX = Math.max(0, Math.min(startRect.x + dx, startRect.x + startRect.w - 10));
        const newY = Math.max(0, Math.min(startRect.y + dy, startRect.y + startRect.h - 10));
        const newW = startRect.w - (newX - startRect.x);
        const newH = startRect.h - (newY - startRect.y);
        newRect = { x: newX, y: newY, w: newW, h: newH };
        break;
      }
      case 'ne': {
        const newY = Math.max(0, Math.min(startRect.y + dy, startRect.y + startRect.h - 10));
        const newW = Math.max(10, Math.min(startRect.w + dx, canvasW - startRect.x));
        const newH = startRect.h - (newY - startRect.y);
        newRect = { x: startRect.x, y: newY, w: newW, h: newH };
        break;
      }
      case 'sw': {
        const newX = Math.max(0, Math.min(startRect.x + dx, startRect.x + startRect.w - 10));
        const newW = startRect.w - (newX - startRect.x);
        const newH = Math.max(10, Math.min(startRect.h + dy, canvasH - startRect.y));
        newRect = { x: newX, y: startRect.y, w: newW, h: newH };
        break;
      }
      case 'se': {
        const newW = Math.max(10, Math.min(startRect.w + dx, canvasW - startRect.x));
        const newH = Math.max(10, Math.min(startRect.h + dy, canvasH - startRect.y));
        newRect = { x: startRect.x, y: startRect.y, w: newW, h: newH };
        break;
      }
      default:
        return;
    }

    setCropRect(newRect);
    drawCropOverlay(newRect);
  };

  // 裁剪鼠标松开
  const handleCropMouseUp = () => {
    isCropping.current = false;
    cropDragStart.current = null;
  };

  // 确认裁剪：截取选区部分作为新图片
  const handleCropConfirm = () => {
    if (!cropRect || cropRect.w < 5 || cropRect.h < 5) return;

    // 合并 base + overlay，然后裁剪选区
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    const merged = document.createElement('canvas');
    merged.width = canvas.width;
    merged.height = canvas.height;
    const mctx = merged.getContext('2d')!;
    mctx.drawImage(canvas, 0, 0);
    mctx.drawImage(overlay, 0, 0);

    // 创建裁剪后的画布
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = Math.round(cropRect.w);
    croppedCanvas.height = Math.round(cropRect.h);
    const cctx = croppedCanvas.getContext('2d')!;
    cctx.drawImage(
      merged,
      Math.round(cropRect.x), Math.round(cropRect.y),
      Math.round(cropRect.w), Math.round(cropRect.h),
      0, 0,
      Math.round(cropRect.w), Math.round(cropRect.h)
    );

    // 直接保存裁剪结果
    onSave(croppedCanvas.toDataURL('image/png'));
  };

  // 进入裁剪模式时绘制初始遮罩
  useEffect(() => {
    if (cropMode) {
      drawCropOverlay(null);
    }
  }, [cropMode, drawCropOverlay]);

  // ── 保存 ──
  const handleSave = () => {
    // 先提交未完成的文字
    if (pendingText && pendingValue.trim()) {
      const overlay = overlayRef.current;
      const ctx = overlay.getContext('2d')!;
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillStyle = color;
      ctx.fillText(pendingValue, pendingText.x, pendingText.y);
    }

    // 合并 base canvas + overlay
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    const merged = document.createElement('canvas');
    merged.width = canvas.width;
    merged.height = canvas.height;
    const mctx = merged.getContext('2d')!;
    mctx.drawImage(canvas, 0, 0);
    mctx.drawImage(overlay, 0, 0);

    // 如果有旋转，计算旋转后的包围盒并生成新画布
    if (rotation % 360 !== 0) {
      const rad = (rotation * Math.PI) / 180;
      const w = merged.width;
      const h = merged.height;

      // 计算旋转后的包围盒尺寸
      const absCos = Math.abs(Math.cos(rad));
      const absSin = Math.abs(Math.sin(rad));
      const newW = Math.ceil(w * absCos + h * absSin);
      const newH = Math.ceil(w * absSin + h * absCos);

      const rotatedCanvas = document.createElement('canvas');
      rotatedCanvas.width = newW;
      rotatedCanvas.height = newH;
      const rctx = rotatedCanvas.getContext('2d')!;

      // 将坐标原点移到新画布中心，旋转后绘制原图
      rctx.translate(newW / 2, newH / 2);
      rctx.rotate(rad);
      rctx.drawImage(merged, -w / 2, -h / 2);

      onSave(rotatedCanvas.toDataURL('image/png'));
    } else {
      onSave(merged.toDataURL('image/png'));
    }
  };

  // overlay 的 cursor
  const cursorStyle = cropMode ? 'crosshair' : tool === 'pen' ? 'crosshair' : 'text';

  // pending text 输入框在 overlay 上的位置（需要转换回 CSS 像素）
  const overlayRect = overlayRef.current?.getBoundingClientRect();
  const overlayW = overlayRef.current?.width || 1;
  const overlayH = overlayRef.current?.height || 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-runway-surface border border-runway-border rounded-xl flex flex-col shadow-2xl max-w-[95vw] max-h-[95vh]">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-runway-border flex-shrink-0">
          <span className="text-sm font-semibold text-white truncate max-w-xs">{label || '图片编辑'}</span>
          <button onClick={onClose} className="text-runway-slate hover:text-white transition-colors ml-4">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 工具栏 */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-b border-runway-border flex-shrink-0 flex-wrap">
          {/* 工具切换 */}
          <div className="flex gap-1 bg-runway-black rounded-md p-0.5">
            <button
              onClick={() => { setTool('pen'); exitCropMode(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${tool === 'pen' && !cropMode ? 'bg-white text-black' : 'text-runway-slate hover:text-white'}`}
            >
              <Pen className="w-3.5 h-3.5" />画笔
            </button>
            <button
              onClick={() => { setTool('text'); exitCropMode(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${tool === 'text' && !cropMode ? 'bg-white text-black' : 'text-runway-slate hover:text-white'}`}
            >
              <Type className="w-3.5 h-3.5" />文字
            </button>
            <button
              onClick={() => { setTool('crop'); enterCropMode(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${cropMode ? 'bg-white text-black' : 'text-runway-slate hover:text-white'}`}
            >
              <Crop className="w-3.5 h-3.5" />裁剪
            </button>
          </div>

          {/* 颜色选择 */}
          <div className="flex items-center gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-5 h-5 rounded-full border-2 transition-transform ${color === c ? 'border-white scale-125' : 'border-transparent hover:scale-110'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* 笔刷大小 / 字号 */}
          <div className="flex items-center gap-1.5 ml-1">
            <span className="text-xs text-runway-slate">{tool === 'pen' ? '笔刷' : '字号'}</span>
            <button
              onClick={() => tool === 'pen' ? setBrushSize(s => Math.max(1, s - 2)) : setFontSize(s => Math.max(10, s - 4))}
              className="w-6 h-6 flex items-center justify-center border border-runway-border rounded text-runway-slate hover:text-white transition-colors"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-xs text-white w-6 text-center">{tool === 'pen' ? brushSize : fontSize}</span>
            <button
              onClick={() => tool === 'pen' ? setBrushSize(s => Math.min(40, s + 2)) : setFontSize(s => Math.min(72, s + 4))}
              className="w-6 h-6 flex items-center justify-center border border-runway-border rounded text-runway-slate hover:text-white transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* 旋转控制 */}
          <div className="flex items-center gap-1.5 ml-1 border-l border-runway-border pl-3">
            <span className="text-xs text-runway-slate">旋转</span>
            <button
              onClick={() => setRotation(r => r - 90)}
              className="w-6 h-6 flex items-center justify-center border border-runway-border rounded text-runway-slate hover:text-white transition-colors"
              title="逆时针旋转90°"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
            <button
              onClick={() => setRotation(r => r - 5)}
              className="w-6 h-6 flex items-center justify-center border border-runway-border rounded text-runway-slate hover:text-white transition-colors"
              title="逆时针旋转5°"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-xs text-white w-10 text-center">{displayRotation}°</span>
            <button
              onClick={() => setRotation(r => r + 5)}
              className="w-6 h-6 flex items-center justify-center border border-runway-border rounded text-runway-slate hover:text-white transition-colors"
              title="顺时针旋转5°"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              onClick={() => setRotation(r => r + 90)}
              className="w-6 h-6 flex items-center justify-center border border-runway-border rounded text-runway-slate hover:text-white transition-colors"
              title="顺时针旋转90°"
            >
              <RotateCw className="w-3 h-3" />
            </button>
            <button
              onClick={() => setRotation(0)}
              className="px-2 py-1 border border-runway-border text-runway-slate text-xs rounded hover:text-white transition-colors"
              title="重置旋转"
            >
              重置
            </button>
          </div>

          <div className="flex-1" />

          {/* 撤销 / 清除 */}
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-runway-border text-runway-slate text-xs rounded-md hover:text-white hover:border-runway-charcoal transition-colors disabled:opacity-30"
          >
            <RotateCcw className="w-3.5 h-3.5" />撤销
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-runway-border text-runway-slate text-xs rounded-md hover:text-red-400 hover:border-red-400/50 transition-colors"
          >
            <ImageIcon className="w-3.5 h-3.5" />恢复原图
          </button>
        </div>

        {/* 画布区域 */}
        <div
          ref={containerRef}
          className="relative flex-1 overflow-auto flex items-center justify-center p-4 bg-runway-black min-h-0"
          style={{ minWidth: 400 }}
        >
          <div style={{ transform: `rotate(${rotation}deg)`, transition: 'transform 0.2s ease', position: 'relative' }}>
            {/* 底层：原图 */}
            <canvas ref={canvasRef} className="absolute pointer-events-none" style={{ maxWidth: '100%', maxHeight: '100%' }} />
            {/* 中层：绘制层 */}
            <canvas
              ref={overlayRef}
              style={{ cursor: cropMode ? 'default' : cursorStyle, maxWidth: '100%', maxHeight: '100%', position: 'relative', pointerEvents: cropMode ? 'none' : 'auto' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={handleCanvasClick}
            />
            {/* 顶层：裁剪遮罩层（仅裁剪模式下可交互） */}
            <canvas
              ref={cropCanvasRef}
              style={{
                cursor: 'crosshair',
                maxWidth: '100%',
                maxHeight: '100%',
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: cropMode ? 'auto' : 'none',
                display: cropMode ? 'block' : 'none',
              }}
              onMouseDown={handleCropMouseDown}
              onMouseMove={handleCropMouseMove}
              onMouseUp={handleCropMouseUp}
              onMouseLeave={handleCropMouseUp}
            />
          </div>

          {/* 裁剪模式操作提示 */}
          {cropMode && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-runway-surface/95 border border-runway-border rounded-lg px-4 py-2.5 shadow-xl backdrop-blur-sm">
              {cropRect && cropRect.w > 5 && cropRect.h > 5 ? (
                <>
                  <span className="text-xs text-runway-slate">
                    选区：{Math.round(cropRect.w)} × {Math.round(cropRect.h)} px
                  </span>
                  <button
                    onClick={handleCropConfirm}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black text-xs font-medium rounded-md hover:bg-runway-cloud transition-colors"
                  >
                    <Crop className="w-3.5 h-3.5" />确认裁剪并保存
                  </button>
                  <button
                    onClick={exitCropMode}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-runway-border text-runway-slate text-xs rounded-md hover:text-white hover:border-runway-charcoal transition-colors"
                  >
                    取消
                  </button>
                </>
              ) : (
                <>
                  <span className="text-xs text-runway-slate">拖拽鼠标框选要保留的区域</span>
                  <button
                    onClick={exitCropMode}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-runway-border text-runway-slate text-xs rounded-md hover:text-white hover:border-runway-charcoal transition-colors"
                  >
                    取消裁剪
                  </button>
                </>
              )}
            </div>
          )}

          {/* 文字输入框（浮动在 overlay 上） */}
          {pendingText && overlayRect && (
            <input
              autoFocus
              value={pendingValue}
              onChange={(e) => setPendingValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitPendingText();
                if (e.key === 'Escape') { setPendingText(null); setPendingValue(''); }
              }}
              onBlur={commitPendingText}
              style={{
                position: 'absolute',
                left: overlayRect.left - (containerRef.current?.getBoundingClientRect().left ?? 0) + (pendingText.x / overlayW) * overlayRect.width,
                top: overlayRect.top - (containerRef.current?.getBoundingClientRect().top ?? 0) + (pendingText.y / overlayH) * overlayRect.height,
                fontSize: `${fontSize * (overlayRect.width / overlayW)}px`,
                color,
                background: 'transparent',
                border: 'none',
                outline: '1px dashed rgba(255,255,255,0.5)',
                minWidth: 80,
                caretColor: color,
              }}
              className="text-input-overlay"
            />
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex gap-3 px-5 py-3 border-t border-runway-border flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 border border-runway-border text-runway-slate text-sm rounded-md hover:text-white hover:border-runway-charcoal transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-runway-cloud transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />保存并覆盖
          </button>
        </div>
      </div>
    </div>
  );
}
