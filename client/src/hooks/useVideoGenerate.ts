import { useState, useCallback } from 'react';
import { uploadVideo } from '../api/fission';
import { authFetch } from '../api/request';
import type { PreparedImage } from '../components/fission/types';
import type { ScriptScene } from '../components/ScriptModal';
import { useUploadState } from './useUploadState';

/**
 * 视频生成阶段的所有状态与操作
 */
export function useVideoGenerate() {
  // ── 视频参数 ──
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoDuration, setVideoDuration] = useState('5');
  const [videoResolution, setVideoResolution] = useState('720p');
  const [videoRatio, setVideoRatio] = useState('adaptive');
  const [generateAudio, setGenerateAudio] = useState(true);
  const [realPersonMode, setRealPersonMode] = useState(true);

  // ── 参考媒体 ──
  const [useRefVideo, setUseRefVideo] = useState(false);
  const [useRefAudio, setUseRefAudio] = useState(false);
  const [refVideoLocalUrl, setRefVideoLocalUrl] = useState<string | null>(null);
  const [refVideoUrl, setRefVideoUrl] = useState<string | null>(null);
  const [refAudioLocalName, setRefAudioLocalName] = useState<string | null>(null);
  const [refAudioUrl, setRefAudioUrl] = useState<string | null>(null);

  // ── 分镜脚本 ──
  const [scriptScenes, setScriptScenes] = useState<ScriptScene[]>([]);

  // ── 生成结果 ──
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [videoGenerating, setVideoGenerating] = useState(false);
  const [videoLoadingMsg, setVideoLoadingMsg] = useState('');

  const { loading, loadingMsg, error, setError, startLoading, stopLoading } = useUploadState();

  // ── 上传参考视频（裁剪弹窗回调）──
  const handleVideoTrimConfirm = useCallback(
    async (fileOrUrl: File | string, localUrl: string) => {
      setRefVideoLocalUrl(localUrl);
      try {
        if (typeof fileOrUrl === 'string') {
          setRefVideoUrl(fileOrUrl);
          return;
        }
        startLoading('上传参考视频中...');
        const result = await uploadVideo(fileOrUrl);
        setRefVideoUrl(result.url);
      } catch (err: any) {
        setError(err.message);
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading, setError]
  );

  // ── 直接上传参考视频 ──
  const handleRefVideoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      setRefVideoLocalUrl(URL.createObjectURL(file));
      try {
        startLoading('上传参考视频中...');
        const result = await uploadVideo(file);
        setRefVideoUrl(result.url);
      } catch (err: any) {
        setError(err.message);
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading, setError]
  );

  // ── 上传参考音频 ──
  const handleRefAudioUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      setRefAudioLocalName(file.name);
      try {
        startLoading('上传参考音频中...');
        const formData = new FormData();
        formData.append('audio', file);
        const response = await authFetch('/api/fission/upload-audio', { method: 'POST', body: formData });
        if (!response.ok) { const err = await response.json(); throw new Error(err.error || '音频上传失败'); }
        const result = await response.json();
        setRefAudioUrl(result.url);
      } catch (err: any) {
        setError(err.message);
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading, setError]
  );

  const clearRefVideo = useCallback(() => {
    setRefVideoLocalUrl(null);
    setRefVideoUrl(null);
  }, []);

  // ── 生成视频 ──
  const handleGenerateVideo = useCallback(
    async (
      images: PreparedImage[],
      selectedPadIds: string[]
    ) => {
      const selectedImages = images.filter((img) => selectedPadIds.includes(img.id) && !img.pending);
      const validImageUrls: string[] = [];

      selectedImages.forEach((img) => {
        if (!img.isGroup && img.url.startsWith('http')) validImageUrls.push(img.url);
      });
      images.forEach((img) => {
        if (img.isGroup && img.selectedGroupUrls && img.selectedGroupUrls.length > 0) {
          img.selectedGroupUrls.filter((u) => u.startsWith('http')).forEach((u) => validImageUrls.push(u));
        }
      });

      const validVideoUrls = refVideoUrl ? [refVideoUrl] : [];

      if (validImageUrls.length === 0 && validVideoUrls.length === 0) {
        setError('请先选择垫图（需要是已生成的公网图片）');
        return;
      }
      if (!videoPrompt.trim()) {
        setError('请填写视频提示词');
        return;
      }

      try {
        setVideoGenerating(true);
        setVideoLoadingMsg('提交视频生成任务...');
        setError(null);
        setGeneratedVideoUrl(null);

        // 合并提示词 + 分镜脚本
        let fullPrompt = videoPrompt.trim();
        if (scriptScenes.length > 0) {
          const sceneParts = scriptScenes
            .filter((s) => s.description.trim())
            .map((s, i) => {
              const parts: string[] = [];
              if (s.timeStart || s.timeEnd) parts.push(`[${s.timeStart || '0s'}-${s.timeEnd || '?'}]`);
              parts.push(s.description.trim());
              if (s.camera) parts.push(`镜头：${s.camera}`);
              if (s.action) parts.push(`动作：${s.action}`);
              return `镜头${i + 1}：${parts.join('，')}`;
            });
          if (sceneParts.length > 0) fullPrompt += '\n\n' + sceneParts.join('；');
        }

        const body: Record<string, any> = {
          prompt: fullPrompt,
          duration: videoDuration,
          resolution: videoResolution,
          ratio: videoRatio,
          generateAudio,
          realPersonMode,
        };
        if (validImageUrls.length > 0) body.imageUrls = validImageUrls;
        if (useRefVideo && validVideoUrls.length > 0) body.videoUrls = validVideoUrls;
        if (useRefAudio && refAudioUrl) body.audioUrls = [refAudioUrl];

        const response = await authFetch('/api/fission/seedance2', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        if (!response.ok) { const err = await response.json(); throw new Error(err.error || '视频生成失败'); }
        const { taskId } = await response.json();

        setVideoLoadingMsg('视频生成中，请耐心等待...');
        const maxWait = 10 * 60 * 1000;
        const startTime = Date.now();
        while (Date.now() - startTime < maxWait) {
          const statusRes = await authFetch(`/api/fission/task/${taskId}`);
          const status = await statusRes.json();
          if (status.status === 'success' && status.url) {
            setGeneratedVideoUrl(status.url);
            return;
          }
          if (status.status === 'failed') throw new Error('视频生成失败');
          await new Promise((r) => setTimeout(r, 5000));
        }
        throw new Error('视频生成超时');
      } catch (err: any) {
        setError(err.message);
      } finally {
        setVideoGenerating(false);
        setVideoLoadingMsg('');
      }
    },
    [videoPrompt, videoDuration, videoResolution, videoRatio, generateAudio, realPersonMode,
      useRefVideo, useRefAudio, refVideoUrl, refAudioUrl, scriptScenes, setError]
  );

  return {
    // state
    videoPrompt,
    videoDuration,
    videoResolution,
    videoRatio,
    generateAudio,
    realPersonMode,
    useRefVideo,
    useRefAudio,
    refVideoLocalUrl,
    refVideoUrl,
    refAudioLocalName,
    refAudioUrl,
    scriptScenes,
    generatedVideoUrl,
    videoGenerating,
    videoLoadingMsg,
    loading,
    loadingMsg,
    error,
    // setters
    setVideoPrompt,
    setVideoDuration,
    setVideoResolution,
    setVideoRatio,
    setGenerateAudio,
    setRealPersonMode,
    setUseRefVideo,
    setUseRefAudio,
    setScriptScenes,
    setError,
    // actions
    handleVideoTrimConfirm,
    handleRefVideoUpload,
    handleRefAudioUpload,
    clearRefVideo,
    handleGenerateVideo,
  };
}
