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

  const parseStoryboard = (content: string): Storyboard | null => {
    const match = content.match(/```storyboard\s*([\s\S]*?)```/);
    if (!match) return null;
    try {
      return JSON.parse(match[1].trim());
    } catch {
      return null;
    }
  };

  const handleAssistantMessage = (content: string) => {
    const parsed = parseStoryboard(content);
    if (parsed) {
      setStoryboard(parsed);
    }
  };

  const handleConfirmStoryboard = () => {
    setPhase('images');
  };

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

  const handleProceedToVideo = () => {
    setPhase('video');
    setVideoError(null);
    setVideoUrl(null);
  };

  const handleVideoComplete = (url: string) => {
    setVideoUrl(url);
    setPhase('done');
  };

  const handleVideoError = (error: string) => {
    setVideoError(error);
  };

  const handlePhaseClick = (targetPhase: ProjectPhase) => {
    setPhase(targetPhase);
    if (targetPhase !== 'video' && targetPhase !== 'done') {
      setVideoUrl(null);
      setVideoError(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <PhaseIndicator currentPhase={phase} onPhaseClick={handlePhaseClick} />

      <div className="flex-1 flex overflow-hidden">
        {phase === 'chat' ? (
          <>
            {/* 聊天阶段：左右分栏 */}
            <div
              className={`${
                storyboard ? 'w-1/2 border-r border-runway-border' : 'w-full'
              } flex flex-col`}
            >
              <ChatPanel
                messages={messages}
                setMessages={setMessages}
                onAssistantMessage={handleAssistantMessage}
                disabled={false}
              />
            </div>
            {storyboard && (
              <div className="w-1/2 flex flex-col">
                <StoryboardPanel
                  storyboard={storyboard}
                  phase={phase}
                  onConfirm={handleConfirmStoryboard}
                  onSceneImageUpdate={handleSceneImageUpdate}
                  onProceedToVideo={handleProceedToVideo}
                  onStoryboardChange={setStoryboard}
                />
              </div>
            )}
          </>
        ) : (phase === 'video' || phase === 'done') ? (
          <div className="w-full flex flex-col">
            <VideoPanel
              storyboard={storyboard!}
              videoUrl={videoUrl}
              videoError={videoError}
              onVideoComplete={handleVideoComplete}
              onVideoError={handleVideoError}
            />
          </div>
        ) : storyboard ? (
          /* 图片准备阶段：全宽分镜面板 */
          <div className="w-full flex flex-col">
            <StoryboardPanel
              storyboard={storyboard}
              phase={phase}
              onConfirm={handleConfirmStoryboard}
              onSceneImageUpdate={handleSceneImageUpdate}
              onProceedToVideo={handleProceedToVideo}
              onStoryboardChange={setStoryboard}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
