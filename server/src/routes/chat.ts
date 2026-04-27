import { Router, Request, Response } from 'express';
import { deepseekChat } from '../services/deepseek';

export const chatRouter = Router();

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
}

// 系统提示词 - 引导用户完成分镜脚本创作
const SYSTEM_PROMPT = `你是一个专业的AI视频分镜脚本创作助手。你的任务是通过与用户的多轮对话，帮助他们完成一个完整的分镜脚本。

你需要引导用户明确以下信息：
1. 视频的主题和风格（如：广告、短片、MV、教程等）
2. 目标受众
3. 视频时长
4. 每个分镜的具体内容，包括：
   - 场景描述（画面内容）
   - 镜头类型（远景、中景、近景、特写等）
   - 画面风格（写实、动漫、水墨等）
   - 运镜方式（固定、推拉、摇移等）
   - 预估时长
   - 配文/旁白（如有）

在对话过程中：
- 主动提问，帮助用户细化需求
- 给出专业建议和创意灵感
- 当信息足够时，生成结构化的分镜脚本

当用户确认分镜脚本完成后，请用以下JSON格式输出最终脚本（用 \`\`\`storyboard 和 \`\`\` 包裹）：

\`\`\`storyboard
{
  "title": "视频标题",
  "style": "整体风格",
  "duration": "预估总时长",
  "scenes": [
    {
      "id": 1,
      "description": "场景描述",
      "cameraType": "镜头类型",
      "visualStyle": "画面风格",
      "cameraMovement": "运镜方式",
      "duration": "时长(秒)",
      "narration": "旁白/配文",
      "imagePrompt": "用于生成图片的英文提示词"
    }
  ]
}
\`\`\`
`;

// POST /api/chat - 与DeepSeek对话
chatRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { messages } = req.body as ChatRequest;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: '请提供有效的消息列表' });
      return;
    }

    // 在消息列表前添加系统提示词
    const fullMessages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ];

    const reply = await deepseekChat(fullMessages);

    res.json({
      message: reply,
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: '对话服务出错',
      detail: error.message,
    });
  }
});
