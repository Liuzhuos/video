import { Outlet, Link } from 'react-router-dom';
import { Film } from 'lucide-react';

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 text-gray-900 hover:text-blue-600 transition-colors">
          <Film className="w-6 h-6 text-blue-600" />
          <h1 className="text-lg font-semibold">AI 视频创作工坊</h1>
        </Link>
      </header>

      {/* 主内容 */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
