import { Outlet, useMatch } from 'react-router-dom';
import AppSidebar from './AppSidebar';

export default function AppLayout() {
  // /apps 精确匹配时（应用中心首页）不显示侧边栏
  const isAppsIndex = useMatch('/apps');

  return (
    <div className="flex flex-1 overflow-hidden h-[calc(100vh-56px)]">
      {!isAppsIndex && <AppSidebar />}
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
