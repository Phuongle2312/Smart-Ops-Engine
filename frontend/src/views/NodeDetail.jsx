import React, { useContext, useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
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
  CheckCircle2, 
  XCircle, 
  Play, 
  Edit, 
  Activity, 
  TrendingUp 
} from 'lucide-react';
import toast from 'react-hot-toast';

const NodeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { 
    user, 
    nodes, 
    incidents, 
    getNodeMetrics, 
    toggleNodeActive 
  } = useContext(AppContext);

  const [range, setRange] = useState('24h');
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);

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

  // Load metrics history
  useEffect(() => {
    if (!node) return;
    setLoading(true);
    // Giả lập độ trễ tải mạng
    const timer = setTimeout(() => {
      const data = getNodeMetrics(node.id, range);
      setChartData(data);
      setLoading(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [node, range, getNodeMetrics]);

  if (!node) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-400 font-semibold mb-4">Không tìm thấy máy chủ yêu cầu.</p>
        <button
          onClick={() => navigate('/app/nodes')}
          className="px-4 py-2 bg-indigo-600 rounded-xl text-white font-semibold text-xs cursor-pointer"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  // Quét ngay tại node này
  const handleCheckNowLocal = () => {
    if (!node.active) {
      toast.error('Máy chủ đang tắt giám sát. Hãy kích hoạt giám sát trước.');
      return;
    }
    toast.success(`Đã kích hoạt quét nhanh máy chủ ${node.name}.`);
    // Random đổi chỉ số trong giây lát
    setLoading(true);
    setTimeout(() => {
      setRange(r => {
        // trigger reload data
        const data = getNodeMetrics(node.id, r);
        setChartData(data);
        return r;
      });
      setLoading(false);
    }, 500);
  };

  // Xác định màu sắc theo ngưỡng tài nguyên
  const getResourceColorClass = (val, enabled) => {
    if (!enabled) return 'text-slate-600';
    if (val >= 90) return 'text-red-400';
    if (val >= 80) return 'text-yellow-400';
    return 'text-emerald-400';
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
      
      {/* Detail Header / Action buttons */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-slate-950/20 p-4 rounded-2xl border border-slate-800/60">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => navigate('/app/nodes')}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
            title="Quay lại"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-heading font-bold text-white leading-none">
                  {node.name}
                </h2>
                <span className={`px-2 py-0.5 rounded text-[9px] font-semibold flex items-center gap-1 ${
                  node.active ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20' : 'bg-slate-900 text-slate-500 border border-slate-800'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${node.active ? 'bg-emerald-500 pulse-active' : 'bg-slate-600'} inline-block`}></span>
                  <span>{node.active ? 'Active' : 'Inactive'}</span>
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 font-mono">
                Host: {node.host} | Port: {node.port} | User: {node.username}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls (ADMIN-only or viewer limited) */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleCheckNowLocal}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold active:scale-95 transition-all cursor-pointer"
            title="Quét lại các thông số kết nối của node này"
          >
            <Play className="w-3.5 h-3.5 text-indigo-400" />
            <span>Kiểm tra ngay</span>
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
              <span>{node.active ? 'Tắt giám sát' : 'Bật giám sát'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Instant metrics gauges (3 Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Card: CPU */}
        <div className="glass p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Tải CPU Hiện Tại</span>
            <Activity className="w-4.5 h-4.5 text-slate-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-4">
            <h3 className={`text-4xl font-heading font-bold ${getResourceColorClass(node.cpu, node.active && node.monitorCpu)}`}>
              {node.active && node.monitorCpu ? `${node.cpu}%` : '-'}
            </h3>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              {node.monitorCpu ? 'Monitoring' : 'Not Monitored'}
            </span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 mt-4">
            <div 
              className={`h-1.5 rounded-full transition-all duration-500 ${
                node.cpu >= 90 ? 'bg-red-500' : node.cpu >= 80 ? 'bg-yellow-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${node.active && node.monitorCpu ? node.cpu : 0}%` }}
            ></div>
          </div>
        </div>

        {/* Card: Disk */}
        <div className="glass p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Dung Lượng Ổ Đĩa</span>
            <Server className="w-4.5 h-4.5 text-slate-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-4">
            <h3 className={`text-4xl font-heading font-bold ${getResourceColorClass(node.disk, node.active && node.monitorDisk)}`}>
              {node.active && node.monitorDisk ? `${node.disk}%` : '-'}
            </h3>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              {node.monitorDisk ? 'Monitoring' : 'Not Monitored'}
            </span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 mt-4">
            <div 
              className={`h-1.5 rounded-full transition-all duration-500 ${
                node.disk >= 90 ? 'bg-red-500' : node.disk >= 80 ? 'bg-yellow-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${node.active && node.monitorDisk ? node.disk : 0}%` }}
            ></div>
          </div>
        </div>

        {/* Card: RAM */}
        <div className="glass p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Sử Dụng RAM</span>
            <TrendingUp className="w-4.5 h-4.5 text-slate-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-4">
            <h3 className={`text-4xl font-heading font-bold ${getResourceColorClass(node.ram, node.active && node.monitorRam)}`}>
              {node.active && node.monitorRam ? `${node.ram}%` : '-'}
            </h3>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              {node.monitorRam ? 'Monitoring' : 'Not Monitored'}
            </span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 mt-4">
            <div 
              className={`h-1.5 rounded-full transition-all duration-500 ${
                node.ram >= 90 ? 'bg-red-500' : node.ram >= 80 ? 'bg-yellow-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${node.active && node.monitorRam ? node.ram : 0}%` }}
            ></div>
          </div>
        </div>

      </div>

      {/* Recharts Historical Metrics Graph */}
      <div className="glass p-5 rounded-2xl flex flex-col h-96 relative border border-slate-800">
        {loading && (
          <div className="absolute inset-0 bg-[#0b0f19]/40 backdrop-blur-xs flex items-center justify-center z-10 rounded-2xl">
            <span className="w-8 h-8 rounded-full border-3 border-indigo-600/30 border-t-indigo-600 animate-spin"></span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
          <h3 className="text-sm font-semibold text-slate-300 font-heading">
            Biểu đồ xu hướng tài nguyên hệ thống
          </h3>
          
          {/* Time range picker */}
          <div className="flex gap-1.5 p-1 bg-slate-950/40 border border-slate-800/80 rounded-xl self-start sm:self-auto">
            {['24h', '7d', '30d'].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-colors cursor-pointer ${
                  range === r ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r === '24h' ? '24 Giờ' : r === '7d' ? '7 Ngày' : '30 Ngày'}
              </button>
            ))}
          </div>
        </div>

        {/* Line Chart */}
        <div className="flex-1 min-h-0">
          {node.active && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.5} />
                <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} domain={[0, 100]} />
                <ChartTooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#9ca3af', fontWeight: 'bold', fontSize: '11px' }}
                  itemStyle={{ color: '#f3f4f6', fontSize: '11px' }}
                />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: '11px' }} />
                
                {/* Horizontal guidance thresholds */}
                <ReferenceLine y={80} label={{ value: 'Warning', fill: '#eab308', fontSize: 10, position: 'insideTopLeft' }} stroke="#eab308" strokeDasharray="3 3" />
                <ReferenceLine y={90} label={{ value: 'Critical', fill: '#ef4444', fontSize: 10, position: 'insideTopLeft' }} stroke="#ef4444" strokeDasharray="3 3" />

                {/* Disk: Blue, CPU: Orange, RAM: Purple */}
                {node.monitorDisk && (
                  <Line type="monotone" dataKey="disk" name="Dung lượng Disk" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                )}
                {node.monitorCpu && (
                  <Line type="monotone" dataKey="cpu" name="Tải CPU" stroke="#f97316" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                )}
                {node.monitorRam && (
                  <Line type="monotone" dataKey="ram" name="Sử dụng RAM" stroke="#a855f7" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
              {!node.active 
                ? 'Đã tắt tính năng giám sát máy chủ. Biểu đồ lịch sử tạm ngắt.' 
                : 'Đang chuẩn bị nạp dữ liệu thống kê...'}
            </div>
          )}
        </div>
      </div>

      {/* Node incidents table history */}
      <div className="glass p-5 rounded-2xl border border-slate-800">
        <h3 className="text-sm font-semibold text-slate-300 font-heading mb-4">
          Lịch sử sự cố của riêng máy chủ này (Tối đa 20)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <th className="py-2.5 px-3">Loại sự cố</th>
                <th className="py-2.5 px-3">Chi tiết sự cố</th>
                <th className="py-2.5 px-3">Người xử lý</th>
                <th className="py-2.5 px-3">Thời gian phát hiện</th>
                <th className="py-2.5 px-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {nodeIncidents.length > 0 ? (
                nodeIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-900/10 text-slate-300 transition-colors">
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        inc.incidentType.includes('CRITICAL') || inc.incidentType === 'SSH_FAILURE'
                          ? 'bg-red-950/40 text-red-400 border border-red-500/20'
                          : 'bg-yellow-950/40 text-yellow-400 border border-yellow-500/20'
                      }`}>
                        {inc.incidentType}
                      </span>
                    </td>
                    <td className="py-3 px-3" title={inc.issueDescription}>
                      {inc.issueDescription}
                      {inc.resolutionAction && (
                        <p className="text-[10px] text-emerald-400 mt-1 font-medium bg-emerald-950/20 p-1.5 rounded-lg border border-emerald-500/10">
                          <strong>Khắc phục:</strong> {inc.resolutionAction}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {inc.assignee || 'Chưa ghi nhận'}
                    </td>
                    <td className="py-3 px-3 text-slate-400 font-mono">
                      {new Date(inc.detectedAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-3">
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
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    Máy chủ hoạt động tốt. Chưa từng xảy ra sự cố.
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
