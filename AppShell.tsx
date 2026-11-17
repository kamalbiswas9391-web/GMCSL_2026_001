import React, { useMemo } from 'react';
import {
  Activity,
  Award,
  BadgeCheck,
  Bell,
  BookOpen,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cloud,
  CreditCard,
  Database,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Globe,
  HardDrive,
  HardDriveDownload,
  History,
  Image as ImageIcon,
  KeyRound,
  Landmark,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Moon,
  Palette,
  PiggyBank,
  QrCode,
  RefreshCw,
  Settings,
  Shield,
  ShieldCheck,
  Sliders,
  Sun,
  User,
  UserCheck,
  Users,
  Wallet,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PWAInstallButton } from './UiPrimitives';
import type { ModuleKey, UserRole } from '../types';

export type NavTabId =
  | 'dashboard'
  | 'members'
  | 'member_pin'
  | 'officer_mgr'
  | 'president_mgr'
  | 'secretary_mgr'
  | 'savings'
  | 'loans'
  | 'loan_repayment'
  | 'loan_applications'
  | 'loan_approval'
  | 'apply_loan'
  | 'shares'
  | 'cashbook'
  | 'cashbook_summary'
  | 'attendance'
  | 'meetings'
  | 'online_payments'
  | 'payment_verification'
  | 'payment_history'
  | 'id_certificates'
  | 'id_cards'
  | 'certificates'
  | 'notices'
  | 'media_manager'
  | 'reports'
  | 'permissions'
  | 'notifications'
  | 'theme_manager'
  | 'society_settings'
  | 'content_manager'
  | 'google_sheets'
  | 'google_drive'
  | 'backup_restore'
  | 'offline_sync'
  | 'audit_log'
  | 'security'
  | 'firebase_setup'
  | 'my_profile';

interface NavSubItem {
  id: NavTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavItem {
  id: NavTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permissionModule?: ModuleKey;
  section?: string;
  children?: NavSubItem[];
}

interface AppShellProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ activeTab, onSelectTab, children }) => {
  const {
    lang,
    setLang,
    tr,
    themeMode,
    setThemeMode,
    isOnline,
    isSyncing,
    session,
    snapshot,
    pendingQueue,
    lastSyncedAt,
    syncNow,
    logout,
    askConfirm,
    hasPermission,
    modals,
    openModal,
    closeModal,
    setModalOpen,
    firebaseUser,
    cloudRecords,
  } = useApp();

  const role: UserRole = session?.user.role || 'Member';
  const settings = snapshot?.settings;
  const unreadNotifs = (snapshot?.notifications || []).filter((n) => !n.isRead);
  const pendingCount = pendingQueue.filter((p) => p.status !== 'Synced').length;

  const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>({});

