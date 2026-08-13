import React, { useRef } from 'react';
import AmbientBackground from './Ambientbackground';
import Sidebar, { type DashboardTab } from './Sidebar';
import { useScrollAnimations } from '../../hooks/Usescrollanimations.ts';

interface DashboardLayoutProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

/**
 * Ensambla el "esqueleto" que antes vivía todo junto en CMODashboard.tsx:
 * ambient background + sidebar + <main>. El contenido de cada tab
 * (children) lo sigue decidiendo el padre (DashboardPage).
 *
 * También corre aquí la animación de scroll (useScrollAnimations),
 * ya que depende directamente del <main ref={...}>.
 */
const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  activeTab,
  onTabChange,
  onLogout,
  children,
}) => {
  const mainContentRef = useRef<HTMLDivElement>(null);
  useScrollAnimations(mainContentRef, activeTab);

  return (
    <div className="app-layout">
      <AmbientBackground />
      <Sidebar activeTab={activeTab} onTabChange={onTabChange} onLogout={onLogout} />
      <main className="main-content" ref={mainContentRef}>
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;