import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { MobileNavigation } from './MobileNavigation';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('pnp_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pnp_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#071017] dark:text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Top Navigation */}
      <MobileNavigation />

      {/* Desktop Left Sidebar */}
      <Sidebar isCollapsed={isCollapsed} onToggleCollapse={toggleCollapse} />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col overflow-x-hidden">
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  );
};
