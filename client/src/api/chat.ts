import type { ChatMessage } from '../types';

interface ChatApiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function sendMessage(messages: ChatMessage[]): Promise<string> {
  const apiMessages: ChatApiMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: apiMessages }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || error.error || '请求失败');
  }

  const data = await response.json();
  return data.message;
}

/**
 * 调用百炼视觉模型或 DeepSeek 润色提示词
 * @param imageUrls 图片 URL 列表（可选）
 * @param videoUrls 视频 URL 列表（可选）
 * @param currentPrompt 当前提示词
 * @param mode 模式：'image' 图片生成润色 | 'video' 视频生成润色
 */
export async function polishPrompt(
  imageUrls: string[],
  videoUrls: string[],
  currentPrompt: string,
  mode: 'image' | 'video' = 'video'
): Promise<string> {
  const response = await fetch('/api/chat/polish-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrls, videoUrls, currentPrompt, mode }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || error.error || '润色失败');
  }

  const data = await response.json();
  return data.prompt;
}
