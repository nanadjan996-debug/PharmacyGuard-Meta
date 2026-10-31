import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdvisoryBanner } from './components/common/AdvisoryBanner';
import { Header } from './components/common/Header';
import { LoginView } from './components/auth/LoginView';
import { Stage1WorkspaceShell } from './components/dashboard/Stage1WorkspaceShell';
import { Loader2 } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-500 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
        <p className="text-xs font-mono tracking-wider uppercase">Loading PharmacyGuard Workstation...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Compact Slate Advisory Banner */}
      <AdvisoryBanner />

      {/* Main Content Area */}
      {isAuthenticated ? (
        <>
          <Header />
          <main className="flex-1 flex flex-col">
            <Stage1WorkspaceShell />
          </main>
        </>
      ) : (
        <main className="flex-1 flex flex-col">
          <LoginView />
        </main>
      )}

      {/* Persistent System Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3 px-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>PharmacyGuard Meta Rebuild · Stage 1 Foundation & Architecture</span>
          <span className="font-mono text-[11px]">
            API Backend: <span className="text-emerald-600 dark:text-emerald-400">Online</span> (Proxy: /api/v1)
          </span>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
};

export default App;
