import { useEffect, useState } from 'react';
import { Users, Trash2, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePreferences } from '../context/PreferencesContext';
import { api } from '../api/client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Danh sách người phụ trách một máy chủ — người nhận email chẩn đoán lỗi từ ảnh
const OwnersPanel = ({ nodeId, canEdit }) => {
  const { t } = usePreferences();
  const [owners, setOwners] = useState([]);
  const [version, setVersion] = useState(0); // tăng để tải lại sau khi thêm/xóa
  const [form, setForm] = useState({ fullName: '', email: '', escalationOrder: 1 });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api.getOwners(nodeId)
      .then((list) => { if (alive) setOwners(list); })
      .catch((err) => { if (alive) toast.error(err.message); });
    return () => { alive = false; };
  }, [nodeId, version]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim() || !EMAIL_RE.test(form.email.trim())) {
      toast.error(t('nodeDetail.ownersInvalid'));
      return;
    }
    setBusy(true);
    try {
      await api.addOwner(nodeId, {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        escalationOrder: Number(form.escalationOrder) || 1,
      });
      setForm({ fullName: '', email: '', escalationOrder: form.escalationOrder });
      setVersion((v) => v + 1);
      toast.success(t('nodeDetail.ownersAdded'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (owner) => {
    if (!window.confirm(t('nodeDetail.ownersRemoveConfirm', { name: owner.fullName }))) return;
    try {
      await api.deleteOwner(owner.id);
      setVersion((v) => v + 1);
      toast.success(t('nodeDetail.ownersRemoved'));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const inputCls = 'px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-700/50 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none';

  return (
    <div className="glass p-5 rounded-2xl">
      <h3 className="text-sm font-semibold text-slate-100 font-heading flex items-center gap-1.5">
        <Users className="w-4 h-4 text-indigo-400" />
        <span>{t('nodeDetail.ownersTitle')}</span>
      </h3>
      <p className="text-xs text-slate-500 mt-1 mb-4">{t('nodeDetail.ownersHint')}</p>

      {owners.length === 0 ? (
        <p className="text-xs text-slate-500 py-2">{t('nodeDetail.ownersEmpty')}</p>
      ) : (
        <ul className="divide-y divide-slate-800/50 mb-4">
          {owners.map((o) => (
            <li key={o.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <span className="font-semibold text-slate-100">{o.fullName}</span>
                <span className="ml-2 text-xs text-slate-400 break-all">{o.email}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/25">
                  {t('nodeDetail.ownersLevel')} {o.escalationOrder}
                </span>
                {canEdit && (
                  <button
                    onClick={() => handleRemove(o)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                    title={t('nodeDetail.ownersRemove')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_90px_auto] gap-3 items-end">
          <input
            className={inputCls}
            placeholder={t('nodeDetail.ownersName')}
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <input
            className={inputCls}
            type="email"
            placeholder={t('nodeDetail.ownersEmail')}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            className={inputCls}
            type="number"
            min="1"
            title={t('nodeDetail.ownersLevelHint')}
            value={form.escalationOrder}
            onChange={(e) => setForm({ ...form, escalationOrder: e.target.value })}
          />
          <button
            type="submit"
            disabled={busy}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('nodeDetail.ownersAdd')}</span>
          </button>
        </form>
      )}
    </div>
  );
};

export default OwnersPanel;
