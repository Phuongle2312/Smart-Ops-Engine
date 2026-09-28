import { useContext, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { Mail, Server, Gauge, Send, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

// Backend chưa có proxy dev — gọi thẳng cổng Spring Boot.
const API_BASE = 'http://localhost:8080/api/system-config';

const DEFAULT_FORM = {
  smtpHost: '',
  smtpPort: 25,
  smtpAuth: false,
  smtpStartTls: false,
  smtpUsername: '',
  smtpPassword: '',
  alertRecipientEmail: '',
  diskWarningThreshold: 80,
  diskCriticalThreshold: 90,
  cpuCriticalThreshold: 85,
  memoryCriticalThreshold: 90,
  schedulerIntervalMs: 300000,
};

const SystemConfig = () => {
  const { user } = useContext(AppContext);
  const isAdmin = user?.role === 'ROLE_ADMIN';

  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;

    const loadConfig = async () => {
      try {
        const res = await fetch(API_BASE);
        if (!res.ok) throw new Error('Không tải được cấu hình từ backend');
        const data = await res.json();
        setForm({ ...DEFAULT_FORM, ...data });
      } catch (err) {
        toast.error(`Không kết nối được backend: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, [isAdmin]);

  // --- ROUTE GUARD FOR SECURITY (theo pattern AlertChannels.jsx) ---
  // Đặt SAU các hook để không vi phạm rules-of-hooks (early return trước hook có thể
  // gây crash "Rendered fewer hooks than expected" nếu role đổi giữa các lần render).
  if (!isAdmin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleTestEmail = async () => {
    setTesting(true);
    const toastId = toast.loading('Đang gửi email thử...');
    try {
      const res = await fetch(`${API_BASE}/test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || data.status === 'FAILED') {
        throw new Error(data.message || 'Gửi email thử thất bại');
      }
      toast.success(data.message, { id: toastId });
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const toastId = toast.loading('Đang lưu cấu hình...');
    try {
      const res = await fetch(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lưu cấu hình thất bại');
      setForm({ ...DEFAULT_FORM, ...data });
      toast.success('Đã lưu cấu hình hệ thống.', { id: toastId });
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
      <div>
        <p className="text-xs text-slate-400 leading-normal">
          Cấu hình SMTP relay, email nhận cảnh báo và ngưỡng cảnh báo — áp dụng ngay không cần restart backend
          (riêng "Chu kỳ quét" vẫn cần restart, xem ghi chú bên dưới).
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
        {/* --- SMTP Relay --- */}
        <div className="glass p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-slate-200">
            <Server className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">SMTP Relay</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">SMTP Host</label>
              <input
                type="text"
                value={form.smtpHost}
                onChange={(e) => handleChange('smtpHost', e.target.value)}
                placeholder="mail.tapdoan.local"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">SMTP Port</label>
              <input
                type="number"
                value={form.smtpPort}
                onChange={(e) => handleChange('smtpPort', Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.smtpAuth}
                onChange={(e) => handleChange('smtpAuth', e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0"
              />
              Yêu cầu xác thực (SMTP AUTH)
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.smtpStartTls}
                onChange={(e) => handleChange('smtpStartTls', e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0"
              />
              Bật STARTTLS
            </label>
          </div>

          {form.smtpAuth && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Username</label>
                <input
                  type="text"
                  value={form.smtpUsername}
                  onChange={(e) => handleChange('smtpUsername', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Password</label>
                <input
                  type="password"
                  value={form.smtpPassword}
                  onChange={(e) => handleChange('smtpPassword', e.target.value)}
                  placeholder="Để trống nếu không đổi"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* --- Alert Recipient --- */}
        <div className="glass p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-slate-200">
            <Mail className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">Email nhận cảnh báo</h3>
          </div>
          <input
            type="email"
            value={form.alertRecipientEmail}
            onChange={(e) => handleChange('alertRecipientEmail', e.target.value)}
            placeholder="ops-team@company.com"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none font-mono"
          />
        </div>

        {/* --- Thresholds --- */}
        <div className="glass p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-slate-200">
            <Gauge className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">Ngưỡng cảnh báo & chu kỳ quét</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ThresholdInput label="Disk Warning (%)" value={form.diskWarningThreshold} onChange={(v) => handleChange('diskWarningThreshold', v)} />
            <ThresholdInput label="Disk Critical (%)" value={form.diskCriticalThreshold} onChange={(v) => handleChange('diskCriticalThreshold', v)} />
            <ThresholdInput label="CPU Critical (%)" value={form.cpuCriticalThreshold} onChange={(v) => handleChange('cpuCriticalThreshold', v)} />
            <ThresholdInput label="Memory Critical (%)" value={form.memoryCriticalThreshold} onChange={(v) => handleChange('memoryCriticalThreshold', v)} />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
              Chu kỳ quét (ms) — cần restart backend để áp dụng
            </label>
            <input
              type="number"
              min={10000}
              step={1000}
              value={form.schedulerIntervalMs}
              onChange={(e) => handleChange('schedulerIntervalMs', Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none font-mono"
            />
          </div>
        </div>

        {/* --- Actions --- */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleTestEmail}
            disabled={testing}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-indigo-400 border border-slate-800 hover:border-indigo-500 rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {testing ? 'Đang gửi...' : 'Gửi thử'}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
        </div>
      </form>
    </div>
  );
};

const ThresholdInput = ({ label, value, onChange }) => (
  <div>
    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">{label}</label>
    <input
      type="number"
      min={0}
      max={100}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none font-mono"
    />
  </div>
);

export default SystemConfig;
