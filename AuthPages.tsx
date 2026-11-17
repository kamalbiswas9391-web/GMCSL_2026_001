import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  Globe,
  KeyRound,
  Lock,
  Shield,
  UserCheck,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../offline/syncEngine';
import type { AuthSession, UserRole } from '../types';

interface AuthPagesProps {
  onBackHome: () => void;
}

export const AuthPages: React.FC<AuthPagesProps> = ({ onBackHome }) => {
  const { lang, setLang, tr, isOnline, completeLogin, pushToast, publicData } = useApp();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // First-time System provisioning state
  const [systemInitialized, setSystemInitialized] = useState(publicData.systemInitialized);
  const [setupName, setSetupName] = useState('System Administrator');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupMobile, setSetupMobile] = useState('');
  const [setupPassword, setSetupPassword] = useState('');

  useEffect(() => {
    if (isOnline) {
      apiFetch<{ systemInitialized: boolean }>('/api/auth/status')
        .then((res) => setSystemInitialized(res.systemInitialized))
        .catch(() => undefined);
    }
  }, [isOnline]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    if (!isOnline) {
      setErrorMsg(tr('offlineLoginNote'));
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await apiFetch<AuthSession>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ role: selectedRole, identifier, secret }),
      });
      await completeLogin({ ...res, offlineAuthorized: true });
      pushToast('success', `Signed in as ${res.user.fullName} (${res.user.role}).`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleFirstTimeSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      setErrorMsg('Internet connectivity is required for initial System setup.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await apiFetch<AuthSession>('/api/auth/setup-system', {
        method: 'POST',
        body: JSON.stringify({
          fullName: setupName,
          email: setupEmail,
          mobileNumber: setupMobile,
          password: setupPassword,
        }),
      });
      setSystemInitialized(true);
      await completeLogin({ ...res, offlineAuthorized: true });
      pushToast('success', 'System Administrator account provisioned and signed in.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Setup failed.');
    } finally {
      setLoading(false);
    }
  };

  const roleCards: Array<{
    role: UserRole;
    title: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
  }> = [
    {
      role: 'Member',
      title: tr('memberLogin'),
      desc: 'Personal savings, loan balance, share details, ID card, and online payments via Mobile + 4-digit PIN.',
      icon: Users,
      accent: 'text-[#087443] bg-emerald-50 dark:bg-emerald-950/50',
    },
    {
      role: 'Secretary',
      title: tr('secretaryLogin'),
      desc: 'Daily registers, meetings, attendance, loan repayments, and payment verification via Mobile + 4-digit PIN.',
      icon: Briefcase,
      accent: 'text-[#2563EB] bg-blue-50 dark:bg-blue-950/50',
    },
    {
      role: 'President',
      title: tr('presidentLogin'),
      desc: 'Executive overview, loan approval desk, registers, and digital authorization via Mobile + 4-digit PIN.',
      icon: BadgeCheck,
      accent: 'text-[#D5A642] bg-amber-50 dark:bg-amber-950/50',
    },
    {
      role: 'System',
      title: tr('systemLogin'),
      desc: 'Full control center, permissions switchboard, Google Sheets sync, backups, and security governance.',
      icon: Shield,
      accent: 'text-[#142D4E] dark:text-slate-200 bg-slate-100 dark:bg-slate-800',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F4F7F6] dark:bg-[#0B1320] flex flex-col">
      {/* Top Bar */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <button
          onClick={selectedRole ? () => { setSelectedRole(null); setErrorMsg(''); setSecret(''); } : onBackHome}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#142D4E] dark:text-slate-200 hover:text-[#087443]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{selectedRole ? tr('roleSelectionTitle') : tr('backToHome')}</span>
        </button>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            {isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-600" /> : <WifiOff className="w-3.5 h-3.5 text-amber-600" />}
            <span>{isOnline ? tr('onlineMode') : tr('offlineMode')}</span>
          </span>
          <button
            onClick={() => setLang(lang === 'en' ? 'as' : 'en')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
          >
            <Globe className="w-3.5 h-3.5 text-[#087443]" />
            <span>{lang === 'en' ? 'অসমীয়া' : 'English'}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        {!selectedRole ? (
          <div className="w-full max-w-4xl">
            <div className="text-center mb-8">
              <img src="/icon.svg" alt="GMCSL" className="w-12 h-12 mx-auto rounded-xl mb-3" />
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#142D4E] dark:text-white">
                {tr('roleSelectionTitle')}
              </h1>
              <p className="mt-2 text-sm text-[#667085] dark:text-slate-400">
                {tr('roleSelectionSubtitle')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {roleCards.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.role}
                    onClick={() => { setSelectedRole(card.role); setErrorMsg(''); setIdentifier(''); setSecret(''); }}
                    className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#087443] dark:hover:border-emerald-500 rounded-2xl p-6 transition-all shadow-sm hover:shadow-md flex items-start gap-4"
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${card.accent}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="font-display text-lg font-bold text-[#142D4E] dark:text-white">{card.title}</h2>
                      <p className="mt-1 text-xs sm:text-sm text-[#667085] dark:text-slate-400 leading-relaxed">
                        {card.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : selectedRole === 'System' && !systemInitialized ? (
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#142D4E] text-white flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-display text-lg font-bold text-[#142D4E] dark:text-white">{tr('firstTimeSetupTitle')}</h1>
                <p className="text-xs text-[#667085] dark:text-slate-400">{tr('firstTimeSetupDesc')}</p>
              </div>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleFirstTimeSetup} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Administrator Name <span className="text-red-600">*</span></label>
                <input
                  type="text"
                  required
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">System Email <span className="text-red-600">*</span></label>
                <input
                  type="email"
                  required
                  value={setupEmail}
                  onChange={(e) => setSetupEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">System Mobile Number <span className="text-red-600">*</span></label>
                <input
                  type="tel"
                  required
                  pattern="\d{10}"
                  value={setupMobile}
                  onChange={(e) => setSetupMobile(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Initial Password (min 6 chars) <span className="text-red-600">*</span></label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-[#087443] hover:bg-[#065c35] text-white font-semibold text-sm disabled:opacity-60"
              >
                {loading ? 'Provisioning...' : 'Provision System Account'}
              </button>
            </form>
          </div>
        ) : (
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-[#087443] text-white flex items-center justify-center">
                {selectedRole === 'System' ? <Lock className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
              </div>
              <div>
                <h1 className="font-display text-xl font-bold text-[#142D4E] dark:text-white">
                  {selectedRole === 'Member'
                    ? tr('memberLogin')
                    : selectedRole === 'Secretary'
                      ? tr('secretaryLogin')
                      : selectedRole === 'President'
                        ? tr('presidentLogin')
                        : tr('systemLogin')}
                </h1>
                <p className="text-xs text-[#667085] dark:text-slate-400">
                  {tr('shortName')} · {selectedRole} Portal
                </p>
              </div>
            </div>

            {!isOnline && (
              <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                {tr('offlineLoginNote')}
              </div>
            )}

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {selectedRole === 'System' ? tr('emailOrMobile') : tr('mobileNumber')} <span className="text-red-600">*</span>
                </label>
                <input
                  type={selectedRole === 'System' ? 'text' : 'tel'}
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={selectedRole === 'System' ? 'Email or 10-digit mobile' : '10-digit mobile number'}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono-tabular"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {selectedRole === 'System' ? tr('password') : tr('fourDigitPin')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="password"
                  required
                  maxLength={selectedRole === 'System' ? 64 : 4}
                  inputMode={selectedRole === 'System' ? 'text' : 'numeric'}
                  pattern={selectedRole === 'System' ? undefined : '\\d{4}'}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder={selectedRole === 'System' ? 'Enter password' : '••••'}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono-tabular tracking-widest"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !isOnline}
                className="w-full py-2.5 rounded-lg bg-[#087443] hover:bg-[#065c35] text-white font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : tr('signIn')}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};
