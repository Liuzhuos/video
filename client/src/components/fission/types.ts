import type { CompareVariant } from '../PromptEditor';
import type { ScriptScene } from '../ScriptModal';

export type FissionStep = 'prepare' | 'generate';
export type ImageSource = 'frame' | 'text2img' | 'img2img';
export type ImageModel = 'g' | 'v2' | 'pro';

export interface PreparedImage {
  id: string;
  url: string;
  /** 首次上传/生成时的原始 URL，用于恢复 */
  originalUrl?: string;
  source: ImageSource;
  label: string;
  pending?: boolean;
  /** 如果是对比组，存储组内所有图片 */
  groupImages?: { url: string; label: string; variantDesc: string }[];
  /** 标记为对比组 */
  isGroup?: boolean;
  /** 对比组中被选中用于视频生成的图片 URL 列表 */
  selectedGroupUrls?: string[];
}

export interface CapturedFrame {
  id: string;
  localUrl: string;
  blob: Blob;
  label: string;
}

export type { CompareVariant, ScriptScene };
