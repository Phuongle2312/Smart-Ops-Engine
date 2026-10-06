import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { UploadCloud, X, ScanSearch, ThumbsUp, ThumbsDown, Info, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { AppContext } from '../context/AppContext';
import { usePreferences } from '../context/PreferencesContext';
import { IncidentTypeChip, SeverityBadge, StatusBadge, AiConfidenceChip } from '../components/IncidentBadges';
import { AI_ERROR_CODES, isAiIncident } from '../constants/incidentMeta';
import { api } from '../api/client';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const RECENT_LIMIT = 10;

const selectCls = 'w-full px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none cursor-pointer font-medium';

// Thẻ phản hồi đúng/sai cho một chẩn đoán AI (chỉ quản trị viên)
const FeedbackBar = ({ incident, sent, onSent }) => {
  const { t } = usePreferences();
  const [wrongOpen, setWrongOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (correct, correctCode) => {
    setBusy(true);
    try {
      await api.sendAiFeedback(incident.id, { correct, correctCode: correctCode || '' });
      toast.success(t('diagnosis.feedbackToast'));
      onSent(incident.id);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-500 font-semibold">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {t('diagnosis.feedbackSent')}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-slate-400 font-medium">{t('diagnosis.feedbackTitle')}</span>
      <button
        disabled={busy}
        onClick={() => send(true)}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 font-semibold cursor-pointer disabled:opacity-50"
      >
        <ThumbsUp className="w-3.5 h-3.5" />{t('diagnosis.correct')}
      </button>
      <button
        disabled={busy}
        onClick={() => setWrongOpen((v) => !v)}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 font-semibold cursor-pointer disabled:opacity-50"
      >
        <ThumbsDown className="w-3.5 h-3.5" />{t('diagnosis.wrong')}
      </button>
      {wrongOpen && (
        <>
          <select
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="px-2 py-1 rounded-lg bg-slate-900/60 border border-slate-700/50 text-xs text-slate-100 focus:outline-none"
          >
            <option value="">{t('diagnosis.wrongPrompt')}</option>
            {AI_ERROR_CODES.map((c) => (
              <option key={c} value={c}>{t(`incidentType.${c}`)}</option>
            ))}
          </select>
          <button
            disabled={busy}
            onClick={() => send(false, code)}
            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer disabled:opacity-50"
          >
            {t('diagnosis.wrongSend')}
          </button>
        </>
      )}
    </div>
  );
};

const Diagnosis = () => {
  const { user, nodes, incidents } = useContext(AppContext);
  const { t, formatDateTime } = usePreferences();
  const isAdmin = user?.role === 'ROLE_ADMIN';

  const [file, setFile] = useState(null);
  const [nodeId, setNodeId] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(() => new Set());
  const inputRef = useRef(null);

  // Ảnh xem trước — URL tạm phải được thu hồi để không rò bộ nhớ
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const acceptFile = (f) => {
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      toast.error(t('diagnosis.errType'));
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error(t('diagnosis.errSize'));
      return;
    }
    setFile(f);
  };

  // Dán ảnh chụp màn hình từ clipboard (Ctrl+V)
  const acceptRef = useRef(acceptFile);
  useEffect(() => { acceptRef.current = acceptFile; });
  useEffect(() => {
    const onPaste = (e) => {
      const item = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith('image/'));
      if (item) acceptRef.current(item.getAsFile());
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error(t('diagnosis.errNoFile'));
    if (!nodeId) return toast.error(t('diagnosis.errNoNode'));
    setSubmitting(true);
    try {
      await api.diagnoseImage(file, nodeId, note.trim());
      toast.success(t('diagnosis.submitted'), { duration: 6000 });
      setFile(null);
      setNote('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const recent = useMemo(
    () => incidents
      .filter(isAiIncident)
      .sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt))
      .slice(0, RECENT_LIMIT),
    [incidents],
  );

  const markSent = (id) => setFeedbackSent((prev) => new Set(prev).add(id));

  return (
    <div className="p-6 space-y-6">
      <div className="glass p-4 rounded-2xl flex items-start gap-3 text-xs text-slate-400 leading-relaxed">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <p>{t('diagnosis.intro')}</p>
      </div>

      {/* Upload */}
      <form onSubmit={handleSubmit} className="glass p-5 rounded-2xl space-y-4">
        <h3 className="text-sm font-semibold text-slate-100 font-heading flex items-center gap-1.5">
          <ScanSearch className="w-4 h-4 text-indigo-400" />
          <span>{t('diagnosis.uploadTitle')}</span>
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Vùng thả ảnh */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); acceptFile(e.dataTransfer.files?.[0]); }}
            onClick={() => !file && inputRef.current?.click()}
            className={`relative min-h-[220px] rounded-2xl border-2 border-dashed flex items-center justify-center text-center transition-colors ${
              dragOver ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700/60 bg-slate-900/30'
            } ${file ? '' : 'cursor-pointer hover:border-indigo-500/60'}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ALLOWED_TYPES.join(',')}
              className="hidden"
              onChange={(e) => { acceptFile(e.target.files?.[0]); e.target.value = ''; }}
            />
            {file ? (
              <>
                <img src={previewUrl} alt={t('diagnosis.previewAlt')} className="max-h-[300px] max-w-full rounded-xl object-contain p-2" />
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-900/80 text-slate-300 hover:text-rose-400 cursor-pointer"
                  title={t('diagnosis.removeFile')}
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="p-6 space-y-2">
                <UploadCloud className="w-10 h-10 text-indigo-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-200">{t('diagnosis.dropHint')}</p>
                <p className="text-xs text-slate-500">{t('diagnosis.formats')}</p>
              </div>
            )}
          </div>

          {/* Thông tin kèm theo */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t('diagnosis.node')}</label>
              <select value={nodeId} onChange={(e) => setNodeId(e.target.value)} className={selectCls}>
                <option value="">{t('diagnosis.nodePlaceholder')}</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.name} ({n.host})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t('diagnosis.note')}</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                rows={4}
                placeholder={t('diagnosis.notePlaceholder')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer active:scale-95 transition-all"
            >
              <ScanSearch className="w-4 h-4" />
              <span>{submitting ? t('diagnosis.submitting') : t('diagnosis.submit')}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Kết quả gần đây */}
      <div className="glass p-5 rounded-2xl">
        <h3 className="text-sm font-semibold text-slate-100 font-heading mb-4">{t('diagnosis.recentTitle')}</h3>

        {recent.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">{t('diagnosis.recentEmpty')}</p>
        ) : (
          <ul className="space-y-3">
            {recent.map((inc) => (
              <li key={inc.id} className="p-4 rounded-xl border border-slate-800/70 bg-slate-900/20 space-y-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="font-bold text-sm text-slate-100">{inc.node.name}</span>
                  <IncidentTypeChip type={inc.incidentType} />
                  <SeverityBadge type={inc.incidentType} />
                  <AiConfidenceChip confidence={inc.aiConfidence} />
                  <StatusBadge status={inc.status} />
                  <span className="ml-auto text-xs text-slate-500 font-mono whitespace-nowrap">{formatDateTime(inc.detectedAt)}</span>
                </div>
                <p className="text-sm text-slate-300">{inc.issueDescription}</p>
                {inc.resolutionAction && (
                  <p className="text-xs text-emerald-400 font-medium">
                    <span className="text-slate-500">{t('common.fix')}:</span> {inc.resolutionAction}
                  </p>
                )}
                {inc.diagnosisId && (
                  isAdmin
                    ? <FeedbackBar incident={inc} sent={feedbackSent.has(inc.id)} onSent={markSent} />
                    : <p className="text-[11px] text-slate-500">{t('diagnosis.adminOnlyFeedback')}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Diagnosis;
