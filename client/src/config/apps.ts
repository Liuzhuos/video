import { Film, Image, Music, FileText, Bot, Wand2, Clapperboard } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface AppConfig {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  path: string;
  available: boolean;
}

export const APP_LIST: AppConfig[] = [
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
  {
    id: 'image-edit',
    name: '图片编辑',
    description: '智能图片编辑工具，支持抠图、修复、风格迁移等多种操作。',
    icon: Wand2,
    path: '/apps/image-edit',
    available: false,
  },
];
