import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

export const AppContext = createContext();

// Hỗ trợ tạo ID ngẫu nhiên cho mock data
const generateId = () => Math.floor(Math.random() * 1000000);

// Khởi tạo danh sách Node mặc định
const DEFAULT_NODES = [
  { id: 1, name: 'prod-web-01', host: '192.168.1.10', port: 22, username: 'ubuntu', description: 'Máy chủ chạy Web Frontend Production', active: true, cpu: 45, disk: 78, ram: 62, monitorCpu: true, monitorDisk: true, monitorRam: true },
  { id: 2, name: 'prod-db-master', host: '192.168.1.20', port: 22, username: 'postgres', description: 'Cơ sở dữ liệu chính PostgreSQL', active: true, cpu: 18, disk: 89, ram: 84, monitorCpu: true, monitorDisk: true, monitorRam: true },
  { id: 3, name: 'stg-api-gateway', host: '192.168.2.11', port: 2222, username: 'admin', description: 'API Gateway môi trường Staging', active: true, cpu: 28, disk: 45, ram: 50, monitorCpu: true, monitorDisk: true, monitorRam: false },
  { id: 4, name: 'dev-runner-01', host: '192.168.5.50', port: 22, username: 'runner', description: 'GitLab CI Runner cho đội phát triển', active: false, cpu: 0, disk: 50, ram: 0, monitorCpu: true, monitorDisk: true, monitorRam: true },
  { id: 5, name: 'mail-smtp-server', host: '10.0.0.15', port: 25, username: 'postfix', description: 'Hệ thống gửi nhận mail SMTP', active: true, cpu: 12, disk: 92, ram: 28, monitorCpu: false, monitorDisk: true, monitorRam: true }
];

// Khởi tạo danh sách sự cố mặc định
const DEFAULT_INCIDENTS = [
  { id: 101, node: { id: 5, name: 'mail-smtp-server' }, incidentType: 'DISK_CRITICAL', issueDescription: 'Dung lượng ổ đĩa vượt ngưỡng nguy hiểm: 92% (Ngưỡng 90%)', resolutionAction: '', status: 'OPEN', detectedAt: new Date(Date.now() - 3600000 * 2).toISOString(), resolvedAt: null, count: 4, assignee: null },
  { id: 102, node: { id: 2, name: 'prod-db-master' }, incidentType: 'DISK_WARNING', issueDescription: 'Dung lượng ổ đĩa vượt ngưỡng cảnh báo: 89% (Ngưỡng 80%)', resolutionAction: 'Đã xóa file logs cũ và clear cache.', status: 'RESOLVED', detectedAt: new Date(Date.now() - 3600000 * 5).toISOString(), resolvedAt: new Date(Date.now() - 3600000 * 4).toISOString(), count: 1, assignee: 'Lê Trí Phương' },
  { id: 103, node: { id: 3, name: 'stg-api-gateway' }, incidentType: 'SSH_FAILURE', issueDescription: 'Mất kết nối SSH tới máy chủ: Connection timed out.', resolutionAction: '', status: 'ACKNOWLEDGED', detectedAt: new Date(Date.now() - 3600000 * 12).toISOString(), resolvedAt: null, count: 2, assignee: 'Lê Trí Phương' },
  { id: 104, node: { id: 4, name: 'dev-runner-01' }, incidentType: 'CPU_HIGH', issueDescription: 'Tải CPU vượt ngưỡng cảnh báo: 85% (Ngưỡng 80%)', resolutionAction: 'Đã khởi động lại dịch vụ Docker.', status: 'RESOLVED', detectedAt: new Date(Date.now() - 3600000 * 24).toISOString(), resolvedAt: new Date(Date.now() - 3600000 * 23).toISOString(), count: 3, assignee: 'System Auto' }
];

// Khởi tạo Alert Channels mặc định
const DEFAULT_CHANNELS = [
  { id: 1, name: 'Email Nhận Cảnh Báo', type: 'Email', target: 'letriphuong23.12@gmail.com', minSeverity: 'Warning', active: true },
  { id: 2, name: 'Slack Webhook Operations', type: 'Webhook', target: 'https://hooks.slack.com/services/T00/B00/X00', minSeverity: 'Critical', active: true }
];

