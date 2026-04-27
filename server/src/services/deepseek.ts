import OpenAI from 'openai';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function getClient(): OpenAI {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY 未配置，请在 .env 文件中设置');
  }

  return new OpenAI({ apiKey, baseURL });
}

/**
 * 调用 DeepSeek 进行对话
 */
export async function deepseekChat(messages: ChatMessage[]): Promise<string> {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages,
    temperature: 0.7,
    max_tokens: 4096,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('DeepSeek 返回了空响应');
  }

  return content;
}
