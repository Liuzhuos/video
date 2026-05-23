import { useNavigate } from 'react-router-dom';
import { Film, Image, Music, FileText, Bot, Clapperboard } from 'lucide-react';

const apps = [
  {
    id: 'storyboard',
    name: '分镜生成',
    description: '通过 AI 对话生成分镜脚本，自动生成图片和视频，从创意到成片一站式完成。',
    icon: Film,
    path: '/apps/storyboard',
    available: true,
  },
  {
    id: 'video-fission',
    name: '视频裂变',
    description: '上传视频截取关键帧或AI生图作为垫图，结合提示词生成全新视频内容。',
    icon: Clapperboard,
    path: '/apps/video-fission',
    available: true,
  },
  {
    id: 'text-to-image',
    name: '文生图',
    description: '输入文字描述，AI 为你生成高质量图片，支持多种风格。',
    icon: Image,
    path: '/apps/text-to-image',
    available: false,
  },
  {
    id: 'text-to-music',
    name: '文生音乐',
    description: '用文字描述你想要的音乐风格，AI 自动生成配乐。',
    icon: Music,
    path: '/apps/text-to-music',
    available: false,
  },
  {
    id: 'copywriting',
    name: '文案生成',
    description: '智能生成营销文案、产品描述、社交媒体内容等。',
    icon: FileText,
    path: '/apps/copywriting',
    available: false,
  },
  {
    id: 'ai-assistant',
    name: 'AI 助手',
    description: '多功能 AI 助手，帮你处理日常工作中的各种任务。',
    icon: Bot,
    path: '/apps/ai-assistant',
    available: false,
  },
];

export default function AppsPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-white mb-2">应用中心</h2>
        <p className="text-runway-slate text-sm">探索 AI 驱动的创作工具</p>
      </div>

      {/* 应用网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {apps.map((app) => {
          const Icon = app.icon;
          return (
            <div
              key={app.id}
              onClick={() => app.available && navigate(app.path)}
              className={`bg-runway-surface border border-runway-border rounded-lg p-6 transition-all ${
                app.available
                  ? 'cursor-pointer hover:border-runway-charcoal hover:shadow-lg hover:-translate-y-0.5'
                  : 'opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  app.available ? 'bg-white/10' : 'bg-white/5'
                }`}>
                  <Icon className={`w-5 h-5 ${app.available ? 'text-white' : 'text-runway-mid-slate'}`} />
                </div>
                {!app.available && (
                  <span className="text-xs text-runway-mid-slate bg-runway-border/50 px-2 py-0.5 rounded">
                    即将上线
                  </span>
                )}
              </div>
              <h3 className={`font-medium mb-2 ${app.available ? 'text-white' : 'text-runway-slate'}`}>
                {app.name}
              </h3>
              <p className="text-sm text-runway-mid-slate leading-relaxed">
                {app.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
