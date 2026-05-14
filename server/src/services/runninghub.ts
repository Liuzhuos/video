/**
 * RunningHub Standard Model API 服务（廉价版）
 *
 * 文生图端点（channel-low-price）：
 *   全能图片G  (gpt-image-2):        /openapi/v2/rhart-image-g-2/text-to-image
 *   全能图片V2 (nano-banana2-flash):  /openapi/v2/rhart-image-n-g31-flash/text-to-image
 *   全能图片pro(nano-banana-pro):     /openapi/v2/rhart-image-n-pro/text-to-image
 *
 * 图生图端点（channel-low-price）：
 *   全能图片G  (gpt-image-2):        /openapi/v2/rhart-image-g-2/image-to-image
 *   全能图片V2 (nano-banana2-flash):  /openapi/v2/rhart-image-n-g31-flash/image-to-image
 *   全能图片pro(nano-banana-pro):     /openapi/v2/rhart-image-n-pro/edit
 */

/** 图片生成模型类型 */
export type ImageModel = 'g' | 'v2' | 'pro';

const BASE_URL = process.env.RUNNINGHUB_BASE_URL || 'https://www.runninghub.cn';

function getApiKey(): string {
  const key = process.env.RUNNINGHUB_API_KEY;
  if (!key) {
    throw new Error('RUNNINGHUB_API_KEY 未配置');
  }
  return key;
}

export interface TaskOutputItem {
  fileUrl: string;
  fileType: string;
  taskCostTime?: string;
  nodeId?: string;
  consumeCoins?: string;
}

/** 各模型文生图廉价版端点 */
const TEXT_TO_IMAGE_ENDPOINTS: Record<ImageModel, string> = {
  g:   '/openapi/v2/rhart-image-g-2/text-to-image',
  v2:  '/openapi/v2/rhart-image-n-g31-flash/text-to-image',
  pro: '/openapi/v2/rhart-image-n-pro/text-to-image',
};

/** 各模型图生图廉价版端点 */
const IMAGE_TO_IMAGE_ENDPOINTS: Record<ImageModel, string> = {
  g:   '/openapi/v2/rhart-image-g-2/image-to-image',
  v2:  '/openapi/v2/rhart-image-n-g31-flash/image-to-image',
  pro: '/openapi/v2/rhart-image-n-pro/edit',
};

/**
 * 调用文生图（廉价版，支持模型选择）
 * @param model 模型：'g' 全能图片G | 'v2' 全能图片V2 | 'pro' 全能图片pro，默认 'g'
 */
export async function createTextToImageTask(
  prompt: string,
  aspectRatio: string = '16:9',
  resolution: '1k' | '2k' | '4k' = '1k',
  model: ImageModel = 'g'
): Promise<string> {
  const apiKey = getApiKey();
  const endpoint = TEXT_TO_IMAGE_ENDPOINTS[model];

  const requestBody = { prompt, aspectRatio, resolution };
  console.log(`[RunningHub] 文生图请求 (model=${model}):`, JSON.stringify(requestBody, null, 2));

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RunningHub 请求失败 (${response.status}): ${text}`);
  }

  const result: any = await response.json();
  console.log('[RunningHub] 文生图响应:', JSON.stringify(result, null, 2));

  // Standard Model API 直接返回 taskId
  const taskId = result.taskId ?? result.data?.taskId ?? result.data?.task_id;
  const msg = result.errorMessage ?? result.msg ?? result.message ?? result.error ?? JSON.stringify(result);

  if (!taskId) {
    throw new Error(`创建任务失败: ${msg}`);
  }

  return taskId;
}

/**
 * 查询任务状态
 */
export async function checkTaskStatus(taskId: string): Promise<string> {
  const apiKey = getApiKey();

  const response = await fetch(`${BASE_URL}/task/openapi/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ apiKey, taskId }),
  });

  const result: any = await response.json();
  console.log('[RunningHub] 任务状态:', JSON.stringify(result));

  const code = result.code;
  if (code !== 0 && code !== 200) {
    throw new Error(`查询状态失败: ${result.msg ?? result.message ?? JSON.stringify(result)}`);
  }

  return result.data?.taskStatus ?? result.data ?? result.taskStatus ?? 'UNKNOWN';
}

