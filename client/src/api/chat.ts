import { authFetch } from './request';
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

  const response = await authFetch('/api/chat', {
    method: 'POST',
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
 */
export async function polishPrompt(
  imageUrls: string[],
  videoUrls: string[],
  currentPrompt: string,
  mode: 'image' | 'video' = 'video'
): Promise<string> {
  const response = await authFetch('/api/chat/polish-prompt', {
    method: 'POST',
    body: JSON.stringify({ imageUrls, videoUrls, currentPrompt, mode }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || error.error || '润色失败');
  }

  const data = await response.json();
  return data.prompt;
}
