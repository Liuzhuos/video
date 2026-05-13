import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import AppLayout from './components/AppLayout';
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import AppsPage from './pages/AppsPage';
import ProjectPage from './pages/ProjectPage';
import FissionPage from './pages/FissionPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
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
      </Route>
    </Routes>
  );
}

export default App;
