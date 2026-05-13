import { MessageSquare, FileText, Image, Film, Check } from 'lucide-react';
import type { ProjectPhase } from '../types';

const phases: { key: ProjectPhase; label: string; icon: React.ReactNode }[] = [
  { key: 'chat', label: 'AI 对话', icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { key: 'storyboard', label: '分镜脚本', icon: <FileText className="w-3.5 h-3.5" /> },
  { key: 'images', label: '图片准备', icon: <Image className="w-3.5 h-3.5" /> },
  { key: 'video', label: '视频生成', icon: <Film className="w-3.5 h-3.5" /> },
  { key: 'done', label: '完成', icon: <Check className="w-3.5 h-3.5" /> },
];

const phaseOrder: ProjectPhase[] = ['chat', 'storyboard', 'images', 'video', 'done'];

interface PhaseIndicatorProps {
  currentPhase: ProjectPhase;
  onPhaseClick?: (phase: ProjectPhase) => void;
}

export default function PhaseIndicator({ currentPhase, onPhaseClick }: PhaseIndicatorProps) {
  const currentIndex = phaseOrder.indexOf(currentPhase);

  return (
    <div className="bg-runway-black border-b border-runway-border px-6 py-3">
      <div className="flex items-center gap-1.5 max-w-3xl mx-auto">
        {phases.map((p, i) => {
          const isActive = p.key === currentPhase;
          const isDone = i < currentIndex;
          const canClick = isDone && onPhaseClick;

          return (
            <div key={p.key} className="flex items-center gap-1.5">
              {i > 0 && (
                <div
                  className={`w-6 h-px ${isDone ? 'bg-white/40' : 'bg-runway-border'}`}
                />
              )}
              <button
                type="button"
                disabled={!canClick}
                onClick={() => canClick && onPhaseClick(p.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sharp text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-white text-black'
                    : isDone
                    ? 'bg-runway-surface text-white border border-runway-border hover:bg-runway-charcoal cursor-pointer'
                    : 'text-runway-slate cursor-default'
                }`}
              >
                {p.icon}
                <span className="tracking-label uppercase">{p.label}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
