// 聊天消息
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// 分镜场景
export interface Scene {
  id: number;
  description: string;
  cameraType: string;
  visualStyle: string;
  cameraMovement: string;
  duration: string;
  narration: string;
  imagePrompt: string;
  // 用户上传或生成的图片
  imageUrl?: string;
  // 生成的视频
  videoUrl?: string;
}

// 分镜脚本
export interface Storyboard {
  title: string;
  style: string;
  duration: string;
  scenes: Scene[];
}

// 项目状态
export type ProjectPhase = 'chat' | 'storyboard' | 'images' | 'video' | 'done';

// 项目
export interface Project {
  id?: string;
  phase: ProjectPhase;
  chatMessages: ChatMessage[];
  storyboard: Storyboard | null;
}
