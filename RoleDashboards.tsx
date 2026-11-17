import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  CreditCard,
  Download,
  FileCheck2,
  Landmark,
  PiggyBank,
  QrCode,
  ShieldAlert,
  Wallet,
  X,
} from 'lucide-react';
import { AppShell, type NavTabId } from '../components/AppShell';
import { DashboardCharts } from '../components/DashboardCharts';
import { StatusLabel } from '../components/UiPrimitives';
import { useApp } from '../context/AppContext';
import {
  CashBookView,
  LoanRegisterView,
  LoanRepaymentView,
  MemberRegisterView,
  SavingRegisterView,
  ShareRegisterView,
} from '../modules/FinancialRegisters';
import {
  AttendanceRegisterView,
  LoanApplicationView,
  MeetingsView,
  OnlinePaymentView,
} from '../modules/OperationsAndWorkflows';
import {
  IdAndCertificateHub,
  NoticeBoardView,
  NotificationsCenterView,
  ReportsCenterView,
} from '../modules/DocumentsAndReportsModule';
import {
  PermissionSwitchboardView,
  SocietySettingsView,
  UsersAndPinManagerView,
} from '../modules/SystemGovernanceViews';
import {
  AdminFirebaseSetupView,
  AuditLogView,
  BackupAndRestoreView,
  GoogleDriveIntegrationView,
  GoogleSheetsIntegrationView,
  OfflineSyncAndConflictView,
  SecurityAndCredentialsView,
} from '../modules/SystemInfraViews';
import {
  exportTableToCsv,
  exportTableToExcel,
  exportTableToPdf,
} from '../utils/exports';

