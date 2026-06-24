import React, { useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as ChartTooltip, 
  Legend 
} from 'recharts';
import { 
  Server, 
  CheckCircle, 
  AlertOctagon, 
  XCircle, 
  ArrowRight,
  ShieldAlert,
  Sliders
} from 'lucide-react';

const COLORS = {
  DISK_CRITICAL: '#ef4444', // Red
  DISK_WARNING: '#eab308',  // Yellow
  CPU_CRITICAL: '#f97316',  // Orange
  CPU_HIGH: '#fbbf24',      // Light Orange
  RAM_CRITICAL: '#a855f7',  // Purple
  SSH_FAILURE: '#ec4899'    // Pink
};

const TYPE_NAMES = {
  DISK_CRITICAL: 'Lỗi Disk Nguy Hiểm',
  DISK_WARNING: 'Cảnh báo Disk Cao',
  CPU_CRITICAL: 'Lỗi CPU Quá Tải',
  CPU_HIGH: 'Cảnh báo CPU Cao',
  RAM_CRITICAL: 'Lỗi Tràn RAM',
  SSH_FAILURE: 'Lỗi Kết Nối SSH'
};

const Dashboard = () => {
  const { 
    user, 
    nodes, 
    incidents, 
    resolveIncident, 
    triggerMockIncident 
  } = useContext(AppContext);
  const navigate = useNavigate();

  const isAdmin = user?.role === 'ROLE_ADMIN';

  // --- 1. METRICS COMPUTATION ---
  const stats = useMemo(() => {
    const total = nodes.length;
    const active = nodes.filter(n => n.active).length;
    const inactive = total - active;
    const open = incidents.filter(i => i.status === 'OPEN').length;
    return { total, active, inactive, open };
  }, [nodes, incidents]);

  // --- 2. PIE CHART DATA (INCIDENT CLASSIFICATION) ---
  const pieData = useMemo(() => {
    const counts = {};
    incidents.forEach(inc => {
      counts[inc.incidentType] = (counts[inc.incidentType] || 0) + 1;
    });

    return Object.keys(counts).map(key => ({
      name: TYPE_NAMES[key] || key,
      value: counts[key],
      rawType: key
    }));
  }, [incidents]);

  // --- 3. BAR CHART DATA (TOP 5 WORST NODES) ---
  const barData = useMemo(() => {
    const nodeCounts = {};
    incidents.forEach(inc => {
      const nodeName = inc.node.name;
      nodeCounts[nodeName] = (nodeCounts[nodeName] || 0) + 1;
    });

    return Object.keys(nodeCounts)
      .map(name => ({ name, incidentsCount: nodeCounts[name] }))
      .sort((a, b) => b.incidentsCount - a.incidentsCount)
      .slice(0, 5);
  }, [incidents]);

  // --- 4. TOP 10 LATEST INCIDENTS ---
  const latestIncidents = useMemo(() => {
    return incidents.slice(0, 10);
  }, [incidents]);

  const handleResolveClick = (id) => {
    const reason = prompt("Nhập biện pháp xử lý sự cố:");
    if (reason !== null) {
      resolveIncident(id, reason);
    }
  };

  // --- 5. TRIGGER SIMULATED EVENTS ---
  const triggerEvent = (type) => {
    if (!isAdmin) return;
    
    let nodeId = 1, nodeName = 'prod-web-01', incidentType = '', desc = '';
    
    if (type === 'cpu') {
      nodeId = 1; nodeName = 'prod-web-01';
      incidentType = 'CPU_CRITICAL';
      desc = 'Tải CPU máy chủ chính tăng đột biến đạt 96% (Ngưỡng critical 90%) do tiến trình NodeJS rò rỉ.';
    } else if (type === 'ssh') {
      nodeId = 3; nodeName = 'stg-api-gateway';
      incidentType = 'SSH_FAILURE';
      desc = 'Lỗi kết nối SSH: Connection timed out trên port 2222 sau 3 lần thử.';
    } else if (type === 'disk') {
      nodeId = 5; nodeName = 'mail-smtp-server';
      incidentType = 'DISK_CRITICAL';
      desc = 'Phát hiện ổ đĩa /var/spool/postfix đầy 94% (Ngưỡng critical 90%) do thư rác tồn đọng.';
    } else if (type === 'ram') {
      nodeId = 2; nodeName = 'prod-db-master';
      incidentType = 'RAM_CRITICAL';
      desc = 'Hệ thống hết bộ nhớ (Out of Memory - OOM-killer) đã kích hoạt trên PostgreSQL: RAM đạt 95%.';
    }

    triggerMockIncident(nodeId, nodeName, incidentType, desc);
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
      
      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        
        {/* Card 1: Total Nodes */}
        <div 
          onClick={() => navigate('/app/nodes')}
          className="glass glass-hover p-5 rounded-2xl flex items-center justify-between cursor-pointer border-l-4 border-slate-500"
        >
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tổng số máy chủ</span>
            <h3 className="text-3xl font-heading font-bold text-white mt-1">{stats.total}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-800/60 flex items-center justify-center text-slate-400">
            <Server className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Active Nodes */}
        <div 
          onClick={() => navigate('/app/nodes')}
          className="glass glass-hover p-5 rounded-2xl flex items-center justify-between cursor-pointer border-l-4 border-emerald-500"
        >
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Đang giám sát</span>
            <h3 className="text-3xl font-heading font-bold text-emerald-400 mt-1">{stats.active}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-950/20 flex items-center justify-center text-emerald-400">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Inactive Nodes */}
        <div 
          onClick={() => navigate('/app/nodes')}
          className="glass glass-hover p-5 rounded-2xl flex items-center justify-between cursor-pointer border-l-4 border-slate-700"
        >
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tạm dừng</span>
            <h3 className="text-3xl font-heading font-bold text-slate-400 mt-1">{stats.inactive}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-800/40 flex items-center justify-center text-slate-500">
            <XCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Open Incidents */}
        <div 
          onClick={() => navigate('/app/incidents?status=OPEN')}
          className="glass glass-hover p-5 rounded-2xl flex items-center justify-between cursor-pointer border-l-4 border-red-500 relative overflow-hidden"
        >
          {stats.open > 0 && (
            <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/5 rounded-full blur-xl animate-pulse"></div>
          )}
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sự cố chưa xử lý</span>
            <h3 className="text-3xl font-heading font-bold text-red-400 mt-1">{stats.open}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-950/20 flex items-center justify-center text-red-400">
            <AlertOctagon className={`w-6 h-6 ${stats.open > 0 ? 'pulse-alert' : ''}`} />
          </div>
        </div>

      </div>

      {/* Recharts Charts Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Incident Type Classification (Pie Chart) */}
        <div className="lg:col-span-5 glass p-5 rounded-2xl flex flex-col h-80">
          <h3 className="text-sm font-semibold text-slate-300 mb-2 font-heading flex items-center gap-2">
            <span>Phân loại sự cố hệ thống</span>
          </h3>
          <div className="flex-1 min-h-0">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.rawType] || '#6366f1'} />
                    ))}
                  </Pie>
                  <ChartTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                    itemStyle={{ color: '#f3f4f6' }}
                  />
                  <Legend 
                    layout="horizontal" 
                    verticalAlign="bottom" 
                    align="center"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                Chưa có dữ liệu sự cố nào được ghi nhận.
              </div>
            )}
          </div>
        </div>

        {/* Incidents Count per Node (Bar Chart) */}
        <div className="lg:col-span-7 glass p-5 rounded-2xl flex flex-col h-80">
          <h3 className="text-sm font-semibold text-slate-300 mb-2 font-heading">
            Tần suất sự cố theo máy chủ (Top 5)
          </h3>
          <div className="flex-1 min-h-0">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} allowDecimals={false} />
                  <ChartTooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                    itemStyle={{ color: '#f3f4f6' }}
                  />
                  <Bar dataKey="incidentsCount" fill="url(#barGradient)" radius={[4, 4, 0, 0]}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#4f46e5" />
                      </linearGradient>
                    </defs>
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                Chưa có dữ liệu thống kê máy chủ.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Latest Incident Logs + Simulator Control Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Latest Incident Logs Table (7 columns / spans 8) */}
        <div className="lg:col-span-8 glass p-5 rounded-2xl flex flex-col min-h-[380px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-slate-300 font-heading">
              Các sự cố mới phát hiện gần đây
            </h3>
            <button 
              onClick={() => navigate('/app/incidents')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition-colors"
            >
              <span>Xem toàn bộ</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium">
                  <th className="py-2.5 px-3">Máy chủ</th>
                  <th className="py-2.5 px-3">Loại sự cố</th>
                  <th className="py-2.5 px-3">Chi tiết sự cố</th>
                  <th className="py-2.5 px-3">Thời gian phát hiện</th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                  {isAdmin && <th className="py-2.5 px-3 text-right">Hành động</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {latestIncidents.length > 0 ? (
                  latestIncidents.map((inc) => (
                    <tr key={inc.id} className="hover:bg-slate-900/20 text-slate-300 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-200">
                        {inc.node.name}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          inc.incidentType.includes('CRITICAL') || inc.incidentType === 'SSH_FAILURE'
                            ? 'bg-red-950/40 text-red-400 border border-red-500/20'
                            : 'bg-yellow-950/40 text-yellow-400 border border-yellow-500/20'
                        }`}>
                          {inc.incidentType}
                        </span>
                      </td>
                      <td className="py-3 px-3 max-w-[200px] truncate" title={inc.issueDescription}>
                        {inc.issueDescription}
                      </td>
                      <td className="py-3 px-3 text-slate-400">
                        {new Date(inc.detectedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' })}
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
                      {isAdmin && (
                        <td className="py-3 px-3 text-right">
                          {inc.status === 'OPEN' && (
                            <button
                              onClick={() => handleResolveClick(inc.id)}
                              className="px-2 py-1 rounded bg-red-950/30 hover:bg-red-950/60 text-red-400 border border-red-500/20 hover:border-red-500/40 font-semibold transition-all cursor-pointer active:scale-95"
                            >
                              Resolve
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="py-8 text-center text-slate-500">
                      Chưa ghi nhận sự cố nào trong hệ thống.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Incident Simulator Controls Panel (spans 4) */}
        <div className="lg:col-span-4 glass p-5 rounded-2xl flex flex-col justify-between min-h-[380px]">
          <div>
            <h3 className="text-sm font-semibold text-slate-300 font-heading flex items-center gap-2 mb-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Giả lập sự cố vận hành</span>
            </h3>
            <p className="text-xs text-slate-400 leading-normal mb-5">
              Bảng này giả lập tác động từ các máy chủ bên ngoài. Click vào nút bên dưới để trigger sự cố giả và xem luồng WebSocket toast/charts cập nhật tức thì.
            </p>

            {isAdmin ? (
              <div className="space-y-3.5">
                <button
                  onClick={() => triggerEvent('cpu')}
                  className="w-full py-2.5 px-4 rounded-xl bg-orange-950/20 hover:bg-orange-950/30 border border-orange-500/20 hover:border-orange-500/50 text-orange-400 text-xs font-semibold text-left transition-all flex items-center justify-between cursor-pointer"
                >
                  <span>1. Quá tải CPU (prod-web-01)</span>
                  <span className="text-[10px] bg-orange-500/15 text-orange-400 px-1.5 py-0.5 rounded">CPU_CRITICAL</span>
                </button>

                <button
                  onClick={() => triggerEvent('disk')}
                  className="w-full py-2.5 px-4 rounded-xl bg-red-950/20 hover:bg-red-950/30 border border-red-500/20 hover:border-red-500/50 text-red-400 text-xs font-semibold text-left transition-all flex items-center justify-between cursor-pointer"
                >
                  <span>2. Đầy dung lượng Disk (mail-smtp-server)</span>
                  <span className="text-[10px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded">DISK_CRITICAL</span>
                </button>

                <button
                  onClick={() => triggerEvent('ssh')}
                  className="w-full py-2.5 px-4 rounded-xl bg-pink-950/20 hover:bg-pink-950/30 border border-pink-500/20 hover:border-pink-500/50 text-pink-400 text-xs font-semibold text-left transition-all flex items-center justify-between cursor-pointer"
                >
                  <span>3. Mất liên kết SSH (stg-api-gateway)</span>
                  <span className="text-[10px] bg-pink-500/15 text-pink-400 px-1.5 py-0.5 rounded">SSH_FAILURE</span>
                </button>

                <button
                  onClick={() => triggerEvent('ram')}
                  className="w-full py-2.5 px-4 rounded-xl bg-purple-950/20 hover:bg-purple-950/30 border border-purple-500/20 hover:border-purple-500/50 text-purple-400 text-xs font-semibold text-left transition-all flex items-center justify-between cursor-pointer"
                >
                  <span>4. Tràn bộ nhớ RAM (prod-db-master)</span>
                  <span className="text-[10px] bg-purple-500/15 text-purple-400 px-1.5 py-0.5 rounded">RAM_CRITICAL</span>
                </button>
              </div>
            ) : (
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col items-center justify-center py-12 text-center">
                <ShieldAlert className="w-10 h-10 text-slate-600 mb-2" />
                <p className="text-xs text-slate-500 font-semibold leading-normal">
                  Chỉ tài khoản ADMIN mới có quyền truy cập bảng điều khiển giả lập sự cố.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800/80 text-[10px] text-slate-500 font-medium">
            * WebSocket Live gửi sự kiện trượt toast. Nếu WS Offline, các cập nhật chỉ xuất hiện sau khi refresh trang hoặc khi polling kích hoạt.
          </div>
        </div>

      </div>

    </div>
  );
};

export default Dashboard;
