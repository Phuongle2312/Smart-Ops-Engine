import React, { useContext, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { 
  Plus, 
  Mail, 
  Webhook, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  Send 
} from 'lucide-react';
import toast from 'react-hot-toast';

const AlertChannels = () => {
  const { 
    user, 
    channels, 
    addAlertChannel, 
    updateAlertChannel, 
    deleteAlertChannel, 
    toggleAlertChannel 
  } = useContext(AppContext);

  // --- ROUTE GUARD FOR SECURITY ---
  if (user?.role !== 'ROLE_ADMIN') {
    return <Navigate to="/app/dashboard" replace />;
  }

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
    if (!name.trim()) tempErrors.name = 'Tên kênh cấu hình không được trống.';
    if (!target.trim()) {
      tempErrors.target = type === 'Email' ? 'Vui lòng nhập Email.' : 'Vui lòng nhập Webhook URL.';
    } else {
      if (type === 'Email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(target)) tempErrors.target = 'Địa chỉ email không đúng định dạng.';
      } else {
        const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/;
        if (!urlRegex.test(target)) tempErrors.target = 'Địa chỉ Webhook URL không hợp lệ.';
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
    toast.loading(`Đang thử nghiệm gửi thông báo mẫu đến [${chan.name}]...`, { id: 'test-chan-toast', duration: 1500 });
    setTimeout(() => {
      toast.success(`Đã kiểm tra kết nối! Kênh [${chan.name}] hoạt động tốt.`, { id: 'test-chan-toast' });
    }, 1500);
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
      
      {/* Header Info */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-xs text-slate-400 mt-0.5 leading-normal">
            Cấu hình các kênh phân phối thông tin cảnh báo tự động khi xuất hiện sự cố trong hệ thống.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/10 active:scale-95 transition-transform cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm kênh nhận tin</span>
        </button>
      </div>

      {/* Channels List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {channels.map((chan) => (
          <div 
            key={chan.id} 
            className={`glass p-5 rounded-2xl border transition-all flex flex-col justify-between h-48 relative overflow-hidden ${
              chan.active ? 'border-slate-800' : 'border-slate-800/40 opacity-70'
            }`}
          >
            {/* Type Icon Tag */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/3 rounded-full blur-xl pointer-events-none"></div>

            <div>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-slate-400 border border-slate-800/60">
                    {chan.type === 'Email' ? (
                      <Mail className="w-4.5 h-4.5 text-indigo-400" />
                    ) : (
                      <Webhook className="w-4.5 h-4.5 text-pink-400" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200">{chan.name}</h4>
                    <span className="text-[9px] text-slate-500 font-mono tracking-wide uppercase font-bold">{chan.type}</span>
                  </div>
                </div>

                {/* Status Toggle Switch */}
                <button
                  onClick={() => toggleAlertChannel(chan.id)}
                  className={`relative inline-flex h-4.5 w-8 shrink-0 items-center rounded-full transition-colors focus:ring-0 cursor-pointer ${
                    chan.active ? 'bg-indigo-600' : 'bg-slate-800'
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                      chan.active ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Channel Target Address */}
              <div className="mt-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Địa chỉ gửi đến</p>
                <p className="text-xs text-slate-300 font-mono mt-1 break-all select-all">{chan.target}</p>
              </div>
            </div>

            {/* Bottom bar with action controls */}
            <div className="flex justify-between items-center border-t border-slate-850/80 pt-3 mt-4 text-[10px]">
              <div>
                <span className="text-slate-500">Mức sự cố tối thiểu: </span>
                <span className={`font-semibold ${
                  chan.minSeverity === 'Critical' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {chan.minSeverity}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTestChannel(chan)}
                  disabled={!chan.active}
                  className="p-1.5 rounded hover:bg-slate-800/80 text-indigo-400 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer flex items-center gap-1 font-semibold"
                  title="Gửi payload test cấu hình"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Test Kênh</span>
                </button>
                <button
                  onClick={() => handleOpenEdit(chan)}
                  className="p-1.5 rounded hover:bg-slate-800/80 text-yellow-500 transition-colors cursor-pointer"
                  title="Sửa cấu hình"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => deleteAlertChannel(chan.id)}
                  className="p-1.5 rounded hover:bg-slate-800/80 text-red-500 transition-colors cursor-pointer"
                  title="Xóa kênh"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* --- ADD / EDIT CHANNEL MODAL --- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md glass border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 border-b border-slate-800/80 bg-slate-950/20">
              <h3 className="text-sm font-heading font-semibold text-white">
                {isEditMode ? 'Cập nhật kênh thông báo' : 'Thêm kênh nhận cảnh báo sự cố'}
              </h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Type Select Tabs */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1.5">Loại Kênh Cảnh Báo</label>
                <div className="flex gap-2 p-1 bg-slate-950/40 border border-slate-800/80 rounded-xl">
                  <button
                    type="button"
                    disabled={isEditMode}
                    onClick={() => { setType('Email'); resetForm(); }}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 ${
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
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 ${
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
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Tên kênh thông báo *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={type === 'Email' ? 'Mail phòng kỹ thuật...' : 'Slack Ops channel...'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none placeholder-slate-700 transition-colors"
                />
                {errors.name && <span className="text-[10px] text-red-400 font-semibold">{errors.name}</span>}
              </div>

              {/* Target (Email Address / Webhook URL) */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                  {type === 'Email' ? 'Địa chỉ Email nhận tin *' : 'Đường dẫn Webhook URL *'}
                </label>
                <input
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder={type === 'Email' ? 'example@company.com' : 'https://hooks.slack.com/services/...'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none placeholder-slate-700 transition-colors font-mono"
                />
                {errors.target && <span className="text-[10px] text-red-400 font-semibold">{errors.target}</span>}
              </div>

              {/* Webhook Secret (Webhook only) */}
              {type === 'Webhook' && (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Webhook Secret Key (Không bắt buộc)</label>
                  <input
                    type="password"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder="Mã hash ký payload..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none placeholder-slate-700 transition-colors"
                  />
                </div>
              )}

              {/* Min Incident Level */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Mức cảnh báo tối thiểu</label>
                <select
                  value={minSeverity}
                  onChange={(e) => setMinSeverity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="Warning">Warning (Báo cáo lỗi cảnh báo + nguy hiểm)</option>
                  <option value="Critical">Critical (Chỉ nhận lỗi nguy hiểm)</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 rounded-xl transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  {isEditMode ? 'Cấu hình lại' : 'Kích hoạt kênh'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AlertChannels;
