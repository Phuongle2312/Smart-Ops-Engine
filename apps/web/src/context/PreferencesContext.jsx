import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import vi from '../i18n/vi';
import en from '../i18n/en';

// eslint-disable-next-line react-refresh/only-export-components -- context đi kèm Provider
export const PreferencesContext = createContext(null);

const DICTIONARIES = { vi, en };
const LOCALES = { vi: 'vi-VN', en: 'en-US' };

// Đọc localStorage an toàn (chế độ ẩn danh / bị chặn storage vẫn chạy được)
const readStorage = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // bỏ qua — chỉ là tiện ích ghi nhớ lựa chọn
  }
};

const getInitialTheme = () => {
  const saved = readStorage('soe_theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

const getInitialLang = () => {
  const saved = readStorage('soe_lang');
  return saved === 'en' || saved === 'vi' ? saved : 'vi';
};

// Tra khóa dạng "a.b.c" trong từ điển lồng nhau
const lookup = (dict, key) => key.split('.').reduce((node, part) => node?.[part], dict);

export const PreferencesProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);
  const [lang, setLang] = useState(getInitialLang);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    writeStorage('soe_theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lookup(DICTIONARIES[lang], 'app.documentTitle');
    writeStorage('soe_lang', lang);
  }, [lang]);

  const toggleTheme = useCallback(() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')), []);
  const toggleLang = useCallback(() => setLang((prev) => (prev === 'vi' ? 'en' : 'vi')), []);

  // t('dashboard.title', { count: 3 }) — thiếu khóa ở ngôn ngữ hiện tại thì lùi về tiếng Việt, rồi về chính khóa
  const t = useCallback((key, params) => {
    let text = lookup(DICTIONARIES[lang], key) ?? lookup(vi, key) ?? key;
    if (typeof text !== 'string') return key;
    if (params) {
      text = text.replace(/\{(\w+)\}/g, (match, name) => (params[name] ?? match));
    }
    return text;
  }, [lang]);

  const locale = LOCALES[lang];

  const formatDateTime = useCallback(
    (value) => new Date(value).toLocaleString(locale, {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }),
    [locale]
  );

  // "5 phút trước" / "5 minutes ago"
  const formatRelative = useCallback((value, now) => {
    const diffSec = Math.round((new Date(value).getTime() - now) / 1000);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const abs = Math.abs(diffSec);
    if (abs < 45) return rtf.format(0, 'second');
    if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
    return rtf.format(Math.round(diffSec / 86400), 'day');
  }, [locale]);

  // Màu cho Recharts (SVG không đọc được class Tailwind)
  const chartTheme = useMemo(() => (theme === 'dark'
    ? { grid: '#1e293b', axis: '#64748b', tooltipBg: '#0f172a', tooltipBorder: '#334155', tooltipText: '#f1f5f9', tooltipLabel: '#94a3b8', cursor: 'rgba(148,163,184,0.08)', centerText: '#f8fafc' }
    : { grid: '#e2e8f0', axis: '#64748b', tooltipBg: '#ffffff', tooltipBorder: '#e2e8f0', tooltipText: '#0f172a', tooltipLabel: '#475569', cursor: 'rgba(15,23,42,0.05)', centerText: '#0f172a' }
  ), [theme]);

  const value = useMemo(() => ({
    theme, setTheme, toggleTheme,
    lang, setLang, toggleLang,
    t, locale, formatDateTime, formatRelative, chartTheme,
  }), [theme, toggleTheme, lang, toggleLang, t, locale, formatDateTime, formatRelative, chartTheme]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components -- hook đi kèm Provider
export const usePreferences = () => useContext(PreferencesContext);
