import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import AppNavbar from './AppNavbar';
import '../../styles/layout.css';

interface LayoutProps {
  children: React.ReactNode;
  pageTitle?: React.ReactNode;
  pageSubtitle?: React.ReactNode;
  titleAction?: React.ReactNode;
  backUrl?: string;
  onBack?: () => void;
  backText?: string;
  headerRight?: React.ReactNode;
  fullScreen?: boolean;
}

export default function Layout({ children, pageTitle, pageSubtitle, titleAction, backUrl, onBack, backText, headerRight, fullScreen }: LayoutProps) {
  const { pathname } = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => sessionStorage.getItem('sidebar_open') !== 'true'
  );

  const setSidebar = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    sessionStorage.setItem('sidebar_open', collapsed ? 'false' : 'true');
  };

  if (fullScreen) {
    return (
      <div className="layout full-screen">
        <main className="layout-content no-padding" style={{ height: '100vh', width: '100vw', overflow: 'auto', padding: '2rem' }}>
          {children}
        </main>
      </div>
    );
  }

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
      <AppNavbar 
          onToggleSidebar={() => setSidebar(!sidebarCollapsed)} 
          pageTitle={pageTitle}
          pageSubtitle={pageSubtitle}
          titleAction={titleAction}
          backUrl={backUrl}
          onBack={onBack}
          backText={backText}
          headerRight={headerRight}
      />
      <main className={`layout-content ${pathname === '/writing/correction' ? 'no-padding' : ''}`}>
        {children}
      </main>
    </div>
  );
}
