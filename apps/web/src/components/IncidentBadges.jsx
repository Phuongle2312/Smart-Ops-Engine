import { usePreferences } from '../context/PreferencesContext';
import { getIncidentType, STATUS_BADGE, SEVERITY_BADGE } from '../constants/incidentMeta';

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
