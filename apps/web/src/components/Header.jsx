import React, { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { 
  Bell, 
  Wifi, 
  WifiOff, 
  LogOut, 
  Cpu, 
  RefreshCw 
} from 'lucide-react';

const Header = () => {
  const { 
    user, 
    incidents, 
    wsConnected, 
    setWsConnected, 
    triggerCheckNow, 
    logout 
  } = useContext(AppContext);
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = user?.role === 'ROLE_ADMIN';

  // Lấy tổng số incident đang OPEN
  const openIncidentsCount = incidents.filter(inc => inc.status === 'OPEN').length;

  // Tiêu đề động tùy theo trang
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return 'Tổng quan vận hành';
    if (path.includes('/nodes/')) return 'Chi tiết máy chủ';
    if (path.includes('/nodes')) return 'Quản lý máy chủ';
    if (path.includes('/incidents')) return 'Nhật ký sự cố';
    if (path.includes('/alert-channels')) return 'Kênh nhận cảnh báo';
    if (path.includes('/audit-logs')) return 'Nhật ký hệ thống';
    return 'Smart Ops Dashboard';
  };

  const handleAlertIndicatorClick = () => {
    navigate('/app/incidents?status=OPEN');
  };

  return (
    <header className="h-16 glass border-b border-slate-800/80 px-6 flex items-center justify-between text-slate-300">
      {/* Page Title */}
      <div>
        <h2 className="text-lg font-heading font-semibold text-white tracking-wide">
          {getPageTitle()}
        </h2>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-5">
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
          title={wsConnected ? "Bấm để ngắt kết nối WebSocket (Test chế độ Polling)" : "Bấm để kết nối lại WebSocket"}
        >
          {wsConnected ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 pulse-active inline-block"></span>
              <span>WS Live</span>
            </>
          ) : (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 pulse-alert inline-block"></span>
              <span>WS Offline</span>
            </>
          )}
        </button>

        {/* Global Urgent Scanning (ADMIN ONLY) */}
        {isAdmin && (
          <button
            onClick={triggerCheckNow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10 active:scale-95 transition-transform"
            title="Quét khẩn cấp toàn bộ hệ thống ngay (Rate-limited)"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Quét hệ thống</span>
          </button>
        )}

        {/* Alerts Indicator Badge */}
        <button 
          onClick={handleAlertIndicatorClick}
          className="relative p-2 rounded-lg hover:bg-slate-800/60 text-slate-400 hover:text-white transition-colors"
          title="Xem danh sách sự cố OPEN"
        >
          <Bell className="w-5 h-5" />
          {openIncidentsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-[#0b0f19]">
              {openIncidentsCount}
            </span>
          )}
        </button>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-red-500/30 text-slate-400 hover:text-red-400 hover:bg-red-950/10 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
