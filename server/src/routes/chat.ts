import { Router, Request, Response } from 'express';
import { deepseekChat } from '../services/deepseek';
import { polishPromptWithVision } from '../services/dashscope';

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

// POST /api/chat/polish-prompt - 使用百炼视觉模型或 DeepSeek 润色提示词
chatRouter.post('/polish-prompt', async (req: Request, res: Response) => {
  try {
    const { imageUrls, videoUrls, currentPrompt, mode } = req.body;

    const hasMedia = (imageUrls && imageUrls.length > 0) || (videoUrls && videoUrls.length > 0);

    if (!hasMedia && !currentPrompt?.trim()) {
      res.status(400).json({ error: '请提供提示词或至少一张图片/视频' });
      return;
    }

    let polished: string;

    if (hasMedia) {
      // 有图片/视频时，使用百炼视觉模型
      polished = await polishPromptWithVision(
        imageUrls || [],
        videoUrls || [],
        currentPrompt || '',
        mode || 'video'
      );
    } else {
      // 纯文本润色，使用 DeepSeek
      const systemPrompt = mode === 'image'
        ? `你是一个专业的AI图片生成提示词优化专家。用户会给你一段图片生成提示词，请帮助润色和优化。
要求：
1. 保留原始意图
2. 从多个维度补充和细化描述
3. 使提示词更加专业和具体
4. 严格按以下 JSON 格式输出，不要加任何解释或前缀：

{
  "prompt": "完整的润色后提示词（将所有维度整合为一段连贯描述）",
  "subject": "主体描述（人物/物体/场景的核心内容）",
  "action": "动作/姿态（主体正在做什么）",
  "environment": "环境/背景（场景所处的空间和氛围）",
  "style": "艺术风格（如写实、油画、水彩、赛博朋克、吉卜力等）",
  "lighting": "光影效果（光源方向、色温、明暗对比）",
  "color": "色彩基调（主色调、配色方案、饱和度）",
  "composition": "构图方式（视角、景别、画面布局）",
  "texture": "材质/质感（皮肤、布料、金属等表面细节）",
  "mood": "情绪/氛围（画面传达的情感和气氛）",
  "details": "额外细节（装饰、配件、特效等补充元素）"
}`
        : `你是一个专业的AI视频生成提示词优化专家。用户会给你一段视频生成提示词，请帮助润色和优化，并生成分镜脚本。
要求：
1. 保留原始意图
2. 从多个维度补充和细化描述
3. 生成分镜脚本，将视频拆分为多个镜头段落
4. 严格按以下 JSON 格式输出，不要加任何解释或前缀：

{
  "prompt": "完整的润色后提示词（整体视频描述，将所有维度整合为一段连贯描述）",
  "subject": "主体描述（人物/物体/场景的核心内容）",
  "style": "视觉风格（如电影感、纪录片、动画、广告等）",
  "mood": "情绪/氛围（画面传达的情感和气氛）",
  "color": "色彩基调（主色调、调色风格、饱和度）",
  "audio": "音效/配乐建议（环境音、背景音乐风格）",
  "scenes": [
    {
      "timeStart": "起始时间（如 0s）",
      "timeEnd": "结束时间（如 3s）",
      "description": "这个镜头的画面描述",
      "camera": "镜头运动（推/拉/摇/移/跟随/固定等）",
      "action": "主体动作",
      "audio": "该段音效/配乐"
    }
  ]
}

注意：scenes 数组根据视频内容合理拆分为 2-6 个镜头，每个镜头 2-5 秒。`;

      polished = await deepseekChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: currentPrompt },
      ]);
    }

    res.json({ prompt: polished });
  } catch (error: any) {
    console.error('[提示词润色] 错误:', error);
    res.status(500).json({
      error: '提示词润色失败',
      detail: error.message,
    });
  }
});
