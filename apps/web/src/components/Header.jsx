import { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { usePreferences } from '../context/PreferencesContext';
import PreferenceToggles from './PreferenceToggles';
import {
  Bell,
  LogOut,
  Cpu
} from 'lucide-react';

// Khóa i18n của tiêu đề theo đường dẫn — '/nodes/' phải đứng trước '/nodes'
const PAGE_TITLES = [
  ['/dashboard', 'dashboard'],
  ['/nodes/', 'nodeDetail'],
  ['/nodes', 'nodes'],
  ['/incidents', 'incidents'],
  ['/diagnosis', 'diagnosis'],
  ['/alert-channels', 'alertChannels'],
  ['/audit-logs', 'auditLogs'],
  ['/system-config', 'systemConfig'],
];

const Header = () => {
  const {
    user,
    incidents,
    wsConnected,
    setWsConnected,
    triggerCheckNow,
    logout
  } = useContext(AppContext);
  const { t } = usePreferences();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = user?.role === 'ROLE_ADMIN';

  // Lấy tổng số incident đang OPEN
  const openIncidentsCount = incidents.filter(inc => inc.status === 'OPEN').length;

  // Tiêu đề động tùy theo trang
  const titleKey = PAGE_TITLES.find(([path]) => location.pathname.includes(path))?.[1] || 'fallback';

  return (
    <header className="h-16 glass border-b border-slate-800/80 px-6 flex items-center justify-between text-slate-300 shrink-0">
      {/* Page Title */}
      <div>
        <h2 className="text-lg font-heading font-semibold text-slate-50 tracking-wide">
          {t(`header.titles.${titleKey}`)}
        </h2>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-4">
        {/* WebSocket Connection Control Indicator */}
        <button
          onClick={() => {
            setWsConnected(prev => !prev);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer border transition-colors ${
            wsConnected
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20 hover:bg-emerald-950/60'
              : 'bg-red-950/40 text-red-400 border-red-500/20 hover:bg-red-950/60'
          }`}
          title={wsConnected ? t('header.wsDisconnectHint') : t('header.wsReconnectHint')}
        >
          <span className={`w-2.5 h-2.5 rounded-full inline-block ${wsConnected ? 'bg-emerald-500 pulse-active' : 'bg-red-500 pulse-alert'}`}></span>
          <span>{wsConnected ? t('header.wsLive') : t('header.wsOffline')}</span>
        </button>

        {/* Global Urgent Scanning (ADMIN ONLY) */}
        {isAdmin && (
          <button
            onClick={triggerCheckNow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10 active:scale-95 transition-transform cursor-pointer"
            title={t('header.scanHint')}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>{t('header.scan')}</span>
          </button>
        )}

        {/* Alerts Indicator Badge */}
        <button
          onClick={() => navigate('/app/incidents?status=OPEN')}
          className={`relative p-2 rounded-xl transition-all cursor-pointer ${
            openIncidentsCount > 0
              ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
              : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-50'
          }`}
          title={t('header.openIncidentsHint')}
        >
          <Bell className={`w-5 h-5 ${openIncidentsCount > 0 ? 'animate-siren' : ''}`} />
          {openIncidentsCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-600 text-white rounded-full text-[10px] font-extrabold flex items-center justify-center border-2 border-[var(--soe-bg)] shadow-md shadow-red-600/50 pulse-alert">
              {openIncidentsCount}
            </span>
          )}
        </button>

        {/* Theme + language */}
        <PreferenceToggles />

        {/* Logout Button */}
        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-red-500/30 text-slate-400 hover:text-red-400 hover:bg-red-950/10 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>{t('header.logout')}</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
