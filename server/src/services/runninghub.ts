/**
 * RunningHub Standard Model API 服务
 * 全能图片G2: /openapi/v2/rhart-image-g-2/text-to-image
 */

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

/**
 * 调用全能图片G2 文生图
 */
export async function createTextToImageTask(prompt: string): Promise<string> {
  const apiKey = getApiKey();

  const response = await fetch(`${BASE_URL}/openapi/v2/rhart-image-g-2/text-to-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RunningHub 请求失败 (${response.status}): ${text}`);
  }

  const result: any = await response.json();
  console.log('[RunningHub] 文生图响应:', JSON.stringify(result, null, 2));

  // 兼容多种返回格式
  const taskId = result.data?.taskId ?? result.taskId ?? result.data?.task_id;
  const msg = result.msg ?? result.message ?? result.error ?? JSON.stringify(result);

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
