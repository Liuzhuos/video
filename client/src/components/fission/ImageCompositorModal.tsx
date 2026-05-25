import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Upload, Trash2, Layers, Save, Wand2, Image as ImageIcon, GripVertical } from 'lucide-react';

// ── 图层数据结构 ──
interface LayerItem {
  id: string;
  img: HTMLImageElement;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  originalWidth: number;
  originalHeight: number;
}

interface Props {
  onClose: () => void;
  onExport: (dataUrl: string, target: 'img2img' | 'pad') => void;
}

export default function ImageCompositorModal({ onClose, onExport }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [, setResizeCornerIdx] = useState(-1);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showExportMenu, setShowExportMenu] = useState(false);

  // 画布视口（用于平移和缩放画布视图）
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [viewScale, setViewScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // 图层拖拽排序
  const [dragLayerId, setDragLayerId] = useState<string | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const selectedLayer = layers.find((l) => l.id === selectedId) ?? null;

  // ── 计算画布尺寸（自适应容器）──
  const CANVAS_W = 1920;
  const CANVAS_H = 1080;

  // ── 上传图片 ──
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = '';

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const id = `layer_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          // 保持图片原始分辨率大小
          const newLayer: LayerItem = {
            id,
            img,
            x: CANVAS_W / 2,
            y: CANVAS_H / 2,
            width: img.width,
            height: img.height,
            rotation: 0,
            scale: 1,
            originalWidth: img.width,
            originalHeight: img.height,
          };
          setSelectedId(id);
          setLayers((prev) => [...prev, newLayer]);
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // ── 计算所有图层的实际边界（用于导出裁剪）──
  const computeBounds = useCallback(() => {
    if (layers.length === 0) return { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    layers.forEach((layer) => {
      const w = layer.width * layer.scale;
      const h = layer.height * layer.scale;
      const rad = (layer.rotation * Math.PI) / 180;
      // 计算旋转后的四个角
      const corners = [
        [-w / 2, -h / 2], [w / 2, -h / 2],
        [-w / 2, h / 2], [w / 2, h / 2],
      ];
      corners.forEach(([cx, cy]) => {
        const rx = cx * Math.cos(rad) - cy * Math.sin(rad) + layer.x;
        const ry = cx * Math.sin(rad) + cy * Math.cos(rad) + layer.y;
        minX = Math.min(minX, rx);
        minY = Math.min(minY, ry);
        maxX = Math.max(maxX, rx);
        maxY = Math.max(maxY, ry);
      });
    });

    return {
      x: Math.floor(minX),
      y: Math.floor(minY),
      w: Math.ceil(maxX - minX),
      h: Math.ceil(maxY - minY),
    };
  }, [layers]);

  // ── 绘制画布 ──
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const container = containerRef.current;
    if (!container) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, cw, ch);

    // 棋盘格背景填满整个画布区域（表示透明）
    const gridSize = 20;
    for (let gy = 0; gy < ch; gy += gridSize) {
      for (let gx = 0; gx < cw; gx += gridSize) {
        ctx.fillStyle = ((Math.floor(gx / gridSize) + Math.floor(gy / gridSize)) % 2 === 0) ? '#2a2a2a' : '#333';
        ctx.fillRect(gx, gy, gridSize, gridSize);
      }
    }

    ctx.save();
    // 应用视口变换：先平移到中心，再缩放，再偏移
    const offsetX = cw / 2 + viewOffset.x;
    const offsetY = ch / 2 + viewOffset.y;
    ctx.translate(offsetX, offsetY);
    ctx.scale(viewScale, viewScale);
    ctx.translate(-CANVAS_W / 2, -CANVAS_H / 2);

    // 绘制每个图层
    layers.forEach((layer) => {
      ctx.save();
      ctx.translate(layer.x, layer.y);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      const w = layer.width * layer.scale;
      const h = layer.height * layer.scale;
      ctx.drawImage(layer.img, -w / 2, -h / 2, w, h);

      // 选中框
      if (layer.id === selectedId) {
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2 / viewScale;
        ctx.setLineDash([6 / viewScale, 3 / viewScale]);
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.setLineDash([]);

        // 四角缩放控制点
        const handleSize = 8 / viewScale;
        const corners = [
          [-w / 2, -h / 2], [w / 2, -h / 2],
          [-w / 2, h / 2], [w / 2, h / 2],
        ];
        corners.forEach(([cx, cy]) => {
          ctx.fillStyle = '#fff';
          ctx.strokeStyle = '#4ade80';
          ctx.lineWidth = 2 / viewScale;
          ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
          ctx.strokeRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
        });

        // 旋转手柄（顶部中间上方）
        const handleDist = 30 / viewScale;
        ctx.beginPath();
        ctx.moveTo(0, -h / 2);
        ctx.lineTo(0, -h / 2 - handleDist);
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2 / viewScale;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -h / 2 - handleDist - 6 / viewScale, 6 / viewScale, 0, Math.PI * 2);
        ctx.fillStyle = '#4ade80';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5 / viewScale;
        ctx.stroke();
      }
      ctx.restore();
    });

    ctx.restore();
  }, [layers, selectedId, viewOffset, viewScale]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // 窗口 resize 时重绘
  useEffect(() => {
    const handleResize = () => drawCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawCanvas]);

  // ── 坐标转换：屏幕坐标 → 画布坐标 ──
  const screenToCanvas = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const offsetX = rect.width / 2 + viewOffset.x;
    const offsetY = rect.height / 2 + viewOffset.y;
    const cx = (sx - offsetX) / viewScale + CANVAS_W / 2;
    const cy = (sy - offsetY) / viewScale + CANVAS_H / 2;
    return { x: cx, y: cy };
  }, [viewOffset, viewScale]);

  // ── 点击检测 ──
  const hitTest = useCallback((mx: number, my: number): string | null => {
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      const dx = mx - layer.x;
      const dy = my - layer.y;
      const rad = -(layer.rotation * Math.PI) / 180;
      const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
      const hw = (layer.width * layer.scale) / 2;
      const hh = (layer.height * layer.scale) / 2;
      if (Math.abs(rx) <= hw && Math.abs(ry) <= hh) {
        return layer.id;
      }
    }
    return null;
  }, [layers]);

  // 检测旋转手柄
  const hitRotateHandle = useCallback((mx: number, my: number): boolean => {
    if (!selectedLayer) return false;
    const dx = mx - selectedLayer.x;
    const dy = my - selectedLayer.y;
    const rad = -(selectedLayer.rotation * Math.PI) / 180;
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
    const hh = (selectedLayer.height * selectedLayer.scale) / 2;
    const handleDist = 30 / viewScale;
    const handleY = -hh - handleDist - 6 / viewScale;
    return Math.sqrt(rx * rx + (ry - handleY) * (ry - handleY)) < 14 / viewScale;
  }, [selectedLayer, viewScale]);

  // 检测缩放角（返回角索引 0-3，-1 表示未命中）
  const hitResizeCornerIdx = useCallback((mx: number, my: number): number => {
    if (!selectedLayer) return -1;
    const dx = mx - selectedLayer.x;
    const dy = my - selectedLayer.y;
    const rad = -(selectedLayer.rotation * Math.PI) / 180;
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
    const hw = (selectedLayer.width * selectedLayer.scale) / 2;
    const hh = (selectedLayer.height * selectedLayer.scale) / 2;
    const corners = [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]];
    const hitRadius = 12 / viewScale;
    for (let i = 0; i < corners.length; i++) {
      const [cx, cy] = corners[i];
      if (Math.abs(rx - cx) < hitRadius && Math.abs(ry - cy) < hitRadius) return i;
    }
    return -1;
  }, [selectedLayer, viewScale]);

  // ── 鼠标事件 ──
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // 中键平移
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // 空格 + 左键平移（通过 isPanning state 在 keydown 中设置）
    if (isPanning && e.button === 0) {
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    const pos = screenToCanvas(e);

    // 先检测旋转手柄
    if (selectedLayer && hitRotateHandle(pos.x, pos.y)) {
      setIsRotating(true);
      setDragStart(pos);
      return;
    }

    // 检测缩放角
    const cornerIdx = hitResizeCornerIdx(pos.x, pos.y);
    if (selectedLayer && cornerIdx >= 0) {
      setIsResizing(true);
      setResizeCornerIdx(cornerIdx);
      setDragStart(pos);
      return;
    }

    // 检测图层点击
    const hitId = hitTest(pos.x, pos.y);
    if (hitId) {
      setSelectedId(hitId);
      setIsDragging(true);
      setDragStart(pos);
    } else {
      setSelectedId(null);
    }
  }, [screenToCanvas, hitTest, hitRotateHandle, hitResizeCornerIdx, selectedLayer, isPanning]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // 平移画布
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setViewOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    const pos = screenToCanvas(e);

    if (isDragging && selectedId) {
      const dx = pos.x - dragStart.x;
      const dy = pos.y - dragStart.y;
      setLayers((prev) =>
        prev.map((l) => l.id === selectedId ? { ...l, x: l.x + dx, y: l.y + dy } : l)
      );
      setDragStart(pos);
    }

    if (isRotating && selectedLayer) {
      const angle = Math.atan2(pos.y - selectedLayer.y, pos.x - selectedLayer.x);
      const prevAngle = Math.atan2(dragStart.y - selectedLayer.y, dragStart.x - selectedLayer.x);
      const delta = ((angle - prevAngle) * 180) / Math.PI;
      setLayers((prev) =>
        prev.map((l) => l.id === selectedId ? { ...l, rotation: l.rotation + delta } : l)
      );
      setDragStart(pos);
    }

    if (isResizing && selectedLayer) {
      const dist = Math.sqrt(
        (pos.x - selectedLayer.x) ** 2 + (pos.y - selectedLayer.y) ** 2
      );
      const prevDist = Math.sqrt(
        (dragStart.x - selectedLayer.x) ** 2 + (dragStart.y - selectedLayer.y) ** 2
      );
      if (prevDist > 0) {
        const ratio = dist / prevDist;
        setLayers((prev) =>
          prev.map((l) => l.id === selectedId ? { ...l, scale: Math.max(0.05, l.scale * ratio) } : l)
        );
      }
      setDragStart(pos);
    }
  }, [isPanning, panStart, isDragging, isRotating, isResizing, selectedId, selectedLayer, dragStart, screenToCanvas]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsRotating(false);
    setIsResizing(false);
    setResizeCornerIdx(-1);
    if (isPanning) setIsPanning(false);
  }, [isPanning]);

  // 滚轮缩放画布视图
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setViewScale((prev) => Math.max(0.1, Math.min(5, prev * factor)));
  }, []);

  // 键盘事件：Delete 删除图层，空格平移
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedId) {
        setLayers((prev) => prev.filter((l) => l.id !== selectedId));
        setSelectedId(null);
      }
      if (e.key === ' ') {
        e.preventDefault();
        setIsPanning(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedId]);

  // ── 图层操作 ──
  const deleteLayer = useCallback(() => {
    if (!selectedId) return;
    setLayers((prev) => prev.filter((l) => l.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  // ── 图层拖拽排序 ──
  const handleLayerDragStart = useCallback((e: React.DragEvent, layerId: string) => {
    setDragLayerId(layerId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleLayerDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(idx);
  }, []);

  const handleLayerDrop = useCallback((e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (!dragLayerId) return;
    setLayers((prev) => {
      const sourceIdx = prev.findIndex((l) => l.id === dragLayerId);
      if (sourceIdx === -1 || sourceIdx === targetIdx) return prev;
      const next = [...prev];
      const [moved] = next.splice(sourceIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
    setDragLayerId(null);
    setDragOverIdx(null);
  }, [dragLayerId]);

  const handleLayerDragEnd = useCallback(() => {
    setDragLayerId(null);
    setDragOverIdx(null);
  }, []);

  // ── 导出（根据实际图层边界裁剪）──
  const handleExport = useCallback((target: 'img2img' | 'pad') => {
    if (layers.length === 0) return;

    const bounds = computeBounds();
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = bounds.w;
    exportCanvas.height = bounds.h;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // 透明背景（PNG 保留透明）
    ctx.clearRect(0, 0, bounds.w, bounds.h);

    layers.forEach((layer) => {
      ctx.save();
      ctx.translate(layer.x - bounds.x, layer.y - bounds.y);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      const w = layer.width * layer.scale;
      const h = layer.height * layer.scale;
      ctx.drawImage(layer.img, -w / 2, -h / 2, w, h);
      ctx.restore();
    });

    const dataUrl = exportCanvas.toDataURL('image/png');
    onExport(dataUrl, target);
    setShowExportMenu(false);
  }, [layers, computeBounds, onExport]);

  // 适应视图
  const fitView = useCallback(() => {
    if (layers.length === 0) return;
    const container = containerRef.current;
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const scale = Math.min(cw * 0.85 / CANVAS_W, ch * 0.85 / CANVAS_H);
    setViewScale(scale);
    setViewOffset({ x: 0, y: 0 });
  }, [layers]);

  // 初始适应
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const scale = Math.min(cw * 0.85 / CANVAS_W, ch * 0.85 / CANVAS_H);
    setViewScale(scale);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex bg-black/95 backdrop-blur-sm">
      {/* ═══ 左侧：画布操作区（占满剩余空间）═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 flex-shrink-0 bg-[#1e1e1e]">
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">图片融合</h2>
            <span className="text-xs text-white/40">
              {layers.length} 图层 | {Math.round(viewScale * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white rounded-md transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />添加图片
            </button>
            <button
              onClick={fitView}
              className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white rounded-md transition-colors"
            >
              适应视图
            </button>
            <div className="w-px h-5 bg-white/10 mx-1" />
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={layers.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-black rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save className="w-3.5 h-3.5" />导出
              </button>
              {showExportMenu && (
                <div className="absolute top-full right-0 mt-1 bg-[#2a2a2a] border border-white/10 rounded-lg shadow-2xl overflow-hidden min-w-[160px] z-10">
                  <button
                    onClick={() => handleExport('img2img')}
                    className="w-full px-4 py-2.5 text-xs text-white hover:bg-white/10 transition-colors text-left flex items-center gap-2"
                  >
                    <Wand2 className="w-3.5 h-3.5" />用作图生图源图
                  </button>
                  <button
                    onClick={() => handleExport('pad')}
                    className="w-full px-4 py-2.5 text-xs text-white hover:bg-white/10 transition-colors text-left flex items-center gap-2"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />用作垫图
                  </button>
                </div>
              )}
            </div>
            <div className="w-px h-5 bg-white/10 mx-1" />
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* 画布区域 */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden relative"
          style={{ cursor: isPanning ? 'grabbing' : 'default' }}
          onWheel={handleWheel}
        >
          {layers.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/20 rounded-2xl p-16 flex flex-col items-center gap-4 cursor-pointer hover:border-emerald-400/50 hover:bg-white/[0.02] transition-all"
              >
                <Upload className="w-14 h-14 text-white/30" />
                <p className="text-sm text-white/50">点击上传图片开始融合</p>
                <p className="text-xs text-white/30">支持多张图片叠加，导出时自动裁剪到实际内容边界</p>
              </div>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onContextMenu={(e) => e.preventDefault()}
            />
          )}

          {/* 底部状态栏 */}
          {layers.length > 0 && selectedLayer && (
            <div className="absolute bottom-3 left-3 flex items-center gap-3 px-3 py-1.5 bg-black/70 backdrop-blur-sm rounded-lg border border-white/10 text-xs text-white/60">
              <span>位置: ({Math.round(selectedLayer.x)}, {Math.round(selectedLayer.y)})</span>
              <span>尺寸: {Math.round(selectedLayer.width * selectedLayer.scale)}×{Math.round(selectedLayer.height * selectedLayer.scale)}</span>
              <span>旋转: {Math.round(selectedLayer.rotation)}°</span>
              <span>缩放: {Math.round(selectedLayer.scale * 100)}%</span>
            </div>
          )}

          {/* 提示 */}
          {layers.length > 0 && (
            <div className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/70 backdrop-blur-sm rounded-lg border border-white/10 text-[10px] text-white/40">
              滚轮缩放 | 空格+拖拽平移 | Delete删除
            </div>
          )}
        </div>
      </div>

      {/* ═══ 右侧：图层面板 ═══ */}
      <div className="w-64 flex flex-col border-l border-white/10 bg-[#1e1e1e]">
        {/* 图层面板标题 */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-white/60" />
            <span className="text-xs font-medium text-white">图层</span>
            <span className="text-[10px] text-white/40 ml-1">{layers.length}</span>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 text-[10px] bg-white/10 hover:bg-white/20 text-white rounded transition-colors"
          >
            <Upload className="w-3 h-3" />添加
          </button>
        </div>

        {/* 图层列表（从上到下 = 从顶层到底层，可拖拽排序）*/}
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
          {layers.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <ImageIcon className="w-10 h-10 text-white/15 mb-3" />
              <p className="text-xs text-white/30">暂无图层</p>
              <p className="text-[10px] text-white/20 mt-1">上传图片后自动创建图层</p>
            </div>
          ) : (
            [...layers].reverse().map((layer, revIdx) => {
              const actualIdx = layers.length - 1 - revIdx;
              const isSelected = selectedId === layer.id;
              const isDragOver = dragOverIdx === actualIdx;
              return (
                <div
                  key={layer.id}
                  draggable
                  onDragStart={(e) => handleLayerDragStart(e, layer.id)}
                  onDragOver={(e) => handleLayerDragOver(e, actualIdx)}
                  onDrop={(e) => handleLayerDrop(e, actualIdx)}
                  onDragEnd={handleLayerDragEnd}
                  onClick={() => setSelectedId(layer.id)}
                  className={`
                    flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all group
                    ${isSelected
                      ? 'bg-emerald-500/15 border border-emerald-500/40'
                      : 'hover:bg-white/5 border border-transparent'
                    }
                    ${isDragOver ? 'border-t-2 border-t-emerald-400' : ''}
                  `}
                >
                  {/* 拖拽手柄 */}
                  <GripVertical className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 cursor-grab flex-shrink-0" />

                  {/* 缩略图 */}
                  <div className="w-10 h-10 rounded-md overflow-hidden border border-white/10 flex-shrink-0 bg-[#333]">
                    <img
                      src={layer.img.src}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* 图层信息 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">图层 {actualIdx + 1}</p>
                    <p className="text-[10px] text-white/40">
                      {Math.round(layer.width * layer.scale)}×{Math.round(layer.height * layer.scale)}
                    </p>
                  </div>

                  {/* 删除按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setLayers((prev) => prev.filter((l) => l.id !== layer.id));
                      if (selectedId === layer.id) setSelectedId(null);
                    }}
                    className="w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/30 transition-all"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* 选中图层属性 */}
        {selectedLayer && (
          <div className="border-t border-white/10 p-3 flex flex-col gap-2">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">属性</span>
            <div className="grid grid-cols-2 gap-1.5 text-[10px] text-white/60">
              <span>X: {Math.round(selectedLayer.x)}</span>
              <span>Y: {Math.round(selectedLayer.y)}</span>
              <span>W: {Math.round(selectedLayer.width * selectedLayer.scale)}</span>
              <span>H: {Math.round(selectedLayer.height * selectedLayer.scale)}</span>
              <span>旋转: {Math.round(selectedLayer.rotation)}°</span>
              <span>缩放: {Math.round(selectedLayer.scale * 100)}%</span>
            </div>
            <button
              onClick={deleteLayer}
              className="mt-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs bg-red-500/15 hover:bg-red-500/30 text-red-400 rounded-md transition-colors"
            >
              <Trash2 className="w-3 h-3" />删除选中图层
            </button>
          </div>
        )}
      </div>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
}
