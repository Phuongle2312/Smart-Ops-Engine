import { Moon, Sun } from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';

// Nút đổi giao diện sáng/tối và ngôn ngữ VI/EN — dùng ở Header và trang Login
const PreferenceToggles = () => {
  const { theme, toggleTheme, lang, toggleLang, t } = usePreferences();
  const isDark = theme === 'dark';

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg border border-slate-800 bg-slate-900/40">
      <button
        type="button"
        onClick={toggleTheme}
        className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 transition-colors cursor-pointer"
        title={isDark ? t('prefs.themeToLight') : t('prefs.themeToDark')}
        aria-label={isDark ? t('prefs.themeToLight') : t('prefs.themeToDark')}
      >
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
      <button
        type="button"
        onClick={toggleLang}
        className="px-2 py-1 rounded-md text-[11px] font-bold tracking-wider text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 transition-colors cursor-pointer"
        title={t('prefs.switchLang')}
        aria-label={t('prefs.switchLang')}
      >
        {lang === 'vi' ? 'VI' : 'EN'}
      </button>
    </div>
  );
};

export default PreferenceToggles;
