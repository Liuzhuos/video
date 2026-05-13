import { MessageSquare } from 'lucide-react';

export default function ChatPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-24 text-center">
      <MessageSquare className="w-12 h-12 text-runway-mid-slate mx-auto mb-6" />
      <h2 className="text-2xl font-semibold text-white mb-3">对话功能</h2>
      <p className="text-runway-slate text-sm max-w-md mx-auto">
        AI 对话功能正在开发中，敬请期待...
      </p>
    </div>
  );
}