  const navItems: NavItem[] = useMemo(() => {
    if (role === 'System') {
      return [
        { id: 'dashboard', label: tr('nav_dashboard'), icon: LayoutDashboard, section: 'Overview' },
        { id: 'members', label: 'Member Management', icon: Users, section: 'People & Access' },
        { id: 'member_pin', label: tr('nav_member_pin'), icon: KeyRound },
        {
          id: 'officer_mgr',
          label: tr('nav_officer_management'),
          icon: BadgeCheck,
          children: [
            { id: 'president_mgr', label: tr('nav_president_mgmt'), icon: BadgeCheck },
            { id: 'secretary_mgr', label: tr('nav_secretary_mgmt'), icon: Briefcase },
          ],
        },
        { id: 'savings', label: tr('nav_saving_register'), icon: PiggyBank, section: 'Financial Registers' },
        { id: 'loans', label: tr('nav_loan_register'), icon: Landmark },
        { id: 'loan_repayment', label: tr('nav_loan_repayment'), icon: Wallet },
        { id: 'loan_applications', label: tr('nav_loan_applications'), icon: FileCheck2 },
        { id: 'shares', label: tr('nav_share_register'), icon: BookOpen },
        { id: 'cashbook', label: tr('nav_cash_book'), icon: Wallet },
        { id: 'cashbook_summary', label: tr('nav_cashbook_summary'), icon: BookOpen },
        { id: 'attendance', label: tr('nav_attendance'), icon: CalendarCheck, section: 'Operations' },
        { id: 'online_payments', label: tr('nav_online_payments'), icon: QrCode },
        { id: 'payment_verification', label: tr('nav_payment_verification'), icon: CheckCircle2 },
        { id: 'meetings', label: tr('nav_meetings'), icon: Users },
        { id: 'notices', label: tr('nav_notices'), icon: Bell, section: 'Publishing & Docs' },
        { id: 'media_manager', label: tr('nav_media_manager'), icon: ImageIcon },
        { id: 'id_cards', label: 'ID Card Manager', icon: CreditCard },
        { id: 'certificates', label: 'Certificate Manager', icon: Award },
        { id: 'reports', label: tr('nav_reports'), icon: FileText },
        { id: 'permissions', label: tr('nav_permissions'), icon: Sliders, section: 'System Governance' },
        { id: 'notifications', label: tr('nav_notifications'), icon: Bell },
        { id: 'theme_manager', label: tr('nav_theme_manager'), icon: Palette },
        { id: 'society_settings', label: tr('nav_society_settings'), icon: Settings },
        { id: 'content_manager', label: tr('nav_content_manager'), icon: QrCode },
        { id: 'google_sheets', label: tr('nav_google_sheets'), icon: FileSpreadsheet },
        { id: 'google_drive', label: tr('nav_google_drive'), icon: HardDrive },
        { id: 'firebase_setup', label: tr('nav_firebase_setup'), icon: Cloud },
        { id: 'backup_restore', label: tr('nav_backup_restore'), icon: HardDriveDownload },
        { id: 'offline_sync', label: tr('nav_offline_sync'), icon: RefreshCw },
        { id: 'audit_log', label: tr('nav_audit_log'), icon: History },
        { id: 'security', label: tr('nav_security'), icon: Shield },
      ];
    }

    if (role === 'President') {
      const items: NavItem[] = [
        { id: 'dashboard', label: 'President Dashboard', icon: LayoutDashboard },
        { id: 'members', label: tr('nav_member_register'), icon: Users, permissionModule: 'member_register' },
        { id: 'savings', label: tr('nav_saving_register'), icon: PiggyBank, permissionModule: 'saving_register' },
        { id: 'loans', label: tr('nav_loan_register'), icon: Landmark, permissionModule: 'loan_register' },
        { id: 'loan_applications', label: tr('nav_loan_applications'), icon: FileText, permissionModule: 'loan_application' },
        { id: 'loan_approval', label: tr('nav_loan_approval'), icon: FileCheck2, permissionModule: 'loan_application' },
        { id: 'loan_repayment', label: tr('nav_loan_repayment'), icon: Wallet, permissionModule: 'loan_repayment' },
        { id: 'shares', label: tr('nav_share_register'), icon: BookOpen, permissionModule: 'share_register' },
        { id: 'cashbook', label: tr('nav_cash_book'), icon: Wallet, permissionModule: 'cash_book' },
        { id: 'cashbook_summary', label: tr('nav_cashbook_summary'), icon: BookOpen, permissionModule: 'cash_book' },
        { id: 'attendance', label: tr('nav_attendance'), icon: CalendarCheck, permissionModule: 'attendance' },
        { id: 'meetings', label: tr('nav_meetings'), icon: Users, permissionModule: 'meetings' },
        { id: 'online_payments', label: tr('nav_online_payments'), icon: QrCode, permissionModule: 'online_payment' },
        { id: 'id_certificates', label: tr('nav_id_certificates'), icon: CreditCard, permissionModule: 'id_certificates' },
        { id: 'notices', label: tr('nav_notices'), icon: Bell, permissionModule: 'notices' },
        { id: 'reports', label: tr('nav_reports'), icon: FileText, permissionModule: 'reports' },
        { id: 'my_profile', label: tr('nav_my_profile'), icon: User },
        { id: 'notifications', label: tr('nav_notifications'), icon: Bell },
        { id: 'offline_sync', label: 'Sync Status', icon: RefreshCw },
      ];
      return items.filter((item) => !item.permissionModule || hasPermission(item.permissionModule, 'view'));
    }

    if (role === 'Secretary') {
      const items: NavItem[] = [
        { id: 'dashboard', label: 'Secretary Dashboard', icon: LayoutDashboard },
        { id: 'members', label: tr('nav_member_register'), icon: Users, permissionModule: 'member_register' },
        { id: 'savings', label: tr('nav_saving_register'), icon: PiggyBank, permissionModule: 'saving_register' },
        { id: 'loans', label: tr('nav_loan_register'), icon: Landmark, permissionModule: 'loan_register' },
        { id: 'loan_repayment', label: tr('nav_loan_repayment'), icon: Wallet, permissionModule: 'loan_repayment' },
        { id: 'loan_applications', label: tr('nav_loan_applications'), icon: FileText, permissionModule: 'loan_application' },
        { id: 'shares', label: tr('nav_share_register'), icon: BookOpen, permissionModule: 'share_register' },
        { id: 'cashbook', label: tr('nav_cash_book'), icon: Wallet, permissionModule: 'cash_book' },
        { id: 'cashbook_summary', label: tr('nav_cashbook_summary'), icon: BookOpen, permissionModule: 'cash_book' },
        { id: 'attendance', label: tr('nav_attendance'), icon: CalendarCheck, permissionModule: 'attendance' },
        { id: 'meetings', label: tr('nav_meetings'), icon: Users, permissionModule: 'meetings' },
        { id: 'online_payments', label: tr('nav_online_payments'), icon: QrCode, permissionModule: 'online_payment' },
        { id: 'payment_verification', label: tr('nav_payment_verification'), icon: CheckCircle2, permissionModule: 'online_payment' },
        { id: 'id_certificates', label: tr('nav_id_certificates'), icon: CreditCard, permissionModule: 'id_certificates' },
        { id: 'notices', label: tr('nav_notices'), icon: Bell, permissionModule: 'notices' },
        { id: 'reports', label: tr('nav_reports'), icon: FileText, permissionModule: 'reports' },
        { id: 'my_profile', label: tr('nav_my_profile'), icon: User },
        { id: 'notifications', label: tr('nav_notifications'), icon: Bell },
        { id: 'offline_sync', label: 'Sync Status', icon: RefreshCw },
      ];
      return items.filter((item) => !item.permissionModule || hasPermission(item.permissionModule, 'view'));
    }

    // Member
    const memberItems: NavItem[] = [
      { id: 'dashboard', label: 'My Dashboard', icon: LayoutDashboard },
      { id: 'my_profile', label: tr('nav_my_profile'), icon: User, permissionModule: 'member_register' },
      { id: 'savings', label: tr('nav_my_savings'), icon: PiggyBank, permissionModule: 'saving_register' },
      { id: 'loans', label: tr('nav_my_loan'), icon: Landmark, permissionModule: 'loan_register' },
      { id: 'apply_loan', label: tr('nav_apply_loan'), icon: FileCheck2, permissionModule: 'loan_application' },
      { id: 'shares', label: tr('nav_my_shares'), icon: BookOpen, permissionModule: 'share_register' },
      { id: 'online_payments', label: tr('nav_online_payments'), icon: QrCode, permissionModule: 'online_payment' },
      { id: 'payment_history', label: tr('nav_my_payment_history'), icon: History, permissionModule: 'online_payment' },
      { id: 'attendance', label: tr('nav_my_attendance'), icon: CalendarCheck, permissionModule: 'attendance' },
      { id: 'id_cards', label: tr('nav_my_id_card'), icon: CreditCard, permissionModule: 'id_certificates' },
      { id: 'certificates', label: tr('nav_my_certificate'), icon: Award, permissionModule: 'id_certificates' },
      { id: 'notices', label: tr('nav_notices'), icon: Bell, permissionModule: 'notices' },
      { id: 'notifications', label: tr('nav_notifications'), icon: Bell },
      { id: 'offline_sync', label: 'Sync Status', icon: RefreshCw },
      { id: 'reports', label: 'My Reports', icon: FileText, permissionModule: 'reports' },
    ];
    return memberItems.filter((item) => !item.permissionModule || hasPermission(item.permissionModule, 'view'));
  }, [hasPermission, role, tr]);

