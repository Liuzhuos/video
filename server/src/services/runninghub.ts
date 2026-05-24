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

import { acquireKey, releaseKey, recordKeyError, PooledKey } from './apiKeyPool';
import prisma from './prisma';

/** 图片生成模型类型 */
export type ImageModel = 'g' | 'v2' | 'pro';

const BASE_URL = process.env.RUNNINGHUB_BASE_URL || 'https://www.runninghub.cn';

/**
 * 从 Key 池获取一个可用 Key，如果池为空则回退到环境变量
 */
async function getPooledKey(): Promise<{ apiKey: string; keyId: number | null }> {
  const pooled = await acquireKey('runninghub');
  if (pooled) {
    return { apiKey: pooled.apiKey, keyId: pooled.id };
  }

  // 回退到环境变量（兼容旧配置）
  const envKey = process.env.RUNNINGHUB_API_KEY;
  if (envKey) {
    console.warn('[RunningHub] Key 池无可用 Key，回退到环境变量');
    return { apiKey: envKey, keyId: null };
  }

  throw new Error('无可用的 RunningHub API Key（池已满或未配置）');
}

/**
 * 根据 keyId 从数据库获取对应的 apiKey（用于查询任务时保持 Key 一致）
 */
async function getApiKeyById(keyId: number | null | undefined): Promise<string | undefined> {
  if (!keyId) return undefined;
  const key = await prisma.apiKey.findUnique({ where: { id: keyId }, select: { apiKey: true } });
  return key?.apiKey ?? undefined;
}

/**
 * taskId → keyId 映射（用于前端轮询场景，查询时能找到创建任务使用的 Key）
 * 任务完成或超时后自动清理
 */
const taskKeyMap = new Map<string, number>();

/** 记录 taskId 对应的 keyId */
export function registerTaskKey(taskId: string, keyId: number | null): void {
  if (keyId) {
    taskKeyMap.set(taskId, keyId);
    // 15 分钟后自动清理，防止内存泄漏
    setTimeout(() => taskKeyMap.delete(taskId), 15 * 60 * 1000);
  }
}

/** 根据 taskId 获取对应的 apiKey */
export async function getApiKeyByTaskId(taskId: string): Promise<string | undefined> {
  const keyId = taskKeyMap.get(taskId);
  return getApiKeyById(keyId);
}

/** 根据 taskId 获取对应的 keyId（用于释放） */
export function getKeyIdByTaskId(taskId: string): number | undefined {
  return taskKeyMap.get(taskId);
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
): Promise<{ taskId: string; keyId: number | null }> {
  const { apiKey, keyId } = await getPooledKey();
  const endpoint = TEXT_TO_IMAGE_ENDPOINTS[model];

  const requestBody = { prompt, aspectRatio, resolution };
  console.log(`[RunningHub] 文生图请求 (model=${model}, keyId=${keyId}):`, JSON.stringify(requestBody, null, 2));

  try {
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
      const errMsg = `RunningHub 请求失败 (${response.status}): ${text}`;
      if (keyId) await recordKeyError(keyId, errMsg);
      if (keyId) await releaseKey(keyId);
      throw new Error(errMsg);
    }

    const result: any = await response.json();
    console.log('[RunningHub] 文生图响应:', JSON.stringify(result, null, 2));

    const taskId = result.taskId ?? result.data?.taskId ?? result.data?.task_id;
    const msg = result.errorMessage ?? result.msg ?? result.message ?? result.error ?? JSON.stringify(result);

    if (!taskId) {
      if (keyId) await recordKeyError(keyId, `创建任务失败: ${msg}`);
      if (keyId) await releaseKey(keyId);
      throw new Error(`创建任务失败: ${msg}`);
    }

    return { taskId, keyId };
  } catch (error: any) {
    // 如果是网络错误等未预期异常，也要释放
    if (keyId && error.message && !error.message.includes('RunningHub')) {
      await recordKeyError(keyId, error.message);
      await releaseKey(keyId);
    }
    throw error;
  }
}




/**
 * 轮询等待文生图任务完成并返回图片 URL（使用新版 V2 查询）
 */
