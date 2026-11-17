import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Printer,
  RefreshCw,
  Search,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { usePWAInstall, useServiceWorkerUpdates } from '../hooks/usePWA';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useApp();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0 no-print">
      {toasts.map((t) => {
        const styles =
          t.type === 'success'
            ? 'bg-emerald-700 text-white border-emerald-600'
            : t.type === 'error'
              ? 'bg-red-700 text-white border-red-600'
              : t.type === 'warning'
                ? 'bg-amber-600 text-white border-amber-500'
                : 'bg-[#142D4E] text-white border-slate-700';
        const Icon =
          t.type === 'success'
            ? CheckCircle2
            : t.type === 'error'
              ? XCircle
              : t.type === 'warning'
                ? AlertTriangle
                : Info;
        return (
          <div
            key={t.id}
            role="status"
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg text-sm transition-all ${styles}`}
          >
            <Icon className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              onClick={() => dismissToast(t.id)}
              aria-label="Close notification"
              className="opacity-80 hover:opacity-100 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export const ConfirmModal: React.FC = () => {
  const { modals, confirmState, confirmBusy, resolveConfirm, tr } = useApp();
  if (!modals.confirm || !confirmState) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[1px] no-print">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-[#1D2939] dark:text-slate-100">{confirmState.title}</h3>
        <p className="mt-2 text-sm text-[#667085] dark:text-slate-300 leading-relaxed">{confirmState.message}</p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={confirmBusy}
            onClick={() => resolveConfirm(false)}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap disabled:opacity-50"
          >
            {tr('cancel')}
          </button>
          <button
            type="button"
            disabled={confirmBusy}
            onClick={() => resolveConfirm(true)}
            className={`px-4 py-2 text-sm font-medium rounded-lg text-white whitespace-nowrap disabled:opacity-60 ${
              confirmState.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#087443] hover:bg-[#065c35]'
            }`}
          >
            {confirmBusy ? 'Processing...' : confirmState.confirmLabel || tr('confirmAction')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { tr, modals, openModal, closeModal } = useApp();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`flex items-center gap-2 rounded-lg bg-[#087443] text-white font-medium hover:bg-[#065c35] transition-colors whitespace-nowrap shrink-0 ${
          compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
        }`}
      >
        <Download className="w-4 h-4" />
        <span>{tr('installApp')}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => openModal('iosInstallGuide')}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{tr('installApp')}</span>
        </button>
        {modals.iosInstallGuide && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-700 shadow-xl">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Install GMCSL on iPhone / iPad</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                1. Tap the <strong>Share</strong> icon in Safari.<br />
                2. Select <strong>Add to Home Screen</strong>.
              </p>
              <button
                type="button"
                onClick={() => closeModal('iosInstallGuide')}
                className="mt-4 w-full rounded-lg bg-[#087443] py-2 text-sm font-medium text-white"
              >
                {tr('cancel')}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const SWUpdateBanner: React.FC = () => {
  const { tr } = useApp();
  const { needRefresh, applyUpdate, dismissUpdate } = useServiceWorkerUpdates();

  if (!needRefresh) return null;

  return (
    <div className="bg-[#142D4E] text-white px-4 py-2.5 text-xs sm:text-sm flex items-center justify-between gap-4 border-b border-[#D5A642]/40 no-print">
      <div className="flex items-center gap-2">
        <RefreshCw className="w-4 h-4 text-[#D5A642] shrink-0" />
        <span>{tr('updateAvailable')} Unsynchronized offline records are preserved safely.</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={applyUpdate}
          className="px-3 py-1 rounded bg-[#D5A642] text-[#142D4E] font-semibold hover:bg-[#c59635] whitespace-nowrap"
        >
          {tr('updateNow')}
        </button>
        <button onClick={dismissUpdate} className="text-slate-300 hover:text-white p-1" aria-label="Dismiss update">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export const StatusLabel: React.FC<{ status: string }> = ({ status }) => {
  const norm = status.toLowerCase();
  let color = 'text-slate-600 dark:text-slate-300';
  let Icon = Info;
  if (['active', 'verified', 'approved', 'synced', 'present', 'completed', 'close', 'running'].includes(norm)) {
    color = 'text-emerald-700 dark:text-emerald-400';
    Icon = CheckCircle2;
  } else if (['pending', 'under review', 'recommended', 'syncing', 'requires review'].includes(norm)) {
    color = 'text-amber-700 dark:text-amber-400';
    Icon = AlertTriangle;
  } else if (['rejected', 'inactive', 'failed', 'conflict', 'absent', 'cancelled', 'locked'].includes(norm)) {
    color = 'text-red-700 dark:text-red-400';
    Icon = XCircle;
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${color}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{status}</span>
    </span>
  );
};

export const EmptyState: React.FC<{ title: string; subtitle: string; actionLabel?: string; onAction?: () => void }> = ({
  title,
  subtitle,
  actionLabel,
  onAction,
}) => (
  <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-10 text-center">
    <p className="text-base font-semibold text-[#1D2939] dark:text-slate-100">{title}</p>
    <p className="mt-1 text-sm text-[#667085] dark:text-slate-400 max-w-md mx-auto">{subtitle}</p>
    {actionLabel && onAction && (
      <button
        onClick={onAction}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#087443] px-4 py-2 text-sm font-medium text-white hover:bg-[#065c35]"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export const FileUploadField: React.FC<{
  label: string;
  value?: string;
  accept?: string;
  onChange: (dataUrl: string, fileName: string) => void;
  required?: boolean;
}> = ({ label, value, accept = 'image/*', onChange, required }) => {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 960;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          onChange(canvas.toDataURL('image/jpeg', 0.8), file.name);
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => onChange(String(reader.result), file.name);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <div className="flex items-center gap-3">
        <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">
          <Upload className="w-3.5 h-3.5" />
          <span>Choose File</span>
          <input type="file" accept={accept} onChange={handleFile} className="hidden" />
        </label>
        {value && value.startsWith('data:image') && (
          <img
            src={value}
            alt={label}
            referrerPolicy="no-referrer"
            className="h-10 w-10 rounded border border-slate-200 dark:border-slate-700 object-cover"
          />
        )}
        {value && !value.startsWith('data:image') && (
          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">File attached</span>
        )}
      </div>
    </div>
  );
};

export const DataToolbar: React.FC<{
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter?: string;
  onStatusChange?: (v: string) => void;
  statusOptions?: string[];
  dateFrom?: string;
  onDateFromChange?: (v: string) => void;
  dateTo?: string;
  onDateToChange?: (v: string) => void;
  sortDir?: 'asc' | 'desc';
  onToggleSort?: () => void;
  onExportPdf?: () => void;
  onExportExcel?: () => void;
  onExportCsv?: () => void;
  onPrint?: () => void;
}> = ({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  statusOptions,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  sortDir,
  onToggleSort,
  onExportPdf,
  onExportExcel,
  onExportCsv,
  onPrint,
}) => {
  const { tr } = useApp();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 no-print">
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[220px]">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={`${tr('search')}...`}
            className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#087443]/30"
          />
        </div>
        {statusOptions && onStatusChange && (
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="">All Status</option>
            {statusOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )}
        {onDateFromChange && (
          <input
            type="date"
            value={dateFrom || ''}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            title="From Date"
          />
        )}
        {onDateToChange && (
          <input
            type="date"
            value={dateTo || ''}
            onChange={(e) => onDateToChange(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            title="To Date"
          />
        )}
        {onToggleSort && (
          <button
            onClick={onToggleSort}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            Sort: {sortDir === 'asc' ? 'Oldest ↑' : 'Newest ↓'}
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {onExportPdf && (
          <button
            onClick={onExportPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5 text-red-600" />
            <span>PDF</span>
          </button>
        )}
        {onExportExcel && (
          <button
            onClick={onExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>Excel</span>
          </button>
        )}
        {onExportCsv && (
          <button
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>CSV</span>
          </button>
        )}
        {onPrint && (
          <button
            onClick={onPrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{tr('print')}</span>
          </button>
        )}
      </div>
    </div>
  );
};
