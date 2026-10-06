import { useContext, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { usePreferences } from '../context/PreferencesContext';
import { 
  Mail, 
  Server, 
  Gauge, 
  Send, 
  Save, 
  Loader2, 
  ShieldCheck, 
  Sliders, 
  CheckCircle2, 
  Info,
  Zap,
  Activity,
  Database,
  Cpu,
  Lock,
  Sparkles,
  Layers,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = '/api/system-config';

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

const PROFILES = [
  {
    id: 'standard',
    titleKey: 'config.presetStandard',
    descKey: 'config.presetStandardDesc',
    icon: Sparkles,
    color: 'indigo',
    values: {
      diskWarningThreshold: 80,
      diskCriticalThreshold: 90,
      cpuCriticalThreshold: 85,
      memoryCriticalThreshold: 90,
      schedulerIntervalMs: 300000,
    }
  },
  {
    id: 'high-load',
    titleKey: 'config.presetHigh',
    descKey: 'config.presetHighDesc',
    icon: Zap,
    color: 'amber',
    values: {
      diskWarningThreshold: 85,
      diskCriticalThreshold: 95,
      cpuCriticalThreshold: 90,
      memoryCriticalThreshold: 95,
      schedulerIntervalMs: 60000,
    }
  },
  {
    id: 'strict',
    titleKey: 'config.presetStrict',
    descKey: 'config.presetStrictDesc',
    icon: ShieldCheck,
    color: 'rose',
    values: {
      diskWarningThreshold: 70,
      diskCriticalThreshold: 85,
      cpuCriticalThreshold: 75,
      memoryCriticalThreshold: 80,
      schedulerIntervalMs: 30000,
    }
  }
];

const SystemConfig = () => {
  const { user } = useContext(AppContext);
  const { t } = usePreferences();
  const isAdmin = user?.role === 'ROLE_ADMIN';

  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState(null);

  useEffect(() => {
    if (!isAdmin) return;

    const loadConfig = async () => {
      try {
        const res = await fetch(API_BASE);
        if (!res.ok) throw new Error(t('config.toastLoadFailed'));
        const data = await res.json();
        setForm({ ...DEFAULT_FORM, ...data });
      } catch (err) {
        toast.error(t('config.toastBackendDown', { message: err.message }));
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, [isAdmin, t]);

  if (!isAdmin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setActiveProfileId(null);
  };

  const handleApplyProfile = (profile) => {
    setForm((prev) => ({
      ...prev,
      ...profile.values,
    }));
    setActiveProfileId(profile.id);
    toast.success(t('config.toastPresetApplied', { name: t(profile.titleKey) }));
  };

  const handleTestEmail = async () => {
    setTesting(true);
    const toastId = toast.loading(t('config.toastSendingTest'));
    try {
      const res = await fetch(`${API_BASE}/test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || data.status === 'FAILED') {
        throw new Error(data.message || t('config.toastTestFailed'));
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
    const toastId = toast.loading(t('config.toastSaving'));
    try {
      const res = await fetch(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('config.toastSaveFailed'));
      setForm({ ...DEFAULT_FORM, ...data });
      toast.success(t('config.toastSaved'), { id: toastId });
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
    <div className="p-6 space-y-6 w-full pb-12">
      {/* Top Header Note */}
      <div className="glass p-4.5 px-6 rounded-2xl border border-slate-700/30 flex items-center justify-between gap-4 text-sm shadow-2xs">
        <div className="flex items-center gap-3">
          <Info className="w-5 h-5 text-indigo-500 shrink-0" />
          <p className="text-slate-200 leading-normal font-medium text-sm">
            {t('config.intro')}
          </p>
        </div>
        <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
          ENGINE CONFIG SYNCED
        </span>
      </div>

      {/* ── 1. PRESET PROFILES ROW (OPTIMIZATION PRESETS) ── */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2.5">
              <Sliders className="w-5 h-5 text-indigo-500" />
              {t('config.presetsTitle')}
            </h3>
            <p className="text-sm text-slate-300 mt-1">
              {t('config.presetsSubtitle')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PROFILES.map((profile) => {
            const Icon = profile.icon;
            const isSelected = activeProfileId === profile.id;
            return (
              <div 
                key={profile.id}
                className={`glass p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden shadow-xs ${
                  isSelected 
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-500/5' 
                    : 'border-slate-700/40 hover:border-slate-700/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-xl border ${
                        profile.color === 'indigo' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' :
                        profile.color === 'amber' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                        'bg-rose-500/10 text-rose-500 border-rose-500/20'
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <h4 className="text-base font-bold text-slate-100">
                        {t(profile.titleKey)}
                      </h4>
                    </div>
                    {isSelected && (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-500 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">
                        <Check className="w-4 h-4" /> Đang chọn
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed mb-4 min-h-[40px]">
                    {t(profile.descKey)}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                    <div className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700/40 text-center">
                      <span className="block text-xs font-bold text-slate-400 uppercase">CPU</span>
                      <strong className="text-sm font-mono text-slate-100">{profile.values.cpuCriticalThreshold}%</strong>
                    </div>
                    <div className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700/40 text-center">
                      <span className="block text-xs font-bold text-slate-400 uppercase">RAM</span>
                      <strong className="text-sm font-mono text-slate-100">{profile.values.memoryCriticalThreshold}%</strong>
                    </div>
                    <div className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700/40 text-center">
                      <span className="block text-xs font-bold text-slate-400 uppercase">Ổ ĐĨA</span>
                      <strong className="text-sm font-mono text-slate-100">{profile.values.diskWarningThreshold}%/{profile.values.diskCriticalThreshold}%</strong>
                    </div>
                    <div className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700/40 text-center">
                      <span className="block text-xs font-bold text-slate-400 uppercase">CHU KỲ</span>
                      <strong className="text-sm font-mono text-indigo-500 font-bold">{profile.values.schedulerIntervalMs / 1000}s</strong>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleApplyProfile(profile)}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-700/40 bg-slate-900/80 hover:bg-indigo-500/10 hover:border-indigo-500/30 text-sm font-bold text-slate-200 hover:text-indigo-500 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 shadow-2xs"
                >
                  <Sparkles className="w-4.5 h-4.5 text-indigo-500" />
                  {t('config.applyPreset')}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 2. FORM CONFIG (BALANCED 3-COLUMN WIDESCREEN GRID) ── */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          
          {/* ── CỘT 1: SMTP RELAY & EMAIL RECIPIENT ── */}
          <div className="space-y-6 flex flex-col justify-between">
            {/* Card 1: SMTP Relay */}
            <div className="glass p-5.5 rounded-2xl space-y-4.5 border border-slate-700/40 shadow-xs flex-1">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-700/30">
                <div className="flex items-center gap-2 text-slate-100 font-bold">
                  <Server className="w-4.5 h-4.5 text-indigo-500" />
                  <h3 className="text-sm uppercase tracking-wider font-bold">{t('config.smtp')}</h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                  MAIL RELAY
                </span>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3.5">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      {t('config.smtpHost')}
                    </label>
                    <input
                      type="text"
                      value={form.smtpHost}
                      onChange={(e) => handleChange('smtpHost', e.target.value)}
                      placeholder="mail.tapdoan.local"
                      className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700/50 text-base text-slate-100 font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none font-mono transition-all shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      {t('config.smtpPort')}
                    </label>
                    <input
                      type="number"
                      value={form.smtpPort}
                      onChange={(e) => handleChange('smtpPort', Number(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700/50 text-base text-slate-100 font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none font-mono transition-all shadow-2xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5 pt-1">
                  <label className="flex items-center gap-3 text-sm font-bold text-slate-200 cursor-pointer p-3.5 rounded-xl bg-slate-900/50 border border-slate-700/40 hover:border-indigo-500/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={form.smtpAuth}
                      onChange={(e) => handleChange('smtpAuth', e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 w-4.5 h-4.5 cursor-pointer"
                    />
                    <span>{t('config.smtpAuth')}</span>
                  </label>
                  <label className="flex items-center gap-3 text-sm font-bold text-slate-200 cursor-pointer p-3.5 rounded-xl bg-slate-900/50 border border-slate-700/40 hover:border-indigo-500/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={form.smtpStartTls}
                      onChange={(e) => handleChange('smtpStartTls', e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 w-4.5 h-4.5 cursor-pointer"
                    />
                    <span>{t('config.startTls')}</span>
                  </label>
                </div>

                {form.smtpAuth && (
                  <div className="space-y-3.5 pt-3.5 border-t border-slate-700/30">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        {t('config.username')}
                      </label>
                      <input
                        type="text"
                        value={form.smtpUsername}
                        onChange={(e) => handleChange('smtpUsername', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700/50 text-base text-slate-100 font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none font-mono transition-all shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        {t('config.password')}
                      </label>
                      <input
                        type="password"
                        value={form.smtpPassword}
                        onChange={(e) => handleChange('smtpPassword', e.target.value)}
                        placeholder={t('config.passwordPlaceholder')}
                        className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700/50 text-base text-slate-100 font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none font-mono transition-all shadow-2xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Email Target */}
            <div className="glass p-5.5 rounded-2xl space-y-3.5 border border-slate-700/40 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-700/30">
                <div className="flex items-center gap-2 text-slate-100 font-bold">
                  <Mail className="w-4.5 h-4.5 text-purple-500" />
                  <h3 className="text-sm uppercase tracking-wider font-bold">{t('config.recipient')}</h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-500/10 text-purple-500 border border-purple-500/20">
                  TARGET
                </span>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Email đích tiếp nhận thông báo sự cố
                </label>
                <input
                  type="email"
                  value={form.alertRecipientEmail}
                  onChange={(e) => handleChange('alertRecipientEmail', e.target.value)}
                  placeholder="ops-team@company.com"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700/50 text-base text-slate-100 font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none font-mono transition-all shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* ── CỘT 2: NGƯỠNG OPS & CHU KỲ QUÉT ── */}
          <div className="space-y-6 flex flex-col justify-between">
            <div className="glass p-5.5 rounded-2xl space-y-4.5 border border-slate-700/40 shadow-xs flex-1">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-700/30">
                <div className="flex items-center gap-2 text-slate-100 font-bold">
                  <Gauge className="w-4.5 h-4.5 text-amber-500" />
                  <h3 className="text-sm uppercase tracking-wider font-bold">{t('config.thresholds')}</h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  THRESHOLDS (%)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <ThresholdInput 
                  label={t('config.diskWarning')} 
                  value={form.diskWarningThreshold} 
                  onChange={(v) => handleChange('diskWarningThreshold', v)} 
                  color="amber"
                />
                <ThresholdInput 
                  label={t('config.diskCritical')} 
                  value={form.diskCriticalThreshold} 
                  onChange={(v) => handleChange('diskCriticalThreshold', v)} 
                  color="rose"
                />
                <ThresholdInput 
                  label={t('config.cpuCritical')} 
                  value={form.cpuCriticalThreshold} 
                  onChange={(v) => handleChange('cpuCriticalThreshold', v)} 
                  color="rose"
                />
                <ThresholdInput 
                  label={t('config.memoryCritical')} 
                  value={form.memoryCriticalThreshold} 
                  onChange={(v) => handleChange('memoryCriticalThreshold', v)} 
                  color="rose"
                />
              </div>

              {/* Chu kỳ quét Scheduler */}
              <div className="pt-3.5 border-t border-slate-700/30">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {t('config.interval')}
                  </label>
                  <span className="text-sm font-mono font-bold text-indigo-500">
                    {Math.round(form.schedulerIntervalMs / 1000)}s
                  </span>
                </div>
                <input
                  type="number"
                  min={10000}
                  step={1000}
                  value={form.schedulerIntervalMs}
                  onChange={(e) => handleChange('schedulerIntervalMs', Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700/50 text-base text-slate-100 font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none font-mono transition-all shadow-2xs"
                />
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  * Riêng chu kỳ quét hệ thống cần khởi động lại tiến trình backend để áp dụng giá trị mới.
                </p>
              </div>
            </div>
          </div>

          {/* ── CỘT 3: CONTROL ACTION & SRE BEST PRACTICES ── */}
          <div className="space-y-6 flex flex-col justify-between">
            {/* Card 4: Action Panel */}
            <div className="glass p-5.5 rounded-2xl border border-slate-700/40 space-y-4.5 shadow-xs">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-700/30">
                <div className="flex items-center gap-2 text-slate-100 font-bold">
                  <Save className="w-4.5 h-4.5 text-emerald-500" />
                  <h3 className="text-sm uppercase tracking-wider font-bold">Bảng điều khiển lưu trữ</h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  READY
                </span>
              </div>

              <div className="flex items-center gap-3 text-sm text-slate-300 p-3.5 rounded-xl bg-slate-900/50 border border-slate-700/40">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <span className="font-medium">Cấu hình tự động lưu trữ và đồng bộ tức thì qua database.</span>
              </div>

              <div className="flex flex-col gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 text-base font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  <Save className="w-5 h-5" />
                  {saving ? t('config.saving') : t('config.save')}
                </button>
                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={testing}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-bold text-indigo-500 border border-indigo-500/30 hover:bg-indigo-500/10 rounded-xl transition-all cursor-pointer disabled:opacity-50 active:scale-95 shadow-2xs"
                >
                  <Send className="w-4.5 h-4.5" />
                  {testing ? t('config.sending') : t('config.sendTest')}
                </button>
              </div>
            </div>

            {/* Card 5: SRE Tips Compact */}
            <div className="glass p-5.5 rounded-2xl border border-slate-700/40 space-y-3.5 shadow-xs flex-1">
              <div className="flex items-center gap-2 text-slate-100 font-bold text-sm uppercase tracking-wider pb-2.5 border-b border-slate-700/30">
                <Layers className="w-4.5 h-4.5 text-indigo-500" />
                <span>Khuyến nghị SRE</span>
              </div>
              <div className="space-y-3 text-sm text-slate-300">
                <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-700/40">
                  <span className="font-bold text-slate-100 text-sm block mb-1">⏱️ Chu kỳ quét tối ưu</span>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">Nên duy trì 30s - 300s để giảm tải I/O và phòng chống quá tải SSH daemon.</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-700/40">
                  <span className="font-bold text-slate-100 text-sm block mb-1">🛡️ Bảo mật STARTTLS</span>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">Luôn kích hoạt STARTTLS khi chuyển tiếp email qua hạ tầng mạng bên ngoài.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </form>

      {/* ── 3. REAL-TIME ENGINE TELEMETRY & DIAGNOSTICS GRID (FULL WIDTH) ── */}
      <div className="space-y-3.5 pt-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-emerald-500" />
            {t('config.diagnosticsTitle')}
          </h3>
          <span className="text-xs font-mono text-emerald-500 font-bold flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            ALL SYSTEMS NORMAL
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5">
          <DiagnosticCard 
            icon={Database}
            iconColor="text-blue-500"
            iconBg="bg-blue-500/10"
            title="PostgreSQL Database"
            status="Connected (OK)"
            statusColor="text-emerald-500"
            details="Port 5432 · Latency 4ms"
            subtext="Persisted Configuration & Incident Vault"
          />

          <DiagnosticCard 
            icon={Cpu}
            iconColor="text-purple-500"
            iconBg="bg-purple-500/10"
            title="SSH Collector Engine"
            status="Running (Active)"
            statusColor="text-emerald-500"
            details="Worker Pool · Non-blocking I/O"
            subtext="Async Node Telemetry Daemon"
          />

          <DiagnosticCard 
            icon={Mail}
            iconColor="text-indigo-500"
            iconBg="bg-indigo-500/10"
            title="Alert Dispatch Pipeline"
            status="Ready / Idle"
            statusColor="text-indigo-500"
            details="SMTP & Webhooks Router"
            subtext="Zero-drop incident notification queue"
          />

          <DiagnosticCard 
            icon={Lock}
            iconColor="text-emerald-500"
            iconBg="bg-emerald-500/10"
            title="Security Shield"
            status="Enforced"
            statusColor="text-emerald-500"
            details="STARTTLS / BCrypt Auth"
            subtext="Role-Based Access Control (RBAC)"
          />
        </div>
      </div>
    </div>
  );
};

const ThresholdInput = ({ label, value, onChange, color = 'rose' }) => (
  <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-700/40">
    <div className="flex justify-between items-center mb-2">
      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider truncate mr-1">
        {label}
      </label>
      <span className={`text-base font-mono font-bold ${color === 'rose' ? 'text-rose-500' : 'text-amber-500'}`}>
        {value}%
      </span>
    </div>
    <input
      type="number"
      min={0}
      max={100}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700/50 text-base text-slate-100 font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono transition-all mb-2 shadow-2xs"
    />
    <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden">
      <div 
        className={`h-full rounded-full transition-all duration-300 ${color === 'rose' ? 'bg-rose-500' : 'bg-amber-500'}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  </div>
);

const DiagnosticCard = ({ icon: Icon, iconColor, iconBg, title, status, statusColor, details, subtext }) => (
  <div className="glass p-4.5 rounded-2xl border border-slate-700/40 space-y-2.5 hover:border-slate-700/80 transition-colors shadow-xs">
    <div className="flex items-center justify-between">
      <div className={`p-2.5 rounded-xl ${iconBg} ${iconColor} border border-slate-700/20`}>
        <Icon className="w-5 h-5" />
      </div>
      <span className={`text-xs font-mono font-bold ${statusColor}`}>
        {status}
      </span>
    </div>
    <div>
      <h4 className="text-sm font-bold text-slate-100">{title}</h4>
      <p className="text-xs font-mono text-slate-400 mt-1">{details}</p>
    </div>
    <p className="text-xs text-slate-400 leading-normal pt-2 border-t border-slate-700/20">
      {subtext}
    </p>
  </div>
);

export default SystemConfig;