export async function waitForTextToImageResult(
  taskId: string,
  maxWaitMs = 5 * 60 * 1000,
  intervalMs = 3000,
  keyId?: number | null
): Promise<string> {
  const startTime = Date.now();
  // 使用创建任务时的同一个 Key 来查询，避免 "Task not found"
  const queryApiKey = await getApiKeyById(keyId);

  try {
    while (Date.now() - startTime < maxWaitMs) {
      const result = await queryV2Task(taskId, queryApiKey);

      if (result.status === 'SUCCESS') {
        if (keyId) await releaseKey(keyId);

        const imageResult = result.results?.find(
          (r) => r.url && r.outputType && ['png', 'jpg', 'jpeg', 'webp'].includes(r.outputType.toLowerCase())
        ) ?? result.results?.[0];

        if (imageResult?.url) {
          return imageResult.url;
        }
        throw new Error('文生图任务完成但没有输出图片');
      }

      if (result.status === 'FAILED') {
        if (keyId) {
          await recordKeyError(keyId, result.errorMessage || '文生图任务失败');
          await releaseKey(keyId);
        }
        throw new Error(`文生图任务失败: ${result.errorMessage || '未知错误'}`);
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    if (keyId) await releaseKey(keyId);
    throw new Error('文生图任务超时（5分钟），请稍后重试');
  } catch (error) {
    if (keyId) {
      try { await releaseKey(keyId); } catch {}
    }
    throw error;
  }
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

export async function queryV2Task(taskId: string, apiKeyOverride?: string): Promise<V2QueryResult> {
  const apiKey = apiKeyOverride ?? process.env.RUNNINGHUB_API_KEY;
  if (!apiKey) {
    throw new Error('无可用的 RunningHub API Key');
  }

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
): Promise<{ taskId: string; keyId: number | null }> {
  const { apiKey, keyId } = await getPooledKey();
  const endpoint = IMAGE_TO_IMAGE_ENDPOINTS[model];

  const requestBody = { prompt, imageUrls, aspectRatio, resolution };
  console.log(`[RunningHub] 图生图请求 (model=${model}, keyId=${keyId}):`, JSON.stringify(requestBody, null, 2));

  try {
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
      const errMsg = `图生图请求失败 (${response.status}): ${text}`;
      if (keyId) await recordKeyError(keyId, errMsg);
      if (keyId) await releaseKey(keyId);
      throw new Error(errMsg);
    }

    const result: any = await response.json();
    console.log('[RunningHub] 图生图响应:', JSON.stringify(result, null, 2));

    const taskId = result.taskId ?? result.data?.taskId;
    if (!taskId) {
      const msg = result.errorMessage ?? result.msg ?? JSON.stringify(result);
      if (keyId) await recordKeyError(keyId, `创建图生图任务失败: ${msg}`);
      if (keyId) await releaseKey(keyId);
      throw new Error(`创建图生图任务失败: ${msg}`);
    }

    return { taskId, keyId };
  } catch (error: any) {
    if (keyId && error.message && !error.message.includes('图生图')) {
      await recordKeyError(keyId, error.message);
      await releaseKey(keyId);
    }
    throw error;
  }
}

/**
 * 轮询等待图生图任务完成并返回图片 URL
 */
export async function waitForImageToImageResult(
  taskId: string,
  maxWaitMs = 5 * 60 * 1000,
  intervalMs = 3000,
  keyId?: number | null
): Promise<string> {
  const startTime = Date.now();
  // 使用创建任务时的同一个 Key 来查询，避免 "Task not found"
  const queryApiKey = await getApiKeyById(keyId);

  try {
    while (Date.now() - startTime < maxWaitMs) {
      const result = await queryV2Task(taskId, queryApiKey);

      if (result.status === 'SUCCESS') {
        if (keyId) await releaseKey(keyId);

        const imageResult = result.results?.find(
          (r) => r.url && r.outputType && ['png', 'jpg', 'jpeg', 'webp'].includes(r.outputType.toLowerCase())
        ) ?? result.results?.[0];

        if (imageResult?.url) {
          return imageResult.url;
        }
        throw new Error('图生图任务完成但没有输出图片');
      }

      if (result.status === 'FAILED') {
        if (keyId) {
          await recordKeyError(keyId, result.errorMessage || '图生图任务失败');
          await releaseKey(keyId);
        }
        throw new Error(`图生图任务失败: ${result.errorMessage || '未知错误'}`);
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    if (keyId) await releaseKey(keyId);
    throw new Error('图生图任务超时（5分钟），请稍后重试');
  } catch (error) {
    if (keyId) {
      try { await releaseKey(keyId); } catch {}
    }
    throw error;
  }
}



/**
 * 调用全能视频G (reference-to-video) 生成视频
 */
export async function createReferenceToVideoTask(
  imageUrls: string[],
  prompt: string,
  duration: string = '6',
  resolution: string = '720p'
): Promise<{ taskId: string; keyId: number | null }> {
  const { apiKey, keyId } = await getPooledKey();

  const requestBody = { imageUrls, prompt, duration, resolution };
  console.log(`[RunningHub] 视频生成请求体 (keyId=${keyId}):`, JSON.stringify(requestBody, null, 2));

  try {
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
      const errMsg = `RunningHub 视频请求失败 (${response.status}): ${text}`;
      if (keyId) await recordKeyError(keyId, errMsg);
      if (keyId) await releaseKey(keyId);
      throw new Error(errMsg);
    }

    const result: any = await response.json();
    console.log('[RunningHub] 视频生成响应:', JSON.stringify(result, null, 2));

    const taskId = result.data?.taskId ?? result.taskId ?? result.data?.task_id;
    const msg = result.msg ?? result.message ?? result.error ?? JSON.stringify(result);

    if (!taskId) {
      if (keyId) await recordKeyError(keyId, `创建视频任务失败: ${msg}`);
      if (keyId) await releaseKey(keyId);
      throw new Error(`创建视频任务失败: ${msg}`);
    }

    // 注册 taskId → keyId 映射，供前端轮询时使用同一个 Key 查询
    registerTaskKey(taskId, keyId);

    return { taskId, keyId };
  } catch (error: any) {
    if (keyId && error.message && !error.message.includes('视频')) {
      await recordKeyError(keyId, error.message);
      await releaseKey(keyId);
    }
    throw error;
  }
}

/**
 * 轮询等待视频任务完成并返回视频URL（使用 V2 查询 + 正确的 Key）
 */
export async function waitForVideoResult(
  taskId: string,
  maxWaitMs = 10 * 60 * 1000,
  intervalMs = 5000,
  keyId?: number | null
): Promise<string> {
  const startTime = Date.now();
  // 使用创建任务时的同一个 Key 来查询，避免 "Task not found"
  const queryApiKey = await getApiKeyById(keyId);

  try {
    while (Date.now() - startTime < maxWaitMs) {
      const result = await queryV2Task(taskId, queryApiKey);

      if (result.status === 'SUCCESS') {
        if (keyId) await releaseKey(keyId);

        const videoOutput = result.results?.find(
          (r) => r.url && r.outputType && ['mp4', 'mov', 'webm', 'avi'].includes(r.outputType.toLowerCase())
        ) ?? result.results?.find((r) => r.url);

        if (videoOutput?.url) {
          return videoOutput.url;
        }

        throw new Error('视频任务完成但没有输出结果');
      }

      if (result.status === 'FAILED') {
        if (keyId) {
          await recordKeyError(keyId, result.errorMessage || '视频任务执行失败');
          await releaseKey(keyId);
        }
        throw new Error(`RunningHub 视频任务执行失败: ${result.errorMessage || '未知错误'}`);
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    if (keyId) await releaseKey(keyId);
    throw new Error('视频任务超时（10分钟），请稍后重试');
  } catch (error) {
    if (keyId) {
      try { await releaseKey(keyId); } catch {}
    }
    throw error;
  }
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
 */
export async function createSeedance2Task(params: Seedance2Params): Promise<{ taskId: string; keyId: number | null }> {
  const { apiKey, keyId } = await getPooledKey();

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

  console.log(`[RunningHub] Seedance2 请求体 (keyId=${keyId}):`, JSON.stringify(body, null, 2));

  try {
    const response = await fetch(`${BASE_URL}/openapi/v2/bytedance/seedance-2.0-global/multimodal-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      const errMsg = `Seedance2 请求失败 (${response.status}): ${text}`;
      if (keyId) await recordKeyError(keyId, errMsg);
      if (keyId) await releaseKey(keyId);
      throw new Error(errMsg);
    }

    const result: any = await response.json();
    console.log('[RunningHub] Seedance2 响应:', JSON.stringify(result, null, 2));

    const taskId = result.taskId ?? result.data?.taskId ?? result.data?.task_id;
    if (!taskId) {
      const msg = result.errorMessage ?? result.msg ?? result.message ?? JSON.stringify(result);
      if (keyId) await recordKeyError(keyId, `创建 Seedance2 任务失败: ${msg}`);
      if (keyId) await releaseKey(keyId);
      throw new Error(`创建 Seedance2 任务失败: ${msg}`);
    }

    // 注册 taskId → keyId 映射，供前端轮询时使用同一个 Key 查询
    registerTaskKey(taskId, keyId);

    return { taskId, keyId };
  } catch (error: any) {
    if (keyId && error.message && !error.message.includes('Seedance2')) {
      await recordKeyError(keyId, error.message);
      await releaseKey(keyId);
    }
    throw error;
  }
}

/**
 * 轮询等待 Seedance 2.0 任务完成并返回视频 URL
 */
export async function waitForSeedance2Result(
  taskId: string,
  maxWaitMs = 10 * 60 * 1000,
  intervalMs = 5000,
  keyId?: number | null
): Promise<string> {
  const startTime = Date.now();
  // 使用创建任务时的同一个 Key 来查询，避免 "Task not found"
  const queryApiKey = await getApiKeyById(keyId);

  try {
    while (Date.now() - startTime < maxWaitMs) {
      const result = await queryV2Task(taskId, queryApiKey);

      if (result.status === 'SUCCESS') {
        if (keyId) await releaseKey(keyId);

        const videoOutput = result.results?.find(
          (r) => r.url && r.outputType && ['mp4', 'mov', 'webm', 'avi'].includes(r.outputType.toLowerCase())
        ) ?? result.results?.find((r) => r.url);
        if (videoOutput?.url) return videoOutput.url;
        throw new Error('Seedance2 任务完成但没有视频输出');
      }

      if (result.status === 'FAILED') {
        if (keyId) {
          await recordKeyError(keyId, result.errorMessage || 'Seedance2 任务失败');
          await releaseKey(keyId);
        }
        throw new Error(`Seedance2 任务失败: ${result.errorMessage || '未知错误'}`);
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    if (keyId) await releaseKey(keyId);
    throw new Error('Seedance2 任务超时（10分钟），请稍后重试');
  } catch (error) {
    if (keyId) {
      try { await releaseKey(keyId); } catch {}
    }
    throw error;
  }
}
