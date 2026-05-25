import OSS from 'ali-oss';
import path from 'path';

// 懒加载：第一次调用时才实例化，确保 dotenv 已经执行
let _client: OSS | null = null;

function getClient(): OSS {
  if (!_client) {
    _client = new OSS({
      region: `oss-${process.env.OSS_REGION || 'cn-hangzhou'}`,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
      bucket: process.env.OSS_BUCKET!,
      secure: true, // 强制使用 HTTPS，避免 HTTP 连接被重置
      timeout: 120000, // 上传超时 120 秒
    });
  }
  return _client;
}

const PREFIX = () => process.env.OSS_PREFIX || 'material/';
const ENDPOINT = () => process.env.OSS_ENDPOINT || 'oss-cn-hangzhou.aliyuncs.com';
const BUCKET = () => process.env.OSS_BUCKET!;

/**
 * 生成签名 URL（私有 Bucket 使用）
 * @param ossKey OSS 对象 key
 * @param expires 过期时间（秒），默认 1 小时
 */
export function getSignedUrl(ossKey: string, expires: number = 3600): string {
  return getClient().signatureUrl(ossKey, { expires });
}

/**
 * 上传 Buffer 到 OSS，返回可访问的 URL
 * 大文件（>5MB）使用分片上传，小文件直接 put
 * 私有 Bucket 返回签名 URL，公共读 Bucket 返回直接 URL
 */
export async function uploadBufferToOSS(buffer: Buffer, filename: string): Promise<string> {
  const ossKey = `${PREFIX()}${filename}`;
  const MULTIPART_THRESHOLD = 5 * 1024 * 1024; // 5MB

  if (buffer.length > MULTIPART_THRESHOLD) {
    // 大文件使用分片上传，自带断点续传和重试
    const { Readable } = await import('stream');
    const stream = Readable.from(buffer);
    await getClient().putStream(ossKey, stream, {
      timeout: 180000, // 3 分钟超时
      headers: { 'Content-Length': String(buffer.length) },
    });
  } else {
    await getClient().put(ossKey, buffer);
  }

  return getSignedUrl(ossKey);
}

/**
 * 上传本地文件到 OSS，返回可访问的 URL
 */
export async function uploadFileToOSS(localFilePath: string): Promise<string> {
  const filename = path.basename(localFilePath);
  const ossKey = `${PREFIX()}${filename}`;
  await getClient().put(ossKey, localFilePath);
  return getSignedUrl(ossKey);
}
