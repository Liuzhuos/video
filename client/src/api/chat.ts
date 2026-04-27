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
