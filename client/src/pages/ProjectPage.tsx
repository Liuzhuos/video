import { useState } from 'react';
import type { ChatMessage, Storyboard, ProjectPhase } from '../types';
import ChatPanel from '../components/ChatPanel';
import StoryboardPanel from '../components/StoryboardPanel';
import VideoPanel from '../components/VideoPanel';
import PhaseIndicator from '../components/PhaseIndicator';

export default function ProjectPage() {
  const [phase, setPhase] = useState<ProjectPhase>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  // 从AI回复中解析分镜脚本
  const parseStoryboard = (content: string): Storyboard | null => {
    const match = content.match(/```storyboard\s*([\s\S]*?)```/);
    if (!match) return null;

    try {
      return JSON.parse(match[1].trim());
    } catch {
      return null;
    }
  };

  // 处理AI回复，检查是否包含分镜脚本
  const handleAssistantMessage = (content: string) => {
    const parsed = parseStoryboard(content);
    if (parsed) {
      setStoryboard(parsed);
    }
  };

  // 确认分镜脚本，进入图片准备阶段
  const handleConfirmStoryboard = () => {
    setPhase('images');
  };

  // 更新某个分镜的图片
  const handleSceneImageUpdate = (sceneId: number, imageUrl: string) => {
    setStoryboard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        scenes: prev.scenes.map((scene) =>
          scene.id === sceneId ? { ...scene, imageUrl: imageUrl || undefined } : scene
        ),
      };
    });
  };

  // 所有图片就绪，进入视频生成阶段
  const handleProceedToVideo = () => {
    setPhase('video');
    setVideoError(null);
    setVideoUrl(null);
  };

  // 视频生成完成
  const handleVideoComplete = (url: string) => {
    setVideoUrl(url);
    setPhase('done');
  };

  // 视频生成失败
  const handleVideoError = (error: string) => {
    setVideoError(error);
  };

  // 点击阶段指示器回退
  const handlePhaseClick = (targetPhase: ProjectPhase) => {
    // 回退到对话阶段时，重新启用聊天
    // 回退到图片阶段时，可以重新编辑图片
    setPhase(targetPhase);
    // 如果从视频/完成阶段回退，清除视频状态
    if (targetPhase !== 'video' && targetPhase !== 'done') {
      setVideoUrl(null);
      setVideoError(null);
    }
  };

  return (
    <div className="h-[calc(100vh-57px)] flex flex-col">
      {/* 阶段指示器 */}
      <PhaseIndicator currentPhase={phase} onPhaseClick={handlePhaseClick} />

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：聊天面板 */}
        <div
          className={`${
            storyboard ? 'w-1/2 border-r border-gray-200' : 'w-full'
          } flex flex-col`}
        >
          <ChatPanel
            messages={messages}
            setMessages={setMessages}
            onAssistantMessage={handleAssistantMessage}
            disabled={phase !== 'chat'}
          />
        </div>

        {/* 右侧面板 */}
        {storyboard && (
          <div className="w-1/2 flex flex-col">
            {(phase === 'video' || phase === 'done') ? (
              <VideoPanel
                storyboard={storyboard}
                videoUrl={videoUrl}
                videoError={videoError}
                onVideoComplete={handleVideoComplete}
                onVideoError={handleVideoError}
              />
            ) : (
              <StoryboardPanel
                storyboard={storyboard}
                phase={phase}
                onConfirm={handleConfirmStoryboard}
                onSceneImageUpdate={handleSceneImageUpdate}
                onProceedToVideo={handleProceedToVideo}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
