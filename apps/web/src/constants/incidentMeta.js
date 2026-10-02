// Nguồn duy nhất cho nhãn / màu / mức độ của loại sự cố và trạng thái.
// Nhãn hiển thị lấy qua i18n: t(`incidentType.${type}`), t(`status.${status}`), t(`severity.${severity}`).

export const SEVERITY = {
  CRITICAL: 'CRITICAL',
  WARNING: 'WARNING',
};

// color: mã hex dùng cho biểu đồ + chấm màu; bảng màu dịu mắt, dễ nhìn
export const INCIDENT_TYPES = {
  DISK_CRITICAL: { severity: SEVERITY.CRITICAL, color: '#e11d48' },
  CPU_CRITICAL: { severity: SEVERITY.CRITICAL, color: '#ea580c' },
  RAM_CRITICAL: { severity: SEVERITY.CRITICAL, color: '#9333ea' },
  SSH_FAILURE: { severity: SEVERITY.CRITICAL, color: '#db2777' },
  DISK_WARNING: { severity: SEVERITY.WARNING, color: '#d97706' },
  CPU_HIGH: { severity: SEVERITY.WARNING, color: '#0d9488' },
  RAM_HIGH: { severity: SEVERITY.WARNING, color: '#2563eb' },
};

const FALLBACK_TYPE = { severity: SEVERITY.WARNING, color: '#64748b' };

export const getIncidentType = (type) => INCIDENT_TYPES[type] || FALLBACK_TYPE;

export const getSeverity = (type) => getIncidentType(type).severity;

export const SEVERITY_BADGE = {
  CRITICAL: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25',
  WARNING: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25',
};

// Màu hex theo mức độ cho biểu đồ cột chồng
export const SEVERITY_COLOR = {
  CRITICAL: '#e11d48',
  WARNING: '#d97706',
};

export const STATUS_BADGE = {
  OPEN: 'bg-red-500/10 text-red-400 border border-red-500/25',
  ACKNOWLEDGED: 'bg-amber-500/10 text-amber-400 border border-amber-500/25',
  RESOLVED: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25',
};

// Thứ tự ưu tiên hiển thị: đang mở > đã xác nhận > đã xử lý
export const STATUS_ORDER = { OPEN: 0, ACKNOWLEDGED: 1, RESOLVED: 2 };

export const isActiveIncident = (inc) => inc.status !== 'RESOLVED';

// Sắp xếp: trạng thái ưu tiên trước, trong cùng trạng thái thì CRITICAL trước, rồi mới nhất trước
export const compareIncidents = (a, b) => {
  const byStatus = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
  if (byStatus !== 0) return byStatus;
  const sevA = getSeverity(a.incidentType) === SEVERITY.CRITICAL ? 0 : 1;
  const sevB = getSeverity(b.incidentType) === SEVERITY.CRITICAL ? 0 : 1;
  if (sevA !== sevB) return sevA - sevB;
  return new Date(b.detectedAt) - new Date(a.detectedAt);
};

// Ngưỡng tài nguyên dùng cho màu hiển thị
export const RESOURCE_WARNING = 80;
export const RESOURCE_CRITICAL = 90;

export const resourceLevel = (value) => {
  if (value >= RESOURCE_CRITICAL) return 'critical';
  if (value >= RESOURCE_WARNING) return 'warning';
  return 'ok';
};

export const RESOURCE_TEXT = {
  critical: 'text-red-400',
  warning: 'text-amber-400',
  ok: 'text-emerald-400',
  off: 'text-slate-600',
};

export const RESOURCE_BAR = {
  critical: 'bg-red-500',
  warning: 'bg-amber-500',
  ok: 'bg-emerald-500',
};

// Tình trạng tổng hợp của một node: paused | critical | warning | healthy
export const getNodeHealth = (node, incidents) => {
  if (!node.active) return 'paused';
  const active = incidents.filter((inc) => inc.node.id === node.id && isActiveIncident(inc));
  const metrics = [
    node.monitorCpu ? node.cpu : 0,
    node.monitorDisk ? node.disk : 0,
    node.monitorRam ? node.ram : 0,
  ];
  if (active.some((inc) => getSeverity(inc.incidentType) === SEVERITY.CRITICAL) || metrics.some((v) => v >= RESOURCE_CRITICAL)) {
    return 'critical';
  }
  if (active.length > 0 || metrics.some((v) => v >= RESOURCE_WARNING)) return 'warning';
  return 'healthy';
};
