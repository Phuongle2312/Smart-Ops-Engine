import { useState } from 'react';
import { X } from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';

// Hộp thoại nhập biện pháp khắc phục — thay cho window.prompt()
const ResolveIncidentModal = ({ incidentId, onSubmit, onClose }) => {
  const { t } = usePreferences();
  const [resolution, setResolution] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!resolution.trim()) return;
    onSubmit(incidentId, resolution.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--soe-overlay)] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md glass rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex justify-between items-center p-5 border-b border-slate-800/80 bg-slate-950/20">
          <h3 className="text-sm font-heading font-semibold text-slate-50">
            {t('resolveModal.title', { id: incidentId })}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-50 transition-colors cursor-pointer" aria-label={t('common.close')}>
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-2">
              {t('resolveModal.label')}
            </label>
            <textarea
              rows={3}
              required
              autoFocus
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder={t('resolveModal.placeholder')}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 rounded-xl transition-all cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
            >
              {t('resolveModal.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResolveIncidentModal;
