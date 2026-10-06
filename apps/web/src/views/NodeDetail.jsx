import { useContext, useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { usePreferences } from '../context/PreferencesContext';
import { IncidentTypeChip, StatusBadge, AiConfidenceChip } from '../components/IncidentBadges';
import { resourceLevel, RESOURCE_TEXT, RESOURCE_BAR } from '../constants/incidentMeta';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip, 
  Legend, 
  ReferenceLine 
} from 'recharts';
import { 
  ArrowLeft, 
  Server, 
  Play, 
  Activity, 
  TrendingUp 
} from 'lucide-react';
import toast from 'react-hot-toast';
import OwnersPanel from '../components/OwnersPanel';

const NodeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { 
    user, 
    nodes, 
    incidents, 
    getNodeMetrics, 
    checkNodeNow,
    toggleNodeActive 
  } = useContext(AppContext);
  const { t, formatDateTime, chartTheme } = usePreferences();

  const [range, setRange] = useState('24h');
  const [chartData, setChartData] = useState([]);
  // Khóa (node|range) của dữ liệu đã tải xong — khác khóa hiện tại nghĩa là đang tải
  const [loadedKey, setLoadedKey] = useState(null);

  const isAdmin = user?.role === 'ROLE_ADMIN';

  // Lấy thông tin Node hiện tại
  const node = useMemo(() => {
    return nodes.find(n => n.id === parseInt(id));
  }, [nodes, id]);

  // Lọc lịch sử sự cố của riêng Node này (tối đa 20)
  const nodeIncidents = useMemo(() => {
    return incidents
      .filter(inc => inc.node.id === parseInt(id))
      .slice(0, 20);
  }, [incidents, id]);

  // Load metrics history từ backend
  const nodeId = node?.id;
  useEffect(() => {
    if (nodeId == null) return undefined;
    let cancelled = false;
    getNodeMetrics(nodeId, range)
      .then((data) => {
        if (cancelled) return;
        setChartData(data);
        setLoadedKey(`${nodeId}|${range}`);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err.message);
        setChartData([]);
        setLoadedKey(`${nodeId}|${range}`);
      });
    return () => { cancelled = true; };
  }, [nodeId, range, getNodeMetrics]);

  const loading = node ? loadedKey !== `${node.id}|${range}` : false;

  if (!node) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-400 font-semibold mb-4">{t('nodeDetail.notFound')}</p>
        <button
          onClick={() => navigate('/app/nodes')}
          className="px-4 py-2 bg-indigo-600 rounded-xl text-white font-semibold text-xs cursor-pointer"
        >
          {t('nodeDetail.backToList')}
        </button>
      </div>
    );
  }

  // Quét ngay tại node này
  const handleCheckNowLocal = async () => {
    if (!node.active) {
      toast.error(t('nodeDetail.toastOff'));
      return;
    }
    toast.success(t('nodeDetail.toastScan', { name: node.name }));
    setLoadedKey(null);
    await checkNodeNow(node.id);
    try {
      setChartData(await getNodeMetrics(node.id, range));
    } catch (err) {
      toast.error(err.message);
    }
    setLoadedKey(`${node.id}|${range}`);
  };

  // Xác định màu sắc theo ngưỡng tài nguyên
  const getResourceColorClass = (val, enabled) => (enabled ? RESOURCE_TEXT[resourceLevel(val)] : RESOURCE_TEXT.off);

  // 3 thẻ chỉ số tức thời
  const gauges = [
    { key: 'cpu', label: t('nodeDetail.cpu'), icon: Activity, value: node.cpu, monitored: node.monitorCpu },
    { key: 'disk', label: t('nodeDetail.disk'), icon: Server, value: node.disk, monitored: node.monitorDisk },
    { key: 'ram', label: t('nodeDetail.ram'), icon: TrendingUp, value: node.ram, monitored: node.monitorRam },
  ];

  return (
    <div className="p-6 space-y-6">
      
      {/* Detail Header / Action buttons */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 glass p-4 rounded-2xl">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => navigate('/app/nodes')}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-50 transition-all cursor-pointer"
            title={t('nodeDetail.back')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-heading font-bold text-slate-50 leading-none">
                  {node.name}
                </h2>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 ${
                  node.active ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20' : 'bg-slate-900 text-slate-500 border border-slate-800'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${node.active ? 'bg-emerald-500 pulse-active' : 'bg-slate-600'} inline-block`}></span>
                  <span>{node.active ? t('nodeDetail.active') : t('nodeDetail.inactive')}</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 font-mono">
                Host: {node.host} | Port: {node.port} | User: {node.username}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls (ADMIN-only or viewer limited) */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleCheckNowLocal}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-50 text-xs font-semibold active:scale-95 transition-all cursor-pointer"
            title={t('nodeDetail.checkNowHint')}
          >
            <Play className="w-3.5 h-3.5 text-indigo-400" />
            <span>{t('nodeDetail.checkNow')}</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => toggleNodeActive(node.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                node.active 
                  ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-500'
              }`}
            >
              <span>{node.active ? t('nodeDetail.disableMonitoring') : t('nodeDetail.enableMonitoring')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Instant metrics gauges (3 Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {gauges.map(({ key, label, icon: Icon, value, monitored }) => {
          const enabled = node.active && monitored;
          return (
            <div key={key} className="glass p-5 rounded-2xl flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <span>{label}</span>
                <Icon className="w-4.5 h-4.5 text-slate-500" />
              </div>
              <div className="flex items-baseline gap-2 mt-4">
                <h3 className={`text-4xl font-heading font-bold ${getResourceColorClass(value, enabled)}`}>
                  {enabled ? `${value}%` : '-'}
                </h3>
                <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                  {monitored ? t('nodeDetail.monitoring') : t('nodeDetail.notMonitored')}
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 mt-4">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${RESOURCE_BAR[resourceLevel(value)]}`}
                  style={{ width: `${enabled ? value : 0}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recharts Historical Metrics Graph */}
      <div className="glass p-5 rounded-2xl flex flex-col h-96 relative">
        {loading && (
          <div className="absolute inset-0 bg-[var(--soe-bg)]/40 backdrop-blur-xs flex items-center justify-center z-10 rounded-2xl">
            <span className="w-8 h-8 rounded-full border-3 border-indigo-600/30 border-t-indigo-600 animate-spin"></span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
          <h3 className="text-sm font-semibold text-slate-100 font-heading">
            {t('nodeDetail.trendTitle')}
          </h3>
          
          {/* Time range picker */}
          <div className="flex gap-1.5 p-1 bg-slate-950/40 border border-slate-800/80 rounded-xl self-start sm:self-auto">
            {['24h', '7d', '30d'].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  range === r ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t(`nodeDetail.range.${r}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Line Chart */}
        <div className="flex-1 min-h-0">
          {node.active && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="time" stroke={chartTheme.axis} fontSize={11} tickLine={false} />
                <YAxis stroke={chartTheme.axis} fontSize={11} tickLine={false} domain={[0, 100]} />
                <ChartTooltip
                  contentStyle={{ backgroundColor: chartTheme.tooltipBg, borderColor: chartTheme.tooltipBorder, borderRadius: '8px' }}
                  labelStyle={{ color: chartTheme.tooltipLabel, fontWeight: 'bold', fontSize: '12px' }}
                  itemStyle={{ color: chartTheme.tooltipText, fontSize: '12px' }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                
                {/* Horizontal guidance thresholds */}
                <ReferenceLine y={80} label={{ value: t('nodeDetail.warning'), fill: '#f59e0b', fontSize: 10, position: 'insideTopLeft' }} stroke="#f59e0b" strokeDasharray="3 3" />
                <ReferenceLine y={90} label={{ value: t('nodeDetail.critical'), fill: '#ef4444', fontSize: 10, position: 'insideTopLeft' }} stroke="#ef4444" strokeDasharray="3 3" />

                {/* Disk: Blue, CPU: Orange, RAM: Purple */}
                {node.monitorDisk && (
                  <Line type="monotone" dataKey="disk" name={t('nodeDetail.lineDisk')} stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                )}
                {node.monitorCpu && (
                  <Line type="monotone" dataKey="cpu" name={t('nodeDetail.lineCpu')} stroke="#f97316" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                )}
                {node.monitorRam && (
                  <Line type="monotone" dataKey="ram" name={t('nodeDetail.lineRam')} stroke="#a855f7" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
              {!node.active 
                ? t('nodeDetail.monitoringOff')
                : t('nodeDetail.preparing')}
            </div>
          )}
        </div>
      </div>

      {/* Người phụ trách — nhận email chẩn đoán lỗi từ ảnh */}
      <OwnersPanel nodeId={node.id} canEdit={isAdmin} />

      {/* Node incidents table history */}
      <div className="glass p-5 rounded-2xl">
        <h3 className="text-sm font-semibold text-slate-100 font-heading mb-4">
          {t('nodeDetail.historyTitle')}
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <th className="py-2.5 px-3">{t('nodeDetail.colType')}</th>
                <th className="py-2.5 px-3">{t('nodeDetail.colDetail')}</th>
                <th className="py-2.5 px-3">{t('nodeDetail.colAssignee')}</th>
                <th className="py-2.5 px-3">{t('nodeDetail.colTime')}</th>
                <th className="py-2.5 px-3">{t('nodeDetail.colStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {nodeIncidents.length > 0 ? (
                nodeIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-900/10 text-slate-300 transition-colors">
                    <td className="py-3 px-3 min-w-[150px]">
                      <IncidentTypeChip type={inc.incidentType} />
                      <div className="mt-1"><AiConfidenceChip confidence={inc.aiConfidence} /></div>
                    </td>
                    <td className="py-3 px-3" title={inc.issueDescription}>
                      {inc.issueDescription}
                      {inc.resolutionAction && (
                        <p className="text-[11px] text-emerald-400 mt-1 font-medium bg-emerald-950/20 p-1.5 rounded-lg border border-emerald-500/10">
                          <strong>{t('common.fix')}:</strong> {inc.resolutionAction}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {inc.assignee || t('nodeDetail.unassigned')}
                    </td>
                    <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                      {formatDateTime(inc.detectedAt)}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={inc.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    {t('nodeDetail.noIncidents')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default NodeDetail;
