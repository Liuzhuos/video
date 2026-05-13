import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { sendMessage } from '../api/chat';
import type { ChatMessage } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onAssistantMessage: (content: string) => void;
  disabled: boolean;
}

export default function ChatPanel({
  messages,
  setMessages,
  onAssistantMessage,
  disabled,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || disabled) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    // 发送后保持输入框焦点
    textareaRef.current?.focus();

    try {
      const allMessages = [...messages, userMsg];
      const reply = await sendMessage(allMessages);

      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now()}_reply`,
        role: 'assistant',
        content: reply,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      onAssistantMessage(reply);
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
      // 回复完成后重新聚焦输入框
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-runway-black">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 && (
          <div className="text-center mt-24">
            <p className="text-feature-title text-white mb-2">AI 视频创作助手</p>
            <p className="text-small text-runway-slate">告诉我你想制作什么样的视频，我来帮你规划分镜脚本</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-comfortable px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-white text-black'
                  : 'bg-runway-surface border border-runway-border text-runway-silver'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose-runway text-sm">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm tracking-body">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-runway-surface border border-runway-border rounded-comfortable px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-runway-slate" />
              <span className="text-sm text-runway-slate">思考中...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="border-t border-runway-border bg-runway-deep p-4">
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? '当前阶段不可对话' : '描述你的视频创意... (Enter 发送)'}
            disabled={disabled || loading}
            rows={1}
            className="flex-1 resize-none rounded-subtle bg-runway-surface border border-runway-border px-4 py-3 text-sm text-white placeholder-runway-slate focus:outline-none focus:border-runway-charcoal disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading || disabled}
            className="p-3 rounded-subtle bg-white text-black hover:bg-runway-cloud disabled:bg-runway-surface disabled:text-runway-slate disabled:cursor-not-allowed transition-colors"
            aria-label="发送消息"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
