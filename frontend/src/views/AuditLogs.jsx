import React, { useContext, useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { 
  FileText, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  X, 
  User, 
  ArrowRight,
  Database
} from 'lucide-react';

const PAGE_SIZE = 10; // Đặt 10 dòng để dễ nhìn trên demo

const AuditLogs = () => {
  const { user, auditLogs } = useContext(AppContext);

  // --- SECURITY ROUTE GUARD ---
  if (user?.role !== 'ROLE_ADMIN') {
    return <Navigate to="/app/dashboard" replace />;
  }

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
      case 'UPDATE': return 'bg-yellow-950/40 text-yellow-400 border border-yellow-500/20';
      case 'DELETE': return 'bg-red-950/40 text-red-400 border border-red-500/20';
      case 'RESOLVE': return 'bg-indigo-950/40 text-indigo-400 border border-indigo-500/20';
      default: return 'bg-slate-900 text-slate-400 border border-slate-800';
    }
  };

  // Hàm hiển thị đẹp JSON
  const renderJSON = (str) => {
    if (!str) return <span className="text-slate-600 font-mono text-[10px]">NULL</span>;
    try {
      const parsed = JSON.parse(str);
      return (
        <pre className="text-[10px] font-mono text-indigo-300 bg-slate-950 p-3 rounded-lg overflow-x-auto border border-slate-800/80 max-h-40">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch (e) {
      return <span className="text-slate-400 font-mono text-[10px]">{str}</span>;
    }
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
      
      {/* Filters bar */}
      <div className="glass p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          
          {/* Action Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Loại hành động</label>
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả hành động</option>
              <option value="CREATE">CREATE (Thêm mới)</option>
              <option value="UPDATE">UPDATE (Sửa đổi)</option>
              <option value="DELETE">DELETE (Xóa bỏ)</option>
              <option value="RESOLVE">RESOLVE (Giải quyết sự cố)</option>
              <option value="ACKNOWLEDGE">ACKNOWLEDGE (Ghi nhận)</option>
            </select>
          </div>

          {/* User Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Người thực hiện</label>
            <select
              value={userFilter}
              onChange={(e) => { setUserFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả tài khoản</option>
              {filterOptions.users.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          {/* Target object filter */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Đối tượng thay đổi</label>
            <select
              value={targetFilter}
              onChange={(e) => { setTargetFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả đối tượng</option>
              {filterOptions.targets.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Text search */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Tìm kiếm nhanh</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Nhập IP, tài khoản, log..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none placeholder-slate-700 transition-colors"
              />
              <Search className="w-4 h-4 text-slate-600 absolute left-3 top-2.5" />
            </div>
          </div>

        </div>
      </div>

      {/* Audit Log Table Grid */}
      <div className="glass rounded-2xl border border-slate-800 overflow-hidden flex flex-col min-h-[440px]">
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/30 text-slate-400 font-medium">
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4">Người thực hiện</th>
                <th className="py-3 px-4">Hành động</th>
                <th className="py-3 px-4">Đối tượng</th>
                <th className="py-3 px-4">ID đích</th>
                <th className="py-3 px-4">Địa chỉ IP</th>
                <th className="py-3 px-4 text-right">Chi tiết thay đổi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {paginatedLogs.length > 0 ? (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/15 text-slate-300 transition-colors">
                    <td className="py-3.5 px-4 text-slate-400 font-mono">
                      {new Date(log.timestamp).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-200">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        {log.username}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase ${getActionBadgeClass(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-medium">{log.target}</td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono">#{log.targetId}</td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono">{log.ipAddress}</td>
                    <td className="py-3.5 px-4 text-right">
                      {(log.oldValue || log.newValue) ? (
                        <button
                          onClick={() => handleOpenDetails(log)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700/60 font-semibold cursor-pointer transition-colors inline-flex items-center gap-1 active:scale-95"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Xem Diff</span>
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
                    Không tìm thấy nhật ký hành động nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/20 flex items-center justify-between">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
            Hiển thị {paginatedLogs.length}/{filteredLogs.length} logs hoạt động
          </span>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4.5 h-4.5" />
            </button>
            <span className="text-xs font-semibold text-slate-300">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </div>

      {/* --- JSON DIFF VIEWER DIALOG --- */}
      {detailOpen && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl glass border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-slate-950/20">
              <div className="flex items-center gap-2">
                <Database className="w-4.5 h-4.5 text-indigo-400" />
                <h3 className="text-sm font-heading font-semibold text-white">
                  Chi tiết thay đổi dữ liệu #{selectedLog.id}
                </h3>
              </div>
              <button 
                onClick={() => setDetailOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 border-b border-slate-850 pb-3 text-slate-400">
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block uppercase">Người thực hiện</span>
                  <span className="text-slate-200 font-semibold">{selectedLog.username}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block uppercase">Thời gian ghi nhận</span>
                  <span className="text-slate-200 font-semibold">{new Date(selectedLog.timestamp).toLocaleString()}</span>
                </div>
              </div>

              {/* Side by Side Diff Viewer */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Old Value */}
                <div>
                  <label className="block text-[10px] font-semibold text-red-400/80 uppercase mb-1.5 tracking-wider">
                    Giá trị cũ (Before)
                  </label>
                  {renderJSON(selectedLog.oldValue)}
                </div>

                {/* New Value */}
                <div>
                  <label className="block text-[10px] font-semibold text-emerald-400/80 uppercase mb-1.5 tracking-wider">
                    Giá trị mới (After)
                  </label>
                  {renderJSON(selectedLog.newValue)}
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/25 flex justify-end">
              <button
                onClick={() => setDetailOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 rounded-xl transition-all cursor-pointer"
              >
                Đóng hộp thoại
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default AuditLogs;
