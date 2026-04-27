/**
 * 上传图片到服务器
 */
export async function uploadImage(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch('/api/image/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '上传失败');
  }

  return response.json();
}

/**
 * 文生图（调用后端 RunningHub API）
 */
export async function generateImage(
  prompt: string,
  sceneId: number
): Promise<{ url?: string; status: string; message?: string }> {
  const response = await fetch('/api/image/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, sceneId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '生成失败');
  }

  return response.json();
}
