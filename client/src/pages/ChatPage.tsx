import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Square, Sparkles, ArrowUp, Lightbulb, Code, Film, PenLine, RotateCcw, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { sendMessage } from '../api/chat';
import type { ChatMessage } from '../types';

/** 建议提示词卡片 */
const SUGGESTIONS = [
  { icon: Film, text: '帮我写一个产品介绍的短视频脚本', color: 'violet' },
  { icon: Lightbulb, text: '用通俗的语言解释量子计算', color: 'amber' },
  { icon: PenLine, text: '给我推荐几个适合周末的活动', color: 'emerald' },
  { icon: Code, text: '帮我优化这段代码的性能', color: 'blue' },
];

const COLOR_MAP: Record<string, { gradient: string; border: string; icon: string }> = {
  violet: { gradient: 'from-violet-500/10 to-purple-500/5', border: 'border-violet-500/20 hover:border-violet-400/40', icon: 'text-violet-400' },
  amber: { gradient: 'from-amber-500/10 to-orange-500/5', border: 'border-amber-500/20 hover:border-amber-400/40', icon: 'text-amber-400' },
  emerald: { gradient: 'from-emerald-500/10 to-teal-500/5', border: 'border-emerald-500/20 hover:border-emerald-400/40', icon: 'text-emerald-400' },
  blue: { gradient: 'from-blue-500/10 to-cyan-500/5', border: 'border-blue-500/20 hover:border-blue-400/40', icon: 'text-blue-400' },
};

/** 打字机效果 hook */
function useTypewriter(text: string, speed = 20) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return { displayed, done };
}