/**
 * 获取任务输出结果
 */
export async function getTaskOutput(taskId: string): Promise<TaskOutputItem[]> {
  const apiKey = getApiKey();

  const response = await fetch(`${BASE_URL}/task/openapi/outputs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ apiKey, taskId }),
  });

  const result: any = await response.json();
  console.log('[RunningHub] 任务输出:', JSON.stringify(result));

  const code = result.code;
  if (code !== 0 && code !== 200) {
    throw new Error(`获取结果失败: ${result.msg ?? result.message ?? JSON.stringify(result)}`);
  }

  const outputs = Array.isArray(result.data) ? result.data : result.data?.outputs ?? [];
  return outputs;
}

/**
 * 轮询等待任务完成并返回结果图片URL
 */
export async function waitForTaskResult(
  taskId: string,
  maxWaitMs = 5 * 60 * 1000,
  intervalMs = 3000
): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const status = await checkTaskStatus(taskId);

    if (status === 'SUCCESS' || status === 'COMPLETED') {
      const outputs = await getTaskOutput(taskId);
      const imageOutput = outputs.find((o: any) =>
        ['png', 'jpg', 'jpeg', 'webp'].includes(o.fileType)
      );

      if (imageOutput) {
        return imageOutput.fileUrl;
      }

      if (outputs.length > 0) {
        return outputs[0].fileUrl;
      }

      throw new Error('任务完成但没有输出结果');
    }

    if (status === 'FAILED' || status === 'ERROR') {
      throw new Error('RunningHub 任务执行失败');
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('任务超时（5分钟），请稍后重试');
}


/**
 * 轮询等待文生图任务完成并返回图片 URL（使用新版 V2 查询）
 */
export async function waitForTextToImageResult(
  taskId: string,
  maxWaitMs = 5 * 60 * 1000,
  intervalMs = 3000
): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const result = await queryV2Task(taskId);

    if (result.status === 'SUCCESS') {
      const imageResult = result.results?.find(
        (r) => r.url && r.outputType && ['png', 'jpg', 'jpeg', 'webp'].includes(r.outputType.toLowerCase())
      ) ?? result.results?.[0];

      if (imageResult?.url) {
        return imageResult.url;
      }
      throw new Error('文生图任务完成但没有输出图片');
    }

    if (result.status === 'FAILED') {
      throw new Error(`文生图任务失败: ${result.errorMessage || '未知错误'}`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('文生图任务超时（5分钟），请稍后重试');
}

/**
 * 使用新版 /openapi/v2/query 查询任务状态和结果（Standard Model API 专用）
 */
export interface V2QueryResult {
  taskId: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | string;
  errorCode: string;
  errorMessage: string;
  results: Array<{ url: string | null; outputType: string | null; text: string | null }> | null;
}

export async function queryV2Task(taskId: string): Promise<V2QueryResult> {
  const apiKey = getApiKey();

  const response = await fetch(`${BASE_URL}/openapi/v2/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ taskId }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`查询任务失败 (${response.status}): ${text}`);
  }

  const result = await response.json() as V2QueryResult;
  console.log('[RunningHub V2 Query]', JSON.stringify(result));
  return result;
}

/**
 * 调用图生图（廉价版，支持模型选择）
 * @param model 模型：'g' 全能图片G | 'v2' 全能图片V2 | 'pro' 全能图片pro，默认 'g'
 */
