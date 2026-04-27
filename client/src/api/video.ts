export interface VideoGenerateParams {
  imageUrls: string[];
  prompt: string;
  duration?: string;
  resolution?: string;
}

export interface VideoTaskResult {
  taskId: string;
  status: 'running' | 'success' | 'failed';
  url?: string;
}

/**
 * 异步提交视频生成任务
 */
export async function generateVideoAsync(params: VideoGenerateParams): Promise<VideoTaskResult> {
  const response = await fetch('/api/video/generate-async', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '视频生成请求失败');
  }

  return response.json();
}

/**
 * 查询视频任务状态
 */
export async function checkVideoTask(taskId: string): Promise<VideoTaskResult> {
  const response = await fetch(`/api/video/task/${taskId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '查询视频状态失败');
  }

  return response.json();
}