/** 单条 AI 消息组件（带打字机效果） */
function AssistantMessage({ content, isLatest }: { content: string; isLatest: boolean }) {
  const { displayed, done } = useTypewriter(content, isLatest ? 15 : 0);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const showContent = isLatest ? displayed : content;
  const showCursor = isLatest && !done;

  return (
    <div className="group">
      <div className="prose-runway text-[14px] leading-7">
        <ReactMarkdown>{showContent}</ReactMarkdown>
        {showCursor && (
          <span className="inline-block w-0.5 h-4 bg-white/80 animate-pulse ml-0.5 align-middle" />
        )}
      </div>
      {/* 消息操作栏 */}
      {(done || !isLatest) && (
        <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-runway-mid-slate hover:text-white hover:bg-runway-surface transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? '已复制' : '复制'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [latestAssistantId, setLatestAssistantId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isEmpty = messages.length === 0;

  // 自动滚动到底部
  useEffect(() => {
    if (!isEmpty) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isEmpty]);

  // 自动调整 textarea 高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = async (text?: string) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const allMessages = [...messages, userMsg];
      const reply = await sendMessage(allMessages);

      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now()}_reply`,
        role: 'assistant',
        content: reply,
        timestamp: Date.now(),
      };

      setLatestAssistantId(assistantMsg.id);
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error: any) {
      const errorMsg: ChatMessage = {
        id: `msg_${Date.now()}_error`,
        role: 'assistant',
        content: `⚠️ 出错了：${error.message}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStop = () => {
    setLoading(false);
  };

  const handleNewChat = () => {
    setMessages([]);
    setLatestAssistantId(null);
    setInput('');
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col relative overflow-hidden">
      {/* 背景装饰 */}
      {isEmpty && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-500/[0.03] rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/[0.03] rounded-full blur-3xl" />
        </div>
      )}

      {/* ── 顶部操作栏（有消息时显示） ── */}
      {!isEmpty && (
        <div className="absolute top-4 right-6 z-10">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-runway-slate bg-runway-surface/80 backdrop-blur-sm border border-runway-border hover:text-white hover:border-runway-charcoal transition-all duration-200"
          >
            <RotateCcw className="w-3 h-3" />
            新对话
          </button>
        </div>
      )}

      {/* ── 消息列表区域 ── */}
      {!isEmpty && (
        <div className="flex-1 overflow-y-auto pb-44 scrollbar-hidden">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-4">
                {/* 头像 */}
                <div className="flex-shrink-0 pt-0.5">
                  {msg.role === 'user' ? (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold ring-2 ring-blue-500/20">
                      我
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center ring-2 ring-emerald-500/20">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>

                {/* 消息内容 */}
                <div className="flex-1 min-w-0 pt-1">
                  {msg.role === 'assistant' ? (
                    <AssistantMessage
                      content={msg.content}
                      isLatest={msg.id === latestAssistantId}
                    />
                  ) : (
                    <p className="text-[14px] text-white leading-7 whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* 加载指示器 */}
            {loading && (
              <div className="flex gap-4">
                <div className="flex-shrink-0 pt-0.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center ring-2 ring-emerald-500/20">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div className="flex-1 pt-2.5">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-emerald-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-emerald-400/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* ── 悬浮输入框区域 ── */}
      <div
        className={`w-full transition-all duration-500 ease-out ${
          isEmpty
            ? 'absolute inset-0 flex flex-col items-center justify-center px-4'
            : 'absolute bottom-0 left-0 right-0 px-4 pb-6 pt-10 bg-gradient-to-t from-runway-black via-runway-black/98 via-60% to-transparent'
        }`}
      >
        {/* 空状态欢迎区域 */}
        {isEmpty && (
          <div className="text-center mb-10 space-y-4">
            <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 via-purple-500/10 to-emerald-500/20 border border-white/[0.06] mb-2">
              <Sparkles className="w-8 h-8 text-blue-400" />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-400/10 to-transparent animate-pulse" />
            </div>
            <h2 className="text-3xl font-semibold text-white tracking-tight">
              有什么可以帮你的？
            </h2>
            <p className="text-[15px] text-runway-slate max-w-lg mx-auto leading-relaxed">
              我是你的 AI 助手，可以帮你创作内容、解答问题、编写代码，或者只是聊聊天
            </p>
          </div>
        )}

        {/* 输入框容器 */}
        <div className="w-full max-w-2xl mx-auto">
          <div className="relative bg-runway-surface/70 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.4)] transition-all duration-300 focus-within:border-white/[0.15] focus-within:shadow-[0_8px_60px_rgba(0,0,0,0.5)] focus-within:bg-runway-surface/90">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的问题..."
              rows={1}
              className="w-full resize-none bg-transparent px-5 pt-4 pb-14 text-[14px] text-white placeholder-runway-mid-slate/70 focus:outline-none leading-relaxed"
              style={{ maxHeight: '200px' }}
            />

            {/* 底部工具栏 */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2 text-runway-mid-slate/50">
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/[0.04] border border-white/[0.06]">
                  Enter
                </kbd>
                <span className="hidden sm:inline text-[10px]">发送</span>
                <span className="hidden sm:inline text-[10px] mx-1">·</span>
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/[0.04] border border-white/[0.06]">
                  Shift + Enter
                </kbd>
                <span className="hidden sm:inline text-[10px]">换行</span>
              </div>

              <div className="flex items-center gap-2">
                {loading ? (
                  <button
                    onClick={handleStop}
                    className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/[0.08] text-runway-slate border border-white/[0.08] hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all duration-200"
                    aria-label="停止生成"
                  >
                    <Square className="w-3 h-3 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim()}
                    className="flex items-center justify-center w-8 h-8 rounded-xl bg-white text-black hover:bg-white/90 hover:scale-105 disabled:bg-white/[0.06] disabled:text-runway-mid-slate/50 disabled:scale-100 disabled:cursor-not-allowed transition-all duration-200"
                    aria-label="发送消息"
                  >
                    <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 建议提示词卡片（仅空状态显示） */}
          {isEmpty && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SUGGESTIONS.map((s, i) => {
                const colors = COLOR_MAP[s.color];
                return (
                  <button
                    key={i}
                    onClick={() => handleSend(s.text)}
                    className={`group relative flex items-start gap-3 px-4 py-3.5 text-left bg-gradient-to-br ${colors.gradient} border ${colors.border} rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]`}
                  >
                    {/* hover 光效 */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-white/[0.02] to-transparent" />
                    <s.icon className={`w-4 h-4 ${colors.icon} mt-0.5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110`} />
                    <span className="text-[13px] text-runway-silver/90 group-hover:text-white transition-colors leading-snug relative z-10">
                      {s.text}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 底部提示 */}
          {isEmpty && (
            <p className="text-center text-[11px] text-runway-mid-slate/40 mt-5">
              AI 生成的内容可能存在错误，请注意甄别
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
