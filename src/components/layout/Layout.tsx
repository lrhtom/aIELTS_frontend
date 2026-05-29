import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import AppNavbar from './AppNavbar';
import '../../styles/layout.css';

interface LayoutProps {
  children: React.ReactNode;
  pageTitle?: React.ReactNode;
  pageSubtitle?: React.ReactNode;
  backUrl?: string;
  onBack?: () => void;
  backText?: string;
  headerRight?: React.ReactNode;
}

export default function Layout({ children, pageTitle, pageSubtitle, backUrl, onBack, backText, headerRight }: LayoutProps) {
  const { pathname } = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => sessionStorage.getItem('sidebar_open') !== 'true'
  );

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
      <AppNavbar 
          onToggleSidebar={() => setSidebar(!sidebarCollapsed)} 
          pageTitle={pageTitle}
          pageSubtitle={pageSubtitle}
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
