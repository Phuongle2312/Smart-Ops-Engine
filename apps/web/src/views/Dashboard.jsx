import { useContext, useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { usePreferences } from '../context/PreferencesContext';
import { useNow } from '../hooks/useNow';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
} from 'recharts';
import {
  Server,
  AlertOctagon,
  ShieldAlert,
  Radar,
  ArrowRight,
  Sliders,
  X,
  Cpu,
  HardDrive,
  WifiOff,
  MemoryStick,
  Volume2,
  VolumeX,
  Radio,
  Flame,
  Activity,
  Search,
  Layers,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import {
  getIncidentType,
  getSeverity,
  getNodeHealth,
  isActiveIncident,
  compareIncidents,
  SEVERITY,
  SEVERITY_COLOR,
} from '../constants/incidentMeta';
import { IncidentTypeChip, StatusBadge } from '../components/IncidentBadges';
import ResolveIncidentModal from '../components/ResolveIncidentModal';

const QUEUE_SIZE = 8;

// Màu ô tình trạng máy chủ (dịu mắt, độ tương phản chuẩn WCAG)
const HEALTH_STYLE = {
  critical: {
    dot: 'bg-rose-500 pulse-alert',
    ring: 'border-rose-500/30 bg-rose-500/5 hover:border-rose-500/60',
    text: 'text-rose-600 dark:text-rose-400 font-semibold',
    bar: 'bg-rose-500',
  },
  warning: {
    dot: 'bg-amber-500 pulse-active',
    ring: 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60',
    text: 'text-amber-700 dark:text-amber-400 font-semibold',
    bar: 'bg-amber-500',
  },
  healthy: {
    dot: 'bg-emerald-500',
    ring: 'border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/40 hover:border-indigo-500/40 shadow-2xs',
    text: 'text-emerald-700 dark:text-emerald-400 font-semibold',
    bar: 'bg-emerald-500',
  },
  paused: {
    dot: 'bg-slate-400 dark:bg-slate-600',
    ring: 'border-slate-300 dark:border-slate-800 border-dashed bg-slate-100/50 dark:bg-transparent',
    text: 'text-slate-500 font-medium',
    bar: 'bg-slate-400 dark:bg-slate-600',
  },
};

// Kịch bản giả lập sự cố (chỉ DEV)
const SIMULATIONS = [
  { key: 'cpu', icon: Cpu, nodeId: 1, nodeName: 'prod-web-01', type: 'CPU_CRITICAL' },
  { key: 'disk', icon: HardDrive, nodeId: 5, nodeName: 'mail-smtp-server', type: 'DISK_CRITICAL' },
  { key: 'ssh', icon: WifiOff, nodeId: 3, nodeName: 'stg-api-gateway', type: 'SSH_FAILURE' },
  { key: 'ram', icon: MemoryStick, nodeId: 2, nodeName: 'prod-db-master', type: 'RAM_CRITICAL' },
];

// Web Audio API Synth Alarm Sound (Êm dịu)
const playAlertBeep = (type = 'critical') => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'critical') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // Note E5
      osc.frequency.setValueAtTime(587.33, ctx.currentTime + 0.12); // Note D5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // Note C5
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    }
  } catch {
    // AudioContext blocked until gesture
  }
};

