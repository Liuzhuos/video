import { Outlet, Link, useLocation } from 'react-router-dom';
import { Film } from 'lucide-react';

const tabs = [
  { name: '首页', path: '/' },
  { name: '对话', path: '/chat' },
  { name: '应用', path: '/apps' },
];

export default function Layout() {
  const location = useLocation();

  const isActiveTab = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-runway-black flex flex-col">
      {/* 顶部导航 */}
      <header className="bg-runway-black/80 backdrop-blur-sm border-b border-runway-border px-6 sticky top-0 z-50">
        <div className="flex items-center h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 text-white hover:opacity-80 transition-opacity mr-10">
            <Film className="w-5 h-5" />
            <h1 className="text-base font-medium tracking-body">AI Studio</h1>
          </Link>

          {/* 标签页导航 */}
          <nav className="flex items-center gap-1 h-full">
            {tabs.map((tab) => (
              <Link
                key={tab.path}
                to={tab.path}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActiveTab(tab.path)
                    ? 'text-white bg-runway-surface'
                    : 'text-runway-slate hover:text-white hover:bg-runway-surface/50'
                }`}
              >
                {tab.name}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
