import { useNavigate } from 'react-router-dom';
import { MessageSquarePlus, Film, Image, Sparkles } from 'lucide-react';

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      {/* Hero */}
      <div className="text-center mb-16">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          用 AI 创作你的视频
        </h2>
        <p className="text-lg text-gray-500 mb-8 max-w-2xl mx-auto">
          通过与 AI 对话确定分镜脚本，自动生成图片和视频。从创意到成片，一站式完成。
        </p>
        <button
          onClick={() => navigate('/project')}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
        >
          <Sparkles className="w-5 h-5" />
          开始创作
        </button>
      </div>

      {/* 流程说明 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StepCard
          icon={<MessageSquarePlus className="w-8 h-8 text-blue-600" />}
          step="1"
          title="AI 对话"
          description="与 AI 助手沟通你的创意，通过多轮对话完善分镜脚本"
        />
        <StepCard
          icon={<Image className="w-8 h-8 text-green-600" />}
          step="2"
          title="生成图片"
          description="上传参考图或使用 AI 文生图，为每个分镜准备垫图"
        />
        <StepCard
          icon={<Film className="w-8 h-8 text-purple-600" />}
          step="3"
          title="生成视频"
          description="确认所有分镜图片后，一键生成完整视频"
        />
      </div>
    </div>
  );
}

function StepCard({
  icon,
  step,
  title,
  description,
}: {
  icon: React.ReactNode;
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <span className="text-sm font-medium text-gray-400">步骤 {step}</span>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
