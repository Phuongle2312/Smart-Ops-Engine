import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { usePreferences } from './PreferencesContext';
import { api } from '../api/client';

// eslint-disable-next-line react-refresh/only-export-components -- context đi kèm Provider, sẽ tách khi bỏ mock
export const AppContext = createContext();

// Hỗ trợ tạo ID ngẫu nhiên cho mock data
const generateId = () => Math.floor(Math.random() * 1000000);

// Chuẩn hóa dữ liệu backend -> shape frontend (-1 = đo lỗi, null = chưa đo)
const metricValue = (v) => (v == null || v < 0 ? 0 : v);
const mapNode = (n) => ({
  ...n,
  cpu: metricValue(n.cpu),
  disk: metricValue(n.disk),
  ram: metricValue(n.ram),
  // Backend chưa lưu cờ giám sát từng chỉ số — mặc định bật cả ba
  monitorCpu: true,
  monitorDisk: true,
  monitorRam: true,
});
const mapIncident = (i) => ({ ...i, count: 1, assignee: null });

const POLL_INTERVAL_MS = 15000;

// Khởi tạo Alert Channels mặc định
const DEFAULT_CHANNELS = [
  { id: 1, name: 'Email Nhận Cảnh Báo', type: 'Email', target: 'letriphuong23.12@gmail.com', minSeverity: 'Warning', active: true },
  { id: 2, name: 'Slack Webhook Operations', type: 'Webhook', target: 'https://api.example.com/webhooks/slack', minSeverity: 'Critical', active: true }
];

// Khởi tạo Audit Logs mặc định
const DEFAULT_AUDIT_LOGS = [
  { id: 501, timestamp: new Date(Date.now() - 3600000 * 4).toISOString(), username: 'admin', action: 'UPDATE', target: 'Node', targetId: 2, ipAddress: '192.168.1.100', oldValue: '{"disk": 92}', newValue: '{"disk": 89}' },
  { id: 502, timestamp: new Date(Date.now() - 3600000 * 4).toISOString(), username: 'admin', action: 'RESOLVE', target: 'IncidentLog', targetId: 102, ipAddress: '192.168.1.100', oldValue: '{"status": "OPEN"}', newValue: '{"status": "RESOLVED", "resolutionAction": "Đã xóa file logs cũ..."}' },
  { id: 503, timestamp: new Date(Date.now() - 3600000 * 10).toISOString(), username: 'admin', action: 'CREATE', target: 'AlertChannel', targetId: 2, ipAddress: '192.168.1.100', oldValue: null, newValue: '{"name": "Slack Webhook Operations", "type": "Webhook"}' }
];

