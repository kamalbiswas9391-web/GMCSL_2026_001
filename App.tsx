import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ConfirmModal, SWUpdateBanner, ToastContainer } from './components/UiPrimitives';
import { HomePage } from './pages/HomePage';
import { AuthPages } from './pages/AuthPages';
import { RoleDashboards } from './pages/RoleDashboards';

const AppRouter: React.FC = () => {
  const { bootLoading, session, tr } = useApp();
  const [showAuth, setShowAuth] = useState(false);

  if (bootLoading) {
    return (
      <div className="min-h-screen bg-[#F4F7F6] dark:bg-[#0B1320] flex flex-col items-center justify-center p-6 text-center">
        <img src="/icon.svg" alt="GMCSL" className="w-14 h-14 rounded-2xl mb-4" />
        <h1 className="font-display text-lg font-bold text-[#142D4E] dark:text-white">{tr('appTitle')}</h1>
        <p className="mt-1 text-xs text-[#667085] dark:text-slate-400">Initializing encrypted offline store & society workspace...</p>
      </div>
    );
  }

  if (session) {
    return <RoleDashboards />;
  }

  if (showAuth) {
    return <AuthPages onBackHome={() => setShowAuth(false)} />;
  }

  return <HomePage onOpenLogin={() => setShowAuth(true)} />;
};

export default function App() {
  return (
    <AppProvider>
      <SWUpdateBanner />
      <AppRouter />
      <ToastContainer />
      <ConfirmModal />
    </AppProvider>
  );
}
