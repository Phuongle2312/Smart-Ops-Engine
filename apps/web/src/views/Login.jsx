import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { usePreferences } from '../context/PreferencesContext';
import PreferenceToggles from '../components/PreferenceToggles';
import { Eye, EyeOff, ShieldCheck, User } from 'lucide-react';

const Login = () => {
  const { login, accessToken } = useContext(AppContext);
  const { t } = usePreferences();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Nếu đã đăng nhập thì redirect qua dashboard
  useEffect(() => {
    if (accessToken) {
      navigate('/app/dashboard');
    }
  }, [accessToken, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError(t('login.missing'));
      return;
    }
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/app/dashboard');
    } catch (err) {
      setError(err.message || t('login.failed'));
    } finally {
      setLoading(false);
    }
  };

  const autofill = (userType) => {
    setUsername(userType);
    setPassword(userType);
  };

  return (
    <div className="min-h-screen bg-[var(--soe-bg)] flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Theme + language */}
      <div className="absolute top-4 right-4 z-10">
        <PreferenceToggles />
      </div>

      {/* Background Gradients decoration */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-purple-500/10 blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md glass rounded-3xl p-8 shadow-2xl relative">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-500/10">
            <span className="font-heading font-extrabold text-white text-2xl tracking-wider">SO</span>
          </div>
          <h2 className="text-2xl font-heading font-bold text-slate-50 tracking-wide">
            Smart Ops Engine
          </h2>
          <p className="text-slate-400 text-xs mt-1 font-medium tracking-wide uppercase">
            {t('login.subtitle')}
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold text-center leading-normal">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              {t('login.username')}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              placeholder={t('login.usernamePlaceholder')}
              className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800/80 focus:border-indigo-500 focus:outline-none text-sm text-slate-200 placeholder-slate-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              {t('login.password')}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder={t('login.passwordPlaceholder')}
                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800/80 focus:border-indigo-500 focus:outline-none text-sm text-slate-200 placeholder-slate-500 transition-colors pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-slate-300 focus:outline-none cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/10 active:scale-[0.98] transition-all flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin"></span>
            ) : (
              <span>{t('login.submit')}</span>
            )}
          </button>
        </form>

        {/* Quick Testing accounts info */}
        <div className="mt-8 pt-6 border-t border-slate-800/80">
          <p className="text-xs text-slate-500 text-center mb-3 font-semibold uppercase">
            {t('login.demoAccounts')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => autofill('admin')}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-purple-950/20 hover:bg-purple-950/30 border border-purple-500/20 text-purple-400 text-xs font-semibold transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t('login.demoAdmin')}</span>
            </button>
            <button
              onClick={() => autofill('viewer')}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-950/20 hover:bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 text-xs font-semibold transition-colors cursor-pointer"
            >
              <User className="w-3.5 h-3.5" />
              <span>{t('login.demoViewer')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
