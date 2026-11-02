import React, { useState, useEffect, useMemo } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdvisoryBanner } from './components/common/AdvisoryBanner';
import { Header } from './components/common/Header';
import { LoginView } from './components/auth/LoginView';
import { Stage1WorkspaceShell } from './components/dashboard/Stage1WorkspaceShell';
import { AccessDeniedView } from './components/common/AccessDeniedView';
import { Loader2 } from 'lucide-react';
import { UserRole } from './types/api';

type WorkspaceType = 'staff' | 'chief' | 'student';

const MainLayout: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [workspace, setWorkspace] = useState<WorkspaceType | null>(() => {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('workspace');
      if (param === 'staff' || param === 'chief' || param === 'student') {
        return param as WorkspaceType;
      }
    }
    return null;
  });

  // Calculate default authorized workspace from user roles
  const defaultWorkspace: WorkspaceType = useMemo(() => {
    if (!user || !user.roles) return 'staff';
    if (user.roles.includes('chief_pharmacist')) return 'chief';
    if (user.roles.includes('staff_pharmacist')) return 'staff';
    if (user.roles.includes('pharmacy_student')) return 'student';
    return 'staff';
  }, [user]);

  const activeWorkspace = workspace || defaultWorkspace;

  const navigateToWorkspace = (target: WorkspaceType) => {
    setWorkspace(target);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('workspace', target);
      window.history.pushState({}, '', url.toString());
    }
  };

  // Sync workspace on browser history popstate
  useEffect(() => {
    const handlePopState = () => {
      const param = new URLSearchParams(window.location.search).get('workspace');
      if (param === 'staff' || param === 'chief' || param === 'student') {
        setWorkspace(param as WorkspaceType);
      } else {
        setWorkspace(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Strict role verification for the target workspace
  const isAuthorized = useMemo(() => {
    if (!user || !user.roles) return false;
    if (activeWorkspace === 'chief') {
      return user.roles.includes('chief_pharmacist');
    }
    if (activeWorkspace === 'staff') {
      return user.roles.includes('staff_pharmacist') || user.roles.includes('chief_pharmacist');
    }
    if (activeWorkspace === 'student') {
      return user.roles.includes('pharmacy_student');
    }
    return false;
  }, [user, activeWorkspace]);

  const requiredRole: UserRole = activeWorkspace === 'chief'
    ? 'chief_pharmacist'
    : activeWorkspace === 'student'
    ? 'pharmacy_student'
    : 'staff_pharmacist';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-500 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
        <p className="text-xs font-mono tracking-wider uppercase">Loading PharmacyGuard Workstation...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans transition-colors overflow-x-hidden">
      {/* Compact Slate Advisory Banner */}
      <AdvisoryBanner />

      {/* Main Content Area */}
      {isAuthenticated ? (
        <>
          <Header
            currentWorkspace={activeWorkspace}
            onNavigateWorkspace={navigateToWorkspace}
          />
          <main className="flex-1 flex flex-col">
            {isAuthorized ? (
              <Stage1WorkspaceShell
                workspace={activeWorkspace}
                onNavigateWorkspace={navigateToWorkspace}
              />
            ) : (
              <AccessDeniedView
                requestedWorkspace={activeWorkspace}
                requiredRole={requiredRole}
                onNavigateHome={() => navigateToWorkspace(defaultWorkspace)}
              />
            )}
          </main>
        </>
      ) : (
        <main className="flex-1 flex flex-col">
          <LoginView />
        </main>
      )}

      {/* Persistent System Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3 px-4 sm:px-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>PharmacyGuard · AI Clinical Verification Agent (Meta Global AI Developer Hackathon)</span>
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
