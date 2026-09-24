import { NavLink, Outlet } from 'react-router-dom';
import { Activity, BarChart3, CarFront, ChevronRight, CircleGauge, Clock3, Cross, LayoutDashboard, Menu, Settings, ShieldCheck, Siren, UserRound, UsersRound, X } from 'lucide-react';
import { useState } from 'react';

const navigation = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Traffic Analysis', path: '/traffic-analysis', icon: CarFront },
  { label: 'Signal Control', path: '/signal-control', icon: Activity },
  { label: 'Emergency', path: '/emergency', icon: Siren },
  { label: 'Pedestrian', path: '/pedestrian', icon: UsersRound },
  { label: 'Performance', path: '/performance', icon: BarChart3 },
  { label: 'Settings', path: '/settings', icon: Settings },
];

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Cross size={21} strokeWidth={2.5} /></div>
          <div><strong>FlowSync</strong><span>Traffic control OS</span></div>
          <button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <div className="sidebar-label">Control centre</div>
        <nav className="sidebar-nav">
          {navigation.map(({ label, path, icon: Icon }) => (
            <NavLink key={path} to={path} end={path === '/'} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} /><span>{label}</span>{label === 'Dashboard' && <span className="nav-live-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="operator-card"><div className="avatar"><UserRound size={17} /></div><div><strong>Control room</strong><span>Operator session</span></div><ChevronRight size={15} /></div>
          <div className="version"><ShieldCheck size={14} /> Safety layer connected <span>v0.1</span></div>
        </div>
      </aside>
      {mobileOpen && <button className="sidebar-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation overlay" />}
      <main className="main-shell">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="breadcrumb"><span>FlowSync</span><ChevronRight size={14} /><strong>Operations overview</strong></div>
          <div className="topbar-actions">
            <div className="system-pill"><span className="pulse-dot" />System online</div>
            <div className="topbar-clock"><Clock3 size={15} /> <span>Tuesday, 10:31 AM</span></div>
            <div className="avatar avatar-top"><UserRound size={16} /></div>
          </div>
        </header>
        <div className="content-area"><Outlet /></div>
      </main>
    </div>
  );
}
