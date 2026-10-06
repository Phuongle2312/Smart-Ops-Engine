import { usePreferences } from '../context/PreferencesContext';
import {
  getIncidentType, STATUS_BADGE, SEVERITY_BADGE, AI_CONFIDENCE_AUTO, AI_CONFIDENCE_REVIEW,
} from '../constants/incidentMeta';

// Chấm màu + nhãn loại sự cố (màu khớp với biểu đồ)
export const IncidentTypeChip = ({ type }) => {
  const { t } = usePreferences();
  const meta = getIncidentType(type);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300" title={type}>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
      <span>{t(`incidentType.${type}`)}</span>
    </span>
  );
};

export const SeverityBadge = ({ type }) => {
  const { t } = usePreferences();
  const { severity } = getIncidentType(type);
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${SEVERITY_BADGE[severity]}`}>
      {t(`severity.${severity}`)}
    </span>
  );
};

export const StatusBadge = ({ status }) => {
  const { t } = usePreferences();
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${STATUS_BADGE[status] || ''}`}>
      {t(`status.${status}`)}
    </span>
  );
};

// Độ tin cậy chẩn đoán AI (0..1): xanh >= 85%, vàng >= 60% (cần xác nhận), xám còn lại
export const AiConfidenceChip = ({ confidence }) => {
  const { t } = usePreferences();
  if (confidence == null) return null;
  const pct = Math.round(confidence * 100);
  const needsReview = confidence >= AI_CONFIDENCE_REVIEW && confidence < AI_CONFIDENCE_AUTO;
  const cls = confidence >= AI_CONFIDENCE_AUTO
    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25'
    : needsReview
      ? 'bg-amber-500/10 text-amber-500 border-amber-500/25'
      : 'bg-slate-500/10 text-slate-400 border-slate-500/25';
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap ${cls}`}
      title={t('diagnosis.confidenceHint')}
    >
      AI {pct}%{needsReview ? ` · ${t('diagnosis.needsReview')}` : ''}
    </span>
  );
};
