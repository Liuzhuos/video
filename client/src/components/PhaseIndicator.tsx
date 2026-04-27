import { MessageSquare, FileText, Image, Film, Check } from 'lucide-react';
import type { ProjectPhase } from '../types';

const phases: { key: ProjectPhase; label: string; icon: React.ReactNode }[] = [
  { key: 'chat', label: 'AI 对话', icon: <MessageSquare className="w-4 h-4" /> },
  { key: 'storyboard', label: '分镜脚本', icon: <FileText className="w-4 h-4" /> },
  { key: 'images', label: '图片准备', icon: <Image className="w-4 h-4" /> },
  { key: 'video', label: '视频生成', icon: <Film className="w-4 h-4" /> },
  { key: 'done', label: '完成', icon: <Check className="w-4 h-4" /> },
];

const phaseOrder: ProjectPhase[] = ['chat', 'storyboard', 'images', 'video', 'done'];

interface PhaseIndicatorProps {
  currentPhase: ProjectPhase;
  onPhaseClick?: (phase: ProjectPhase) => void;
}

export default function PhaseIndicator({ currentPhase, onPhaseClick }: PhaseIndicatorProps) {
  const currentIndex = phaseOrder.indexOf(currentPhase);

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center gap-2 max-w-3xl mx-auto">
        {phases.map((p, i) => {
          const isActive = p.key === currentPhase;
          const isDone = i < currentIndex;
          // 只能点击已完成的阶段（回退）
          const canClick = isDone && onPhaseClick;

          return (
            <div key={p.key} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`w-8 h-px ${isDone ? 'bg-blue-400' : 'bg-gray-200'}`}
                />
              )}
              <button
                type="button"
                disabled={!canClick}
                onClick={() => canClick && onPhaseClick(p.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-100 text-blue-700'
                    : isDone
                    ? 'bg-green-50 text-green-600 hover:bg-green-100 cursor-pointer'
                    : 'bg-gray-100 text-gray-400 cursor-default'
                } ${canClick ? '' : 'cursor-default'}`}
              >
                {p.icon}
                <span>{p.label}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
