import { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Film, User, LogOut, ChevronDown, FolderOpen, Settings } from 'lucide-react';
import { getUser, logout } from '../api/request';

const tabs = [
  { name: '首页', path: '/' },
  { name: '对话', path: '/chat' },
  { name: '应用', path: '/apps' },
];

function UserMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const user = getUser();

  // 点击外部关闭菜单
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setOpen(false);
    logout();
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* 头像按钮 */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-runway-surface/50 transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium">
          {user?.nickname?.charAt(0) || user?.username?.charAt(0) || 'U'}
        </div>
        <span className="text-sm text-runway-slate max-w-[80px] truncate hidden sm:inline">
          {user?.nickname || user?.username || '用户'}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-runway-slate transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* 下拉菜单 */}
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-runway-surface border border-runway-border rounded-lg shadow-xl py-1 z-50">
          {/* 用户信息 */}
          <div className="px-4 py-3 border-b border-runway-border">
            <p className="text-sm font-medium text-white truncate">
              {user?.nickname || user?.username || '用户'}
            </p>
            <p className="text-xs text-runway-slate mt-0.5 truncate">
              @{user?.username || '未知'}
            </p>
            {user?.role && (
              <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-500/20 text-blue-400">
                {user.role === 'admin' ? '管理员' : '普通用户'}
              </span>
            )}
          </div>

          {/* 菜单项 */}
          <div className="py-1">
            <button
              onClick={() => {
                setOpen(false);
                navigate('/assets');
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-runway-slate hover:text-white hover:bg-runway-border/50 transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              个人资产
            </button>
            {user?.role === 'ADMIN' && (
              <button
                onClick={() => {
                  setOpen(false);
                  navigate('/admin');
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-runway-slate hover:text-white hover:bg-runway-border/50 transition-colors"
              >
                <Settings className="w-4 h-4" />
                系统管理
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-runway-slate hover:text-white hover:bg-runway-border/50 transition-colors"
            >
              <User className="w-4 h-4" />
              个人信息
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-runway-border/50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              退出登录
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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

          {/* 右侧用户菜单 */}
          <div className="ml-auto">
            <UserMenu />
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
