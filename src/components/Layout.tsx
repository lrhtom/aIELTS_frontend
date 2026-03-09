import { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import AppNavbar from './AppNavbar';
import '../styles/layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // 点击侧边栏外部区域时收起
  useEffect(() => {
    if (sidebarCollapsed) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setSidebarCollapsed(true);
      }
    };

    // 延迟注册，避免触发打开菜单的那次点击
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [sidebarCollapsed]);

  return (
    <div className={`layout ${sidebarCollapsed ? 'collapsed-sidebar' : ''}`}>
      {/* 遮罩层：菜单打开时半透明背景，点击即关闭 */}
      {!sidebarCollapsed && (
        <div className="sidebar-overlay" onClick={() => setSidebarCollapsed(true)} />
      )}
      <div ref={sidebarRef}>
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>
      <AppNavbar onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main className="layout-content">
        {children}
      </main>
    </div>
  );
}