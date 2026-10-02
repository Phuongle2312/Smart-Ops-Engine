import { useContext, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { usePreferences } from '../context/PreferencesContext';
import { 
  Plus, 
  Mail, 
  Webhook, 
  Edit2, 
  Trash2, 
  X, 
  Send 
} from 'lucide-react';
import toast from 'react-hot-toast';

const AlertChannelsContent = () => {
  const { 
    channels, 
    addAlertChannel, 
    updateAlertChannel, 
    deleteAlertChannel, 
    toggleAlertChannel
  } = useContext(AppContext);
  const { t } = usePreferences();

  // --- Modal States ---
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentChanId, setCurrentChanId] = useState(null);

  // --- Form States ---
  const [type, setType] = useState('Email'); // Email | Webhook
  const [name, setName] = useState('');
  const [target, setTarget] = useState(''); // Email address or URL
  const [secret, setSecret] = useState(''); // Webhook secret
  const [minSeverity, setMinSeverity] = useState('Warning'); // Warning | Critical
  const [errors, setErrors] = useState({});

  const resetForm = () => {
    setName('');
    setTarget('');
    setSecret('');
    setMinSeverity('Warning');
    setErrors({});
  };

  const handleOpenAdd = () => {
    setIsEditMode(false);
    resetForm();
    setType('Email');
    setModalOpen(true);
  };

  const handleOpenEdit = (chan) => {
    setIsEditMode(true);
    setCurrentChanId(chan.id);
    setName(chan.name);
    setType(chan.type);
    setTarget(chan.target);
    setSecret(chan.secret || '');
    setMinSeverity(chan.minSeverity);
    setErrors({});
    setModalOpen(true);
  };

  const validate = () => {
    const tempErrors = {};
    if (!name.trim()) tempErrors.name = t('channels.errors.name');
    if (!target.trim()) {
      tempErrors.target = type === 'Email' ? t('channels.errors.email') : t('channels.errors.webhook');
    } else {
      if (type === 'Email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(target)) tempErrors.target = t('channels.errors.emailInvalid');
      } else {
        const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
        if (!urlRegex.test(target)) tempErrors.target = t('channels.errors.webhookInvalid');
      }
    }
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const data = {
      name,
      type,
      target,
      minSeverity,
      secret: type === 'Webhook' ? secret : ''
    };

    if (isEditMode) {
      updateAlertChannel(currentChanId, data);
    } else {
      addAlertChannel(data);
    }
    setModalOpen(false);
  };

  const handleTestChannel = (chan) => {
    toast.loading(t('channels.toastTesting', { name: chan.name }), { id: 'test-chan-toast', duration: 1500 });
    setTimeout(() => {
      toast.success(t('channels.toastTested', { name: chan.name }), { id: 'test-chan-toast' });
    }, 1500);
  };

  return (
    <div className="p-6 space-y-6">
      
      {/* Header Info */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-slate-300 mt-0.5 leading-normal">
            {t('channels.intro')}
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/10 active:scale-95 transition-transform cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t('channels.add')}</span>
        </button>
      </div>

      {/* Channels List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {channels.map((chan) => (
          <div 
            key={chan.id} 
            className={`glass p-5 rounded-2xl transition-all flex flex-col justify-between h-52 relative overflow-hidden border border-slate-200 dark:border-slate-700/40 shadow-xs ${
              chan.active ? '' : 'opacity-60'
            }`}
          >
            {/* Type Icon Tag */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none"></div>

            <div>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900/80 dark:bg-slate-900/60 flex items-center justify-center text-slate-400 border border-slate-200 dark:border-slate-700/40 shadow-2xs">
                    {chan.type === 'Email' ? (
                      <Mail className="w-5 h-5 text-indigo-500" />
                    ) : (
                      <Webhook className="w-5 h-5 text-purple-500" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-100">{chan.name}</h4>
                    <span className="text-xs text-slate-400 font-mono tracking-wide uppercase font-bold">{chan.type}</span>
                  </div>
                </div>

                {/* Status Toggle Switch */}
                <button
                  onClick={() => toggleAlertChannel(chan.id)}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:ring-0 cursor-pointer ${
                    chan.active ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-800'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-xs ${
                      chan.active ? 'translate-x-4.5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Channel Target Address */}
              <div className="mt-4">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">{t('channels.target')}</p>
                <p className="text-xs sm:text-sm text-slate-200 font-mono mt-0.5 break-all select-all font-bold truncate" title={chan.target}>
                  {chan.target}
                </p>
              </div>
            </div>

            {/* Bottom bar with action controls */}
            <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-700/30 pt-3 mt-3 text-xs">
              <div>
                <span className="text-slate-400 text-xs">{t('channels.minSeverity')}: </span>
                <span className={`font-bold text-xs ${
                  chan.minSeverity === 'Critical' ? 'text-rose-500' : 'text-amber-500'
                }`}>
                  {t(`severity.${chan.minSeverity === 'Critical' ? 'CRITICAL' : 'WARNING'}`)}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleTestChannel(chan)}
                  disabled={!chan.active}
                  className="px-2.5 py-1 rounded-lg hover:bg-slate-900/80 dark:hover:bg-slate-800/40 text-indigo-500 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer flex items-center gap-1 font-bold text-xs"
                  title={t('channels.testHint')}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{t('channels.test')}</span>
                </button>
                <button
                  onClick={() => handleOpenEdit(chan)}
                  className="p-1.5 rounded-lg hover:bg-slate-900/80 dark:hover:bg-slate-800/40 text-amber-500 transition-colors cursor-pointer"
                  title={t('channels.edit')}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteAlertChannel(chan.id)}
                  className="p-1.5 rounded-lg hover:bg-slate-900/80 dark:hover:bg-slate-800/40 text-rose-500 transition-colors cursor-pointer"
                  title={t('channels.delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Quick Add Placeholder Card to fill grid balance */}
        <button
          onClick={handleOpenAdd}
          className="p-5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-indigo-500/60 transition-all flex flex-col items-center justify-center text-center h-52 group cursor-pointer bg-white/60 dark:bg-slate-900/20 hover:bg-indigo-500/5 shadow-2xs"
        >
          <div className="w-11 h-11 rounded-xl bg-slate-900/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center text-slate-500 dark:text-slate-400 transition-all mb-2 shadow-2xs">
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
            {t('channels.add')}
          </span>
          <span className="text-xs text-slate-400 mt-1 max-w-[220px]">
            {t('dashboard.addChannelDesc')}
          </span>
        </button>
      </div>

      {/* --- INTEGRATION TEMPLATES & BEST PRACTICES TO FILL WIDESCREEN SPACE --- */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Mẫu tích hợp Webhook tức thời (Quick Integrations)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Chọn mẫu cấu hình webhook chuẩn payload JSON để kết nối nhanh với các nền tảng chat vận hành
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <IntegrationCard 
            title="Slack Webhook"
            tag="SLACK INCOMING"
            desc="Nhận thông báo sự cố phân luồng theo channel #ops-alerts qua Slack Incoming Webhooks."
            onSelect={() => {
              setIsEditMode(false);
              setType('Webhook');
              setName('Slack Ops Alerts');
              setTarget('https://api.example.com/webhooks/slack/ops-alerts');
              setSecret('');
              setMinSeverity('Warning');
              setModalOpen(true);
            }}
          />
          <IntegrationCard 
            title="Discord Webhook"
            tag="DISCORD BOT"
            desc="Bắn thông điệp markdown chi tiết và mention @role on-call qua Discord Webhook Endpoint."
            onSelect={() => {
              setIsEditMode(false);
              setType('Webhook');
              setName('Discord SRE Channel');
              setTarget('https://api.example.com/webhooks/discord/sre-alerts');
              setSecret('');
              setMinSeverity('Critical');
              setModalOpen(true);
            }}
          />
          <IntegrationCard 
            title="Telegram Bot API"
            tag="TELEGRAM ALERTS"
            desc="Gửi thông báo đẩy tức thời tới nhóm Telegram điều hành thông qua Bot Token và Chat ID."
            onSelect={() => {
              setIsEditMode(false);
              setType('Webhook');
              setName('Telegram Ops Bot');
              setTarget('https://api.example.com/webhooks/telegram/ops-bot');
              setSecret('');
              setMinSeverity('Warning');
              setModalOpen(true);
            }}
          />
          <IntegrationCard 
            title="MS Teams Connector"
            tag="OFFICE 365"
            desc="Đẩy thẻ thích ứng (Adaptive Cards) định dạng phong phú tới Microsoft Teams Channel."
            onSelect={() => {
              setIsEditMode(false);
              setType('Webhook');
              setName('Teams Incident Channel');
              setTarget('https://api.example.com/webhooks/teams/incident-channel');
              setSecret('');
              setMinSeverity('Warning');
              setModalOpen(true);
            }}
          />
        </div>
      </div>

      {/* --- ADD / EDIT CHANNEL MODAL --- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--soe-overlay)] backdrop-blur-sm">
          <div className="w-full max-w-md glass rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 border-b border-slate-800/80 bg-slate-950/20">
              <h3 className="text-sm font-heading font-semibold text-slate-50">
                {isEditMode ? t('channels.modal.editTitle') : t('channels.modal.addTitle')}
              </h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-50 transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Type Select Tabs */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1.5">{t('channels.modal.type')}</label>
                <div className="flex gap-2 p-1 bg-slate-950/40 border border-slate-800/80 rounded-xl">
                  <button
                    type="button"
                    disabled={isEditMode}
                    onClick={() => { setType('Email'); resetForm(); }}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 ${
                      type === 'Email' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email</span>
                  </button>
                  <button
                    type="button"
                    disabled={isEditMode}
                    onClick={() => { setType('Webhook'); resetForm(); }}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 ${
                      type === 'Webhook' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Webhook className="w-3.5 h-3.5" />
                    <span>Webhook URL</span>
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">{t('channels.modal.name')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={type === 'Email' ? t('channels.modal.namePlaceholderEmail') : t('channels.modal.namePlaceholderWebhook')}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none placeholder-slate-600 transition-colors"
                />
                {errors.name && <span className="text-[11px] text-red-400 font-semibold">{errors.name}</span>}
              </div>

              {/* Target (Email Address / Webhook URL) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                  {type === 'Email' ? t('channels.modal.targetEmail') : t('channels.modal.targetWebhook')}
                </label>
                <input
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder={type === 'Email' ? 'example@company.com' : 'https://api.example.com/webhook'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none placeholder-slate-600 transition-colors font-mono"
                />
                {errors.target && <span className="text-[11px] text-red-400 font-semibold">{errors.target}</span>}
              </div>

              {/* Webhook Secret (Webhook only) */}
              {type === 'Webhook' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">{t('channels.modal.secret')}</label>
                  <input
                    type="password"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder={t('channels.modal.secretPlaceholder')}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none placeholder-slate-600 transition-colors"
                  />
                </div>
              )}

              {/* Min Incident Level */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">{t('channels.modal.minSeverity')}</label>
                <select
                  value={minSeverity}
                  onChange={(e) => setMinSeverity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="Warning">{t('channels.modal.severityWarning')}</option>
                  <option value="Critical">{t('channels.modal.severityCritical')}</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 rounded-xl transition-all cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  {isEditMode ? t('channels.modal.submitEdit') : t('channels.modal.submitAdd')}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

const IntegrationCard = ({ title, tag, desc, onSelect }) => (
  <div className="glass p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:border-indigo-500/40 transition-colors">
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white">{title}</h4>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          {tag}
        </span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
        {desc}
      </p>
    </div>
    <button
      type="button"
      onClick={onSelect}
      className="w-full py-1.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer active:scale-98 text-center"
    >
      Dùng mẫu này
    </button>
  </div>
);

// Chặn truy cập trước khi gọi các hook của trang (hook không được gọi sau return sớm)
const AlertChannels = () => {
  const { user } = useContext(AppContext);
  if (user?.role !== 'ROLE_ADMIN') {
    return <Navigate to="/app/dashboard" replace />;
  }
  return <AlertChannelsContent />;
};

export default AlertChannels;

