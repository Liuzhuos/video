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
    });
  }
  return _client;
}

const PREFIX = () => process.env.OSS_PREFIX || 'material/';
const ENDPOINT = () => process.env.OSS_ENDPOINT || 'oss-cn-hangzhou.aliyuncs.com';
const BUCKET = () => process.env.OSS_BUCKET!;

/**
 * 上传 Buffer 到 OSS，返回公网可访问的 URL
 */
export async function uploadBufferToOSS(buffer: Buffer, filename: string): Promise<string> {
  const ossKey = `${PREFIX()}${filename}`;
  await getClient().put(ossKey, buffer);
  return `https://${BUCKET()}.${ENDPOINT()}/${ossKey}`;
}

/**
 * 上传本地文件到 OSS，返回公网可访问的 URL
 */
export async function uploadFileToOSS(localFilePath: string): Promise<string> {
  const filename = path.basename(localFilePath);
  const ossKey = `${PREFIX()}${filename}`;
  await getClient().put(ossKey, localFilePath);
  return `https://${BUCKET()}.${ENDPOINT()}/${ossKey}`;
}
