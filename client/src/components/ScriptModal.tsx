/**
 * ScriptModal — 分镜脚本弹窗
 * 以表格形式展示和编辑每段时间的分镜描述
 */
import { useState } from 'react';
import { X, Plus, Trash2, FileText } from 'lucide-react';

export interface ScriptScene {
  id: string;
  timeStart: string;
  timeEnd: string;
  description: string;
  camera: string;
  action: string;
  audio: string;
}

interface ScriptModalProps {
  scenes: ScriptScene[];
  onScenesChange: (scenes: ScriptScene[]) => void;
  onClose: () => void;
}

function createEmptyScene(): ScriptScene {
  return {
    id: `scene_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timeStart: '',
    timeEnd: '',
    description: '',
    camera: '',
    action: '',
    audio: '',
  };
}

export default function ScriptModal({ scenes, onScenesChange, onClose }: ScriptModalProps) {
  const [localScenes, setLocalScenes] = useState<ScriptScene[]>(
    scenes.length > 0 ? scenes : [createEmptyScene()]
  );

  const updateScene = (id: string, field: keyof ScriptScene, value: string) => {
    setLocalScenes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const addScene = () => {
    setLocalScenes((prev) => [...prev, createEmptyScene()]);
  };

  const removeScene = (id: string) => {
    setLocalScenes((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSave = () => {
    onScenesChange(localScenes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-runway-surface border border-runway-border rounded-xl w-[900px] max-w-[95vw] max-h-[85vh] flex flex-col shadow-2xl">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-runway-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-runway-slate" />
            <span className="text-sm font-semibold text-white">分镜脚本</span>
            <span className="text-xs text-runway-mid-slate">（{localScenes.length} 个镜头）</span>
          </div>
          <button onClick={onClose} className="text-runway-slate hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 表格内容 */}
        <div className="flex-1 overflow-auto p-4 min-h-0">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-runway-slate">
                <th className="text-left py-2 px-2 border-b border-runway-border w-8">#</th>
                <th className="text-left py-2 px-2 border-b border-runway-border w-20">起始</th>
                <th className="text-left py-2 px-2 border-b border-runway-border w-20">结束</th>
                <th className="text-left py-2 px-2 border-b border-runway-border">画面描述</th>
                <th className="text-left py-2 px-2 border-b border-runway-border w-28">镜头运动</th>
                <th className="text-left py-2 px-2 border-b border-runway-border w-28">动作</th>
                <th className="text-left py-2 px-2 border-b border-runway-border w-28">音效/配乐</th>
                <th className="text-left py-2 px-2 border-b border-runway-border w-8"></th>
              </tr>
            </thead>
            <tbody>
              {localScenes.map((scene, idx) => (
                <tr key={scene.id} className="group hover:bg-runway-deep/50">
                  <td className="py-2 px-2 border-b border-runway-border text-runway-mid-slate align-middle text-center">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-1 border-b border-runway-border align-middle text-center">
                    <input
                      type="text"
                      value={scene.timeStart}
                      onChange={(e) => updateScene(scene.id, 'timeStart', e.target.value)}
                      placeholder="0s"
                      className="w-full bg-runway-black border border-runway-border rounded px-2 py-2.5 text-white text-xs text-center focus:outline-none focus:border-runway-charcoal"
                    />
                  </td>
                  <td className="py-2 px-1 border-b border-runway-border align-middle text-center">
                    <input
                      type="text"
                      value={scene.timeEnd}
                      onChange={(e) => updateScene(scene.id, 'timeEnd', e.target.value)}
                      placeholder="5s"
                      className="w-full bg-runway-black border border-runway-border rounded px-2 py-2.5 text-white text-xs text-center focus:outline-none focus:border-runway-charcoal"
                    />
                  </td>
                  <td className="py-2 px-1 border-b border-runway-border align-top">
                    <textarea
                      value={scene.description}
                      onChange={(e) => updateScene(scene.id, 'description', e.target.value)}
                      placeholder="描述这个镜头的画面内容..."
                      rows={4}
                      className="w-full bg-runway-black border border-runway-border rounded px-2 py-2.5 text-white text-xs focus:outline-none focus:border-runway-charcoal resize-vertical leading-relaxed"
                    />
                  </td>
                  <td className="py-2 px-1 border-b border-runway-border align-top">
                    <textarea
                      value={scene.camera}
                      onChange={(e) => updateScene(scene.id, 'camera', e.target.value)}
                      placeholder="推/拉/摇..."
                      rows={5}
                      className="w-full bg-runway-black border border-runway-border rounded px-2 py-2.5 text-white text-xs focus:outline-none focus:border-runway-charcoal resize-none"
                    />
                  </td>
                  <td className="py-2 px-1 border-b border-runway-border align-top">
                    <textarea
                      value={scene.action}
                      onChange={(e) => updateScene(scene.id, 'action', e.target.value)}
                      placeholder="人物动作..."
                      rows={5}
                      className="w-full bg-runway-black border border-runway-border rounded px-2 py-2.5 text-white text-xs focus:outline-none focus:border-runway-charcoal resize-none"
                    />
                  </td>
                  <td className="py-2 px-1 border-b border-runway-border align-top">
                    <textarea
                      value={scene.audio}
                      onChange={(e) => updateScene(scene.id, 'audio', e.target.value)}
                      placeholder="音效..."
                      rows={5}
                      className="w-full bg-runway-black border border-runway-border rounded px-2 py-2.5 text-white text-xs focus:outline-none focus:border-runway-charcoal resize-none"
                    />
                  </td>
                  <td className="py-2 px-1 border-b border-runway-border align-middle text-center">
                    <button
                      onClick={() => removeScene(scene.id)}
                      disabled={localScenes.length <= 1}
                      className="p-1 text-runway-mid-slate hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 添加行按钮 */}
          <button
            onClick={addScene}
            className="mt-3 flex items-center gap-1.5 px-3 py-2 text-xs text-runway-slate border border-dashed border-runway-border rounded-md hover:text-white hover:border-runway-charcoal transition-colors"
          >
            <Plus className="w-3 h-3" />添加镜头
          </button>
        </div>

        {/* 底部按钮 */}
        <div className="flex gap-3 px-5 py-4 border-t border-runway-border flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 border border-runway-border text-runway-slate text-sm rounded-md hover:text-white hover:border-runway-charcoal transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-runway-cloud transition-colors"
          >
            保存脚本
          </button>
        </div>
      </div>
    </div>
  );
}