// Khởi tạo Audit Logs mặc định
const DEFAULT_AUDIT_LOGS = [
  { id: 501, timestamp: new Date(Date.now() - 3600000 * 4).toISOString(), username: 'admin', action: 'UPDATE', target: 'Node', targetId: 2, ipAddress: '192.168.1.100', oldValue: '{"disk": 92}', newValue: '{"disk": 89}' },
  { id: 502, timestamp: new Date(Date.now() - 3600000 * 4).toISOString(), username: 'admin', action: 'RESOLVE', target: 'IncidentLog', targetId: 102, ipAddress: '192.168.1.100', oldValue: '{"status": "OPEN"}', newValue: '{"status": "RESOLVED", "resolutionAction": "Đã xóa file logs cũ..."}' },
  { id: 503, timestamp: new Date(Date.now() - 3600000 * 10).toISOString(), username: 'admin', action: 'CREATE', target: 'AlertChannel', targetId: 2, ipAddress: '192.168.1.100', oldValue: null, newValue: '{"name": "Slack Webhook Operations", "type": "Webhook"}' }
];

// Hàm phụ để sinh dữ liệu biểu đồ lịch sử 24h, 7d, 30d cho một Node
const generateHistoricalMetrics = (nodeId, range) => {
  const points = range === '24h' ? 24 : range === '7d' ? 7 : 30;
  const data = [];
  const now = new Date();
  
  // Xác định base metrics dựa vào node
  let baseCpu = 25, baseDisk = 50, baseRam = 45;
  if (nodeId === 1) { baseCpu = 40; baseDisk = 75; baseRam = 60; }
  else if (nodeId === 2) { baseCpu = 15; baseDisk = 87; baseRam = 80; }
  else if (nodeId === 3) { baseCpu = 20; baseDisk = 42; baseRam = 48; }
  else if (nodeId === 5) { baseCpu = 10; baseDisk = 90; baseRam = 25; }

  for (let i = points - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - (range === '24h' ? i * 3600000 : range === '7d' ? i * 24 * 3600000 : i * 24 * 3600000));
    
    // Tạo độ biến động ngẫu nhiên hình sin + random
    const varianceCpu = Math.sin(i / 2) * 10 + (Math.random() - 0.5) * 8;
    const varianceDisk = (i / points) * -3 + (Math.random() - 0.5) * 1.5; // giảm dần về quá khứ
    const varianceRam = Math.cos(i / 3) * 5 + (Math.random() - 0.5) * 4;

    const formattedTime = range === '24h' 
      ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      : time.toLocaleDateString([], { month: '2-digit', day: '2-digit' });

    data.push({
      time: formattedTime,
      timestamp: time.toISOString(),
      cpu: Math.max(0, Math.min(100, Math.round(baseCpu + varianceCpu))),
      disk: Math.max(0, Math.min(100, Math.round(baseDisk + varianceDisk))),
      ram: Math.max(0, Math.min(100, Math.round(baseRam + varianceRam)))
    });
  }
  return data;
};

