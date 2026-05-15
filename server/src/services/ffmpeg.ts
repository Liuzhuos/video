import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { Readable } from 'stream';
import os from 'os';
import path from 'path';
import fs from 'fs';

// 指向 ffmpeg-static 提供的二进制
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

/**
 * 用 ffmpeg 裁剪视频 buffer，返回裁剪后的 buffer
 * 使用 -c copy 关键帧切割，速度极快，不重新编码
 */
export function trimVideoBuffer(
  inputBuffer: Buffer,
  startTime: number,
  endTime: number,
  inputExt: string = 'mp4'
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // 写临时输入文件（ffmpeg 需要 seekable 输入）
    const tmpInput = path.join(os.tmpdir(), `trim_in_${Date.now()}.${inputExt}`);
    const tmpOutput = path.join(os.tmpdir(), `trim_out_${Date.now()}.mp4`);

    fs.writeFileSync(tmpInput, inputBuffer);

    const duration = endTime - startTime;

    ffmpeg(tmpInput)
      .setStartTime(startTime)
      .setDuration(duration)
      .outputOptions(['-c copy', '-avoid_negative_ts make_zero'])
      .output(tmpOutput)
      .on('end', () => {
        try {
          const result = fs.readFileSync(tmpOutput);
          fs.unlinkSync(tmpInput);
          fs.unlinkSync(tmpOutput);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      })
      .on('error', (err) => {
        try { fs.unlinkSync(tmpInput); } catch {}
        try { fs.unlinkSync(tmpOutput); } catch {}
        reject(err);
      })
      .run();
  });
}