export async function createImageToImageTask(
  imageUrls: string[],
  prompt: string,
  aspectRatio: string = '16:9',
  resolution: '1k' | '2k' | '4k' = '1k',
  model: ImageModel = 'g'
): Promise<string> {
  const apiKey = getApiKey();
  const endpoint = IMAGE_TO_IMAGE_ENDPOINTS[model];

  // pro 模型不支持 quality 参数，g/v2 也不需要（廉价版无此参数）
  const requestBody = { prompt, imageUrls, aspectRatio, resolution };
  console.log(`[RunningHub] 图生图请求 (model=${model}):`, JSON.stringify(requestBody, null, 2));

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`图生图请求失败 (${response.status}): ${text}`);
  }

  const result: any = await response.json();
  console.log('[RunningHub] 图生图响应:', JSON.stringify(result, null, 2));

  const taskId = result.taskId ?? result.data?.taskId;
  if (!taskId) {
    const msg = result.errorMessage ?? result.msg ?? JSON.stringify(result);
    throw new Error(`创建图生图任务失败: ${msg}`);
  }

  return taskId;
}

/**
 * 轮询等待图生图任务完成并返回图片 URL
 */
export async function waitForImageToImageResult(
  taskId: string,
  maxWaitMs = 5 * 60 * 1000,
  intervalMs = 3000
): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const result = await queryV2Task(taskId);

    if (result.status === 'SUCCESS') {
      const imageResult = result.results?.find(
        (r) => r.url && r.outputType && ['png', 'jpg', 'jpeg', 'webp'].includes(r.outputType.toLowerCase())
      ) ?? result.results?.[0];

      if (imageResult?.url) {
        return imageResult.url;
      }
      throw new Error('图生图任务完成但没有输出图片');
    }

    if (result.status === 'FAILED') {
      throw new Error(`图生图任务失败: ${result.errorMessage || '未知错误'}`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('图生图任务超时（5分钟），请稍后重试');
}

/**
 * @deprecated 请使用 createImageToImageTask 代替
 * 保留此函数以兼容旧代码
 */
export async function createGptImage2Task(
  imageUrls: string[],
  prompt: string,
  aspectRatio: string = '16:9',
  resolution: '1k' | '2k' | '4k' = '1k',
  _quality: 'low' | 'medium' | 'high' = 'medium'
): Promise<string> {
  return createImageToImageTask(imageUrls, prompt, aspectRatio, resolution, 'g');
}

/**
 * @deprecated 请使用 waitForImageToImageResult 代替
 */
export async function waitForGptImage2Result(
  taskId: string,
  maxWaitMs = 5 * 60 * 1000,
  intervalMs = 3000
): Promise<string> {
  return waitForImageToImageResult(taskId, maxWaitMs, intervalMs);
}

/**
 * 调用全能视频G (reference-to-video) 生成视频
 * @param imageUrls 参考图片URL列表
 * @param prompt 视频描述提示词
 * @param duration 视频时长（秒），默认6
 * @param resolution 分辨率，默认720p
 */
export async function createReferenceToVideoTask(
  imageUrls: string[],
  prompt: string,
  duration: string = '6',
  resolution: string = '720p'
): Promise<string> {
  const apiKey = getApiKey();

  const requestBody = {
    imageUrls,
    prompt,
    duration,
    resolution,
  };

  console.log('[RunningHub] 视频生成请求体:', JSON.stringify(requestBody, null, 2));

  const response = await fetch(`${BASE_URL}/openapi/v2/rhart-video-g-official/reference-to-video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RunningHub 视频请求失败 (${response.status}): ${text}`);
  }

  const result: any = await response.json();
  console.log('[RunningHub] 视频生成响应:', JSON.stringify(result, null, 2));

  const taskId = result.data?.taskId ?? result.taskId ?? result.data?.task_id;
  const msg = result.msg ?? result.message ?? result.error ?? JSON.stringify(result);

  if (!taskId) {
    throw new Error(`创建视频任务失败: ${msg}`);
  }

  return taskId;
}

/**
 * 轮询等待视频任务完成并返回视频URL
 */