export const AppProvider = ({ children }) => {
  // --- AUTH STATE ---
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('soe_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [accessToken, setAccessToken] = useState(() => {
    return user ? 'mock-jwt-token-xyz-12345' : null;
  });

  // --- CORE STATE ---
  const [nodes, setNodes] = useState(() => {
    const saved = localStorage.getItem('soe_nodes');
    return saved ? JSON.parse(saved) : DEFAULT_NODES;
  });
  const [incidents, setIncidents] = useState(() => {
    const saved = localStorage.getItem('soe_incidents');
    return saved ? JSON.parse(saved) : DEFAULT_INCIDENTS;
  });
  const [channels, setChannels] = useState(() => {
    const saved = localStorage.getItem('soe_channels');
    return saved ? JSON.parse(saved) : DEFAULT_CHANNELS;
  });
  const [auditLogs, setAuditLogs] = useState(() => {
    const saved = localStorage.getItem('soe_audit_logs');
    return saved ? JSON.parse(saved) : DEFAULT_AUDIT_LOGS;
  });

  // --- WEB SOCKET STATUS ---
  const [wsConnected, setWsConnected] = useState(true);
  const [newIncidentId, setNewIncidentId] = useState(null); // Lưu ID incident mới nhận để highlight

  // --- METRICS CACHE (Vẽ biểu đồ lịch sử) ---
  const [metricsCache, setMetricsCache] = useState({});

  // Sync states to local storage
  useEffect(() => {
    localStorage.setItem('soe_nodes', JSON.stringify(nodes));
  }, [nodes]);

  useEffect(() => {
    localStorage.setItem('soe_incidents', JSON.stringify(incidents));
  }, [incidents]);

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
          toast.success(`Đăng nhập thành công với quyền ${u === 'admin' ? 'ADMIN' : 'VIEWER'}!`);
          resolve(loggedUser);
        } else {
          reject(new Error('Tên đăng nhập hoặc mật khẩu không đúng.'));
        }
      }, 500);
    });
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('soe_user');
    toast.success('Đã đăng xuất khỏi hệ thống.');
  };

  // --- NODE CRUD ACTIONS ---
  const addNode = (nodeData) => {
    const newNode = {
      id: generateId(),
      active: true,
      cpu: 0,
      disk: 0,
      ram: 0,
      ...nodeData
    };
    setNodes(prev => [...prev, newNode]);
    logAudit('CREATE', 'Node', newNode.id, null, nodeData);
    toast.success(`Đã thêm máy chủ ${nodeData.name} thành công.`);
  };

  const updateNode = (id, nodeData) => {
    let oldNode = null;
    setNodes(prev => prev.map(node => {
      if (node.id === id) {
        oldNode = { ...node };
        return { ...node, ...nodeData };
      }
      return node;
    }));
    logAudit('UPDATE', 'Node', id, oldNode, nodeData);
    toast.success(`Cập nhật thông tin máy chủ thành công.`);
  };

  const deleteNode = (id) => {
    const nodeToDelete = nodes.find(n => n.id === id);
    if (!nodeToDelete) return;
    setNodes(prev => prev.filter(node => node.id !== id));
    logAudit('DELETE', 'Node', id, nodeToDelete, null);
    toast.success(`Đã xóa máy chủ ${nodeToDelete.name}.`);
  };

  const toggleNodeActive = (id) => {
    let oldState = null;
    let newState = null;
    setNodes(prev => prev.map(node => {
      if (node.id === id) {
        oldState = { active: node.active };
        newState = { active: !node.active };
        
        // Nếu ngắt giám sát, đưa các chỉ số về 0
        const updated = {
          ...node,
          active: !node.active,
          cpu: !node.active ? node.cpu : 0,
          disk: !node.active ? node.disk : 0,
          ram: !node.active ? node.ram : 0
        };
        return updated;
      }
      return node;
    }));
    
    const node = nodes.find(n => n.id === id);
    logAudit('UPDATE', 'Node', id, oldState, newState);
    toast.success(`Đã ${!node.active ? 'bật' : 'tắt'} giám sát máy chủ ${node.name}.`);
  };

  // --- INCIDENT ACTIONS ---
  const resolveIncident = (id, resolutionAction) => {
    let oldIncident = null;
    let updatedIncident = null;
    setIncidents(prev => prev.map(inc => {
      if (inc.id === id) {
        oldIncident = { status: inc.status, resolutionAction: inc.resolutionAction, resolvedAt: inc.resolvedAt };
        updatedIncident = {
          ...inc,
          status: 'RESOLVED',
          resolutionAction: resolutionAction || 'Đã kiểm tra và xử lý sự cố hoàn tất.',
          resolvedAt: new Date().toISOString(),
          assignee: user ? user.fullName.split(' (')[0] : 'System Auto'
        };
        return updatedIncident;
      }
      return inc;
    }));
    logAudit('RESOLVE', 'IncidentLog', id, oldIncident, { status: 'RESOLVED', resolutionAction });
    toast.success('Sự cố đã được giải quyết thành công.');
  };

  const acknowledgeIncident = (id) => {
    let oldIncident = null;
    setIncidents(prev => prev.map(inc => {
      if (inc.id === id) {
        oldIncident = { status: inc.status };
        return {
          ...inc,
          status: 'ACKNOWLEDGED',
          assignee: user ? user.fullName.split(' (')[0] : 'System'
        };
      }
      return inc;
    }));
    logAudit('ACKNOWLEDGE', 'IncidentLog', id, oldIncident, { status: 'ACKNOWLEDGED' });
    toast.success('Đã xác nhận sự cố (Đang xử lý).');
  };

  // --- ALERT CHANNELS CRUD ---
  const addAlertChannel = (channelData) => {
    const newChan = { id: generateId(), active: true, ...channelData };
    setChannels(prev => [...prev, newChan]);
    logAudit('CREATE', 'AlertChannel', newChan.id, null, channelData);
    toast.success(`Đã thêm kênh thông báo ${channelData.name}.`);
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
    toast.success(`Cập nhật kênh thông báo thành công.`);
  };

  const deleteAlertChannel = (id) => {
    const oldChan = channels.find(c => c.id === id);
    setChannels(prev => prev.filter(c => c.id !== id));
    logAudit('DELETE', 'AlertChannel', id, oldChan, null);
    toast.success(`Đã xóa kênh thông báo.`);
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
    toast.success(`Đã thay đổi trạng thái kênh thông báo.`);
  };

  // --- NODE METRICS FETCH SIMULATION ---
  const getNodeMetrics = (nodeId, range) => {
    const cacheKey = `${nodeId}_${range}`;
    if (metricsCache[cacheKey]) {
      return metricsCache[cacheKey];
    }
    const data = generateHistoricalMetrics(nodeId, range);
    setMetricsCache(prev => ({ ...prev, [cacheKey]: data }));
    return data;
  };

  // --- SYSTEM CHECK NOW (ADMIN ONLY, RATE-LIMITED) ---
  const lastCheckTime = useRef(0);
  const triggerCheckNow = () => {
    if (user?.role !== 'ROLE_ADMIN') {
      toast.error('Bạn không có quyền thực hiện thao tác này.');
      return;
    }
    const now = Date.now();
    if (now - lastCheckTime.current < 12000) { // 12 giây thay vì 1 phút để test dễ dàng hơn
      toast.error('Thao tác quá nhanh. Vui lòng đợi trong giây lát.');
      return;
    }
    lastCheckTime.current = now;
    toast.loading('Đang gửi lệnh quét khẩn cấp tới các máy chủ...', { id: 'check-now-toast', duration: 1500 });
    
    setTimeout(() => {
      // Đọc ngẫu nhiên một node và thay đổi metrics để người dùng thấy biến động
      const activeNodes = nodes.filter(n => n.active);
      if (activeNodes.length > 0) {
        const randomNode = activeNodes[Math.floor(Math.random() * activeNodes.length)];
        
        // Random tăng mạnh một chỉ số
        const metricType = Math.random() > 0.5 ? 'cpu' : 'ram';
        const newVal = Math.floor(Math.random() * 20) + 75; // 75% -> 95%
        
        setNodes(prev => prev.map(n => {
          if (n.id === randomNode.id) {
            return {
              ...n,
              [metricType]: newVal
            };
          }
          return n;
        }));

        // Nếu tăng quá cao, tạo sự cố
        if (newVal >= 80) {
          const isCritical = newVal >= 90;
          const incidentType = `${metricType.toUpperCase()}_${isCritical ? 'CRITICAL' : 'HIGH'}`;
          const desc = `Phát hiện quá tải ${metricType.toUpperCase()} qua quét khẩn cấp: ${newVal}% (Ngưỡng ${isCritical ? '90%' : '80%'})`;
          
          triggerMockIncident(randomNode.id, randomNode.name, incidentType, desc);
        } else {
          toast.success('Hoàn thành quét hệ thống. Các chỉ số hoạt động ổn định.', { id: 'check-now-toast' });
        }
      } else {
        toast.error('Không có máy chủ nào đang hoạt động để quét.', { id: 'check-now-toast' });
      }
    }, 1500);
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
        toast.error(`[WebSocket] ${nodeName} tái phát sự cố ${incidentType} (${incidents.find(i=>i.id===existing.id)?.count+1 || 2} lần)!`);
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
        toast.custom((t) => (
          <div className={`${t.visible ? 'animate-bounce' : 'animate-ping'} max-w-md w-full bg-red-950/80 border border-red-500/50 backdrop-blur-md shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 p-4`}>
            <div className="flex-1 w-0">
              <p className="text-sm font-bold text-red-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 pulse-alert inline-block"></span>
                PHÁT HIỆN SỰ CỐ MỚI (WebSocket Live)
              </p>
              <p className="mt-1 text-sm text-gray-200">
                <strong>{nodeName}</strong> — <span className="text-yellow-400 font-mono">{incidentType}</span>
              </p>
              <p className="mt-0.5 text-xs text-gray-400">
                {description}
              </p>
            </div>
            <div className="flex border-l border-red-500/20 pl-3 ml-3 justify-center items-center">
              <button
                onClick={() => toast.dismiss(t.id)}
                className="text-xs text-red-400 hover:text-red-300 font-semibold focus:outline-none"
              >
                Đóng
              </button>
            </div>
          </div>
        ), { duration: 5000 });
      }
    }
  }, [incidents, wsConnected]);

  // --- METRICS FLUCTUATION SIMULATION & BACKGROUND ALERTS ---
  useEffect(() => {
    const timer = setInterval(() => {
      // Chỉ hoạt động khi có người dùng đăng nhập
      if (!user) return;

      // 1. Cập nhật nhẹ các thông số tài nguyên của các Node đang active
      setNodes(prevNodes => prevNodes.map(node => {
        if (!node.active) return node;

        // Tạo dao động nhỏ (-5% đến +5%)
        const deltaCpu = Math.floor(Math.random() * 11) - 5;
        const deltaRam = Math.floor(Math.random() * 9) - 4;
        const deltaDisk = Math.floor(Math.random() * 3) - 1; // Ổ đĩa dao động cực ít

        const nextCpu = Math.max(5, Math.min(98, node.cpu + deltaCpu));
        const nextRam = Math.max(10, Math.min(96, node.ram + deltaRam));
        const nextDisk = Math.max(5, Math.min(99, node.disk + deltaDisk));

        return {
          ...node,
          cpu: node.monitorCpu ? nextCpu : node.cpu,
          ram: node.monitorRam ? nextRam : node.ram,
          disk: node.monitorDisk ? nextDisk : node.disk
        };
      }));

      // 2. Tỷ lệ nhỏ (khoảng 8%) tạo sự cố ngẫu nhiên trên một Active Node để demo WebSocket
      if (Math.random() < 0.08) {
        const activeNodes = nodes.filter(n => n.active);
        if (activeNodes.length === 0) return;
        const targetNode = activeNodes[Math.floor(Math.random() * activeNodes.length)];
        
        // Chọn loại sự cố ngẫu nhiên
        const rand = Math.random();
        let incidentType = '';
        let desc = '';

        if (rand < 0.25 && targetNode.monitorCpu) {
          incidentType = 'CPU_CRITICAL';
          desc = `Tải CPU tăng đột biến vượt mức nghiêm trọng: ${Math.floor(Math.random()*6) + 93}% (Ngưỡng 90%)`;
        } else if (rand < 0.50 && targetNode.monitorDisk) {
          incidentType = 'DISK_WARNING';
          desc = `Dung lượng ổ đĩa chạm mức cảnh báo: ${Math.floor(Math.random()*4) + 82}% (Ngưỡng 80%)`;
        } else if (rand < 0.75 && targetNode.monitorRam) {
          incidentType = 'RAM_CRITICAL';
          desc = `Tràn bộ nhớ RAM hệ thống: ${Math.floor(Math.random()*5) + 91}% (Ngưỡng 90%)`;
        } else {
          incidentType = 'SSH_FAILURE';
          desc = `Mất kết nối SSH (Authentication Failure) - Failed publickey for admin from 192.168.1.100.`;
        }

        // Tạm thời set chỉ số trên Node tương ứng để đồng bộ
        if (incidentType.includes('CPU')) {
          setNodes(prev => prev.map(n => n.id === targetNode.id ? { ...n, cpu: 94 } : n));
        } else if (incidentType.includes('DISK')) {
          setNodes(prev => prev.map(n => n.id === targetNode.id ? { ...n, disk: 84 } : n));
        } else if (incidentType.includes('RAM')) {
          setNodes(prev => prev.map(n => n.id === targetNode.id ? { ...n, ram: 92 } : n));
        }

        triggerMockIncident(targetNode.id, targetNode.name, incidentType, desc);
      }
    }, 7000); // 7 giây một chu kỳ mô phỏng để trang web sinh động

    return () => clearInterval(timer);
  }, [user, nodes, triggerMockIncident]);

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