  const flatNav = useMemo(
    () => navItems.flatMap((n) => (n.children ? [n, ...n.children] : [n])),
    [navItems]
  );
  const activeNav = flatNav.find((n) => n.id === activeTab) || navItems[0];

  const handleLogout = async () => {
    const msg =
      pendingCount > 0
        ? `You have ${pendingCount} unsynchronized offline record(s). Logging out clears your cached profile while safely preserving your pending sync queue on this device. Continue?`
        : 'Are you sure you want to sign out of GMCSL?';
    await askConfirm({
      title: tr('logout'),
      message: msg,
      confirmLabel: tr('logout'),
      danger: true,
      onConfirm: async () => {
        await logout();
      },
    });
  };

  const cycleTheme = () => {
    const next = themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'auto' : 'light';
    setThemeMode(next);
  };

  const mobileQuickTabs: NavTabId[] =
    role === 'Member'
      ? ['dashboard', 'savings', 'loans', 'online_payments']
      : role === 'System'
        ? ['dashboard', 'members', 'savings', 'offline_sync']
        : ['dashboard', 'members', 'savings', 'loans'];

  return (
    <div className="min-h-screen bg-[#F4F7F6] dark:bg-[#0B1320] text-[#1D2939] dark:text-slate-100 flex">
      {/* Desktop Fixed Sidebar */}
      <aside
        style={{ backgroundColor: 'var(--gmcsl-sidebar, #142D4E)' }}
        className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 text-slate-200 border-r border-white/10 z-30 no-print"
      >
        <div className="h-16 px-4 flex items-center gap-3 border-b border-white/10 shrink-0">
          <img
            src={settings?.logoUrl || '/icon.svg'}
            alt="GMCSL Logo"
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 shrink-0"
          />
          <div className="min-w-0">
            <p className="font-display text-sm font-bold text-white truncate">{settings?.shortName || 'GMCSL'}</p>
            <p className="text-[11px] text-[#D5A642] font-medium truncate">{role} Portal</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const hasChildren = Boolean(item.children?.length);
            const childActive = item.children?.some((c) => c.id === activeTab) ?? false;
            const isExpanded = Boolean(expandedGroups[item.id]) || childActive || activeTab === item.id;
            const active = activeTab === item.id;
            return (
              <React.Fragment key={item.id}>
                {item.section && (
                  <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {item.section}
                  </p>
                )}
                <button
                  onClick={() => {
                    if (hasChildren) {
                      setExpandedGroups((prev) => ({ ...prev, [item.id]: !isExpanded }));
                    }
                    onSelectTab(item.id);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                    active || (hasChildren && childActive)
                      ? 'bg-[#087443] text-white shadow-sm'
                      : 'text-slate-200 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate flex-1">{item.label}</span>
                  {hasChildren && (isExpanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />)}
                  {item.id === 'offline_sync' && pendingCount > 0 && (
                    <span className="font-mono-tabular text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-slate-950">
                      {pendingCount}
                    </span>
                  )}
                  {item.id === 'notifications' && unreadNotifs.length > 0 && (
                    <span className="font-mono-tabular text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#D5A642] text-slate-950">
                      {unreadNotifs.length}
                    </span>
                  )}
                </button>
                {hasChildren && isExpanded && (
                  <div className="pl-5 space-y-1 mt-1 border-l border-white/15 ml-4">
                    {item.children!.map((sub) => {
                      const SubIcon = sub.icon;
                      const subActive = activeTab === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => onSelectTab(sub.id)}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors text-left ${
                            subActive
                              ? 'bg-white/20 text-white font-semibold'
                              : 'text-slate-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <SubIcon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate flex-1">{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10 shrink-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-red-200 hover:bg-red-500/20 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>{tr('logout')}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {modals.mobileMenu && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div className="fixed inset-0 bg-black/55" onClick={() => closeModal('mobileMenu')} />
          <aside
            style={{ backgroundColor: 'var(--gmcsl-sidebar, #142D4E)' }}
            className="relative w-72 max-w-[85vw] flex flex-col text-slate-200 h-full shadow-2xl"
          >
            <div className="h-16 px-4 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2.5 min-w-0">
                <img src={settings?.logoUrl || '/icon.svg'} alt="GMCSL" className="w-8 h-8 rounded bg-white p-0.5" />
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold text-white truncate">{settings?.shortName || 'GMCSL'}</p>
                  <p className="text-[11px] text-[#D5A642]">{role} Portal</p>
                </div>
              </div>
              <button
                onClick={() => closeModal('mobileMenu')}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const hasChildren = Boolean(item.children?.length);
                const childActive = item.children?.some((c) => c.id === activeTab) ?? false;
                const isExpanded = Boolean(expandedGroups[item.id]) || childActive || activeTab === item.id;
                const active = activeTab === item.id;
                return (
                  <React.Fragment key={item.id}>
                    <button
                      onClick={() => {
                        if (hasChildren) {
                          setExpandedGroups((prev) => ({ ...prev, [item.id]: !isExpanded }));
                          onSelectTab(item.id);
                        } else {
                          onSelectTab(item.id);
                          closeModal('mobileMenu');
                        }
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left ${
                        active || (hasChildren && childActive) ? 'bg-[#087443] text-white' : 'text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate flex-1">{item.label}</span>
                      {hasChildren && (isExpanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />)}
                    </button>
                    {hasChildren && isExpanded && (
                      <div className="pl-5 space-y-1 mt-1 border-l border-white/15 ml-4">
                        {item.children!.map((sub) => {
                          const SubIcon = sub.icon;
                          const subActive = activeTab === sub.id;
                          return (
                            <button
                              key={sub.id}
                              onClick={() => {
                                onSelectTab(sub.id);
                                closeModal('mobileMenu');
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left ${
                                subActive ? 'bg-white/20 text-white font-semibold' : 'text-slate-300 hover:bg-white/10'
                              }`}
                            >
                              <SubIcon className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate flex-1">{sub.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </nav>
            <div className="p-3 border-t border-white/10">
              <button
                onClick={() => {
                  closeModal('mobileMenu');
                  handleLogout();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-red-200 hover:bg-red-500/20"
              >
                <LogOut className="w-4 h-4" />
                <span>{tr('logout')}</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 pb-16 lg:pb-0">
        {/* Global Header */}
        <header className="sticky top-0 z-20 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 flex items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => openModal('mobileMenu')}
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-sm sm:text-base font-bold text-[#142D4E] dark:text-white truncate">
                {activeNav?.label || tr('nav_dashboard')}
              </h1>
              <p className="hidden sm:block text-[11px] text-[#667085] dark:text-slate-400 truncate">
                {lang === 'as' && settings?.societyNameAs
                  ? settings.societyNameAs
                  : settings?.societyName || tr('orgFullName')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Online / Offline Status */}
            <span
              title={lastSyncedAt ? `Last synced: ${new Date(lastSyncedAt).toLocaleString()}` : undefined}
              className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${
                isOnline
                  ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                  : 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
              }`}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{isOnline ? tr('onlineMode') : tr('offlineMode')}</span>
            </span>

            {/* Sync Indicator & Button */}
            <button
              onClick={() => (isOnline ? syncNow() : onSelectTab('offline_sync'))}
              disabled={isSyncing}
              title={lastSyncedAt ? `${tr('lastSynchronized')}: ${new Date(lastSyncedAt).toLocaleString()}` : tr('syncNow')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#087443] ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">
                {isSyncing ? tr('syncing') : pendingCount > 0 ? `${pendingCount} ${tr('pendingSync')}` : tr('synced')}
              </span>
              {pendingCount > 0 && (
                <span className="md:hidden font-mono-tabular text-[11px] font-bold text-amber-600">{pendingCount}</span>
              )}
            </button>

            {/* Language Switcher */}
            <button
              onClick={() => setLang(lang === 'en' ? 'as' : 'en')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              title="Switch Language (English / অসমীয়া)"
            >
              <Globe className="w-3.5 h-3.5 text-[#087443]" />
              <span>{lang === 'en' ? 'অসমীয়া' : 'EN'}</span>
            </button>

            {/* Theme Quick Toggle */}
            <button
              onClick={cycleTheme}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              title={`Theme: ${themeMode} (Click to toggle)`}
              aria-label="Toggle theme"
            >
              {themeMode === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {/* PWA Install */}
            <div className="hidden xl:block">
              <PWAInstallButton compact />
            </div>

            {/* Firebase Cloud Sync Quick Indicator */}
            <button
              onClick={() => onSelectTab('offline_sync')}
              title={
                firebaseUser
                  ? `Firebase Cloud Sync Active (${firebaseUser.email}) · ${cloudRecords.length} cached`
                  : 'Configure Firebase Cloud Sync (Free Spark Plan)'
              }
              className={`hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap ${
                firebaseUser
                  ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>{firebaseUser ? `Cloud (${cloudRecords.length})` : 'Cloud Sync'}</span>
            </button>

            {/* Notification Bell + Dropdown */}
            <div className="relative">
              <button
                onClick={() => setModalOpen('notificationsDropdown', !modals.notificationsDropdown)}
                className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifs.length > 0 && (
                  <span className="absolute -top-1 -right-1 font-mono-tabular text-[10px] font-bold px-1.5 rounded-full bg-red-600 text-white">
                    {unreadNotifs.length}
                  </span>
                )}
              </button>
              {modals.notificationsDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3 z-50">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-[#142D4E] dark:text-white">{tr('notifications')}</span>
                    <button
                      onClick={() => {
                        closeModal('notificationsDropdown');
                        onSelectTab('notifications');
                      }}
                      className="text-xs font-medium text-[#087443] hover:underline"
                    >
                      View all
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {(snapshot?.notifications || []).slice(0, 4).map((n) => (
                      <div key={n.notificationId} className="py-2 text-xs">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{n.title}</p>
                        <p className="text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{n.message}</p>
                      </div>
                    ))}
                    {(snapshot?.notifications || []).length === 0 && (
                      <p className="py-4 text-center text-xs text-slate-400">{tr('noNotifications')}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile & Settings Shortcut */}
            <button
              onClick={() => onSelectTab(role === 'System' ? 'security' : 'my_profile')}
              className="hidden md:flex items-center gap-2 pl-2 pr-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
              title={tr('profileSettings')}
            >
              <div className="w-7 h-7 rounded-md bg-[#142D4E] text-white flex items-center justify-center text-xs font-bold">
                {(session?.user.fullName || role).slice(0, 1).toUpperCase()}
              </div>
              <div className="leading-tight max-w-[120px]">
                <p className="text-xs font-semibold truncate">{session?.user.fullName}</p>
                <p className="text-[10px] text-[#667085] dark:text-slate-400">{role}</p>
              </div>
            </button>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
              title={tr('logout')}
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Offline / Provisional Banner when Offline */}
        {!isOnline && (
          <div className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-3 no-print">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>{tr('offlineStoredNotice')}</span>
            </div>
            <span className="font-mono-tabular font-semibold shrink-0">{pendingCount} Pending</span>
          </div>
        )}

        {/* Active Module View */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>

      {/* Sleek Mobile Bottom Quick Navigation (<= 15% height) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 grid grid-cols-4 no-print">
        {mobileQuickTabs.map((tabId) => {
          const item = navItems.find((n) => n.id === tabId);
          if (!item) return null;
          const Icon = item.icon;
          const active = activeTab === tabId;
          return (
            <button
              key={tabId}
              onClick={() => onSelectTab(tabId)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                active ? 'text-[#087443] dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-[76px]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
