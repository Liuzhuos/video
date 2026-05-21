import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import AppLayout from './components/AppLayout';
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import AppsPage from './pages/AppsPage';
import ProjectPage from './pages/ProjectPage';
import FissionPage from './pages/FissionPage';
import LoginPage from './pages/LoginPage';
import AssetsPage from './pages/AssetsPage';
import AdminPage from './pages/AdminPage';
import { getToken, getUser } from './api/request';

// 路由守卫：未登录跳转到登录页
function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = getToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// 路由守卫：需要管理员权限
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const token = getToken();
  const user = getUser();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<HomePage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="apps" element={<AppsPage />} />
        {/* 具体应用页面带侧边栏 */}
        <Route path="apps" element={<AppLayout />}>
          <Route path="storyboard" element={<ProjectPage />} />
          <Route path="video-fission" element={<FissionPage />} />
        </Route>
        {/* 保留旧路由兼容 */}
        <Route path="project" element={<ProjectPage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
      </Route>
    </Routes>
  );
}

export default App;