// Thẻ chỉ số đầu trang (Êm dịu & Tinh tế)
const KpiCard = ({
  label,
  icon: Icon,
  iconClass,
  value,
  valueClass,
  unit,
  sub,
  subClass,
  onClick,
  alertGlow,
  cornerAccent,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={`glass relative overflow-hidden p-5 rounded-2xl text-left flex flex-col justify-between gap-3 min-w-0 transition-all duration-300 ${
      onClick ? 'glass-hover cursor-pointer' : 'cursor-default'
    } ${
      alertGlow === 'critical'
        ? 'glow-card-critical'
        : alertGlow === 'warning'
        ? 'glow-card-warning'
        : ''
    }`}
  >
    {/* Subtle HUD Corners */}
    {cornerAccent && (
      <>
        <div className="hud-corner-tl opacity-60" />
        <div className="hud-corner-br opacity-60" />
      </>
    )}

    {/* Top Accent Line */}
    <div
      className={`absolute top-0 left-0 right-0 h-1 ${
        alertGlow === 'critical'
          ? 'bg-rose-500/80'
          : alertGlow === 'warning'
          ? 'bg-amber-500/80'
          : 'bg-indigo-500/40'
      }`}
    />

    <div className="flex items-center justify-between gap-3 pt-1">
      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate flex items-center gap-1.5">
        {alertGlow === 'critical' && <span className="w-2 h-2 rounded-full bg-rose-500 pulse-alert inline-block" />}
        {label}
      </span>
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconClass}`}>
        <Icon className="w-4.5 h-4.5" />
      </span>
    </div>

    <div className="flex items-baseline gap-2 min-w-0">
      <span className={`font-heading font-bold tracking-tight leading-none tabular-nums ${valueClass}`}>
        {value}
      </span>
      {unit && <span className="text-sm font-semibold text-slate-400 truncate uppercase">{unit}</span>}
    </div>

    <span className={`text-xs font-semibold truncate ${subClass || 'text-slate-500 dark:text-slate-400'}`}>{sub}</span>
  </button>
);

const Card = ({ title, subtitle, action, children, className = '', headerClass = '', alertBorder }) => (
  <section
    className={`glass rounded-2xl p-5 flex flex-col min-w-0 relative overflow-hidden transition-all duration-300 ${
      alertBorder === 'critical'
        ? 'border-rose-500/30'
        : 'border-slate-200 dark:border-slate-800/80'
    } ${className}`}
  >
    <div className={`flex items-start justify-between gap-3 mb-4 ${headerClass}`}>
      <div className="min-w-0">
        <h3 className="text-base font-bold text-slate-100 font-heading flex items-center gap-2 tracking-wide">
          {title}
        </h3>
        {subtitle && <p className="text-xs text-slate-400 font-medium mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const EmptyState = ({ children }) => (
  <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 text-sm py-12 gap-2">
    <ShieldCheck className="w-10 h-10 text-emerald-500/50" />
    <span>{children}</span>
  </div>
);

const Dashboard = () => {
  const {
    user,
    nodes,
    incidents,
    wsConnected,
    lastScanAt,
    resolveIncident,
    acknowledgeIncident,
    triggerMockIncident,
  } = useContext(AppContext);
  const { t, formatDateTime, formatRelative, chartTheme } = usePreferences();
  const navigate = useNavigate();
  const now = useNow(10000);

  const isAdmin = user?.role === 'ROLE_ADMIN';
  const showSimulator = import.meta.env.DEV && isAdmin;

  const [resolvingId, setResolvingId] = useState(null);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [soundAlerts, setSoundAlerts] = useState(false);
  const [tableFilter, setTableFilter] = useState('ALL'); // 'ALL' | 'CRITICAL' | 'WARNING' | 'OPEN'
  const [searchQuery, setSearchQuery] = useState('');

  // --- 1. KPI & Thống Kê Đồng Bộ ---
  const stats = useMemo(() => {
    const active = incidents.filter(isActiveIncident); // OPEN + ACKNOWLEDGED
    const criticalActive = active.filter((inc) => getSeverity(inc.incidentType) === SEVERITY.CRITICAL).length;
    const warningActive = active.length - criticalActive;
    const openCount = incidents.filter((i) => i.status === 'OPEN').length;
    const acknowledgedCount = incidents.filter((i) => i.status === 'ACKNOWLEDGED').length;

    return {
      totalNodes: nodes.length,
      monitoredNodes: nodes.filter((n) => n.active).length,
      pausedNodes: nodes.filter((n) => !n.active).length,
      totalIncidents: incidents.length,
      activeIncidents: active.length, // 15
      openCount, // 14
      acknowledgedCount, // 1
      criticalActive, // 10
      warningActive, // 5
    };
  }, [nodes, incidents]);

  // Audio beep effect on critical change
  const prevCriticalCount = useRef(stats.criticalActive);
  useEffect(() => {
    if (soundAlerts && stats.criticalActive > prevCriticalCount.current) {
      playAlertBeep('critical');
    }
    prevCriticalCount.current = stats.criticalActive;
  }, [stats.criticalActive, soundAlerts]);

  // --- 2. Hàng đợi sự cố lọc theo Tab & Search ---
  const filteredQueue = useMemo(() => {
    let list = [...incidents].sort(compareIncidents);

    if (tableFilter === 'CRITICAL') {
      list = list.filter((inc) => getSeverity(inc.incidentType) === SEVERITY.CRITICAL && isActiveIncident(inc));
    } else if (tableFilter === 'WARNING') {
      list = list.filter((inc) => getSeverity(inc.incidentType) === SEVERITY.WARNING && isActiveIncident(inc));
    } else if (tableFilter === 'OPEN') {
      list = list.filter((inc) => inc.status === 'OPEN');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (inc) =>
          inc.node.name.toLowerCase().includes(q) ||
          inc.issueDescription.toLowerCase().includes(q) ||
          inc.incidentType.toLowerCase().includes(q)
      );
    }

    return list.slice(0, QUEUE_SIZE);
  }, [incidents, tableFilter, searchQuery]);

  // --- 3. Phân loại theo loại sự cố ---
  const breakdown = useMemo(() => {
    const counts = {};
    incidents.forEach((inc) => {
      counts[inc.incidentType] = (counts[inc.incidentType] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([type, value]) => ({ type, value, name: t(`incidentType.${type}`), color: getIncidentType(type).color }))
      .sort((a, b) => b.value - a.value);
  }, [incidents, t]);

  // --- 4. Top 5 máy chủ, chồng theo mức độ ---
  const topNodes = useMemo(() => {
    const byNode = {};
    incidents.forEach((inc) => {
      const row = byNode[inc.node.name] || { name: inc.node.name, CRITICAL: 0, WARNING: 0, total: 0 };
      row[getSeverity(inc.incidentType)] += 1;
      row.total += 1;
      byNode[inc.node.name] = row;
    });
    return Object.values(byNode).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [incidents]);

  // --- 5. Tình trạng từng máy chủ ---
  const nodeHealth = useMemo(() => {
    const rank = { critical: 0, warning: 1, healthy: 2, paused: 3 };
    return nodes
      .map((node) => ({ node, health: getNodeHealth(node, incidents) }))
      .sort((a, b) => rank[a.health] - rank[b.health]);
  }, [nodes, incidents]);

  const triggerEvent = (sim) => {
    if (!isAdmin) return;
    if (soundAlerts) playAlertBeep('critical');
    triggerMockIncident(sim.nodeId, sim.nodeName, sim.type, t(`dashboard.simulator.${sim.key}Desc`));
  };

  const handleResolveSubmit = (id, resolution) => {
    resolveIncident(id, resolution);
    setResolvingId(null);
  };

  const tooltipProps = {
    contentStyle: {
      backgroundColor: chartTheme.tooltipBg,
      borderColor: chartTheme.tooltipBorder,
      borderRadius: 10,
      fontSize: 12,
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
    },
    labelStyle: { color: chartTheme.tooltipLabel, fontWeight: 700 },
    itemStyle: { color: chartTheme.tooltipText },
    cursor: { fill: chartTheme.cursor },
  };

  const criticalHosts = useMemo(() => {
    return Array.from(
      new Set(
        incidents
          .filter((i) => isActiveIncident(i) && getSeverity(i.incidentType) === SEVERITY.CRITICAL)
          .map((i) => i.node.name)
      )
    );
  }, [incidents]);

  return (
    <div className="p-6 space-y-6 bg-tech-grid min-h-screen text-slate-800 dark:text-slate-100">
      {/* ── MISSION-CRITICAL ALERT COMMAND BANNER (Dịu mắt, rõ ràng) ── */}
      {stats.criticalActive > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-rose-500/30 dark:border-rose-500/30 bg-rose-50/80 dark:bg-slate-900/90 p-4 shadow-sm transition-all">
          <div className="cyber-scanline" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 animate-siren">
                <Flame className="w-6 h-6 fill-rose-500/20" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-rose-600 text-white shadow-sm">
                    {t('dashboard.alertBannerTitle')}
                  </span>
                  <span className="text-sm font-bold text-rose-700 dark:text-rose-300">
                    {t('dashboard.alertBannerSubtitle', { count: stats.criticalActive })}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold">{t('dashboard.affectedHosts')}</span>
                  {criticalHosts.map((host) => (
                    <span
                      key={host}
                      className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-800/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 shadow-2xs"
                    >
                      {host}
                    </span>
                  ))}
                </p>
              </div>
            </div>

            {/* Banner Quick Actions */}
            <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
              <button
                type="button"
                onClick={() => {
                  setSoundAlerts(!soundAlerts);
                  if (!soundAlerts) playAlertBeep('critical');
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  soundAlerts
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title={soundAlerts ? t('dashboard.soundOff') : t('dashboard.soundOn')}
              >
                {soundAlerts ? <Volume2 className="w-4 h-4 text-rose-500" /> : <VolumeX className="w-4 h-4" />}
                <span>{soundAlerts ? t('dashboard.soundOn') : t('dashboard.soundOff')}</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/app/incidents?status=OPEN')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm active:scale-95 transition-all cursor-pointer whitespace-nowrap"
              >
                <Zap className="w-4 h-4" />
                <span>{t('dashboard.fixNow')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Status Bar when nominal / zero incidents */}
      {stats.criticalActive === 0 && (
        <div className="glass rounded-2xl p-3.5 px-5 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 pulse-active" />
            <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
              {t('dashboard.operationalStatus')}: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{t('dashboard.statusBarNominal')}</span>
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 font-mono text-xs">
            <span>TELEMETRY: <strong className="text-emerald-600 dark:text-emerald-400">ACTIVE</strong></span>
            <span>LATENCY: <strong className="text-slate-700 dark:text-slate-300">12ms</strong></span>
            <button
              onClick={() => {
                setSoundAlerts(!soundAlerts);
                playAlertBeep('normal');
              }}
              className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer font-semibold"
            >
              {soundAlerts ? <Volume2 className="w-3.5 h-3.5 text-indigo-500" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{soundAlerts ? 'SOUND ON' : 'SOUND OFF'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── ONBOARDING GUIDE BANNER KHI CHƯA CÓ NODE NÀO ── */}
      {stats.totalNodes === 0 && (
        <div className="glass rounded-2xl p-6 border border-indigo-500/30 bg-gradient-to-r from-indigo-500/15 via-purple-500/10 to-transparent flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/30">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-100 font-heading">
                {t('dashboard.onboardingTitle')}
              </h4>
              <p className="text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
                {t('dashboard.onboardingDesc')}
              </p>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => navigate('/app/nodes')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <Server className="w-4 h-4" />
              <span>{t('dashboard.onboardingBtn')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* ── Hàng 1: 4 KPI CARDS (ĐỒNG BỘ SỐ LIỆU & DỊU MẮT) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <KpiCard
          label={t('dashboard.kpi.nodes')}
          icon={Server}
          iconClass="bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
          value={stats.totalNodes}
          valueClass="text-3xl text-slate-100 font-extrabold"
          sub={t('dashboard.kpi.nodesSub', { active: stats.monitoredNodes, paused: stats.pausedNodes })}
          cornerAccent
          onClick={() => navigate('/app/nodes')}
        />

        <KpiCard
          label="Sự cố đang xử lý"
          icon={AlertOctagon}
          iconClass={stats.activeIncidents > 0 ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}
          value={stats.activeIncidents}
          valueClass={`text-3xl font-extrabold ${stats.activeIncidents > 0 ? 'text-rose-500' : 'text-emerald-500'}`}
          sub={`${stats.openCount} đang mở · ${stats.acknowledgedCount} đã xác nhận`}
          subClass={stats.acknowledgedCount > 0 ? 'text-amber-500 font-semibold' : undefined}
          alertGlow={stats.activeIncidents > 0 ? 'critical' : undefined}
          cornerAccent
          onClick={() => navigate('/app/incidents?status=OPEN')}
        />

        <KpiCard
          label={t('dashboard.kpi.critical')}
          icon={ShieldAlert}
          iconClass={stats.criticalActive > 0 ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30' : 'bg-slate-800/30 text-slate-400 border border-slate-700/30'}
          value={stats.criticalActive}
          valueClass={`text-3xl font-extrabold ${stats.criticalActive > 0 ? 'text-rose-500' : 'text-slate-100'}`}
          unit={t('dashboard.kpi.criticalUnit')}
          sub={t('dashboard.kpi.criticalSub', { warning: stats.warningActive })}
          alertGlow={stats.criticalActive > 0 ? 'critical' : undefined}
          cornerAccent
          onClick={() => navigate('/app/incidents')}
        />

        {/* Card Radar Scanner Live */}
        <div className="glass relative overflow-hidden p-5 rounded-2xl text-left flex flex-col justify-between gap-3 min-w-0 border-slate-700/30">
          <div className="hud-corner-tl opacity-60" />
          <div className="hud-corner-br opacity-60" />
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500/50 to-indigo-500/50" />

          {/* Animated Subtle Radar Sweep */}
          <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full border border-indigo-500/15 overflow-hidden pointer-events-none flex items-center justify-center">
            <div className="w-full h-full radar-sweep rounded-full opacity-60" />
          </div>

          <div className="flex items-center justify-between gap-3 pt-1 relative z-10">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
              {t('dashboard.kpi.lastScan')}
            </span>
            <span className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Radar className="w-4.5 h-4.5 animate-spin" style={{ animationDuration: '10s' }} />
            </span>
          </div>

          <div className="relative z-10">
            <span className="font-heading font-extrabold text-2xl text-slate-100 truncate block">
              {lastScanAt ? (formatRelative(lastScanAt, now) === 'bây giờ' ? 'Vừa xong' : formatRelative(lastScanAt, now)) : t('dashboard.kpi.lastScanNever')}
            </span>
          </div>

          <div className="relative z-10 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500 pulse-active' : 'bg-rose-500'}`} />
            <span className={`text-xs font-semibold ${wsConnected ? 'text-emerald-500' : 'text-rose-500'}`}>
              {wsConnected ? t('dashboard.kpi.wsLive') : t('dashboard.kpi.wsOffline')}
            </span>
          </div>
        </div>
      </div>

      {/* ── Hàng 2: HÀNG ĐỢI SỰ CỐ CẦN XỬ LÝ (TABS + TÌM KIẾM) + PHÂN LOẠI ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <Card
          className="xl:col-span-8"
          title={
            <div className="flex items-center gap-2.5">
              <Activity className="w-4 h-4 text-indigo-500" />
              <span>{t('dashboard.queue.title')}</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-800/30 text-slate-200 border border-slate-700/40">
                {stats.activeIncidents} đang xử lý
              </span>
            </div>
          }
          subtitle={t('dashboard.queue.subtitle')}
          action={
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => navigate('/app/incidents')}
                className="text-xs text-indigo-500 hover:underline font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>{t('dashboard.queue.viewAll')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          }
        >
          {/* Quick Filter Tabs & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4 pt-1">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-800/20 border border-slate-700/30 overflow-x-auto text-xs">
              <button
                onClick={() => setTableFilter('ALL')}
                className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
                  tableFilter === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-slate-100'
                }`}
              >
                {t('dashboard.tabsAll', { count: stats.totalIncidents })}
              </button>
              <button
                onClick={() => setTableFilter('CRITICAL')}
                className={`px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  tableFilter === 'CRITICAL'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-rose-500 hover:bg-rose-500/10'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                {t('dashboard.tabsCritical', { count: stats.criticalActive })}
              </button>
              <button
                onClick={() => setTableFilter('WARNING')}
                className={`px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  tableFilter === 'WARNING'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-500 hover:bg-amber-500/10'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {t('dashboard.tabsWarning', { count: stats.warningActive })}
              </button>
              <button
                onClick={() => setTableFilter('OPEN')}
                className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
                  tableFilter === 'OPEN'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-slate-100'
                }`}
              >
                {t('dashboard.tabsOpen', { count: stats.openCount })}
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={t('dashboard.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-56 pl-9 pr-3.5 py-1.5 rounded-xl bg-slate-900/50 border border-slate-700/40 text-xs text-slate-100 font-medium placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {filteredQueue.length === 0 ? (
            <EmptyState>{t('dashboard.queue.empty')}</EmptyState>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-3">{t('dashboard.queue.colNode')}</th>
                    <th className="py-3 px-3">{t('dashboard.queue.colDetail')}</th>
                    <th className="py-3 px-3 whitespace-nowrap">{t('dashboard.queue.colTime')}</th>
                    <th className="py-3 px-3">{t('dashboard.queue.colStatus')}</th>
                    {isAdmin && <th className="py-3 px-3 text-right">{t('dashboard.queue.colActions')}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {filteredQueue.map((inc) => {
                    const resolved = inc.status === 'RESOLVED';
                    const isCrit = getSeverity(inc.incidentType) === SEVERITY.CRITICAL;
                    const relTime = formatRelative(inc.detectedAt, now);
                    const formattedTime = relTime === 'bây giờ' ? 'Vừa xong' : relTime;

                    return (
                      <tr
                        key={inc.id}
                        onClick={() => navigate(`/app/nodes/${inc.node.id}`)}
                        title={t('dashboard.queue.rowHint')}
                        className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors align-top group ${
                          resolved
                            ? 'opacity-50'
                            : isCrit
                            ? 'border-l-4 border-l-rose-500'
                            : 'border-l-4 border-l-amber-500/70'
                        }`}
                      >
                        <td className="py-3.5 px-3 min-w-[170px]">
                          <div className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                            {isCrit && !resolved && (
                              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                            )}
                            {inc.node.name}
                          </div>
                          <div className="mt-1">
                            <IncidentTypeChip type={inc.incidentType} />
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-slate-600 dark:text-slate-300 text-sm leading-relaxed max-w-md">
                          <span className="line-clamp-2 font-medium" title={inc.issueDescription}>
                            {inc.issueDescription}
                          </span>
                          {inc.count > 1 && (
                            <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-500/10 text-xs font-mono font-bold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/20">
                              LẶP LẠI {t('dashboard.queue.repeated', { count: inc.count })}
                            </span>
                          )}
                        </td>
                        <td
                          className="py-3.5 px-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono"
                          title={formatDateTime(inc.detectedAt)}
                        >
                          {formattedTime}
                        </td>
                        <td className="py-3.5 px-3">
                          <StatusBadge status={inc.status} />
                        </td>
                        {isAdmin && (
                          <td className="py-3.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-2">
                              {inc.status === 'OPEN' && (
                                <button
                                  onClick={() => {
                                    acknowledgeIncident(inc.id);
                                    if (soundAlerts) playAlertBeep('normal');
                                  }}
                                  title={t('actions.acknowledgeHint')}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-400 bg-amber-50/80 dark:bg-transparent hover:bg-amber-100 dark:hover:bg-amber-500/10 transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  {t('actions.acknowledge')}
                                </button>
                              )}
                              {!resolved && (
                                <button
                                  onClick={() => setResolvingId(inc.id)}
                                  title={t('actions.resolveHint')}
                                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors cursor-pointer whitespace-nowrap active:scale-95"
                                >
                                  {t('actions.resolve')}
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* ── BREAKDOWN CHART (DỊU MẮT & ĐỒNG BỘ) ── */}
        <Card
          className="xl:col-span-4"
          title={
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-500" />
              <span>{t('dashboard.breakdown.title')}</span>
            </div>
          }
        >
          {breakdown.length === 0 ? (
            <EmptyState>{t('dashboard.breakdown.empty')}</EmptyState>
          ) : (
            <>
              <div className="relative h-48 my-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={breakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="68%"
                      outerRadius="92%"
                      paddingAngle={3}
                      stroke="none"
                    >
                      {breakdown.map((entry) => (
                        <Cell key={entry.type} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip {...tooltipProps} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-heading font-extrabold text-slate-900 dark:text-slate-50 leading-none tabular-nums">
                    {stats.totalIncidents}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">
                    Tổng sự cố
                  </span>
                </div>
              </div>

              {/* Enhanced Visual Legend */}
              <ul className="mt-4 space-y-2.5">
                {breakdown.map((entry) => {
                  const percent = Math.round((entry.value / stats.totalIncidents) * 100);
                  return (
                    <li key={entry.type} className="flex flex-col gap-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="text-slate-700 dark:text-slate-300 font-medium truncate">{entry.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{entry.value}</span>
                          <span className="text-slate-500 font-mono text-[11px] w-8 text-right">{percent}%</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300 opacity-90"
                          style={{ width: `${percent}%`, backgroundColor: entry.color }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>
      </div>

      {/* ── Hàng 3: TOP MÁY CHỦ + CYBER SERVER RACK MATRIX ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <Card
          className="xl:col-span-7"
          title={
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-500" />
              <span>{t('dashboard.topNodes.title')}</span>
            </div>
          }
          action={
            <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
              {[SEVERITY.CRITICAL, SEVERITY.WARNING].map((sev) => (
                <span key={sev} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: SEVERITY_COLOR[sev] }}
                  />
                  {t(`severity.${sev}`)}
                </span>
              ))}
            </div>
          }
        >
          {topNodes.length === 0 ? (
            <EmptyState>{t('dashboard.topNodes.empty')}</EmptyState>
          ) : (
            <div style={{ height: Math.max(180, topNodes.length * 48 + 30) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topNodes}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                  barCategoryGap={14}
                >
                  <CartesianGrid horizontal={false} stroke={chartTheme.grid} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    stroke={chartTheme.axis}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    stroke={chartTheme.axis}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip {...tooltipProps} />
                  <Bar
                    dataKey={SEVERITY.CRITICAL}
                    name={t('severity.CRITICAL')}
                    stackId="sev"
                    fill={SEVERITY_COLOR.CRITICAL}
                    maxBarSize={18}
                  />
                  <Bar
                    dataKey={SEVERITY.WARNING}
                    name={t('severity.WARNING')}
                    stackId="sev"
                    fill={SEVERITY_COLOR.WARNING}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* ── SERVER RACK MATRIX ── */}
        <Card
          className="xl:col-span-5"
          title={
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-500" />
              <span>{t('dashboard.health.title')}</span>
            </div>
          }
          subtitle="Tải CPU / RAM / Ổ đĩa thời gian thực"
        >
          {nodeHealth.length === 0 ? (
            <EmptyState>{t('dashboard.health.empty')}</EmptyState>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-1">
              {nodeHealth.map(({ node, health }) => {
                const style = HEALTH_STYLE[health];
                const metrics = [
                  { label: 'CPU', val: node.cpu, active: node.monitorCpu },
                  { label: 'RAM', val: node.ram, active: node.monitorRam },
                  { label: 'DSK', val: node.disk, active: node.monitorDisk },
                ];

                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => navigate(`/app/nodes/${node.id}`)}
                    className={`text-left p-3.5 rounded-xl border ${style.ring} transition-all cursor-pointer min-w-0 relative overflow-hidden group`}
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />
                        <span
                          className="text-sm font-bold text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate"
                          title={node.name}
                        >
                          {node.name}
                        </span>
                      </div>
                      <span className={`text-xs uppercase font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-2xs ${style.text}`}>
                        {t(`nodeHealth.${health}`)}
                      </span>
                    </div>

                    {/* Progress bars */}
                    {node.active && (
                      <div className="space-y-2 mt-3">
                        {metrics.map(({ label, val, active }) => {
                          if (!active) return null;
                          const isHigh = val >= 90;
                          const isMed = val >= 80;
                          const barColor = isHigh ? 'bg-rose-500' : isMed ? 'bg-amber-500' : 'bg-emerald-500';
                          return (
                            <div key={label} className="text-xs">
                              <div className="flex justify-between font-mono text-slate-500 dark:text-slate-400 mb-1">
                                <span className="font-semibold">{label}</span>
                                <span className={`font-bold ${isHigh ? 'text-rose-600 dark:text-rose-400' : isMed ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                  {val}%
                                </span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                                  style={{ width: `${Math.min(100, val)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ── Giả lập sự cố: DEV ONLY ── */}
      {showSimulator && (
        <>
          <button
            onClick={() => setSimulatorOpen(true)}
            className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold shadow-lg hover:border-indigo-500 transition-all cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span>{t('dashboard.simulator.open')}</span>
            <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-[10px] text-indigo-300 font-mono">DEV</span>
          </button>

          {simulatorOpen && (
            <div className="fixed inset-0 z-40 bg-[var(--soe-overlay)]" onClick={() => setSimulatorOpen(false)}>
              <aside
                className="drawer-in absolute right-0 top-0 h-full w-full max-w-sm bg-[var(--soe-bg)] border-l border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-5 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 font-heading flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-indigo-500" />
                      {t('dashboard.simulator.title')}
                    </h3>
                    <span className="inline-block mt-1.5 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                      {t('dashboard.simulator.devOnly')}
                    </span>
                  </div>
                  <button
                    onClick={() => setSimulatorOpen(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    aria-label={t('common.close')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t('dashboard.simulator.description')}</p>
                <div className="space-y-2.5">
                  {SIMULATIONS.map((sim) => {
                    const Icon = sim.icon;
                    return (
                      <button
                        key={sim.key}
                        onClick={() => triggerEvent(sim)}
                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 bg-white dark:bg-slate-900/40 text-left flex items-center gap-3 transition-colors cursor-pointer shadow-2xs"
                      >
                        <Icon className="w-4.5 h-4.5 shrink-0" style={{ color: getIncidentType(sim.type).color }} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {t(`dashboard.simulator.${sim.key}`)}
                          </span>
                          <span className="block text-xs text-slate-500 font-mono truncate">{sim.nodeName}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 leading-relaxed">
                  {t('dashboard.simulator.note')}
                </p>
              </aside>
            </div>
          )}
        </>
      )}

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

export default Dashboard;
