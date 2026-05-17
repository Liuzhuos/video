import OpenAI from 'openai';

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'video_url'; video_url: { url: string } };

function getClient(): OpenAI {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const baseURL = process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

  if (!apiKey) {
    throw new Error('DASHSCOPE_API_KEY 未配置，请在 .env 文件中设置');
  }

  return new OpenAI({ apiKey, baseURL });
}

/**
 * 调用百炼 qwen-vl-plus 模型，根据图片/视频内容润色提示词
 */
export async function polishPromptWithVision(
  imageUrls: string[],
  videoUrls: string[],
  currentPrompt: string,
  mode: 'image' | 'video' = 'video'
): Promise<string> {
  const client = getClient();

  const contentParts: ContentPart[] = [];

  // 添加图片
  for (const url of imageUrls) {
    contentParts.push({ type: 'image_url', image_url: { url } });
  }

  // 添加视频
  for (const url of videoUrls) {
    contentParts.push({ type: 'video_url', video_url: { url } });
  }

  // 根据 mode 构建不同的 JSON 格式要求
  const jsonFormat = mode === 'image'
    ? `{
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
    : `{
  "prompt": "完整的润色后提示词（将所有维度整合为一段连贯描述）",
  "subject": "主体描述（人物/物体/场景的核心内容）",
  "action": "动作/运动（主体的动作和运动轨迹）",
  "environment": "环境/背景（场景所处的空间和氛围）",
  "style": "视觉风格（如电影感、纪录片、动画、广告等）",
  "camera": "镜头运动（推拉摇移、跟随、环绕、升降等）",
  "shot": "景别（远景、全景、中景、近景、特写）",
  "lighting": "光影效果（光源方向、色温、明暗变化）",
  "color": "色彩基调（主色调、调色风格、饱和度）",
  "speed": "节奏/速度（快慢、加速、慢动作等）",
  "transition": "转场/变化（画面如何演变和过渡）",
  "mood": "情绪/氛围（画面传达的情感和气氛）",
  "audio": "音效/配乐建议（环境音、背景音乐风格）"
}`;

  // 构建提示文本
  let promptText = '';
  if (currentPrompt.trim()) {
    promptText = `我正在为${mode === 'image' ? '图片' : '视频'}生成编写提示词，当前的提示词是：「${currentPrompt}」

请根据上面提供的图片/视频内容，帮我润色和优化这段提示词。要求：
1. 保留原始意图
2. 结合图片/视频中的视觉信息补充细节
3. 使提示词更加专业和具体
4. 严格按以下 JSON 格式输出，不要加任何解释或前缀：

${jsonFormat}`;
  } else {
    promptText = `请仔细观察上面提供的图片/视频内容，为我生成一段${mode === 'image' ? '图片' : '视频'}生成提示词。要求：
1. 详细描述画面内容
2. 从多个维度进行专业描述
3. 严格按以下 JSON 格式输出，不要加任何解释或前缀：

${jsonFormat}`;
  }

  contentParts.push({ type: 'text', text: promptText });

  const response = await client.chat.completions.create({
    model: 'qwen-vl-plus',
    messages: [
      {
        role: 'user',
        content: contentParts as any,
      },
    ],
    temperature: 0.7,
    max_tokens: 2048,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('百炼视觉模型返回了空响应');
  }

  return content;
}