export async function waitForVideoResult(
  taskId: string,
  maxWaitMs = 10 * 60 * 1000, // 视频生成时间更长，10分钟
  intervalMs = 5000
): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const status = await checkTaskStatus(taskId);

    if (status === 'SUCCESS' || status === 'COMPLETED') {
      const outputs = await getTaskOutput(taskId);
      const videoOutput = outputs.find((o: any) =>
        ['mp4', 'mov', 'webm', 'avi'].includes(o.fileType)
      );

      if (videoOutput) {
        return videoOutput.fileUrl;
      }

      // 没有视频类型就返回第一个
      if (outputs.length > 0) {
        return outputs[0].fileUrl;
      }

      throw new Error('视频任务完成但没有输出结果');
    }

    if (status === 'FAILED' || status === 'ERROR') {
      throw new Error('RunningHub 视频任务执行失败');
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('视频任务超时（10分钟），请稍后重试');
}

// ==================== Seedance 2.0 ====================

export interface Seedance2Params {
  /** 视频提示词（必填，1-20480字符） */
  prompt: string;
  /** 视频分辨率（必填）: 480p | 720p | native1080p | 1080p | 2k | 4k */
  resolution: string;
  /** 视频时长（必填，秒）: 4-15 */
  duration: string;
  /** 参考图片 URL 列表（可选，最多9张） */
  imageUrls?: string[];
  /** 参考视频 URL 列表（可选，最多3个） */
  videoUrls?: string[];
  /** 参考音频 URL 列表（可选，最多3个） */
  audioUrls?: string[];
  /** 是否生成视频音频（可选） */
  generateAudio?: boolean;
  /** 视频宽高比（可选）: adaptive | 16:9 | 4:3 | 1:1 | 3:4 | 9:16 | 21:9 */
  ratio?: string;
  /** 真人模式（可选） */
  realPersonMode?: boolean;
}

/**
 * 创建 Seedance 2.0 多模态视频任务
 * 接口: POST /rhart-video/sparkvideo-2.0/multimodal-video
 */
export async function createSeedance2Task(params: Seedance2Params): Promise<string> {
  const apiKey = getApiKey();

  const body: Record<string, any> = {
    prompt: params.prompt,
    resolution: params.resolution,
    duration: params.duration,
  };

  if (params.imageUrls && params.imageUrls.length > 0) body.imageUrls = params.imageUrls;
  if (params.videoUrls && params.videoUrls.length > 0) body.videoUrls = params.videoUrls;
  if (params.audioUrls && params.audioUrls.length > 0) body.audioUrls = params.audioUrls;
  if (params.generateAudio !== undefined) body.generateAudio = params.generateAudio;
  if (params.ratio) body.ratio = params.ratio;
  if (params.realPersonMode !== undefined) body.realPersonMode = params.realPersonMode;

  console.log('[RunningHub] Seedance2 请求体:', JSON.stringify(body, null, 2));

  const response = await fetch(`${BASE_URL}/rhart-video/sparkvideo-2.0/multimodal-video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Seedance2 请求失败 (${response.status}): ${text}`);
  }

  const result: any = await response.json();
  console.log('[RunningHub] Seedance2 响应:', JSON.stringify(result, null, 2));

  const taskId = result.taskId ?? result.data?.taskId ?? result.data?.task_id;
  if (!taskId) {
    const msg = result.errorMessage ?? result.msg ?? result.message ?? JSON.stringify(result);
    throw new Error(`创建 Seedance2 任务失败: ${msg}`);
  }

  return taskId;
}

/**
 * 轮询等待 Seedance 2.0 任务完成并返回视频 URL
 */
export async function waitForSeedance2Result(
  taskId: string,
  maxWaitMs = 10 * 60 * 1000,
  intervalMs = 5000
): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const status = await checkTaskStatus(taskId);

    if (status === 'SUCCESS' || status === 'COMPLETED') {
      const outputs = await getTaskOutput(taskId);
      const videoOutput = outputs.find((o) =>
        ['mp4', 'mov', 'webm', 'avi'].includes(o.fileType?.toLowerCase() ?? '')
      );
      if (videoOutput) return videoOutput.fileUrl;
      if (outputs.length > 0) return outputs[0].fileUrl;
      throw new Error('Seedance2 任务完成但没有视频输出');
    }

    if (status === 'FAILED' || status === 'ERROR') {
      throw new Error('Seedance2 任务执行失败');
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Seedance2 任务超时（10分钟），请稍后重试');
}
