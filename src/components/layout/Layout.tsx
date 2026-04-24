import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import AppNavbar from './AppNavbar';
import '../../styles/layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { pathname } = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => sessionStorage.getItem('sidebar_open') !== 'true'
  );

  const shouldHideNavbar = [
    '/writing/chart/doing',
    '/writing/task2/doing',
    '/writing/correction',
    '/vocabulary/practice/doing',
  ].includes(pathname);

  const isVocabularyDoingRoute =
    pathname.startsWith('/vocabulary/practice/') && pathname.endsWith('/doing');

  const setSidebar = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    sessionStorage.setItem('sidebar_open', collapsed ? 'false' : 'true');
  };

  return (
    <div className={`layout ${sidebarCollapsed ? 'collapsed-sidebar' : ''}`}>
      {/* 遮罩层：点击关闭侧边栏 */}
      {!sidebarCollapsed && (
        <div className="sidebar-overlay" onClick={() => setSidebar(true)} />
      )}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebar(!sidebarCollapsed)}
      />
      {!shouldHideNavbar && !isVocabularyDoingRoute && (
        <AppNavbar onToggleSidebar={() => setSidebar(!sidebarCollapsed)} />
      )}
      <main className="layout-content">
        {children}
      </main>
    </div>
  );
}
