import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { 
  LayoutDashboard, 
  Server, 
  AlertTriangle, 
  BellRing, 
  FileText, 
  ShieldAlert,
  User,
  Shield
} from 'lucide-react';

const Sidebar = () => {
  const { user } = useContext(AppContext);
  const isAdmin = user?.role === 'ROLE_ADMIN';

  const menuItems = [
    { name: 'Tổng quan', path: '/app/dashboard', icon: LayoutDashboard, role: 'ALL' },
    { name: 'Máy chủ', path: '/app/nodes', icon: Server, role: 'ALL' },
    { name: 'Sự cố', path: '/app/incidents', icon: AlertTriangle, role: 'ALL' },
    { name: 'Kênh thông báo', path: '/app/alert-channels', icon: BellRing, role: 'ADMIN' },
    { name: 'Nhật ký hệ thống', path: '/app/audit-logs', icon: FileText, role: 'ADMIN' },
  ];

  return (
    <aside className="w-64 glass border-r border-slate-800 flex flex-col min-h-screen text-slate-300">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800/80 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <span className="font-heading font-bold text-white text-lg tracking-wider">SO</span>
        </div>
        <div>
          <h1 className="font-heading font-semibold text-white leading-none text-base">Smart Ops</h1>
          <span className="text-[10px] text-indigo-400 tracking-wider uppercase font-semibold">Engine v2.0</span>
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
                `flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-500/15 to-purple-500/10 text-indigo-400 border-l-4 border-indigo-500 font-semibold'
                    : 'hover:bg-slate-800/50 hover:text-white border-l-4 border-transparent'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Information Summary */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/20">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/40 border border-slate-800/50">
          <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
            {isAdmin ? (
              <Shield className="w-5 h-5 text-purple-400" />
            ) : (
              <User className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate leading-tight">
              {user?.fullName.split(' (')[0]}
            </p>
            <span className="text-[10px] text-slate-500 font-mono">
              {user?.role === 'ROLE_ADMIN' ? 'ROLE_ADMIN' : 'ROLE_VIEWER'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
