import { useContext, useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { usePreferences } from '../context/PreferencesContext';
import { IncidentTypeChip, SeverityBadge, StatusBadge, AiConfidenceChip } from '../components/IncidentBadges';
import ResolveIncidentModal from '../components/ResolveIncidentModal';
import { 
  Search, 
  Filter, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight,
  ShieldCheck
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
  const { t, formatDateTime } = usePreferences();

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

  // --- Modal state: ID sự cố đang mở hộp thoại xử lý ---
  const [resolvingId, setResolvingId] = useState(null);

  // Đồng bộ bộ lọc trạng thái khi tham số ?status= trên URL thay đổi (điều chỉnh state ngay khi render)
  const urlStatus = searchParams.get('status');
  const [prevUrlStatus, setPrevUrlStatus] = useState(urlStatus);
  if (urlStatus !== prevUrlStatus) {
    setPrevUrlStatus(urlStatus);
    if (urlStatus) setStatusFilter(urlStatus);
  }

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
        t(`incidentType.${inc.incidentType}`).toLowerCase().includes(q) || 
        inc.issueDescription.toLowerCase().includes(q)
      );
    }

    return result;
  }, [incidents, statusFilter, nodeFilter, typeFilter, debouncedSearch, t]);

  // --- Pagination Logic ---
  const totalPages = Math.ceil(filteredIncidents.length / PAGE_SIZE) || 1;
  
  // Reset trang về 1 khi thay đổi bộ lọc
  const filterKey = `${statusFilter}|${nodeFilter}|${typeFilter}|${debouncedSearch}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setCurrentPage(1);
  }

  const paginatedIncidents = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredIncidents.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredIncidents, currentPage]);

  // --- Actions ---
  const handleResolveOpen = (id) => {
    if (!isAdmin) return;
    setResolvingId(id);
  };

  const handleResolveSubmit = (id, resolution) => {
    resolveIncident(id, resolution);
    setResolvingId(null);
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
    <div className="p-6 space-y-6">
      
      {/* Search and Filters Bar */}
      <div className="glass p-5 rounded-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <h3 className="text-sm font-semibold text-slate-100 font-heading flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-indigo-400" />
            <span>{t('incidents.filters.title')}</span>
          </h3>
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{t('incidents.filters.reset')}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {/* Keyword Search */}
          <div className="relative">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t('incidents.filters.keyword')}</label>
            <div className="relative">
              <input
                type="text"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                placeholder={t('incidents.filters.keywordPlaceholder')}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition-colors font-medium"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t('incidents.filters.status')}</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setSearchParams(e.target.value === 'ALL' ? {} : { status: e.target.value });
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none cursor-pointer font-medium"
            >
              <option value="ALL">{t('incidents.filters.allStatuses')}</option>
              {['OPEN', 'ACKNOWLEDGED', 'RESOLVED'].map(s => (
                <option key={s} value={s}>{t(`status.${s}`)}</option>
              ))}
            </select>
          </div>

          {/* Node Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t('incidents.filters.node')}</label>
            <select
              value={nodeFilter}
              onChange={(e) => setNodeFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none cursor-pointer font-medium"
            >
              <option value="ALL">{t('incidents.filters.allNodes')}</option>
              {nodes.map(n => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t('incidents.filters.type')}</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none cursor-pointer font-medium"
            >
              <option value="ALL">{t('incidents.filters.allTypes')}</option>
              {allTypes.map(type => (
                <option key={type} value={type}>{t(`incidentType.${type}`)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Incident Log Table */}
      <div className="glass rounded-2xl overflow-hidden flex flex-col min-h-[440px] border border-slate-200 dark:border-slate-800/80 shadow-xs">
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-900/60 dark:bg-slate-900/30 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">{t('incidents.table.id')}</th>
                <th className="py-3.5 px-4">{t('incidents.table.node')}</th>
                <th className="py-3.5 px-4">{t('incidents.table.type')}</th>
                <th className="py-3.5 px-4">{t('incidents.table.detail')}</th>
                <th className="py-3.5 px-4 text-center">{t('incidents.table.count')}</th>
                <th className="py-3.5 px-4">{t('incidents.table.time')}</th>
                <th className="py-3.5 px-4">{t('incidents.table.assignee')}</th>
                <th className="py-3.5 px-4">{t('incidents.table.status')}</th>
                {isAdmin && <th className="py-3.5 px-4 text-right">{t('incidents.table.actions')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
              {paginatedIncidents.length > 0 ? (
                paginatedIncidents.map((inc) => {
                  // Class highlight khi có WebSocket incident mới
                  const isNewWS = newIncidentId === inc.id;

                  return (
                    <tr 
                      key={inc.id} 
                      className={`text-slate-700 dark:text-slate-300 transition-colors ${
                        isNewWS ? 'incident-highlight' : 'hover:bg-slate-900/80 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-400 font-bold">#{inc.id}</td>
                      <td className="py-3.5 px-4 font-bold text-sm text-slate-100">{inc.node.name}</td>
                      <td className="py-3.5 px-4 min-w-[160px]">
                        <IncidentTypeChip type={inc.incidentType} />
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <SeverityBadge type={inc.incidentType} />
                          <AiConfidenceChip confidence={inc.aiConfidence} />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 min-w-[240px] max-w-[360px] text-sm">
                        <span className="line-clamp-2 font-medium" title={inc.issueDescription}>{inc.issueDescription}</span>
                        {inc.resolutionAction && (
                          <div className="text-xs text-emerald-400 font-medium mt-1 line-clamp-2" title={inc.resolutionAction}>
                            <span className="text-slate-500">{t('common.fix')}:</span> {inc.resolutionAction}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold font-mono text-sm text-indigo-400">
                        {inc.count}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400 whitespace-nowrap font-mono">
                        {formatDateTime(inc.detectedAt)}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {inc.assignee || '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={inc.status} />
                      </td>
                      
                      {/* Admin-only Operations */}
                      {isAdmin && (
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            {inc.status === 'OPEN' && (
                              <button
                                onClick={() => handleAcknowledge(inc.id)}
                                className="px-2.5 py-1 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-semibold cursor-pointer active:scale-95 whitespace-nowrap"
                                title={t('actions.acknowledgeHint')}
                              >
                                {t('actions.acknowledge')}
                              </button>
                            )}
                            {inc.status !== 'RESOLVED' && (
                              <button
                                onClick={() => handleResolveOpen(inc.id)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer active:scale-95 whitespace-nowrap"
                                title={t('actions.resolveHint')}
                              >
                                {t('actions.resolve')}
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
                  <td colSpan={isAdmin ? 9 : 8} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-center">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3 shadow-xs">
                        <ShieldCheck className="w-7 h-7" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
                        Hệ thống hoàn toàn ổn định
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        {debouncedSearch || statusFilter !== 'ALL' || nodeFilter !== 'ALL' || typeFilter !== 'ALL'
                          ? 'Không tìm thấy sự cố nào phù hợp với bộ lọc hiện tại. Thử đặt lại bộ lọc.'
                          : 'Không có sự cố nào được ghi nhận. Toàn bộ máy chủ đang trong trạng thái an toàn.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/20 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-semibold">
            {t('incidents.table.showing', { shown: paginatedIncidents.length, total: filteredIncidents.length })}
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

      {/* --- RESOLVE INCIDENT MODAL (ADMIN ONLY) --- */}
      {resolvingId !== null && (
        <ResolveIncidentModal
          incidentId={resolvingId}
          onSubmit={handleResolveSubmit}
          onClose={() => setResolvingId(null)}
        />
      )}

    </div>
  );
};

export default Incidents;
