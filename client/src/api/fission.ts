import { authFetch } from './request';

/**
 * 视频裂变应用 API
 */

export interface FissionVideoGenerateParams {
  imageUrl: string;
  prompt: string;
  referenceVideoUrl?: string;
  duration?: string;
  resolution?: string;
}

export interface FissionTaskResult {
  taskId: string;
  status: 'running' | 'success' | 'failed';
  url?: string;
}

/**
 * 上传视频文件
 */
export async function uploadVideo(file: File): Promise<{ url: string; filename: string }> {
  const formData = new FormData();
  formData.append('video', file);

  const response = await authFetch('/api/fission/upload-video', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '视频上传失败');
  }

  return response.json();
}

/**
 * 图生图
 */
export async function imageToImage(
  imageUrl: string,
  prompt: string
): Promise<{ url: string; taskId: string }> {
  const response = await authFetch('/api/fission/image-to-image', {
    method: 'POST',
    body: JSON.stringify({ imageUrl, prompt }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '图生图失败');
  }

  return response.json();
}

/**
 * 提交视频裂变生成任务
 */
export async function generateFissionVideo(
  params: FissionVideoGenerateParams
): Promise<FissionTaskResult> {
  const response = await authFetch('/api/fission/generate-video', {
    method: 'POST',
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '视频生成请求失败');
  }

  return response.json();
}

/**
 * 查询裂变视频任务状态
 */
export async function checkFissionTask(taskId: string): Promise<FissionTaskResult> {
  const response = await authFetch(`/api/fission/task/${taskId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '查询任务状态失败');
  }

  return response.json();
}