const formatCurrency = (val: number, symbol = '₹') =>
  `${symbol}${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface DrilldownData {
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  targetTab?: NavTabId;
}

const KpiCard: React.FC<{
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  onClick?: () => void;
}> = ({ label, value, sub, accent = 'text-[#142D4E] dark:text-white', onClick }) => {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#087443] dark:hover:border-emerald-500 rounded-xl p-4 flex flex-col justify-between transition-all hover:shadow-sm group"
      >
        <div className="flex items-center justify-between gap-2 w-full">
          <p className="text-xs font-medium text-[#667085] dark:text-slate-400">{label}</p>
          <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-[#087443] shrink-0 transition-colors" />
        </div>
        <p className={`mt-2 text-xl sm:text-2xl font-bold font-mono-tabular ${accent}`}>{value}</p>
        {sub && <p className="mt-1 text-[11px] text-[#667085] dark:text-slate-400 truncate w-full">{sub}</p>}
      </button>
    );
  }
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between">
      <p className="text-xs font-medium text-[#667085] dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-xl sm:text-2xl font-bold font-mono-tabular ${accent}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-[#667085] dark:text-slate-400 truncate">{sub}</p>}
    </div>
  );
};

const LiveSyncHeaderBadge: React.FC<{ isLive: boolean; syncedAt?: string | null }> = ({ isLive, syncedAt }) => {
  const { tr } = useApp();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs">
      <div className="flex items-center gap-2 font-semibold">
        <span className={isLive ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
          {isLive ? tr('liveDataBadge') : tr('cachedDataBadge')}
        </span>
      </div>
      <span className="text-[#667085] dark:text-slate-400 font-mono-tabular">
        {tr('lastSynchronized')}: {syncedAt ? new Date(syncedAt).toLocaleString() : '—'}
      </span>
    </div>
  );
};

// ==========================================
// SHARED OPERATIONAL WIDGETS ROW (Loan Apps + Online Payments)
// ==========================================
const OperationalWidgetsRow: React.FC = () => {
  const { snapshot, tr, openModal } = useApp();
  if (!snapshot) return null;
  const st = snapshot.stats;
  const totalLoanApps = st.totalLoanApplications ?? snapshot.loanApplications.length;
  const totalOnlinePays = st.totalOnlinePayments ?? snapshot.onlinePayments.length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* 1. Loan Applications Count Widget */}
      <button
        type="button"
        onClick={() => openModal('loanAppsWidgetModal')}
        className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#087443] rounded-xl p-4 flex flex-col justify-between transition-all hover:shadow-sm"
      >
        <div className="flex items-center justify-between w-full">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#142D4E] dark:text-white">
            <FileCheck2 className="w-4 h-4 text-[#087443]" />
            <span>{tr('nav_loan_applications')}</span>
          </span>
          <span className="text-[11px] font-semibold text-[#087443]">View List →</span>
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-2">
          <div>
            <p className="text-2xl font-bold font-mono-tabular text-[#142D4E] dark:text-white">{totalLoanApps}</p>
            <p className="text-[11px] text-slate-500">Total Submitted</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold font-mono-tabular text-amber-600">{st.pendingLoanApplications}</p>
            <p className="text-[11px] text-slate-500">Pending Review</p>
          </div>
        </div>
      </button>

      {/* 2. Online Payments Count Widget */}
      <button
        type="button"
        onClick={() => openModal('onlinePaymentsWidgetModal')}
        className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#087443] rounded-xl p-4 flex flex-col justify-between transition-all hover:shadow-sm"
      >
        <div className="flex items-center justify-between w-full">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#142D4E] dark:text-white">
            <QrCode className="w-4 h-4 text-[#2563EB]" />
            <span>{tr('nav_online_payments')}</span>
          </span>
          <span className="text-[11px] font-semibold text-[#2563EB]">View List →</span>
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-2">
          <div>
            <p className="text-2xl font-bold font-mono-tabular text-[#142D4E] dark:text-white">{totalOnlinePays}</p>
            <p className="text-[11px] text-slate-500">Total Submissions</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold font-mono-tabular text-amber-600">{st.pendingOnlinePayments}</p>
            <p className="text-[11px] text-slate-500">Pending Verify</p>
          </div>
        </div>
      </button>
    </div>
  );
};

// ==========================================
// DEDICATED CASH BOOK SUMMARY SIDEBAR VIEW
// ==========================================
const CashBookSummaryView: React.FC<{ onOpenRegister: () => void }> = ({ onOpenRegister }) => {
  const { snapshot, tr } = useApp();
  if (!snapshot) return null;
  const st = snapshot.stats;
  const settings = snapshot.settings;
  const sym = settings?.currencySymbol || '₹';

  const cashDepositEntries = snapshot.cashBook.filter((c) => c.paymentMode === 'Deposit');
  const cashPaymentEntries = snapshot.cashBook.filter((c) => c.paymentMode === 'Payment');
  const depositCount = st.totalCashDepositCount ?? cashDepositEntries.length;
  const depositAmt = st.totalCashDepositAmount ?? cashDepositEntries.reduce((a, c) => a + Number(c.totalAmount || 0), 0);
  const paymentCount = st.totalCashPaymentCount ?? cashPaymentEntries.length;
  const paymentAmt = st.totalCashPaymentAmount ?? cashPaymentEntries.reduce((a, c) => a + Number(c.totalAmount || 0), 0);
  const combinedCashBookBal = Math.round((Number(st.totalBankBalance || 0) + Number(st.totalCashBalance || 0)) * 100) / 100;

  const cashSummaryHeaders = ['Category', 'Count', 'Amount'];
  const cashSummaryRows: Array<Array<string | number>> = [
    ['Deposits (Inflow)', depositCount, depositAmt.toFixed(2)],
    ['Payments (Outflow)', paymentCount, paymentAmt.toFixed(2)],
    ['Bank Balance', '-', Number(st.totalBankBalance || 0).toFixed(2)],
    ['Cash Balance', '-', Number(st.totalCashBalance || 0).toFixed(2)],
    ['Total Society Balance (Bank + Cash)', '-', combinedCashBookBal.toFixed(2)],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#087443]" />
            <span>{tr('cashBookSummary')}</span>
          </h2>
          <p className="text-xs text-[#667085] dark:text-slate-400">
            Live summary of society cash inflows, outflows, Bank balance, Cash-in-hand, and combined total balance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportTableToPdf('Cash Book Summary', cashSummaryHeaders, cashSummaryRows, settings, 'GMCSL_CashBook_Summary')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
          <button
            type="button"
            onClick={() => exportTableToExcel('CashBookSummary', cashSummaryHeaders, cashSummaryRows, 'GMCSL_CashBook_Summary')}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Excel
          </button>
          <button
            type="button"
            onClick={() => exportTableToCsv(cashSummaryHeaders, cashSummaryRows, 'GMCSL_CashBook_Summary')}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            CSV
          </button>
          <button
            type="button"
            onClick={onOpenRegister}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#087443] hover:bg-[#065c35] text-white text-xs font-semibold"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Open {tr('nav_cash_book')}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Total Deposits ({depositCount})</p>
          <p className="mt-2 text-xl font-bold font-mono-tabular text-[#087443] dark:text-emerald-400">
            {formatCurrency(depositAmt, sym)}
          </p>
        </div>
        <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Total Payments ({paymentCount})</p>
          <p className="mt-2 text-xl font-bold font-mono-tabular text-amber-700 dark:text-amber-400">
            {formatCurrency(paymentAmt, sym)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{tr('bankBalance')}</p>
          <p className="mt-2 text-xl font-bold font-mono-tabular text-blue-700 dark:text-blue-400">
            {formatCurrency(st.totalBankBalance, sym)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{tr('cashBalance')}</p>
          <p className="mt-2 text-xl font-bold font-mono-tabular text-emerald-700 dark:text-emerald-400">
            {formatCurrency(st.totalCashBalance, sym)}
          </p>
        </div>
        <div className="bg-[#142D4E] text-white rounded-xl p-4">
          <p className="text-xs font-medium text-slate-300">{tr('totalBalance')} (Bank + Cash)</p>
          <p className="mt-2 text-xl font-bold font-mono-tabular text-white">
            {formatCurrency(combinedCashBookBal, sym)}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-display text-sm font-bold text-[#142D4E] dark:text-white">Cash Book Ledger Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b text-xs font-semibold">
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Entry Count</th>
                <th className="py-3 px-4 text-right">Amount ({sym})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {cashSummaryRows.map((row, idx) => (
                <tr key={idx} className={idx === cashSummaryRows.length - 1 ? 'bg-slate-50/70 dark:bg-slate-800/40 font-bold' : ''}>
                  <td className="py-3 px-4">{row[0]}</td>
                  <td className="py-3 px-4 text-center font-mono-tabular">{row[1]}</td>
                  <td className="py-3 px-4 text-right font-mono-tabular">{sym}{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// SYSTEM DASHBOARD OVERVIEW (19 KPIs)
// ==========================================
const SystemOverview: React.FC<{ onNavigate: (t: NavTabId) => void; onDrill: (key: string, label: string) => void }> = ({
  onNavigate,
  onDrill,
}) => {
  const { snapshot, tr, isOnline, canDrilldownDashboard } = useApp();
  if (!snapshot) return null;
  const st = snapshot.stats;
  const sym = snapshot.settings?.currencySymbol || '₹';
  const d = (key: string, label: string) => (canDrilldownDashboard ? () => onDrill(key, label) : undefined);

  return (
    <div className="space-y-6">
      <LiveSyncHeaderBadge isLive={isOnline && st.isLive} syncedAt={snapshot.syncedAt} />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <KpiCard label={tr('totalMembers')} value={st.totalMembers} onClick={d('all_members', tr('totalMembers'))} />
        <KpiCard label={tr('activeMembers')} value={st.activeMembers} accent="text-emerald-700 dark:text-emerald-400" onClick={d('active_members', tr('activeMembers'))} />
        <KpiCard label={tr('inactiveMembers')} value={st.inactiveMembers} accent="text-slate-600 dark:text-slate-300" onClick={d('inactive_members', tr('inactiveMembers'))} />
        <KpiCard label={tr('monthlySavings')} value={formatCurrency(st.totalMonthlySavings, sym)} onClick={d('savings', tr('monthlySavings'))} />
        <KpiCard label={tr('totalSavings')} value={formatCurrency(st.totalSavings, sym)} accent="text-[#087443] dark:text-emerald-400" onClick={d('savings', tr('totalSavings'))} />
        <KpiCard label={tr('totalShares')} value={st.totalShares} onClick={d('shares', tr('totalShares'))} />
        <KpiCard label={tr('totalShareValue')} value={formatCurrency(st.totalShareValue, sym)} onClick={d('shares', tr('totalShareValue'))} />
        <KpiCard label={tr('totalLoanDisbursed')} value={formatCurrency(st.totalLoanDisbursed, sym)} onClick={d('all_loans', tr('totalLoanDisbursed'))} />
        <KpiCard label={tr('totalLoanBalance')} value={formatCurrency(st.totalLoanBalance, sym)} accent="text-amber-700 dark:text-amber-400" onClick={d('active_loans', tr('totalLoanBalance'))} />
        <KpiCard label={tr('totalLoanInterest')} value={formatCurrency(st.totalLoanInterest, sym)} onClick={d('repayments', tr('totalLoanInterest'))} />
        <KpiCard label={tr('totalLoanFine')} value={formatCurrency(st.totalLoanFine, sym)} onClick={d('repayments', tr('totalLoanFine'))} />
        <KpiCard label={tr('activeLoans')} value={st.activeLoans} accent="text-[#087443] dark:text-emerald-400" onClick={d('active_loans', tr('activeLoans'))} />
        <KpiCard label={tr('closedLoans')} value={st.closedLoans} onClick={d('closed_loans', tr('closedLoans'))} />
        <KpiCard label={tr('inactiveLoans')} value={st.inactiveLoans} onClick={d('inactive_loans', tr('inactiveLoans'))} />
        <KpiCard label={tr('bankBalance')} value={formatCurrency(st.totalBankBalance, sym)} accent="text-blue-700 dark:text-blue-400" onClick={d('cashbook', tr('bankBalance'))} />
        <KpiCard label={tr('cashBalance')} value={formatCurrency(st.totalCashBalance, sym)} accent="text-emerald-700 dark:text-emerald-400" onClick={d('cashbook', tr('cashBalance'))} />
        <KpiCard label={tr('pendingLoanApps')} value={st.pendingLoanApplications} accent="text-amber-700 dark:text-amber-400" onClick={d('pending_loan_apps', tr('pendingLoanApps'))} />
        <KpiCard label={tr('pendingPayments')} value={st.pendingOnlinePayments} accent="text-amber-700 dark:text-amber-400" onClick={d('pending_payments', tr('pendingPayments'))} />
        <KpiCard label={tr('totalMeetings')} value={st.totalMeetings} onClick={d('meetings', tr('totalMeetings'))} />
      </div>

      <OperationalWidgetsRow />

      {/* Quick Governance Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { tab: 'permissions' as NavTabId, label: tr('nav_permissions') },
          { tab: 'google_sheets' as NavTabId, label: tr('nav_google_sheets') },
          { tab: 'google_drive' as NavTabId, label: tr('nav_google_drive') },
          { tab: 'backup_restore' as NavTabId, label: tr('nav_backup_restore') },
        ].map((q) => (
          <button
            key={q.tab}
            onClick={() => onNavigate(q.tab)}
            className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#087443] text-xs font-semibold text-[#142D4E] dark:text-white transition-colors"
          >
            <span className="truncate">{q.label}</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#087443] shrink-0" />
          </button>
        ))}
      </div>

      <DashboardCharts snapshot={snapshot} mode="system" />
    </div>
  );
};

// ==========================================
// PRESIDENT DASHBOARD OVERVIEW
// ==========================================
const PresidentOverview: React.FC<{ onNavigate: (t: NavTabId) => void; onDrill: (key: string, label: string) => void }> = ({
  onNavigate,
  onDrill,
}) => {
  const { snapshot, tr, isOnline, canDrilldownDashboard } = useApp();
  if (!snapshot) return null;
  const st = snapshot.stats;
  const sym = snapshot.settings?.currencySymbol || '₹';
  const d = (key: string, label: string) => (canDrilldownDashboard ? () => onDrill(key, label) : undefined);

  return (
    <div className="space-y-6">
      <LiveSyncHeaderBadge isLive={isOnline && st.isLive} syncedAt={snapshot.syncedAt} />

      {(st.pendingLoanApplications > 0 || st.pendingOnlinePayments > 0) && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs sm:text-sm">
              <p className="font-semibold text-amber-900 dark:text-amber-200">Executive Action Pending</p>
              <p className="text-amber-800 dark:text-amber-300">
                {st.pendingLoanApplications} loan application(s) awaiting decision · {st.pendingOnlinePayments} online payment(s) pending verification.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('loan_approval')}
            className="px-4 py-2 rounded-lg bg-[#087443] text-white text-xs font-semibold hover:bg-[#065c35] whitespace-nowrap"
          >
            Open Loan Approval Desk
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard label={tr('totalMembers')} value={st.totalMembers} onClick={d('all_members', tr('totalMembers'))} />
        <KpiCard label={tr('activeMembers')} value={st.activeMembers} accent="text-emerald-700 dark:text-emerald-400" onClick={d('active_members', tr('activeMembers'))} />
        <KpiCard label={tr('totalSavings')} value={formatCurrency(st.totalSavings, sym)} accent="text-[#087443] dark:text-emerald-400" onClick={d('savings', tr('totalSavings'))} />
        <KpiCard label={tr('totalShares')} value={st.totalShares} onClick={d('shares', tr('totalShares'))} />
        <KpiCard label={tr('totalShareValue')} value={formatCurrency(st.totalShareValue, sym)} onClick={d('shares', tr('totalShareValue'))} />
        <KpiCard label={tr('totalLoanDisbursed')} value={formatCurrency(st.totalLoanDisbursed, sym)} onClick={d('all_loans', tr('totalLoanDisbursed'))} />
        <KpiCard label={tr('totalLoanBalance')} value={formatCurrency(st.totalLoanBalance, sym)} accent="text-amber-700 dark:text-amber-400" onClick={d('active_loans', tr('totalLoanBalance'))} />
        <KpiCard label="Total Loan Repaid" value={formatCurrency(st.totalLoanRepaid, sym)} accent="text-emerald-700 dark:text-emerald-400" onClick={d('repayments', 'Total Loan Repaid')} />
        <KpiCard label={tr('bankBalance')} value={formatCurrency(st.totalBankBalance, sym)} accent="text-blue-700 dark:text-blue-400" onClick={d('cashbook', tr('bankBalance'))} />
        <KpiCard label={tr('cashBalance')} value={formatCurrency(st.totalCashBalance, sym)} accent="text-emerald-700 dark:text-emerald-400" onClick={d('cashbook', tr('cashBalance'))} />
        <KpiCard label={tr('pendingLoanApps')} value={st.pendingLoanApplications} accent="text-amber-700 dark:text-amber-400" onClick={d('pending_loan_apps', tr('pendingLoanApps'))} />
        <KpiCard label={tr('pendingPayments')} value={st.pendingOnlinePayments} accent="text-amber-700 dark:text-amber-400" onClick={d('pending_payments', tr('pendingPayments'))} />
      </div>

      <OperationalWidgetsRow />

      <DashboardCharts snapshot={snapshot} mode="president" />
    </div>
  );
};

// ==========================================
// SECRETARY DASHBOARD OVERVIEW
// ==========================================
const SecretaryOverview: React.FC<{ onNavigate: (t: NavTabId) => void; onDrill: (key: string, label: string) => void }> = ({
  onNavigate,
  onDrill,
}) => {
  const { snapshot, tr, isOnline, canDrilldownDashboard } = useApp();
  if (!snapshot) return null;
  const st = snapshot.stats;
  const sym = snapshot.settings?.currencySymbol || '₹';
  const today = new Date().toISOString().slice(0, 10);
  const todaysAttendance = snapshot.attendance.filter((a) => a.date === today && a.attendanceStatus === 'Present').length;
  const d = (key: string, label: string) => (canDrilldownDashboard ? () => onDrill(key, label) : undefined);

  return (
    <div className="space-y-6">
      <LiveSyncHeaderBadge isLive={isOnline && st.isLive} syncedAt={snapshot.syncedAt} />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard label={tr('totalMembers')} value={st.totalMembers} onClick={d('all_members', tr('totalMembers'))} />
        <KpiCard label={tr('activeMembers')} value={st.activeMembers} accent="text-emerald-700 dark:text-emerald-400" onClick={d('active_members', tr('activeMembers'))} />
        <KpiCard label={tr('monthlySavings')} value={formatCurrency(st.totalMonthlySavings, sym)} onClick={d('savings', tr('monthlySavings'))} />
        <KpiCard label={tr('totalSavings')} value={formatCurrency(st.totalSavings, sym)} accent="text-[#087443] dark:text-emerald-400" onClick={d('savings', tr('totalSavings'))} />
        <KpiCard label={tr('totalShares')} value={st.totalShares} onClick={d('shares', tr('totalShares'))} />
        <KpiCard label={tr('totalLoanDisbursed')} value={formatCurrency(st.totalLoanDisbursed, sym)} onClick={d('all_loans', tr('totalLoanDisbursed'))} />
        <KpiCard label={tr('totalLoanBalance')} value={formatCurrency(st.totalLoanBalance, sym)} accent="text-amber-700 dark:text-amber-400" onClick={d('active_loans', tr('totalLoanBalance'))} />
        <KpiCard label={tr('activeLoans')} value={st.activeLoans} onClick={d('active_loans', tr('activeLoans'))} />
        <KpiCard label={tr('bankBalance')} value={formatCurrency(st.totalBankBalance, sym)} accent="text-blue-700 dark:text-blue-400" onClick={d('cashbook', tr('bankBalance'))} />
        <KpiCard label={tr('cashBalance')} value={formatCurrency(st.totalCashBalance, sym)} accent="text-emerald-700 dark:text-emerald-400" onClick={d('cashbook', tr('cashBalance'))} />
        <KpiCard label={tr('pendingPayments')} value={st.pendingOnlinePayments} accent="text-amber-700 dark:text-amber-400" onClick={d('pending_payments', tr('pendingPayments'))} />
        <KpiCard label={tr('totalMeetings')} value={st.totalMeetings} onClick={d('meetings', tr('totalMeetings'))} />
        <KpiCard label="Today's Attendance (Present)" value={todaysAttendance} sub={`Date: ${today}`} onClick={d('attendance', "Today's Attendance")} />
      </div>

      <OperationalWidgetsRow />

      {/* Daily Operations Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { tab: 'savings' as NavTabId, label: 'Record Saving' },
          { tab: 'loan_repayment' as NavTabId, label: 'Loan Repayment' },
          { tab: 'attendance' as NavTabId, label: 'Mark Attendance' },
          { tab: 'payment_verification' as NavTabId, label: 'Verify Payments' },
        ].map((q) => (
          <button
            key={q.tab}
            onClick={() => onNavigate(q.tab)}
            className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#087443] text-xs font-semibold text-[#142D4E] dark:text-white transition-colors"
          >
            <span className="truncate">{q.label}</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#087443] shrink-0" />
          </button>
        ))}
      </div>

      <DashboardCharts snapshot={snapshot} mode="secretary" />
    </div>
  );
};

// ==========================================
// MEMBER DASHBOARD OVERVIEW (100% PERSONAL ISOLATION)
// ==========================================
const MemberOverview: React.FC<{ onNavigate: (t: NavTabId) => void; onDrill: (key: string, label: string) => void }> = ({
  onNavigate,
  onDrill,
}) => {
  const { session, snapshot, tr, isOnline, canDrilldownDashboard } = useApp();
  if (!snapshot || !session) return null;

  const sym = snapshot.settings?.currencySymbol || '₹';
  const myId = session.user.memberId;
  const profile = snapshot.members.find((m) => m.memberId === myId) || session.memberProfile || null;

  const mySavings = snapshot.savings.filter((s) => s.memberId === myId);
  const myShares = snapshot.shares.filter((s) => s.memberId === myId);
  const myLoans = snapshot.loans.filter((l) => l.memberId === myId);
  const myPayments = snapshot.onlinePayments.filter((p) => p.memberId === myId);

  const curMonthPrefix = new Date().toISOString().slice(0, 7);
  const totalSavings = mySavings.reduce((acc, s) => acc + Number(s.totalSaving || 0), 0);
  const currentMonthSaving = mySavings
    .filter((s) => (s.date || '').startsWith(curMonthPrefix))
    .reduce((acc, s) => acc + Number(s.monthlySavingAmount || 0), 0);
  const totalSavingInterest = mySavings.reduce((acc, s) => acc + Number(s.interest || 0), 0);
  const totalSavingFine = mySavings.reduce((acc, s) => acc + Number(s.fine || 0), 0);

  const totalShares = myShares.reduce((acc, s) => acc + Number(s.numberOfShares || 0), 0);
  const totalShareValue = myShares.reduce((acc, s) => acc + Number(s.totalShareValue || 0), 0);

  const latestLoanByNum = useMemo(() => {
    const map: Record<string, (typeof myLoans)[number]> = {};
    for (const l of myLoans) {
      map[l.loanNumber || l.loanId] = l;
    }
    return Object.values(map);
  }, [myLoans]);

  const activeLoanBalance = latestLoanByNum
    .filter((l) => l.loanStatus === 'Active' || l.loanStatus === 'Running')
    .reduce((acc, l) => acc + Number(l.currentLoanBalance || 0), 0);
  const totalLoanRepaid = myLoans.reduce((acc, l) => acc + Number(l.loanRepayment || 0), 0);
  const totalLoanInterest = myLoans.reduce((acc, l) => acc + Number(l.interest || 0), 0);
  const totalLoanFine = myLoans.reduce((acc, l) => acc + Number(l.fine || 0), 0);
  const nextDue =
    latestLoanByNum
      .filter((l) => (l.loanStatus === 'Active' || l.loanStatus === 'Running') && l.nextDueDate)
      .map((l) => l.nextDueDate)
      .sort()[0] || 'No Active Due';

  const pendingPayments = myPayments.filter((p) => p.verificationStatus === 'Pending').length;

  const recentTransactions = useMemo(() => {
    const list: Array<{ id: string; date: string; type: string; amount: number; status: string }> = [
      ...mySavings.map((s) => ({
        id: s.savingId,
        date: s.date,
        type: 'Saving Entry',
        amount: s.totalSaving,
        status: s.paymentStatus,
      })),
      ...myLoans.map((l) => ({
        id: l.loanId,
        date: l.loanDate,
        type: l.isDisbursement ? 'Loan Disbursement' : 'Loan Repayment',
        amount: l.isDisbursement ? l.loanAmount : l.loanRepayment,
        status: l.paymentStatus,
      })),
      ...myPayments.map((p) => ({
        id: p.paymentId,
        date: p.date,
        type: `Online (${p.paymentMethod})`,
        amount: p.amount,
        status: p.verificationStatus,
      })),
    ];
    return list.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  }, [myLoans, myPayments, mySavings]);

  const d = (key: string, label: string) => (canDrilldownDashboard ? () => onDrill(key, label) : undefined);

  return (
    <div className="space-y-6">
      <LiveSyncHeaderBadge isLive={isOnline && snapshot.stats.isLive} syncedAt={snapshot.syncedAt} />

      {/* Member Identity Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {profile?.photoUrl ? (
            <img
              src={profile.photoUrl}
              alt={profile.memberName}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-[#142D4E] text-white flex items-center justify-center text-xl font-bold">
              {(session.user.fullName || 'M').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="font-display text-lg font-bold text-[#142D4E] dark:text-white">
              {profile?.memberName || session.user.fullName}
            </h2>
            <p className="text-xs text-[#667085] dark:text-slate-400 font-mono-tabular mt-0.5">
              {myId || 'Member'} · {profile?.mobileNumber || session.user.mobileNumber}
            </p>
            <div className="mt-1.5">
              <StatusLabel status={profile?.accountStatus || session.user.accountStatus} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onNavigate('online_payments')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#087443] text-white text-xs font-semibold hover:bg-[#065c35]"
          >
            <QrCode className="w-4 h-4" />
            <span>Pay Online</span>
          </button>
          <button
            onClick={() => onNavigate('apply_loan')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <FileCheck2 className="w-4 h-4 text-[#087443]" />
            <span>{tr('nav_apply_loan')}</span>
          </button>
        </div>
      </div>

      {/* Personal Financial Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard label="My Total Savings" value={formatCurrency(totalSavings, sym)} accent="text-[#087443] dark:text-emerald-400" onClick={d('savings', 'My Total Savings')} />
        <KpiCard label="Current Month Saving" value={formatCurrency(currentMonthSaving, sym)} onClick={d('savings', 'Current Month Saving')} />
        <KpiCard label="Saving + Loan Interest" value={formatCurrency(totalSavingInterest + totalLoanInterest, sym)} onClick={d('savings', 'Interest History')} />
        <KpiCard label="Total Fine Paid" value={formatCurrency(totalSavingFine + totalLoanFine, sym)} onClick={d('savings', 'Fine History')} />
        <KpiCard label="My Total Shares" value={totalShares} onClick={d('shares', 'My Total Shares')} />
        <KpiCard label="My Share Value" value={formatCurrency(totalShareValue, sym)} onClick={d('shares', 'My Share Value')} />
        <KpiCard label="Active Loan Balance" value={formatCurrency(activeLoanBalance, sym)} accent="text-amber-700 dark:text-amber-400" onClick={d('active_loans', 'Active Loan Balance')} />
        <KpiCard label="Total Loan Repaid" value={formatCurrency(totalLoanRepaid, sym)} accent="text-emerald-700 dark:text-emerald-400" onClick={d('repayments', 'My Loan Repayments')} />
        <KpiCard label={tr('nextDueDate')} value={nextDue} onClick={d('active_loans', 'Upcoming Loan Dues')} />
        <KpiCard label="Pending Online Payments" value={pendingPayments} accent="text-amber-700 dark:text-amber-400" onClick={d('pending_payments', 'My Pending Online Payments')} />
      </div>

      {/* Quick Member Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { tab: 'id_cards' as NavTabId, label: tr('nav_my_id_card'), icon: CreditCard },
          { tab: 'certificates' as NavTabId, label: tr('nav_my_certificate'), icon: Award },
          { tab: 'savings' as NavTabId, label: tr('nav_my_savings'), icon: PiggyBank },
          { tab: 'loans' as NavTabId, label: tr('nav_my_loan'), icon: Landmark },
        ].map((q) => {
          const Icon = q.icon;
          return (
            <button
              key={q.tab}
              onClick={() => onNavigate(q.tab)}
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#087443] text-xs font-semibold text-[#142D4E] dark:text-white transition-colors"
            >
              <Icon className="w-4 h-4 text-[#087443] shrink-0" />
              <span className="truncate">{q.label}</span>
            </button>
          );
        })}
      </div>

      {/* Recent Personal Transactions */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-bold text-[#142D4E] dark:text-white mb-4">Recent Personal Transactions</h3>
        {recentTransactions.length === 0 ? (
          <p className="text-xs text-[#667085] dark:text-slate-400 py-4">No personal transactions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2 pr-3">Reference</th>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                  <th className="py-2 pl-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="py-2.5 pr-3 font-mono-tabular font-medium">{tx.id}</td>
                    <td className="py-2.5 px-3 font-mono-tabular">{tx.date}</td>
                    <td className="py-2.5 px-3">{tx.type}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold">{formatCurrency(tx.amount, sym)}</td>
                    <td className="py-2.5 pl-3">
                      <StatusLabel status={tx.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// OFFICER PROFILE VIEW (President / Secretary)
// ==========================================
const OfficerProfileView: React.FC = () => {
  const { session } = useApp();
  if (!session) return null;
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-[#142D4E] text-white flex items-center justify-center">
            <BadgeCheck className="w-6 h-6 text-[#D5A642]" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-[#142D4E] dark:text-white">{session.user.fullName}</h2>
            <p className="text-xs text-[#667085] dark:text-slate-400">
              {session.user.role} · {session.user.userId}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border-t border-slate-100 dark:border-slate-800 pt-4">
          <div>
            <dt className="text-slate-500">Registered Mobile</dt>
            <dd className="font-mono-tabular font-semibold mt-0.5">{session.user.mobileNumber}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Account Status</dt>
            <dd className="mt-0.5"><StatusLabel status={session.user.accountStatus} /></dd>
          </div>
          {session.user.email && (
            <div>
              <dt className="text-slate-500">Email</dt>
              <dd className="font-medium mt-0.5">{session.user.email}</dd>
            </div>
          )}
          <div>
            <dt className="text-slate-500">Last Login</dt>
            <dd className="font-mono-tabular mt-0.5">
              {session.user.lastLoginAt ? new Date(session.user.lastLoginAt).toLocaleString() : 'Active Session'}
            </dd>
          </div>
        </dl>
      </div>
      <SecurityAndCredentialsView />
    </div>
  );
};

// ==========================================
// MAIN ROLE DASHBOARD ROUTER
// ==========================================
export const RoleDashboards: React.FC = () => {
  const { session, snapshot, tr, modals, openModal, closeModal } = useApp();
  const [activeTab, setActiveTab] = useState<NavTabId>('dashboard');
  const [drilldown, setDrilldown] = useState<DrilldownData | null>(null);

  if (!session) return null;
  const role = session.user.role;
  const isMember = role === 'Member';
  const settings = snapshot?.settings!;

  const handleDrill = (key: string, label: string) => {
    if (!snapshot) return;
    const myId = session.user.memberId;
    const scopeMembers = isMember ? snapshot.members.filter((m) => m.memberId === myId) : snapshot.members;
    const scopeSavings = isMember ? snapshot.savings.filter((s) => s.memberId === myId) : snapshot.savings;
    const scopeShares = isMember ? snapshot.shares.filter((s) => s.memberId === myId) : snapshot.shares;
    const scopeLoans = isMember ? snapshot.loans.filter((l) => l.memberId === myId) : snapshot.loans;
    const scopeRepays = isMember ? (snapshot.loanRepayments || []).filter((r) => r.memberId === myId) : snapshot.loanRepayments || [];
    const scopeApps = isMember ? snapshot.loanApplications.filter((a) => a.memberId === myId) : snapshot.loanApplications;
    const scopePays = isMember ? snapshot.onlinePayments.filter((p) => p.memberId === myId) : snapshot.onlinePayments;

    let data: DrilldownData = { title: label, headers: [], rows: [] };
    switch (key) {
      case 'all_members':
      case 'active_members':
      case 'inactive_members': {
        const list =
          key === 'active_members'
            ? scopeMembers.filter((m) => m.accountStatus === 'Active')
            : key === 'inactive_members'
              ? scopeMembers.filter((m) => m.accountStatus === 'Inactive')
              : scopeMembers;
        data = {
          title: label,
          headers: ['Member ID', 'Name', 'Mobile', 'Join Date', 'Village', 'Status'],
          rows: list.map((m) => [m.memberId, m.memberName, m.mobileNumber, m.joinDate, m.village || '—', m.accountStatus]),
          targetTab: 'members',
        };
        break;
      }
      case 'savings':
        data = {
          title: label,
          headers: ['Saving ID', 'Date', 'Member', 'Monthly', 'Previous', 'Interest', 'Fine', 'Total'],
          rows: scopeSavings.map((s) => [
            s.savingId,
            s.date,
            `${s.memberName} (${s.memberId})`,
            s.monthlySavingAmount,
            s.previousSavingAmount || 0,
            s.interest,
            s.fine,
            s.totalSaving,
          ]),
          targetTab: 'savings',
        };
        break;
      case 'shares':
        data = {
          title: label,
          headers: ['Share ID', 'Date', 'Member', 'Shares', 'Face Value', 'Total Value'],
          rows: scopeShares.map((s) => [s.shareId, s.date, `${s.memberName} (${s.memberId})`, s.numberOfShares, s.faceValuePerShare, s.totalShareValue]),
          targetTab: 'shares',
        };
        break;
      case 'all_loans':
      case 'active_loans':
      case 'closed_loans':
      case 'inactive_loans': {
        const list =
          key === 'active_loans'
            ? scopeLoans.filter((l) => l.loanStatus === 'Active' || l.loanStatus === 'Running')
            : key === 'closed_loans'
              ? scopeLoans.filter((l) => l.loanStatus === 'Close')
              : key === 'inactive_loans'
                ? scopeLoans.filter((l) => l.loanStatus === 'Inactive')
                : scopeLoans;
        data = {
          title: label,
          headers: ['Loan No', 'Date', 'Member', 'Disbursed', 'Repaid', 'Balance', 'Status'],
          rows: list.map((l) => [l.loanNumber, l.loanDate, `${l.memberName} (${l.memberId})`, l.loanAmount, l.loanRepayment, l.currentLoanBalance, l.loanStatus]),
          targetTab: 'loans',
        };
        break;
      }
      case 'repayments':
        data = {
          title: label,
          headers: ['Repayment ID', 'Date', 'Loan No', 'Member', 'Principal', 'Interest', 'Fine', 'Total Paid', 'Bal After'],
          rows: scopeRepays.map((r) => [r.repaymentId, r.date, r.loanNumber, r.memberName, r.principalPaid, r.interestPaid, r.finePaid, r.totalPaid, r.loanBalanceAfter]),
          targetTab: isMember ? 'loans' : 'loan_repayment',
        };
        break;
      case 'cashbook':
        data = {
          title: label,
          headers: ['Txn ID', 'Date', 'Mode', 'Description', 'Bank', 'Cash', 'Total'],
          rows: snapshot.cashBook.map((c) => [c.transactionId, c.date, c.paymentMode, c.description, c.bankAmount, c.cashAmount, c.totalAmount]),
          targetTab: 'cashbook',
        };
        break;
      case 'pending_loan_apps': {
        const list = scopeApps.filter((a) => ['Pending', 'Under Review', 'Recommended'].includes(a.applicationStatus));
        data = {
          title: label,
          headers: ['App ID', 'Date', 'Applicant', 'Requested', 'Purpose', 'Status'],
          rows: list.map((a) => [a.applicationId, a.applicationDate, a.memberName, a.loanAmountRequired, a.purposeOfLoan, a.applicationStatus]),
          targetTab: isMember ? 'apply_loan' : 'loan_applications',
        };
        break;
      }
      case 'pending_payments': {
        const list = scopePays.filter((p) => p.verificationStatus === 'Pending');
        data = {
          title: label,
          headers: ['Payment ID', 'Date', 'Member', 'Amount', 'Category', 'UPI Txn ID', 'Status'],
          rows: list.map((p) => [p.paymentId, p.date, p.memberName, p.amount, p.paymentMethod, p.upiTransactionId, p.verificationStatus]),
          targetTab: isMember ? 'payment_history' : 'online_payments',
        };
        break;
      }
      case 'meetings':
        data = {
          title: label,
          headers: ['Meeting No', 'Date', 'Type', 'Location', 'Agenda'],
          rows: snapshot.meetings.map((m) => [m.meetingNumber, m.meetingDate, m.meetingType, m.meetingLocation, m.meetingAgenda || '—']),
          targetTab: 'meetings',
        };
        break;
      case 'attendance': {
        const today = new Date().toISOString().slice(0, 10);
        const list = snapshot.attendance.filter((a) => a.date === today);
        data = {
          title: label,
          headers: ['Meeting No', 'Date', 'Member ID', 'Member Name', 'Status'],
          rows: list.map((a) => [a.meetingNumber, a.date, a.memberId, a.memberName, a.attendanceStatus]),
          targetTab: 'attendance',
        };
        break;
      }
      default:
        break;
    }

    setDrilldown(data);
    openModal('kpiDrilldownModal');
  };

  const renderContent = () => {
    if (!snapshot) {
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-sm text-slate-500">
          Loading authorized society workspace...
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        if (role === 'System') return <SystemOverview onNavigate={setActiveTab} onDrill={handleDrill} />;
        if (role === 'President') return <PresidentOverview onNavigate={setActiveTab} onDrill={handleDrill} />;
        if (role === 'Secretary') return <SecretaryOverview onNavigate={setActiveTab} onDrill={handleDrill} />;
        return <MemberOverview onNavigate={setActiveTab} onDrill={handleDrill} />;

      case 'members':
        return <MemberRegisterView readOnlyOwn={isMember} />;
      case 'my_profile':
        return isMember ? (
          <div className="space-y-6">
            <MemberRegisterView readOnlyOwn />
            <SecurityAndCredentialsView />
          </div>
        ) : (
          <OfficerProfileView />
        );

      case 'member_pin':
        return role === 'System' ? <UsersAndPinManagerView focus="members" /> : null;
      case 'officer_mgr':
        return role === 'System' ? <UsersAndPinManagerView focus="officers" /> : null;
      case 'president_mgr':
        return role === 'System' ? <UsersAndPinManagerView focus="President" /> : null;
      case 'secretary_mgr':
        return role === 'System' ? <UsersAndPinManagerView focus="Secretary" /> : null;

      case 'savings':
        return <SavingRegisterView readOnlyOwn={isMember} />;
      case 'shares':
        return <ShareRegisterView readOnlyOwn={isMember} />;
      case 'loans':
        return <LoanRegisterView readOnlyOwn={isMember} />;
      case 'loan_repayment':
        return <LoanRepaymentView readOnlyOwn={isMember} />;
      case 'cashbook':
        return isMember ? null : <CashBookView />;
      case 'cashbook_summary':
        return isMember ? null : <CashBookSummaryView onOpenRegister={() => setActiveTab('cashbook')} />;

      case 'meetings':
        return isMember ? null : <MeetingsView />;
      case 'attendance':
        return <AttendanceRegisterView readOnlyOwn={isMember} />;

      case 'loan_applications':
      case 'apply_loan':
        return <LoanApplicationView approvalMode={false} />;
      case 'loan_approval':
        return role === 'System' || role === 'President' ? <LoanApplicationView approvalMode /> : null;

      case 'online_payments':
      case 'payment_history':
        return <OnlinePaymentView verificationDesk={false} />;
      case 'payment_verification':
        return role === 'System' || role === 'Secretary' ? <OnlinePaymentView verificationDesk /> : null;

      case 'id_certificates':
        return <IdAndCertificateHub onlyOwn={isMember} defaultTab="id" />;
      case 'id_cards':
        return <IdAndCertificateHub onlyOwn={isMember} defaultTab="id" />;
      case 'certificates':
        return <IdAndCertificateHub onlyOwn={isMember} defaultTab="cert" />;

      case 'notices':
        return <NoticeBoardView />;
      case 'notifications':
        return <NotificationsCenterView />;
      case 'reports':
        return <ReportsCenterView />;

      case 'media_manager':
        return role === 'System' ? <SocietySettingsView section="media" /> : null;
      case 'theme_manager':
        return role === 'System' ? <SocietySettingsView section="theme" /> : null;
      case 'society_settings':
        return role === 'System' ? <SocietySettingsView section="settings" /> : null;
      case 'content_manager':
        return role === 'System' ? <SocietySettingsView section="content" /> : null;

      case 'permissions':
        return role === 'System' ? <PermissionSwitchboardView /> : null;
      case 'google_sheets':
        return role === 'System' ? <GoogleSheetsIntegrationView /> : null;
      case 'google_drive':
        return role === 'System' ? <GoogleDriveIntegrationView /> : null;
      case 'firebase_setup':
        return role === 'System' ? <AdminFirebaseSetupView /> : null;
      case 'backup_restore':
        return role === 'System' ? <BackupAndRestoreView /> : null;
      case 'offline_sync':
        return <OfflineSyncAndConflictView />;
      case 'audit_log':
        return role === 'System' ? <AuditLogView /> : null;
      case 'security':
        return role === 'System' ? <SecurityAndCredentialsView /> : null;

      default:
        return null;
    }
  };

  const loanAppsHeaders = ['App ID', 'Date', 'Member', 'Requested', 'Approved', 'Purpose', 'Status'];
  const loanAppsRows = (snapshot?.loanApplications || []).map((a) => [
    a.applicationId,
    a.applicationDate,
    `${a.memberName} (${a.memberId})`,
    a.loanAmountRequired,
    a.approvedAmount || 0,
    a.purposeOfLoan,
    a.applicationStatus,
  ]);

  const onlinePayHeaders = ['Payment ID', 'Date', 'Member', 'Category', 'Amount', 'UPI Txn ID', 'Status'];
  const onlinePayRows = (snapshot?.onlinePayments || []).map((p) => [
    p.paymentId,
    p.date,
    `${p.memberName} (${p.memberId})`,
    p.paymentMethod,
    p.amount,
    p.upiTransactionId,
    p.verificationStatus,
  ]);

  return (
    <AppShell activeTab={activeTab} onSelectTab={setActiveTab}>
      {session.user.mustChangePassword && activeTab !== 'security' && activeTab !== 'my_profile' && (
        <div className="mb-6 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs sm:text-sm text-red-800 dark:text-red-200">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <p className="font-bold">Security Action Required: Update Your Temporary Credentials</p>
              <p className="text-xs opacity-90">
                Please change your initial password or PIN before continuing society administration.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab(role === 'System' ? 'security' : 'my_profile')}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold whitespace-nowrap"
          >
            Update Credentials Now
          </button>
        </div>
      )}

      {renderContent()}

      {/* Global Modal: KPI Drilldown */}
      {modals.kpiDrilldownModal && drilldown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 no-print">
          <div className="w-full max-w-4xl max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-[#142D4E] dark:text-white">{drilldown.title}</h3>
                <p className="text-xs text-slate-500">{drilldown.rows.length} matching record(s)</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportTableToPdf(drilldown.title, drilldown.headers, drilldown.rows, settings, 'GMCSL_KPI_Drilldown')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
                >
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
                <button
                  type="button"
                  onClick={() => exportTableToExcel('Drilldown', drilldown.headers, drilldown.rows, 'GMCSL_KPI_Drilldown')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
                >
                  Excel
                </button>
                <button
                  type="button"
                  onClick={() => exportTableToCsv(drilldown.headers, drilldown.rows, 'GMCSL_KPI_Drilldown')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeModal('kpiDrilldownModal');
                    setDrilldown(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {drilldown.rows.length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-500">No records found for this metric.</p>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/70 border-b">
                      {drilldown.headers.map((h) => (
                        <th key={h} className="py-2 px-3 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {drilldown.rows.map((r, idx) => (
                      <tr key={idx}>
                        {r.map((cell, ci) => (
                          <td key={ci} className="py-2 px-3 font-mono-tabular">{String(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              {drilldown.targetTab ? (
                <button
                  type="button"
                  onClick={() => {
                    const t = drilldown.targetTab!;
                    closeModal('kpiDrilldownModal');
                    setDrilldown(null);
                    setActiveTab(t);
                  }}
                  className="text-xs font-semibold text-[#087443] hover:underline"
                >
                  Open Full Module →
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => {
                  closeModal('kpiDrilldownModal');
                  setDrilldown(null);
                }}
                className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                {tr('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Modal: Loan Applications Widget List */}
      {modals.loanAppsWidgetModal && snapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 no-print">
          <div className="w-full max-w-4xl max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-[#142D4E] dark:text-white">
                  {tr('nav_loan_applications')} ({snapshot.loanApplications.length})
                </h3>
                <p className="text-xs text-slate-500">All submitted loan applications and current approval decisions.</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => exportTableToPdf('Loan Applications', loanAppsHeaders, loanAppsRows, settings, 'GMCSL_Loan_Applications')} className="px-2.5 py-1.5 rounded-lg border text-xs font-medium">PDF</button>
                <button type="button" onClick={() => exportTableToExcel('LoanApps', loanAppsHeaders, loanAppsRows, 'GMCSL_Loan_Applications')} className="px-2.5 py-1.5 rounded-lg border text-xs font-medium">Excel</button>
                <button type="button" onClick={() => exportTableToCsv(loanAppsHeaders, loanAppsRows, 'GMCSL_Loan_Applications')} className="px-2.5 py-1.5 rounded-lg border text-xs font-medium">CSV</button>
                <button type="button" onClick={() => closeModal('loanAppsWidgetModal')} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {snapshot.loanApplications.length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-500">No loan applications submitted yet.</p>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/70 border-b">
                      <th className="py-2 px-3">App ID</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Applicant</th>
                      <th className="py-2 px-3">Purpose</th>
                      <th className="py-2 px-3 text-right">Requested</th>
                      <th className="py-2 px-3 text-right">Approved</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {snapshot.loanApplications.map((a) => (
                      <tr key={a.applicationId}>
                        <td className="py-2 px-3 font-mono-tabular font-semibold">{a.applicationId}</td>
                        <td className="py-2 px-3 font-mono-tabular">{a.applicationDate}</td>
                        <td className="py-2 px-3">{a.memberName} ({a.memberId})</td>
                        <td className="py-2 px-3">{a.purposeOfLoan}</td>
                        <td className="py-2 px-3 text-right font-mono-tabular">₹{a.loanAmountRequired.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono-tabular">{a.approvedAmount ? `₹${a.approvedAmount.toFixed(2)}` : '—'}</td>
                        <td className="py-2 px-3"><StatusLabel status={a.applicationStatus} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  closeModal('loanAppsWidgetModal');
                  setActiveTab('loan_applications');
                }}
                className="text-xs font-semibold text-[#087443] hover:underline"
              >
                Go to Loan Applications →
              </button>
              <button
                type="button"
                onClick={() => closeModal('loanAppsWidgetModal')}
                className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                {tr('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Modal: Online Payments Widget List */}
      {modals.onlinePaymentsWidgetModal && snapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 no-print">
          <div className="w-full max-w-4xl max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-[#142D4E] dark:text-white">
                  {tr('nav_online_payments')} ({snapshot.onlinePayments.length})
                </h3>
                <p className="text-xs text-slate-500">All member UPI payment proofs and verification statuses.</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => exportTableToPdf('Online Payments', onlinePayHeaders, onlinePayRows, settings, 'GMCSL_Online_Payments')} className="px-2.5 py-1.5 rounded-lg border text-xs font-medium">PDF</button>
                <button type="button" onClick={() => exportTableToExcel('OnlinePayments', onlinePayHeaders, onlinePayRows, 'GMCSL_Online_Payments')} className="px-2.5 py-1.5 rounded-lg border text-xs font-medium">Excel</button>
                <button type="button" onClick={() => exportTableToCsv(onlinePayHeaders, onlinePayRows, 'GMCSL_Online_Payments')} className="px-2.5 py-1.5 rounded-lg border text-xs font-medium">CSV</button>
                <button type="button" onClick={() => closeModal('onlinePaymentsWidgetModal')} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {snapshot.onlinePayments.length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-500">No online payments submitted yet.</p>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/70 border-b">
                      <th className="py-2 px-3">Payment ID</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Member</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3">UPI Txn ID</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {snapshot.onlinePayments.map((p) => (
                      <tr key={p.paymentId}>
                        <td className="py-2 px-3 font-mono-tabular font-semibold">{p.paymentId}</td>
                        <td className="py-2 px-3 font-mono-tabular">{p.date}</td>
                        <td className="py-2 px-3">{p.memberName} ({p.memberId})</td>
                        <td className="py-2 px-3">{p.paymentMethod}</td>
                        <td className="py-2 px-3 font-mono-tabular">{p.upiTransactionId}</td>
                        <td className="py-2 px-3 text-right font-mono-tabular font-semibold">₹{p.amount.toFixed(2)}</td>
                        <td className="py-2 px-3"><StatusLabel status={p.verificationStatus} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  closeModal('onlinePaymentsWidgetModal');
                  setActiveTab(role === 'Secretary' || role === 'System' ? 'payment_verification' : 'online_payments');
                }}
                className="text-xs font-semibold text-[#2563EB] hover:underline"
              >
                Go to Online Payments →
              </button>
              <button
                type="button"
                onClick={() => closeModal('onlinePaymentsWidgetModal')}
                className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                {tr('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};
