import { useState, useCallback } from 'react';
import { uploadImage } from '../api/image';
import { authFetch } from '../api/request';
import type { PreparedImage, ImageModel, CapturedFrame } from '../components/fission/types';
import type { CompareVariant } from '../components/PromptEditor';
import { useUploadState } from './useUploadState';

/**
 * 垫图准备阶段的所有状态与操作
 */
export function useImagePrepare() {
  // ── 步骤内 tab ──
  const [prepareTab, setPrepareTab] = useState<'text2img' | 'img2img'>('text2img');

  // ── 垫图列表 ──
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [selectedPadIds, setSelectedPadIds] = useState<string[]>([]);

  // ── 图生图源图 ──
  const [img2imgSources, setImg2imgSources] = useState<{ url: string; originalUrl?: string; label: string }[]>([]);

  // ── 生图参数 ──
  const [textToImagePrompt, setTextToImagePrompt] = useState('');
  const [img2imgPrompt, setImg2imgPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [resolution, setResolution] = useState<'1k' | '2k' | '4k'>('1k');
  const [t2iModel, setT2iModel] = useState<ImageModel>('g');
  const [i2iModel, setI2iModel] = useState<ImageModel>('g');
  const [t2iCompareVariants, setT2iCompareVariants] = useState<CompareVariant[]>([]);
  const [i2iCompareVariants, setI2iCompareVariants] = useState<CompareVariant[]>([]);

  const { loading, loadingMsg, error, setError, startLoading, stopLoading, setMsg } = useUploadState();

  // ── 垫图多选 ──
  const togglePadSelect = useCallback((id: string) => {
    setSelectedPadIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 9) return prev;
      return [...prev, id];
    });
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    setSelectedPadIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const addImage = useCallback((img: PreparedImage) => {
    setImages((prev) => [...prev, img]);
  }, []);

  const updateGroupSelectedUrls = useCallback((groupId: string, urls: string[]) => {
    setImages((prev) =>
      prev.map((img) => (img.id === groupId ? { ...img, selectedGroupUrls: urls } : img))
    );
  }, []);

  // ── 截帧确认 ──
  const handleCaptureConfirm = useCallback(
    async (frames: CapturedFrame[], destination: 'source' | 'pad') => {
      try {
        startLoading();
        if (destination === 'source') {
          const uploaded: { url: string; label: string }[] = [];
          for (let i = 0; i < frames.length; i++) {
            setMsg(`上传截帧中 (${i + 1}/${frames.length})...`);
            const file = new File([frames[i].blob], `frame_${Date.now()}.png`, { type: 'image/png' });
            const result = await uploadImage(file);
            uploaded.push({ url: result.url, label: `截帧 ${frames[i].label}` });
          }
          setImg2imgSources((prev) => [...prev, ...uploaded]);
        } else {
          const slotIds = frames.map(
            () => `frame_${Date.now()}_${Math.random().toString(36).slice(2)}`
          );
          setImages((prev) => [
            ...prev,
            ...slotIds.map((id, i) => ({
              id,
              url: '',
              source: 'frame' as const,
              label: `截帧 ${frames[i].label}`,
              pending: true,
            })),
          ]);
          for (let i = 0; i < frames.length; i++) {
            setMsg(`上传截帧中 (${i + 1}/${frames.length})...`);
            const file = new File([frames[i].blob], `frame_${Date.now()}.png`, { type: 'image/png' });
            const result = await uploadImage(file);
            const slotId = slotIds[i];
            setImages((prev) =>
              prev.map((img) => (img.id === slotId ? { ...img, url: result.url, pending: false } : img))
            );
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading, setMsg, setError]
  );

  // ── 上传图片（图生图源图）──
  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;
      e.target.value = '';
      try {
        startLoading();
        const uploaded: { url: string; label: string }[] = [];
        for (let i = 0; i < files.length; i++) {
          setMsg(`上传图片 (${i + 1}/${files.length})...`);
          const result = await uploadImage(files[i]);
          uploaded.push({ url: result.url, label: files[i].name.slice(0, 20) });
        }
        setImg2imgSources((prev) => [...prev, ...uploaded]);
      } catch (err: any) {
        setError(err.message);
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading, setMsg, setError]
  );

  // ── 生成对比变体提示词组合 ──
  const generateVariantPrompts = useCallback(
    (basePrompt: string, variants: CompareVariant[]): { prompt: string; desc: string }[] => {
      if (variants.length === 0) return [{ prompt: basePrompt, desc: '' }];
      let combinations: { prompt: string; desc: string }[] = [{ prompt: basePrompt, desc: '' }];
      for (const v of variants) {
        const next: { prompt: string; desc: string }[] = [];
        for (const combo of combinations) {
          for (const word of v.variants) {
            next.push({
              prompt: combo.prompt.replace(v.original, word),
              desc: combo.desc ? `${combo.desc}, ${word}` : word,
            });
          }
        }
        combinations = next;
      }
      return combinations;
    },
    []
  );

  // ── 文生图 ──
  const handleTextToImage = useCallback(async () => {
    if (!textToImagePrompt.trim()) return;
    const currentPrompt = textToImagePrompt.trim();

    if (t2iCompareVariants.length > 0) {
      const prompts = generateVariantPrompts(currentPrompt, t2iCompareVariants);
      if (prompts.length > 1) {
        const groupId = `t2i_group_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        setImages((prev) => [
          ...prev,
          { id: groupId, url: '', source: 'text2img', label: `对比: ${currentPrompt.slice(0, 15)}...`, pending: true, isGroup: true, groupImages: [] },
        ]);
        setError(null);
        try {
          const promises = prompts.map(async ({ prompt, desc }) => {
            // 1. 提交任务，立即拿到 taskId
            const submitRes = await authFetch('/api/image/generate-async', {
              method: 'POST',
              body: JSON.stringify({ prompt, aspectRatio, resolution, model: t2iModel }),
            });
            if (!submitRes.ok) { const err = await submitRes.json(); throw new Error(err.error || '文生图失败'); }
            const { taskId } = await submitRes.json();

            // 2. 轮询直到完成
            const maxWait = 5 * 60 * 1000;
            const start = Date.now();
            while (Date.now() - start < maxWait) {
              await new Promise((r) => setTimeout(r, 3000));
              const pollRes = await authFetch(`/api/image/task/${taskId}`);
              const status = await pollRes.json();
              if (status.status === 'success' && status.url) {
                const item = { url: status.url as string, label: desc, variantDesc: desc };
                setImages((prev) =>
                  prev.map((img) =>
                    img.id === groupId ? { ...img, groupImages: [...(img.groupImages ?? []), item] } : img
                  )
                );
                return item;
              }
              if (status.status === 'failed') throw new Error('文生图任务失败');
            }
            throw new Error('文生图任务超时');
          });
          const settled = await Promise.allSettled(promises);
          const errors: string[] = [];
          let hasSuccess = false;
          settled.forEach((r, idx) => {
            if (r.status === 'fulfilled') hasSuccess = true;
            else errors.push(`变体"${prompts[idx].desc}"失败: ${r.reason?.message || '未知错误'}`);
          });
          if (hasSuccess) {
            setImages((prev) => prev.map((img) => img.id === groupId ? { ...img, pending: false } : img));
          } else {
            setImages((prev) => prev.filter((img) => img.id !== groupId));
          }
          if (errors.length > 0) setError(errors.join('；'));
        } catch (err: any) {
          setImages((prev) => prev.filter((img) => img.id !== groupId));
          setError(err.message);
        }
        return;
      }
    }

    const slotId = `t2i_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setImages((prev) => [
      ...prev,
      { id: slotId, url: '', source: 'text2img', label: currentPrompt.slice(0, 20) + '...', pending: true },
    ]);
    setError(null);
    try {
      // 1. 提交任务
      const submitRes = await authFetch('/api/image/generate-async', {
        method: 'POST',
        body: JSON.stringify({ prompt: currentPrompt, aspectRatio, resolution, model: t2iModel }),
      });
      if (!submitRes.ok) { const err = await submitRes.json(); throw new Error(err.error || '文生图失败'); }
      const { taskId } = await submitRes.json();

      // 2. 轮询直到完成
      const maxWait = 5 * 60 * 1000;
      const start = Date.now();
      while (Date.now() - start < maxWait) {
        await new Promise((r) => setTimeout(r, 3000));
        const pollRes = await authFetch(`/api/image/task/${taskId}`);
        const status = await pollRes.json();
        if (status.status === 'success' && status.url) {
          setImages((prev) =>
            prev.map((img) => (img.id === slotId ? { ...img, url: status.url, pending: false } : img))
          );
          return;
        }
        if (status.status === 'failed') throw new Error('文生图任务失败');
      }
      throw new Error('文生图任务超时');
    } catch (err: any) {
      setImages((prev) => prev.filter((img) => img.id !== slotId));
      setError(err.message);
    }
  }, [textToImagePrompt, t2iCompareVariants, aspectRatio, resolution, t2iModel, generateVariantPrompts, setError]);

  // ── 图生图 ──
  const handleImageToImage = useCallback(async () => {
    if (img2imgSources.length === 0 || !img2imgPrompt.trim()) return;
    const sourceUrl = img2imgSources[0].url;
    if (!sourceUrl.startsWith('http')) {
      setError('源图片必须是公网URL，请使用AI生图或上传后重试');
      return;
    }
    const currentPrompt = img2imgPrompt.trim();

    if (i2iCompareVariants.length > 0) {
      const prompts = generateVariantPrompts(currentPrompt, i2iCompareVariants);
      if (prompts.length > 1) {
        const groupId = `i2i_group_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        setImages((prev) => [
          ...prev,
          { id: groupId, url: '', source: 'img2img', label: `对比: ${currentPrompt.slice(0, 15)}...`, pending: true, isGroup: true, groupImages: [] },
        ]);
        setError(null);
        try {
          const promises = prompts.map(async ({ prompt, desc }) => {
            // 1. 提交任务
            const submitRes = await authFetch('/api/fission/image-to-image-async', {
              method: 'POST',
              body: JSON.stringify({ imageUrl: sourceUrl, prompt, aspectRatio, resolution, model: i2iModel }),
            });
            if (!submitRes.ok) { const err = await submitRes.json(); throw new Error(err.error || '图生图失败'); }
            const { taskId } = await submitRes.json();

            // 2. 轮询直到完成
            const maxWait = 5 * 60 * 1000;
            const start = Date.now();
            while (Date.now() - start < maxWait) {
              await new Promise((r) => setTimeout(r, 3000));
              const pollRes = await authFetch(`/api/fission/task/${taskId}`);
              const status = await pollRes.json();
              if (status.status === 'success' && status.url) {
                const item = { url: status.url as string, label: desc, variantDesc: desc };
                setImages((prev) =>
                  prev.map((img) =>
                    img.id === groupId ? { ...img, groupImages: [...(img.groupImages ?? []), item] } : img
                  )
                );
                return item;
              }
              if (status.status === 'failed') throw new Error('图生图任务失败');
            }
            throw new Error('图生图任务超时');
          });
          const settled = await Promise.allSettled(promises);
          const errors: string[] = [];
          let hasSuccess = false;
          settled.forEach((r, idx) => {
            if (r.status === 'fulfilled') hasSuccess = true;
            else errors.push(`变体"${prompts[idx].desc}"失败: ${r.reason?.message || '未知错误'}`);
          });
          if (hasSuccess) {
            setImages((prev) => prev.map((img) => img.id === groupId ? { ...img, pending: false } : img));
          } else {
            setImages((prev) => prev.filter((img) => img.id !== groupId));
          }
          if (errors.length > 0) setError(errors.join('；'));
        } catch (err: any) {
          setImages((prev) => prev.filter((img) => img.id !== groupId));
          setError(err.message);
        }
        return;
      }
    }

    const slotId = `i2i_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setImages((prev) => [
      ...prev,
      { id: slotId, url: '', source: 'img2img', label: `图生图: ${currentPrompt.slice(0, 15)}...`, pending: true },
    ]);
    setError(null);
    try {
      // 1. 提交任务
      const submitRes = await authFetch('/api/fission/image-to-image-async', {
        method: 'POST',
        body: JSON.stringify({ imageUrl: sourceUrl, prompt: currentPrompt, aspectRatio, resolution, model: i2iModel }),
      });
      if (!submitRes.ok) { const err = await submitRes.json(); throw new Error(err.error || '图生图失败'); }
      const { taskId } = await submitRes.json();

      // 2. 轮询直到完成
      const maxWait = 5 * 60 * 1000;
      const start = Date.now();
      while (Date.now() - start < maxWait) {
        await new Promise((r) => setTimeout(r, 3000));
        const pollRes = await authFetch(`/api/fission/task/${taskId}`);
        const status = await pollRes.json();
        if (status.status === 'success' && status.url) {
          setImages((prev) =>
            prev.map((img) => (img.id === slotId ? { ...img, url: status.url, pending: false } : img))
          );
          return;
        }
        if (status.status === 'failed') throw new Error('图生图任务失败');
      }
      throw new Error('图生图任务超时');
    } catch (err: any) {
      setImages((prev) => prev.filter((img) => img.id !== slotId));
      setError(err.message);
    }
  }, [img2imgSources, img2imgPrompt, i2iCompareVariants, aspectRatio, resolution, i2iModel, generateVariantPrompts, setError]);

  // ── 图片编辑保存（垫图 or 源图）──
  const handleImageEditorSave = useCallback(
    async (
      dataUrl: string,
      editingImage: {
        type: 'img2img-source';
        index: number;
        url: string;
        originalUrl: string;
        label: string;
      } | {
        type: 'pad-image';
        id: string;
        url: string;
        originalUrl: string;
        label: string;
      }
    ) => {
      try {
        startLoading('上传编辑后的图片...');
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], `edited_${Date.now()}.png`, { type: 'image/png' });
        const result = await uploadImage(file);
        if (editingImage.type === 'img2img-source') {
          setImg2imgSources((prev) =>
            prev.map((src, i) =>
              i === editingImage.index
                ? { ...src, url: result.url, originalUrl: src.originalUrl ?? src.url }
                : src
            )
          );
        } else {
          setImages((prev) =>
            prev.map((img) =>
              img.id === editingImage.id
                ? { ...img, url: result.url, originalUrl: img.originalUrl ?? img.url }
                : img
            )
          );
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading, setError]
  );

  return {
    // state
    prepareTab,
    images,
    selectedPadIds,
    img2imgSources,
    textToImagePrompt,
    img2imgPrompt,
    aspectRatio,
    resolution,
    t2iModel,
    i2iModel,
    t2iCompareVariants,
    i2iCompareVariants,
    loading,
    loadingMsg,
    error,
    // setters
    setPrepareTab,
    setImg2imgSources,
    setImages,
    setTextToImagePrompt,
    setImg2imgPrompt,
    setAspectRatio,
    setResolution,
    setT2iModel,
    setI2iModel,
    setT2iCompareVariants,
    setI2iCompareVariants,
    setError,
    // actions
    togglePadSelect,
    removeImage,
    addImage,
    updateGroupSelectedUrls,
    handleCaptureConfirm,
    handleImageUpload,
    handleTextToImage,
    handleImageToImage,
    handleImageEditorSave,
  };
}
