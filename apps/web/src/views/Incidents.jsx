import React, { useContext, useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { 
  AlertTriangle, 
  Search, 
  Filter, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle,
  HelpCircle,
  Eye
} from 'lucide-react';

const PAGE_SIZE = 10; // Thay đổi 10 thay vì 20 bản ghi/trang để demo trực quan hơn

const Incidents = () => {
  const { 
    user, 
    incidents, 
    nodes, 
    resolveIncident, 
    acknowledgeIncident,
    newIncidentId 
  } = useContext(AppContext);

  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = user?.role === 'ROLE_ADMIN';

  // --- Filter states ---
  const initialStatus = searchParams.get('status') || 'ALL';
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [nodeFilter, setNodeFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [searchVal, setSearchVal] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // --- Pagination states ---
  const [currentPage, setCurrentPage] = useState(1);

  // --- Modal states ---
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [currentIncidentId, setCurrentIncidentId] = useState(null);
  const [resolutionAction, setResolutionAction] = useState('');

  // Sync URL search parameters if status is chosen
  useEffect(() => {
    const urlStatus = searchParams.get('status');
    if (urlStatus) {
      setStatusFilter(urlStatus);
    }
  }, [searchParams]);

  // Search Debounce (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchVal);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchVal]);

  // Reset all filters
  const resetFilters = () => {
    setStatusFilter('ALL');
    setNodeFilter('ALL');
    setTypeFilter('ALL');
    setSearchVal('');
    setDebouncedSearch('');
    setSearchParams({});
    setCurrentPage(1);
  };

  // Lọc sự cố theo bộ lọc
  const filteredIncidents = useMemo(() => {
    let result = [...incidents];

    // 1. Lọc theo trạng thái
    if (statusFilter !== 'ALL') {
      result = result.filter(inc => inc.status === statusFilter);
    }

    // 2. Lọc theo node
    if (nodeFilter !== 'ALL') {
      result = result.filter(inc => inc.node.id === parseInt(nodeFilter));
    }

    // 3. Lọc theo loại sự cố
    if (typeFilter !== 'ALL') {
      result = result.filter(inc => inc.incidentType === typeFilter);
    }

    // 4. Lọc theo từ khóa tìm kiếm (Tên Node, Loại sự cố, Mô tả)
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      result = result.filter(inc => 
        inc.node.name.toLowerCase().includes(q) || 
        inc.incidentType.toLowerCase().includes(q) || 
        inc.issueDescription.toLowerCase().includes(q)
      );
    }

    return result;
  }, [incidents, statusFilter, nodeFilter, typeFilter, debouncedSearch]);

  // --- Pagination Logic ---
  const totalPages = Math.ceil(filteredIncidents.length / PAGE_SIZE) || 1;
  
  // Reset trang về 1 khi thay đổi bộ lọc
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, nodeFilter, typeFilter, debouncedSearch]);

  const paginatedIncidents = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredIncidents.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredIncidents, currentPage]);

  // --- Actions ---
  const handleResolveOpen = (id) => {
    if (!isAdmin) return;
    setCurrentIncidentId(id);
    setResolutionAction('');
    setResolveModalOpen(true);
  };

  const handleResolveSubmit = (e) => {
    e.preventDefault();
    if (!resolutionAction.trim()) return;
    resolveIncident(currentIncidentId, resolutionAction);
    setResolveModalOpen(false);
  };

  const handleAcknowledge = (id) => {
    if (!isAdmin) return;
    acknowledgeIncident(id);
  };

  // Thu thập danh sách các Loại sự cố để đưa vào dropdown filter
  const allTypes = useMemo(() => {
    const typesSet = new Set(incidents.map(inc => inc.incidentType));
    return Array.from(typesSet);
  }, [incidents]);

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
      
      {/* Search and Filters Bar */}
      <div className="glass p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <h3 className="text-xs font-semibold text-slate-300 font-heading flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-indigo-400" />
            <span>Thanh công cụ lọc sự cố</span>
          </h3>
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset bộ lọc</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {/* Keyword Search */}
          <div className="relative">
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Từ khóa tìm kiếm</label>
            <div className="relative">
              <input
                type="text"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                placeholder="Nhập tên node, lỗi..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-700 focus:border-indigo-500 focus:outline-none transition-colors"
              />
              <Search className="w-4 h-4 text-slate-600 absolute left-3 top-2.5" />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Trạng thái sự cố</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setSearchParams(e.target.value === 'ALL' ? {} : { status: e.target.value });
              }}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="OPEN">Chưa xử lý (OPEN)</option>
              <option value="ACKNOWLEDGED">Đang xử lý (ACKNOWLEDGED)</option>
              <option value="RESOLVED">Đã giải quyết (RESOLVED)</option>
            </select>
          </div>

          {/* Node Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Máy chủ gặp lỗi</label>
            <select
              value={nodeFilter}
              onChange={(e) => setNodeFilter(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả máy chủ</option>
              {nodes.map(n => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Loại cảnh báo</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả loại lỗi</option>
              {allTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Incident Log Table */}
      <div className="glass rounded-2xl border border-slate-800 overflow-hidden flex flex-col min-h-[440px]">
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/30 text-slate-400 font-medium">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Máy chủ</th>
                <th className="py-3 px-4">Loại sự cố</th>
                <th className="py-3 px-4">Chi tiết lỗi đo được</th>
                <th className="py-3 px-4 text-center">Số lần</th>
                <th className="py-3 px-4">Thời gian xảy ra</th>
                <th className="py-3 px-4">Người xử lý</th>
                <th className="py-3 px-4">Trạng thái</th>
                {isAdmin && <th className="py-3 px-4 text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {paginatedIncidents.length > 0 ? (
                paginatedIncidents.map((inc) => {
                  // Class highlight khi có WebSocket incident mới
                  const isNewWS = newIncidentId === inc.id;

                  return (
                    <tr 
                      key={inc.id} 
                      className={`text-slate-300 transition-colors ${
                        isNewWS ? 'incident-highlight' : 'hover:bg-slate-900/15'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono text-slate-500">#{inc.id}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-200">{inc.node.name}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          inc.incidentType.includes('CRITICAL') || inc.incidentType === 'SSH_FAILURE'
                            ? 'bg-red-950/40 text-red-400 border border-red-500/20'
                            : 'bg-yellow-950/40 text-yellow-400 border border-yellow-500/20'
                        }`}>
                          {inc.incidentType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-[240px] truncate" title={inc.issueDescription}>
                        {inc.issueDescription}
                        {inc.resolutionAction && (
                          <div className="text-[10px] text-emerald-400 font-semibold mt-1">
                            <span className="text-slate-500">Khắc phục:</span> {inc.resolutionAction}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold font-mono text-indigo-400">
                        {inc.count}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono">
                        {new Date(inc.detectedAt).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {inc.assignee || '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          inc.status === 'OPEN'
                            ? 'bg-red-500/10 text-red-500 border border-red-500/10'
                            : inc.status === 'ACKNOWLEDGED'
                            ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/10'
                            : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/10'
                        }`}>
                          {inc.status}
                        </span>
                      </td>
                      
                      {/* Admin-only Operations */}
                      {isAdmin && (
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            {inc.status === 'OPEN' && (
                              <button
                                onClick={() => handleAcknowledge(inc.id)}
                                className="px-2 py-1 rounded bg-yellow-950/30 hover:bg-yellow-950/60 text-yellow-400 border border-yellow-500/20 hover:border-yellow-500/40 font-semibold cursor-pointer active:scale-95"
                                title="Đánh dấu đã ghi nhận đang xử lý"
                              >
                                Ack
                              </button>
                            )}
                            {inc.status !== 'RESOLVED' && (
                              <button
                                onClick={() => handleResolveOpen(inc.id)}
                                className="px-2 py-1 rounded bg-red-950/30 hover:bg-red-950/60 text-red-400 border border-red-500/20 hover:border-red-500/40 font-semibold cursor-pointer active:scale-95"
                                title="Giải quyết dứt điểm sự cố"
                              >
                                Resolve
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="py-12 text-center text-slate-500">
                    Không tìm thấy bản ghi sự cố nào phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/20 flex items-center justify-between">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
            Hiển thị {paginatedIncidents.length}/{filteredIncidents.length} sự cố
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

      {/* --- RESOLVE INCIDENT MODAL (ADMIN ONLY) --- */}
      {resolveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md glass border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-slate-800/80 bg-slate-950/20">
              <h3 className="text-sm font-heading font-semibold text-white">
                Giải quyết sự cố #{currentIncidentId}
              </h3>
            </div>
            <form onSubmit={handleResolveSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-2">
                  Biện pháp khắc phục lỗi *
                </label>
                <textarea
                  rows={3}
                  required
                  value={resolutionAction}
                  onChange={(e) => setResolutionAction(e.target.value)}
                  placeholder="Ghi chú chi tiết cách bạn đã khắc phục (ví dụ: đã dọn dẹp dung lượng ổ đĩa, giải phóng RAM)..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-700 focus:border-indigo-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResolveModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 rounded-xl transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  Xác nhận giải quyết
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Incidents;
