import { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { usePreferences } from '../context/PreferencesContext';
import {
  LayoutDashboard,
  Server,
  AlertTriangle,
  BellRing,
  FileText,
  User,
  Shield,
  Settings
} from 'lucide-react';

const Sidebar = () => {
  const { user, incidents } = useContext(AppContext);
  const { t } = usePreferences();
  const isAdmin = user?.role === 'ROLE_ADMIN';

  const activeIncidentsCount = incidents?.filter((i) => i.status !== 'RESOLVED').length || 0;

  const menuItems = [
    { key: 'dashboard', path: '/app/dashboard', icon: LayoutDashboard, role: 'ALL' },
    { key: 'nodes', path: '/app/nodes', icon: Server, role: 'ALL' },
    { key: 'incidents', path: '/app/incidents', icon: AlertTriangle, role: 'ALL' },
    { key: 'alertChannels', path: '/app/alert-channels', icon: BellRing, role: 'ADMIN' },
    { key: 'auditLogs', path: '/app/audit-logs', icon: FileText, role: 'ADMIN' },
    { key: 'systemConfig', path: '/app/system-config', icon: Settings, role: 'ADMIN' },
  ];

  return (
    <aside className="w-64 glass border-r border-slate-200 dark:border-slate-800 flex flex-col min-h-screen text-slate-700 dark:text-slate-300 shrink-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-800/80 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <span className="font-heading font-bold text-white text-lg tracking-wider">SO</span>
        </div>
        <div>
          <h1 className="font-heading font-bold text-slate-100 leading-none text-base tracking-tight">Smart Ops</h1>
          <span className="text-xs text-indigo-500 dark:text-indigo-400 tracking-wider uppercase font-bold">{t('app.engine')}</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5">
        {menuItems.map((item) => {
          // Ẩn menu nếu là ADMIN-only mà user không có quyền
          if (item.role === 'ADMIN' && !isAdmin) return null;

          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center justify-between px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-500/15 to-purple-500/10 text-indigo-600 dark:text-indigo-400 border-l-4 border-indigo-500 font-bold shadow-2xs'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-50 border-l-4 border-transparent text-slate-600 dark:text-slate-400'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5" />
                <span className="text-sm">{t(`nav.${item.key}`)}</span>
              </div>
              {item.key === 'incidents' && activeIncidentsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 pulse-alert">
                  {activeIncidentsCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Information Summary */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-950/20">
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50">
          <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 shrink-0">
            {isAdmin ? (
              <Shield className="w-5 h-5 text-purple-500 dark:text-purple-400" />
            ) : (
              <User className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-100 truncate leading-tight">
              {user?.fullName.split(' (')[0]}
            </p>
            <span className="text-xs text-slate-400 font-medium">
              {t(`role.${isAdmin ? 'ROLE_ADMIN' : 'ROLE_VIEWER'}`)}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
