import React, { useState } from 'react';
import cmoImage from '../../assets/cmo.png';
export type DashboardTab =
  | 'inicio'
  | 'nueva_atencion'
  | 'mis_pacientes'
  | 'pacientes_externos'
  | 'modelos'
  | 'reportes';

interface SidebarProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  onLogout: () => void;
}

/**
 * Sidebar con toggle de contraer/expandir. El estado `collapsed` vive
 * aquí mismo porque es puramente visual (no afecta datos ni otras partes
 * del dashboard). Agrega la clase "collapsed" al <aside>, que se controla
 * por CSS (ver Dashboardpage.css).
 */
const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);

  const navItem = (
    tab: DashboardTab,
    label: string,
    icon: React.ReactNode,
    extraClass = ''
  ) => (
    <a
      href="#"
      className={`${extraClass} ${activeTab === tab ? 'active' : ''}`.trim()}
      title={collapsed ? label : undefined}
      onClick={(e) => {
        e.preventDefault();
        onTabChange(tab);
      }}
    >
      {icon}
      <span className="sidebar-nav-label">{label}</span>
      {tab === 'inicio' && <span className="badge">3</span>}
    </a>
  );

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`.trim()}>
      <div className="sidebar-top">
        <a href="#" className="sidebar-brand">
          <span className="sidebar-brand-mark">
            <img src={cmoImage} alt="CMO" />
          </span>
          <span className="sidebar-brand-text">
            CMO
            <span className="sidebar-brand-sub">Consultores Médicos Oruro</span>
          </span>
        </a>

        <button
          type="button"
          className="sidebar-toggle-btn"
          onClick={() => setCollapsed((prev) => !prev)}
          title={collapsed ? 'Expandir menú' : 'Contraer menú'}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      <nav className="sidebar-nav" id="sidebarNav">
        {navItem(
          'inicio',
          'Inicio',
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        )}

        {navItem(
          'nueva_atencion',
          'Nueva atención',
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>,
          'sidebar-action-btn'
        )}

        {navItem(
          'mis_pacientes',
          'Mis Pacientes',
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        )}

        {navItem(
          'pacientes_externos',
          'Pacientes Externos',
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
        )}

        {navItem(
          'modelos',
          'Modelos',
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        )}

        {navItem(
          'reportes',
          'Reportes',
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="avatar">RG</div>
        <div className="user-info">
          <div className="name">Dr. Miguel</div>
        </div>
        <button className="logout" title="Cerrar sesión" onClick={onLogout}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;