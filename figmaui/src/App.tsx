import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import QAEntryPage from './pages/QAEntryPage';
import PackagingEntryPage from './pages/PackagingEntryPage';
import DataImportPage from './pages/DataImportPage';
import LoginPage from './pages/LoginPage';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { AuthProvider, useAuth } from './context/AuthContext';

function Layout() {
  const { user } = useAuth();
  
  // 根据角色初始化默认页面
  const getInitialMenu = () => {
    if (user?.role === 'pkg') return '包装录入';
    if (user?.role === 'admin') return '数据导入';
    return '质检录入';
  };

  const [activeMenu, setActiveMenu] = useState(getInitialMenu());
  
  // 当用户变化时更新默认菜单 (例如登录后)
  // 注意：这可能会重置用户手动选择的菜单，所以仅在初始加载或 user 变化时有效
  // 但为了保留用户选择，我们通常只在初始化时设置。
  // 不过考虑到登录跳转，我们可以使用 useEffect
  
  /* 
   使用 useEffect 来确保登录后跳转正确页面，但需要小心避免循环。
   简单起见，我们在 useState 初始化时做一次。
   如果 Layout 组件在登录后被重新挂载（因为在 App.tsx 中 Route 切换了），那么 useState 会重新计算。
  */

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const renderPage = () => {
    switch (activeMenu) {
      case '质检录入':
        return <QAEntryPage />;
      case '包装录入':
        return <PackagingEntryPage />;
      case '看板分析':
        return <DashboardPage />;
      case '数据导入':
        return <DataImportPage />;
      default:
        return <QAEntryPage />;
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} role={user.role} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav user={user} />
        <main className="flex-1 overflow-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Layout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

