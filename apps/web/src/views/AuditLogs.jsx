import { useContext, useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { usePreferences } from '../context/PreferencesContext';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  X, 
  User,
  Database
} from 'lucide-react';

const PAGE_SIZE = 10; // Đặt 10 dòng để dễ nhìn trên demo

const AuditLogsContent = () => {
  const { auditLogs } = useContext(AppContext);
  const { t, formatDateTime } = usePreferences();

  // --- Filter states ---
  const [actionFilter, setActionFilter] = useState('ALL');
  const [userFilter, setUserFilter] = useState('ALL');
  const [targetFilter, setTargetFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // --- Pagination states ---
  const [currentPage, setCurrentPage] = useState(1);

  // --- Details Dialog states ---
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Thu thập danh sách người thực hiện và loại đối tượng để làm dropdown filter
  const filterOptions = useMemo(() => {
    const users = new Set(auditLogs.map(l => l.username));
    const targets = new Set(auditLogs.map(l => l.target));
    return {
      users: Array.from(users),
      targets: Array.from(targets)
    };
  }, [auditLogs]);

  // Lọc log theo bộ lọc
  const filteredLogs = useMemo(() => {
    let result = [...auditLogs];

    if (actionFilter !== 'ALL') {
      result = result.filter(l => l.action === actionFilter);
    }
    if (userFilter !== 'ALL') {
      result = result.filter(l => l.username === userFilter);
    }
    if (targetFilter !== 'ALL') {
      result = result.filter(l => l.target === targetFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(l => 
        l.username.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.target.toLowerCase().includes(q) ||
        (l.ipAddress && l.ipAddress.includes(q))
      );
    }

    return result;
  }, [auditLogs, actionFilter, userFilter, targetFilter, searchQuery]);

  // Phân trang
  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE) || 1;
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredLogs.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredLogs, currentPage]);

  const handleOpenDetails = (log) => {
    setSelectedLog(log);
    setDetailOpen(true);
  };

  // Helper hiển thị màu sắc theo loại hành động
  const getActionBadgeClass = (action) => {
    switch (action) {
      case 'CREATE': return 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20';
      case 'UPDATE': return 'bg-sky-950/40 text-sky-400 border border-sky-500/20';
      case 'DELETE': return 'bg-red-950/40 text-red-400 border border-red-500/20';
      case 'RESOLVE': return 'bg-indigo-950/40 text-indigo-400 border border-indigo-500/20';
      case 'ACKNOWLEDGE': return 'bg-amber-950/40 text-amber-400 border border-amber-500/20';
      default: return 'bg-slate-900 text-slate-400 border border-slate-800';
    }
  };

  // Hàm hiển thị đẹp JSON
  const renderJSON = (str) => {
    if (!str) return <span className="text-slate-600 font-mono text-[10px]">NULL</span>;
    try {
      const parsed = JSON.parse(str);
      return (
        <pre className="text-[11px] font-mono text-indigo-300 bg-slate-950 p-3 rounded-lg overflow-x-auto border border-slate-800/80 max-h-40">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch {
      return <span className="text-slate-400 font-mono text-[10px]">{str}</span>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      
      {/* Filters bar */}
      <div className="glass p-5 rounded-2xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          
          {/* Action Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t('audit.filters.action')}</label>
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-sm text-slate-100 font-medium focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">{t('audit.filters.allActions')}</option>
              {['CREATE', 'UPDATE', 'DELETE', 'RESOLVE', 'ACKNOWLEDGE'].map(a => (
                <option key={a} value={a}>{t(`audit.action.${a}`)}</option>
              ))}
            </select>
          </div>

          {/* User Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t('audit.filters.user')}</label>
            <select
              value={userFilter}
              onChange={(e) => { setUserFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-sm text-slate-100 font-medium focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">{t('audit.filters.allUsers')}</option>
              {filterOptions.users.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          {/* Target object filter */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t('audit.filters.target')}</label>
            <select
              value={targetFilter}
              onChange={(e) => { setTargetFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-sm text-slate-100 font-medium focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">{t('audit.filters.allTargets')}</option>
              {filterOptions.targets.map(target => (
                <option key={target} value={target}>{target}</option>
              ))}
            </select>
          </div>

          {/* Text search */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t('audit.filters.search')}</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder={t('audit.filters.searchPlaceholder')}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-sm text-slate-100 font-medium focus:border-indigo-500 focus:outline-none placeholder-slate-500 transition-colors"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

        </div>
      </div>

      {/* Audit Log Table Grid */}
      <div className="glass rounded-2xl overflow-hidden flex flex-col min-h-[440px] border border-slate-200 dark:border-slate-800/80 shadow-xs">
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-900/60 dark:bg-slate-900/30 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">{t('audit.table.time')}</th>
                <th className="py-3.5 px-4">{t('audit.table.user')}</th>
                <th className="py-3.5 px-4">{t('audit.table.action')}</th>
                <th className="py-3.5 px-4">{t('audit.table.target')}</th>
                <th className="py-3.5 px-4">{t('audit.table.targetId')}</th>
                <th className="py-3.5 px-4">{t('audit.table.ip')}</th>
                <th className="py-3.5 px-4 text-right">{t('audit.table.diff')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
              {paginatedLogs.length > 0 ? (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/80 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300 transition-colors">
                    <td className="py-3.5 px-4 text-xs text-slate-400 whitespace-nowrap font-mono">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-sm text-slate-100">
                      <span className="flex items-center gap-1.5">
                        <User className="w-4 h-4 text-slate-400" />
                        {log.username}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap ${getActionBadgeClass(log.action)}`} title={log.action}>
                        {t(`audit.action.${log.action}`)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-200 font-semibold text-sm">{log.target}</td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-xs">#{log.targetId}</td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-xs">{log.ipAddress}</td>
                    <td className="py-3.5 px-4 text-right">
                      {(log.oldValue || log.newValue) ? (
                        <button
                          onClick={() => handleOpenDetails(log)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 hover:text-slate-50 border border-slate-700/60 font-bold text-xs cursor-pointer transition-colors inline-flex items-center gap-1.5 active:scale-95"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{t('audit.table.viewDiff')}</span>
                        </button>
                      ) : (
                        <span className="text-slate-600 font-semibold">-</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    {t('audit.table.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/20 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-semibold">
            {t('audit.table.showing', { shown: paginatedLogs.length, total: filteredLogs.length })}
          </span>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-50 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4.5 h-4.5" />
            </button>
            <span className="text-xs font-semibold text-slate-300">
              {t('common.page', { current: currentPage, total: totalPages })}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-50 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </div>

      {/* --- JSON DIFF VIEWER DIALOG --- */}
      {detailOpen && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--soe-overlay)] backdrop-blur-sm">
          <div className="w-full max-w-2xl glass rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-slate-950/20">
              <div className="flex items-center gap-2">
                <Database className="w-4.5 h-4.5 text-indigo-400" />
                <h3 className="text-sm font-heading font-semibold text-slate-50">
                  {t('audit.dialog.title', { id: selectedLog.id })}
                </h3>
              </div>
              <button 
                onClick={() => setDetailOpen(false)}
                className="text-slate-400 hover:text-slate-50 transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 border-b border-slate-800 pb-3 text-slate-400">
                <div>
                  <span className="text-[11px] text-slate-500 font-semibold block uppercase">{t('audit.dialog.user')}</span>
                  <span className="text-slate-200 font-semibold">{selectedLog.username}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-semibold block uppercase">{t('audit.dialog.time')}</span>
                  <span className="text-slate-200 font-semibold">{formatDateTime(selectedLog.timestamp)}</span>
                </div>
              </div>

              {/* Side by Side Diff Viewer */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Old Value */}
                <div>
                  <label className="block text-[11px] font-semibold text-red-400 uppercase mb-1.5 tracking-wider">
                    {t('audit.dialog.before')}
                  </label>
                  {renderJSON(selectedLog.oldValue)}
                </div>

                {/* New Value */}
                <div>
                  <label className="block text-[11px] font-semibold text-emerald-400 uppercase mb-1.5 tracking-wider">
                    {t('audit.dialog.after')}
                  </label>
                  {renderJSON(selectedLog.newValue)}
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/25 flex justify-end">
              <button
                onClick={() => setDetailOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-50 border border-slate-800 hover:border-slate-700 rounded-xl transition-all cursor-pointer"
              >
                {t('common.close')}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

// Chặn truy cập trước khi gọi các hook của trang (hook không được gọi sau return sớm)
const AuditLogs = () => {
  const { user } = useContext(AppContext);
  if (user?.role !== 'ROLE_ADMIN') {
    return <Navigate to="/app/dashboard" replace />;
  }
  return <AuditLogsContent />;
};

export default AuditLogs;
