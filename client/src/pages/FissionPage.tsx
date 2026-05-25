import { useState } from 'react';
import PrepareStep from '../components/fission/PrepareStep';
import GenerateStep from '../components/fission/GenerateStep';
import CaptureFrameModal from '../components/fission/CaptureFrameModal';
import VideoTrimModal from '../components/fission/VideoTrimModal';
import ImageEditorModal from '../components/ImageEditorModal';
import ImageCompositorModal from '../components/fission/ImageCompositorModal';
import { useImagePrepare } from '../hooks/useImagePrepare';
import { useVideoGenerate } from '../hooks/useVideoGenerate';


type FissionStep = 'prepare' | 'generate';

// 编辑中的图片信息（垫图 or 图生图源图）
type EditingImage =
  | { type: 'img2img-source'; index: number; url: string; originalUrl: string; label: string }
  | { type: 'pad-image'; id: string; url: string; originalUrl: string; label: string };

export default function FissionPage() {
  const [step, setStep] = useState<FissionStep>('generate');
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [showVideoTrimModal, setShowVideoTrimModal] = useState(false);
  const [showCompositorModal, setShowCompositorModal] = useState(false);
  const [editingImage, setEditingImage] = useState<EditingImage | null>(null);

  // ── 垫图准备阶段 ──
  const imagePrepare = useImagePrepare();

  // ── 视频生成阶段 ──
  const videoGenerate = useVideoGenerate();

  // ── 截帧目标（source = 图生图源图，pad = 垫图）──
  const [captureDestination, setCaptureDestination] = useState<'source' | 'pad'>('pad');

  const handleOpenCaptureModal = (destination: 'source' | 'pad' = 'pad') => {
    setCaptureDestination(destination);
    setShowCaptureModal(true);
  };

  // 打开图片编辑器（图生图源图）
  const handleEditImg2imgSource = (index: number, url: string, label: string, originalUrl: string) => {
    setEditingImage({ type: 'img2img-source', index, url, originalUrl, label });
  };

  // 打开图片编辑器（垫图）
  const handleEditPadImage = (id: string, url: string, label: string, originalUrl: string) => {
    setEditingImage({ type: 'pad-image', id, url, originalUrl, label });
  };

  // 图生图：把垫图加入源图列表
  const handleAddToImg2imgSource = (url: string, label: string) => {
    imagePrepare.setImg2imgSources((prev) => [...prev, { url, label }]);
  };

  // 融合导出处理
  const handleCompositorExport = async (dataUrl: string, target: 'img2img' | 'pad') => {
    setShowCompositorModal(false);
    try {
      // 将 dataUrl 转为 File 并上传
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `composite_${Date.now()}.png`, { type: 'image/png' });
      const { uploadImage } = await import('../api/image');
      const result = await uploadImage(file);

      if (target === 'img2img') {
        imagePrepare.setImg2imgSources((prev) => [...prev, { url: result.url, label: '融合图片' }]);
        imagePrepare.setPrepareTab('img2img');
      } else {
        const newId = `composite_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        imagePrepare.addImage({
          id: newId,
          url: result.url,
          originalUrl: result.url,
          source: 'img2img',
          label: '融合图片',
        });
      }
    } catch (err: any) {
      console.error('融合图片上传失败:', err);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-runway-black">
      {/* Tab 切换 */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-runway-border flex-shrink-0">
        <button
          onClick={() => setStep('prepare')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            step === 'prepare'
              ? 'bg-white text-black'
              : 'text-runway-slate hover:text-white hover:bg-runway-charcoal'
          }`}
        >
          准备垫图
        </button>
        <button
          onClick={() => setStep('generate')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            step === 'generate'
              ? 'bg-white text-black'
              : 'text-runway-slate hover:text-white hover:bg-runway-charcoal'
          }`}
        >
          生成视频
        </button>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {step === 'prepare' ? (
          <PrepareStep
            images={imagePrepare.images}
            selectedPadIds={imagePrepare.selectedPadIds}
            textToImagePrompt={imagePrepare.textToImagePrompt}
            img2imgPrompt={imagePrepare.img2imgPrompt}
            img2imgSources={imagePrepare.img2imgSources}
            aspectRatio={imagePrepare.aspectRatio}
            resolution={imagePrepare.resolution}
            t2iModel={imagePrepare.t2iModel}
            i2iModel={imagePrepare.i2iModel}
            loading={imagePrepare.loading}
            loadingMsg={imagePrepare.loadingMsg}
            activeTab={imagePrepare.prepareTab}
            t2iCompareVariants={imagePrepare.t2iCompareVariants}
            i2iCompareVariants={imagePrepare.i2iCompareVariants}
            onActiveTabChange={imagePrepare.setPrepareTab}
            onTogglePadSelect={imagePrepare.togglePadSelect}
            onRemoveImage={imagePrepare.removeImage}
            onTextToImage={imagePrepare.handleTextToImage}
            onImageUpload={imagePrepare.handleImageUpload}
            onImageToImage={imagePrepare.handleImageToImage}
            onRemoveSource={(idx) =>
              imagePrepare.setImg2imgSources((prev) => prev.filter((_, i) => i !== idx))
            }
            onTextToImagePromptChange={imagePrepare.setTextToImagePrompt}
            onImg2imgPromptChange={imagePrepare.setImg2imgPrompt}
            onAspectRatioChange={imagePrepare.setAspectRatio}
            onResolutionChange={imagePrepare.setResolution}
            onT2iModelChange={imagePrepare.setT2iModel}
            onI2iModelChange={imagePrepare.setI2iModel}
            onOpenCaptureModal={() => handleOpenCaptureModal('pad')}
            onOpenCompositor={() => setShowCompositorModal(true)}
            onAddToImg2imgSource={handleAddToImg2imgSource}
            onEditImg2imgSource={handleEditImg2imgSource}
            onEditPadImage={handleEditPadImage}
            onUpdateGroupSelectedUrls={imagePrepare.updateGroupSelectedUrls}
            onT2iCompareVariantsChange={imagePrepare.setT2iCompareVariants}
            onI2iCompareVariantsChange={imagePrepare.setI2iCompareVariants}
            onAddImage={imagePrepare.addImage}
            onNext={() => setStep('generate')}
          />
        ) : (
          <GenerateStep
            images={imagePrepare.images}
            selectedPadIds={imagePrepare.selectedPadIds}
            onTogglePadSelect={imagePrepare.togglePadSelect}
            onRemoveImage={imagePrepare.removeImage}
            onAddImage={imagePrepare.addImage}
            videoPrompt={videoGenerate.videoPrompt}
            videoDuration={videoGenerate.videoDuration}
            videoResolution={videoGenerate.videoResolution}
            videoRatio={videoGenerate.videoRatio}
            generateAudio={videoGenerate.generateAudio}
            realPersonMode={videoGenerate.realPersonMode}
            useRefVideo={videoGenerate.useRefVideo}
            useRefAudio={videoGenerate.useRefAudio}
            refVideoLocalUrl={videoGenerate.refVideoLocalUrl}
            refVideoUrl={videoGenerate.refVideoUrl}
            refAudioLocalName={videoGenerate.refAudioLocalName}
            refAudioUrl={videoGenerate.refAudioUrl}
            generatedVideoUrl={videoGenerate.generatedVideoUrl}
            videoGenerating={videoGenerate.videoGenerating}
            videoLoadingMsg={videoGenerate.videoLoadingMsg}
            loading={videoGenerate.loading}
            loadingMsg={videoGenerate.loadingMsg}
            scriptScenes={videoGenerate.scriptScenes}
            onScriptScenesChange={videoGenerate.setScriptScenes}
            onVideoPromptChange={videoGenerate.setVideoPrompt}
            onVideoDurationChange={videoGenerate.setVideoDuration}
            onVideoResolutionChange={videoGenerate.setVideoResolution}
            onVideoRatioChange={videoGenerate.setVideoRatio}
            onGenerateAudioChange={videoGenerate.setGenerateAudio}
            onRealPersonModeChange={videoGenerate.setRealPersonMode}
            onUseRefVideoChange={videoGenerate.setUseRefVideo}
            onUseRefAudioChange={videoGenerate.setUseRefAudio}
            onRefVideoUpload={videoGenerate.handleRefVideoUpload}
            onRefAudioUpload={videoGenerate.handleRefAudioUpload}
            onOpenVideoTrimModal={() => setShowVideoTrimModal(true)}
            onClearRefVideo={videoGenerate.clearRefVideo}
            onEditPadImage={handleEditPadImage}
            onUpdateGroupSelectedUrls={imagePrepare.updateGroupSelectedUrls}
            onGenerate={() =>
              videoGenerate.handleGenerateVideo(imagePrepare.images, imagePrepare.selectedPadIds)
            }
            onBack={() => setStep('prepare')}
          />
        )}
      </div>

      {/* 截帧弹窗 */}
      {showCaptureModal && (
        <CaptureFrameModal
          onConfirm={(frames) => {
            setShowCaptureModal(false);
            imagePrepare.handleCaptureConfirm(frames, captureDestination);
          }}
          onClose={() => setShowCaptureModal(false)}
        />
      )}

      {/* 视频裁剪弹窗 */}
      {showVideoTrimModal && (
        <VideoTrimModal
          onConfirm={(fileOrUrl, localUrl) => {
            setShowVideoTrimModal(false);
            videoGenerate.handleVideoTrimConfirm(fileOrUrl, localUrl);
          }}
          onClose={() => setShowVideoTrimModal(false)}
        />
      )}

      {/* 图片编辑弹窗 */}
      {editingImage && (
        <ImageEditorModal
          imageUrl={editingImage.url}
          originalUrl={editingImage.originalUrl}
          onSave={(dataUrl) => {
            imagePrepare.handleImageEditorSave(dataUrl, editingImage);
            setEditingImage(null);
          }}
          onClose={() => setEditingImage(null)}
        />
      )}

      {/* 图片位置融合弹窗 */}
      {showCompositorModal && (
        <ImageCompositorModal
          onClose={() => setShowCompositorModal(false)}
          onExport={handleCompositorExport}
        />
      )}
    </div>
  );
}