export const AppProvider = ({ children }) => {
  const { t } = usePreferences();

  // --- AUTH STATE ---
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('soe_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [accessToken, setAccessToken] = useState(() => {
    return user ? 'mock-jwt-token-xyz-12345' : null;
  });

  // --- CORE STATE ---
  const [nodes, setNodes] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [channels, setChannels] = useState(() => {
    const saved = localStorage.getItem('soe_channels');
    return saved ? JSON.parse(saved) : DEFAULT_CHANNELS;
  });
  const [auditLogs, setAuditLogs] = useState(() => {
    const saved = localStorage.getItem('soe_audit_logs');
    return saved ? JSON.parse(saved) : DEFAULT_AUDIT_LOGS;
  });

  // --- WEB SOCKET STATUS ---
  // wsConnected: bật/tắt đồng bộ tự động (polling API). Tắt = tạm dừng cập nhật
  const [wsConnected, setWsConnected] = useState(true);
  const [newIncidentId, setNewIncidentId] = useState(null); // Lưu ID incident mới nhận để highlight
  const [apiError, setApiError] = useState(null); // Lỗi gọi backend gần nhất
  const [lastScanAt, setLastScanAt] = useState(null); // Thời điểm chu kỳ quét gần nhất (hiển thị trên Dashboard)

  // --- ĐỒNG BỘ DỮ LIỆU THẬT TỪ BACKEND ---
  const knownIncidentIds = useRef(null);
  const wsRef = useRef(wsConnected);
  useEffect(() => { wsRef.current = wsConnected; }, [wsConnected]);

  const refresh = useCallback(async () => {
    try {
      const [nodeList, incidentList] = await Promise.all([api.getNodes(), api.getIncidents()]);
      const mappedIncidents = incidentList.map(mapIncident);
      setNodes(nodeList.map(mapNode));
      setIncidents(mappedIncidents);
      setLastScanAt(new Date().toISOString());
      setApiError(null);

      // Báo toast khi có sự cố mới xuất hiện so với lần tải trước
      if (knownIncidentIds.current) {
        mappedIncidents
          .filter(i => !knownIncidentIds.current.has(i.id) && i.status === 'OPEN')
          .forEach(i => {
            setNewIncidentId(i.id);
            setTimeout(() => setNewIncidentId(null), 3000);
            toast.error(`${i.node.name} — ${t(`incidentType.${i.incidentType}`)}`);
          });
      }
      knownIncidentIds.current = new Set(mappedIncidents.map(i => i.id));
    } catch (err) {
      setApiError(err.message);
    }
  }, [t]);

  useEffect(() => {
    if (!user) return undefined;
    const first = setTimeout(refresh, 0);
    const timer = setInterval(() => {
      if (wsRef.current) refresh();
    }, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [user, refresh]);

  // Sync channels/audit logs (vẫn là mock) vào local storage
  useEffect(() => {
    localStorage.setItem('soe_channels', JSON.stringify(channels));
  }, [channels]);

  useEffect(() => {
    localStorage.setItem('soe_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  // Ghi log hành động (Audit Log)
  const logAudit = useCallback((action, target, targetId, oldValue, newValue) => {
    const logUser = user ? user.username : 'system';
    const newLog = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      username: logUser,
      action,
      target,
      targetId,
      ipAddress: '192.168.1.100', // Mock IP người dùng
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null
    };
    setAuditLogs(prev => [newLog, ...prev]);
  }, [user]);

  // --- AUTH ACTIONS ---
  const login = (username, password) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const u = username.toLowerCase();
        const p = password;
        
        if ((u === 'admin' && p === 'admin') || (u === 'viewer' && p === 'viewer')) {
          const loggedUser = {
            id: u === 'admin' ? 1 : 2,
            username: u,
            fullName: u === 'admin' ? 'Lê Trí Phương (Admin)' : 'Nguyễn Văn Xem (Viewer)',
            role: u === 'admin' ? 'ROLE_ADMIN' : 'ROLE_VIEWER'
          };
          setUser(loggedUser);
          setAccessToken('mock-jwt-token-xyz-12345');
          localStorage.setItem('soe_user', JSON.stringify(loggedUser));
          toast.success(t('toast.loginSuccess', { role: u === 'admin' ? 'ADMIN' : 'VIEWER' }));
          resolve(loggedUser);
        } else {
          reject(new Error(t('login.invalid')));
        }
      }, 500);
    });
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('soe_user');
    toast.success(t('toast.logout'));
  };

  // --- NODE CRUD ACTIONS (gọi backend thật) ---
  const toNodePayload = (d) => ({
    name: d.name,
    host: d.host,
    port: d.port,
    username: d.username,
    description: d.description,
    password: d.password,
  });

  const addNode = async (nodeData) => {
    try {
      const created = await api.createNode(toNodePayload(nodeData));
      logAudit('CREATE', 'Node', created.id, null, { ...nodeData, password: undefined });
      toast.success(t('toast.nodeAdded', { name: nodeData.name }));
      await refresh();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  };

  const updateNode = async (id, nodeData) => {
    const oldNode = nodes.find(n => n.id === id);
    try {
      await api.updateNode(id, toNodePayload(nodeData));
      logAudit('UPDATE', 'Node', id, oldNode, { ...nodeData, password: undefined });
      toast.success(t('toast.nodeUpdated'));
      await refresh();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  };

  const deleteNode = async (id) => {
    const nodeToDelete = nodes.find(n => n.id === id);
    if (!nodeToDelete) return;
    try {
      await api.deleteNode(id);
      logAudit('DELETE', 'Node', id, nodeToDelete, null);
      toast.success(t('toast.nodeDeleted', { name: nodeToDelete.name }));
      await refresh();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleNodeActive = async (id) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    try {
      await api.toggleNode(id);
      logAudit('UPDATE', 'Node', id, { active: node.active }, { active: !node.active });
      toast.success(t(!node.active ? 'toast.nodeMonitorOn' : 'toast.nodeMonitorOff', { name: node.name }));
      await refresh();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // --- INCIDENT ACTIONS ---
  const resolveIncident = async (id, resolutionAction) => {
    const old = incidents.find(i => i.id === id);
    try {
      await api.resolveIncident(id, resolutionAction || t('toast.defaultResolution'));
      logAudit('RESOLVE', 'IncidentLog', id, old && { status: old.status }, { status: 'RESOLVED', resolutionAction });
      toast.success(t('toast.incidentResolved'));
      await refresh();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const acknowledgeIncident = async (id) => {
    const old = incidents.find(i => i.id === id);
    try {
      await api.acknowledgeIncident(id);
      logAudit('ACKNOWLEDGE', 'IncidentLog', id, old && { status: old.status }, { status: 'ACKNOWLEDGED' });
      toast.success(t('toast.incidentAcknowledged'));
      await refresh();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // --- ALERT CHANNELS CRUD ---
  const addAlertChannel = (channelData) => {
    const newChan = { id: generateId(), active: true, ...channelData };
    setChannels(prev => [...prev, newChan]);
    logAudit('CREATE', 'AlertChannel', newChan.id, null, channelData);
    toast.success(t('toast.channelAdded', { name: channelData.name }));
  };

  const updateAlertChannel = (id, channelData) => {
    let oldChan = null;
    setChannels(prev => prev.map(c => {
      if (c.id === id) {
        oldChan = { ...c };
        return { ...c, ...channelData };
      }
      return c;
    }));
    logAudit('UPDATE', 'AlertChannel', id, oldChan, channelData);
    toast.success(t('toast.channelUpdated'));
  };

  const deleteAlertChannel = (id) => {
    const oldChan = channels.find(c => c.id === id);
    setChannels(prev => prev.filter(c => c.id !== id));
    logAudit('DELETE', 'AlertChannel', id, oldChan, null);
    toast.success(t('toast.channelDeleted'));
  };

  const toggleAlertChannel = (id) => {
    let oldState = null;
    let newState = null;
    setChannels(prev => prev.map(c => {
      if (c.id === id) {
        oldState = { active: c.active };
        newState = { active: !c.active };
        return { ...c, active: !c.active };
      }
      return c;
    }));
    logAudit('UPDATE', 'AlertChannel', id, oldState, newState);
    toast.success(t('toast.channelToggled'));
  };

  // --- LỊCH SỬ METRICS (async, từ backend) ---
  const getNodeMetrics = useCallback(async (nodeId, range) => {
    const points = await api.getMetrics(nodeId, range);
    return points.map(p => {
      const d = new Date(p.timestamp);
      return {
        time: range === '24h'
          ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : d.toLocaleDateString([], { month: '2-digit', day: '2-digit' }),
        timestamp: d.toISOString(),
        cpu: metricValue(p.cpu),
        disk: metricValue(p.disk),
        ram: metricValue(p.ram),
      };
    });
  }, []);

  // Quét ngay một node (thu thập + lưu metrics thật)
  const checkNodeNow = async (nodeId) => {
    try {
      await api.checkNode(nodeId);
      await refresh();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  };

  // --- SYSTEM CHECK NOW (ADMIN ONLY, RATE-LIMITED) ---
  const lastCheckTime = useRef(0);
  const triggerCheckNow = async () => {
    if (user?.role !== 'ROLE_ADMIN') {
      toast.error(t('toast.noPermission'));
      return;
    }
    const now = Date.now();
    if (now - lastCheckTime.current < 12000) {
      toast.error(t('toast.tooFast'));
      return;
    }
    lastCheckTime.current = now;
    toast.loading(t('toast.scanning'), { id: 'check-now-toast' });
    try {
      await api.checkAll();
      await refresh();
      toast.success(t('toast.scanOk'), { id: 'check-now-toast' });
    } catch (err) {
      toast.error(err.message, { id: 'check-now-toast' });
    }
  };

  // --- TRIGGER MOCK INCIDENT HELPER ---
  const triggerMockIncident = useCallback((nodeId, nodeName, incidentType, description) => {
    // Kiểm tra xem sự cố OPEN cùng loại trên node này đã tồn tại chưa
    const existing = incidents.find(inc => inc.node.id === nodeId && inc.incidentType === incidentType && inc.status === 'OPEN');
    
    if (existing) {
      // Tăng số lần xuất hiện (count)
      setIncidents(prev => prev.map(inc => {
        if (inc.id === existing.id) {
          return {
            ...inc,
            count: inc.count + 1,
            detectedAt: new Date().toISOString() // Cập nhật lần cuối phát hiện
          };
        }
        return inc;
      }));
      if (wsConnected) {
        toast.error(t('toast.recurring', { node: nodeName, type: t(`incidentType.${incidentType}`), count: existing.count + 1 }));
      }
    } else {
      const newInc = {
        id: generateId(),
        node: { id: nodeId, name: nodeName },
        incidentType,
        issueDescription: description,
        resolutionAction: '',
        status: 'OPEN',
        detectedAt: new Date().toISOString(),
        resolvedAt: null,
        count: 1,
        assignee: null
      };
      
      setIncidents(prev => [newInc, ...prev]);
      setNewIncidentId(newInc.id);
      
      // Xóa highlight sau 3 giây
      setTimeout(() => {
        setNewIncidentId(null);
      }, 3000);

      if (wsConnected) {
        toast.custom((toastItem) => (
          <div className={`${toastItem.visible ? 'animate-bounce' : 'animate-ping'} max-w-md w-full bg-red-950/90 border border-red-500/50 backdrop-blur-md shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black/5 p-4`}>
            <div className="flex-1 w-0">
              <p className="text-sm font-bold text-red-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 pulse-alert inline-block"></span>
                {t('toast.newIncident')}
              </p>
              <p className="mt-1 text-sm text-slate-200">
                <strong>{nodeName}</strong> — <span className="text-amber-400">{t(`incidentType.${incidentType}`)}</span>
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {description}
              </p>
            </div>
            <div className="flex border-l border-red-500/20 pl-3 ml-3 justify-center items-center">
              <button
                onClick={() => toast.dismiss(toastItem.id)}
                className="text-xs text-red-400 hover:text-red-300 font-semibold focus:outline-none"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        ), { duration: 5000 });
      }
    }
  }, [incidents, wsConnected, t]);

  return (
    <AppContext.Provider value={{
      user,
      accessToken,
      nodes,
      incidents,
      channels,
      auditLogs,
      wsConnected,
      newIncidentId,
      lastScanAt,
      apiError,
      refresh,
      checkNodeNow,
      login,
      logout,
      addNode,
      updateNode,
      deleteNode,
      toggleNodeActive,
      resolveIncident,
      acknowledgeIncident,
      addAlertChannel,
      updateAlertChannel,
      deleteAlertChannel,
      toggleAlertChannel,
      getNodeMetrics,
      triggerCheckNow,
      setWsConnected,
      triggerMockIncident
    }}>
      {children}
    </AppContext.Provider>
  );
};
