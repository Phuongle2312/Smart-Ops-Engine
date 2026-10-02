import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppProvider } from './context/AppContext';
import { PreferencesProvider, usePreferences } from './context/PreferencesContext';

// Components
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import PrivateRoute from './components/PrivateRoute';

// Lazy Loaded Views
const Login = lazy(() => import('./views/Login'));
const Dashboard = lazy(() => import('./views/Dashboard'));
const Nodes = lazy(() => import('./views/Nodes'));
const NodeDetail = lazy(() => import('./views/NodeDetail'));
const Incidents = lazy(() => import('./views/Incidents'));
const AlertChannels = lazy(() => import('./views/AlertChannels'));
const AuditLogs = lazy(() => import('./views/AuditLogs'));
const SystemConfig = lazy(() => import('./views/SystemConfig'));

// Fallback Page Loader Component
const PageLoader = () => {
  const { t } = usePreferences();
  return (
    <div className="w-full h-full flex items-center justify-center bg-[var(--soe-bg)]/20 backdrop-blur-xs min-h-[300px]">
      <div className="flex flex-col items-center gap-3">
        <span className="w-10 h-10 rounded-full border-4 border-indigo-600/20 border-t-indigo-500 animate-spin"></span>
        <span className="text-xs font-semibold text-slate-400 tracking-wider">{t('app.loading')}</span>
      </div>
    </div>
  );
};

// Toast đổi màu theo theme
const ThemedToaster = () => {
  const { theme } = usePreferences();
  const isDark = theme === 'dark';
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: {
          background: isDark ? '#0f172a' : '#ffffff',
          color: isDark ? '#f3f4f6' : '#0f172a',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.1)',
          boxShadow: isDark ? undefined : '0 8px 24px -8px rgba(15, 23, 42, 0.15)',
          borderRadius: '12px',
          fontSize: '13px',
          padding: '12px 16px',
        },
        success: { iconTheme: { primary: '#10b981', secondary: '#ffffff' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#ffffff' } },
      }}
    />
  );
};

// Bố cục chính (Main Layout) sau khi đăng nhập thành công
const AppLayout = () => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--soe-bg)] text-slate-100">
      {/* Sidebar cố định bên trái */}
      <Sidebar />

      {/* Vùng nội dung chính bên phải */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <Header />
        
        {/* Dynamic content rendering */}
        <main className="flex-1 overflow-y-auto relative">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="nodes" element={<Nodes />} />
              <Route path="nodes/:id" element={<NodeDetail />} />
              <Route path="incidents" element={<Incidents />} />
              <Route path="alert-channels" element={<AlertChannels />} />
              <Route path="audit-logs" element={<AuditLogs />} />
              <Route path="system-config" element={<SystemConfig />} />
              
              {/* Catch-all redirect inside app */}
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <PreferencesProvider>
      <AppProvider>
        <BrowserRouter>
          {/* Toast notifications container */}
          <ThemedToaster />

          <Routes>
            {/* Public Login Route */}
            <Route path="/login" element={
              <Suspense fallback={<PageLoader />}>
                <Login />
              </Suspense>
            } />

            {/* Protected Routes Wrapper */}
            <Route path="/app/*" element={<PrivateRoute />}>
              <Route path="*" element={<AppLayout />} />
            </Route>

            {/* Root redirect rules */}
            <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </PreferencesProvider>
  );
}

export default App;
