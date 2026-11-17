import React, { useMemo, useState } from 'react';
import { Download, Edit3, Plus, RotateCcw, Trash2, Wallet } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch, queueOfflineRecord } from '../offline/syncEngine';
import {
  DataToolbar,
  EmptyState,
  FileUploadField,
  StatusLabel,
} from '../components/UiPrimitives';
import {
  downloadReceiptPdf,
  exportTableToCsv,
  exportTableToExcel,
  exportTableToPdf,
} from '../utils/exports';
import type {
  CashBookRecord,
  LoanRecord,
  LoanRepaymentRecord,
  MemberRecord,
  ReceiptRecord,
  SavingRecord,
  ShareRecord,
} from '../types';

function makeAutoId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

function paginate<T>(arr: T[], page: number, size = 10) {
  const totalPages = Math.max(1, Math.ceil(arr.length / size));
  const cur = Math.min(page, totalPages);
  return {
    items: arr.slice((cur - 1) * size, cur * size),
    page: cur,
    totalPages,
  };
}

// ==========================================
// 1. MEMBER REGISTER (FORM 1)
// ==========================================
export const MemberRegisterView: React.FC<{ readOnlyOwn?: boolean }> = ({ readOnlyOwn }) => {
  const { session, snapshot, isOnline, tr, pushToast, syncNow, refreshLocalView, hasPermission, canEditAutoIds, modals, openModal, closeModal } = useApp();
  const members = snapshot?.members || [];
  const settings = snapshot?.settings!;

  const canAdd = !readOnlyOwn && hasPermission('member_register', 'add');
  const canEdit = hasPermission('member_register', 'edit');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const [form, setForm] = useState({
    memberId: '',
    memberName: '',
    fatherName: '',
    joinDate: new Date().toISOString().slice(0, 10),
    dateOfBirth: '',
    aadhaarNumber: '',
    panNumber: '',
    voterId: '',
    bankAccountNumber: '',
    ifscCode: '',
    branchName: '',
    mobileNumber: '',
    gmailId: '',
    state: 'Assam',
    district: '',
    developmentBlock: '',
    village: '',
    postOffice: '',
    pinCode: '',
    panchayat: '',
    photoUrl: '',
    signatureUrl: '',
    accountStatus: 'Active' as 'Active' | 'Inactive',
    pin: '',
  });

  const openAdd = () => {
    const nextNum = members.length + 1;
    setEditingId(null);
    setForm({
      memberId: `${settings?.memberIdPrefix || 'GMCSL-M'}${String(nextNum).padStart(4, '0')}`,
      memberName: '',
      fatherName: '',
      joinDate: new Date().toISOString().slice(0, 10),
      dateOfBirth: '',
      aadhaarNumber: '',
      panNumber: '',
      voterId: '',
      bankAccountNumber: '',
      ifscCode: '',
      branchName: '',
      mobileNumber: '',
      gmailId: '',
      state: 'Assam',
      district: '',
      developmentBlock: '',
      village: '',
      postOffice: '',
      pinCode: '',
      panchayat: '',
      photoUrl: '',
      signatureUrl: '',
      accountStatus: 'Active',
      pin: '',
    });
    openModal('memberForm');
  };

  const openEdit = (m: MemberRecord) => {
    setEditingId(m.memberId);
    setForm({
      memberId: m.memberId,
      memberName: m.memberName,
      fatherName: m.fatherName,
      joinDate: m.joinDate,
      dateOfBirth: m.dateOfBirth,
      aadhaarNumber: m.aadhaarNumber,
      panNumber: m.panNumber,
      voterId: m.voterId,
      bankAccountNumber: m.bankAccountNumber,
      ifscCode: m.ifscCode,
      branchName: m.branchName,
      mobileNumber: m.mobileNumber,
      gmailId: m.gmailId,
      state: m.state || 'Assam',
      district: m.district,
      developmentBlock: m.developmentBlock,
      village: m.village,
      postOffice: m.postOffice,
      pinCode: m.pinCode,
      panchayat: m.panchayat,
      photoUrl: m.photoUrl,
      signatureUrl: m.signatureUrl,
      accountStatus: m.accountStatus,
      pin: '',
    });
    openModal('memberForm');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    const safeMemberId = form.memberId.trim() || `${settings?.memberIdPrefix || 'GMCSL-M'}${String(members.length + 1).padStart(4, '0')}`;
    const payload = { ...form, memberId: safeMemberId };
    if (!/^\d{10}$/.test(payload.mobileNumber.trim())) {
      pushToast('error', 'Mobile Number must be 10 digits.');
      return;
    }

    try {
      if (isOnline) {
        if (editingId) {
          await apiFetch(`/api/members/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) }, session.token);
          pushToast('success', 'Member record updated.');
        } else {
          await apiFetch('/api/members', { method: 'POST', body: JSON.stringify(payload) }, session.token);
          pushToast('success', 'Member registered successfully.');
        }
        await syncNow();
      } else {
        await queueOfflineRecord({
          store: 'members',
          module: 'members',
          action: editingId ? 'update' : 'create',
          recordId: safeMemberId,
          localRecord: { ...payload },
          payload: { ...payload },
          session,
        });
        pushToast('warning', tr('savedOfflineMsg'));
        await refreshLocalView();
      }
      closeModal('memberForm');
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to save member.');
    }
  };

  const filtered = useMemo(() => {
    return members
      .filter((m) => {
        if (statusFilter && m.accountStatus !== statusFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            m.memberId.toLowerCase().includes(q) ||
            m.memberName.toLowerCase().includes(q) ||
            m.mobileNumber.toLowerCase().includes(q) ||
            (m.village || '').toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) =>
        sortDir === 'asc'
          ? a.joinDate.localeCompare(b.joinDate)
          : b.joinDate.localeCompare(a.joinDate)
      );
  }, [members, search, statusFilter, sortDir]);

  const paged = paginate(filtered, page);

  const exportHeaders = ['Member ID', 'Member Name', "Father's Name", 'Mobile', 'Join Date', 'Village', 'District', 'State', 'Status'];
  const exportRows = filtered.map((m) => [m.memberId, m.memberName, m.fatherName, m.mobileNumber, m.joinDate, m.village, m.district, m.state, m.accountStatus]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white">{tr('nav_member_register')}</h2>
          <p className="text-xs text-[#667085] dark:text-slate-400">
            Total: {filtered.length} members · Sensitive ID & bank numbers are masked per RBAC policy.
          </p>
        </div>
        {canAdd && (
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#087443] hover:bg-[#065c35] text-white text-sm font-semibold whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Member</span>
          </button>
        )}
      </div>

      {modals.memberForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-display text-base font-bold text-[#142D4E] dark:text-white">
              {editingId ? `Edit Member: ${editingId}` : 'New Member Registration (Form 1)'}
            </h3>
            {!isOnline && <span className="text-xs font-semibold text-amber-600">{tr('offlineMode')}</span>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">
                {tr('memberId')} <span className="text-red-600">*</span>
                {!editingId && canEditAutoIds && <span className="ml-1 text-[10px] text-[#087443] dark:text-emerald-400">(Editable)</span>}
              </label>
              <input
                type="text"
                required
                readOnly={Boolean(editingId) || !canEditAutoIds}
                value={form.memberId}
                onChange={(e) => setForm({ ...form, memberId: e.target.value })}
                onBlur={() => {
                  if (!editingId && !form.memberId.trim()) {
                    const nextNum = members.length + 1;
                    setForm((prev) => ({
                      ...prev,
                      memberId: `${settings?.memberIdPrefix || 'GMCSL-M'}${String(nextNum).padStart(4, '0')}`,
                    }));
                  }
                }}
                className={`w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 font-mono-tabular ${
                  Boolean(editingId) || !canEditAutoIds ? 'bg-slate-100 dark:bg-slate-800/70 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-800'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('memberName')} <span className="text-red-600">*</span></label>
              <input
                type="text"
                required
                value={form.memberName}
                onChange={(e) => setForm({ ...form, memberName: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('fatherName')}</label>
              <input
                type="text"
                value={form.fatherName}
                onChange={(e) => setForm({ ...form, fatherName: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('mobileNumber')} <span className="text-red-600">*</span></label>
              <input
                type="tel"
                required
                pattern="\d{10}"
                value={form.mobileNumber}
                onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('joinDate')} <span className="text-red-600">*</span></label>
              <input
                type="date"
                required
                value={form.joinDate}
                onChange={(e) => setForm({ ...form, joinDate: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('dob')}</label>
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('aadhaar')}</label>
              <input
                type="text"
                value={form.aadhaarNumber}
                onChange={(e) => setForm({ ...form, aadhaarNumber: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('pan')}</label>
              <input
                type="text"
                value={form.panNumber}
                onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('voterId')}</label>
              <input
                type="text"
                value={form.voterId}
                onChange={(e) => setForm({ ...form, voterId: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('bankAccount')}</label>
              <input
                type="text"
                value={form.bankAccountNumber}
                onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('ifsc')}</label>
              <input
                type="text"
                value={form.ifscCode}
                onChange={(e) => setForm({ ...form, ifscCode: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('branchName')}</label>
              <input
                type="text"
                value={form.branchName}
                onChange={(e) => setForm({ ...form, branchName: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('gmailId')}</label>
              <input
                type="email"
                value={form.gmailId}
                onChange={(e) => setForm({ ...form, gmailId: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('state')}</label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('district')}</label>
              <input
                type="text"
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('devBlock')}</label>
              <input
                type="text"
                value={form.developmentBlock}
                onChange={(e) => setForm({ ...form, developmentBlock: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('village')}</label>
              <input
                type="text"
                value={form.village}
                onChange={(e) => setForm({ ...form, village: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('postOffice')}</label>
              <input
                type="text"
                value={form.postOffice}
                onChange={(e) => setForm({ ...form, postOffice: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('pinCode')}</label>
              <input
                type="text"
                value={form.pinCode}
                onChange={(e) => setForm({ ...form, pinCode: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('panchayat')}</label>
              <input
                type="text"
                value={form.panchayat}
                onChange={(e) => setForm({ ...form, panchayat: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
            {!readOnlyOwn && (
              <div>
                <label className="block text-xs font-medium mb-1">{tr('accountStatus')}</label>
                <select
                  value={form.accountStatus}
                  onChange={(e) => setForm({ ...form, accountStatus: e.target.value as 'Active' | 'Inactive' })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            )}
            {!editingId && (
              <div>
                <label className="block text-xs font-medium mb-1">Initial 4-Digit Login PIN (Optional)</label>
                <input
                  type="password"
                  maxLength={4}
                  pattern="\d{4}"
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value })}
                  placeholder="4 digits"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular"
                />
              </div>
            )}
            <FileUploadField
              label="Member Photo"
              value={form.photoUrl}
              onChange={(url) => setForm({ ...form, photoUrl: url })}
            />
            <FileUploadField
              label="Member Signature"
              value={form.signatureUrl}
              onChange={(url) => setForm({ ...form, signatureUrl: url })}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => closeModal('memberForm')}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium"
            >
              {tr('cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#087443] hover:bg-[#065c35] text-white text-sm font-semibold"
            >
              {tr('save')}
            </button>
          </div>
        </form>
      )}

      {!readOnlyOwn && (
        <DataToolbar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          statusFilter={statusFilter}
          onStatusChange={(v) => { setStatusFilter(v); setPage(1); }}
          statusOptions={['Active', 'Inactive']}
          sortDir={sortDir}
          onToggleSort={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          onExportPdf={() => exportTableToPdf('Member Register', exportHeaders, exportRows, settings, 'GMCSL_Members')}
          onExportExcel={() => exportTableToExcel('Members', exportHeaders, exportRows, 'GMCSL_Members')}
          onExportCsv={() => exportTableToCsv(exportHeaders, exportRows, 'GMCSL_Members')}
          onPrint={() => window.print()}
        />
      )}

      {paged.items.length === 0 ? (
        <EmptyState
          title="No Member Records Found"
          subtitle="Register members to begin managing savings, shares, and loan portfolios."
          actionLabel={canAdd ? 'Register First Member' : undefined}
          onAction={canAdd ? openAdd : undefined}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4">Join Date</th>
                  <th className="py-3 px-4">Address</th>
                  <th className="py-3 px-4">Bank / IFSC</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Sync</th>
                  {canEdit && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paged.items.map((m) => (
                  <tr key={m.memberId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        {m.photoUrl ? (
                          <img src={m.photoUrl} alt={m.memberName} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#142D4E] text-white text-xs font-bold flex items-center justify-center">
                            {m.memberName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-[#1D2939] dark:text-white">{m.memberName}</p>
                          <p className="text-xs font-mono-tabular text-slate-500">{m.memberId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono-tabular">{m.mobileNumber}</td>
                    <td className="py-3 px-4 font-mono-tabular">{m.joinDate}</td>
                    <td className="py-3 px-4 text-xs">{[m.village, m.district, m.state].filter(Boolean).join(', ') || '—'}</td>
                    <td className="py-3 px-4 text-xs font-mono-tabular">{m.bankAccountNumber ? `${m.bankAccountNumber} (${m.ifscCode})` : '—'}</td>
                    <td className="py-3 px-4"><StatusLabel status={m.accountStatus} /></td>
                    <td className="py-3 px-4"><StatusLabel status={m.syncStatus || 'Synced'} /></td>
                    {canEdit && (
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openEdit(m)}
                          className="text-xs font-semibold text-[#087443] dark:text-emerald-400 hover:underline"
                        >
                          {tr('edit')}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {paged.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <span>Page {paged.page} of {paged.totalPages}</span>
              <div className="flex gap-2">
                <button disabled={paged.page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded border disabled:opacity-40">Prev</button>
                <button disabled={paged.page >= paged.totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded border disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 2. SAVING REGISTER (FORM 2)
// ==========================================
export const SavingRegisterView: React.FC<{ readOnlyOwn?: boolean }> = ({ readOnlyOwn }) => {
  const { session, snapshot, isOnline, tr, pushToast, syncNow, refreshLocalView, hasPermission, canEditAutoIds, askConfirm, modals, openModal, closeModal } = useApp();
  const savings = snapshot?.savings || [];
  const members = snapshot?.members || [];
  const settings = snapshot?.settings!;

  const canAdd = !readOnlyOwn && hasPermission('saving_register', 'add');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const [form, setForm] = useState({
    savingId: '',
    memberId: '',
    memberName: '',
    date: new Date().toISOString().slice(0, 10),
    monthlySavingAmount: 0,
    previousSavingAmount: 0,
    interest: 0,
    fine: 0,
    paymentStatus: 'Cash' as SavingRecord['paymentStatus'],
    paymentMethod: 'Saving' as SavingRecord['paymentMethod'],
    meetingStatus: 'Present' as SavingRecord['meetingStatus'],
  });

  const computedTotal =
    Math.round(
      (Number(form.monthlySavingAmount || 0) +
        Number(form.previousSavingAmount || 0) +
        Number(form.interest || 0) +
        Number(form.fine || 0)) *
        100
    ) / 100;

  const getMemberPrevSum = (mid: string) => {
    if (!mid) return 0;
    const sum = savings
      .filter((s) => s.memberId === mid)
      .reduce((acc, s) => acc + Number(s.monthlySavingAmount || 0) + Number(s.interest || 0) + Number(s.fine || 0), 0);
    return Math.round(sum * 100) / 100;
  };

  const openAdd = () => {
    const firstMid = members[0]?.memberId || '';
    setForm({
      savingId: makeAutoId('SAV'),
      memberId: firstMid,
      memberName: members[0]?.memberName || '',
      date: new Date().toISOString().slice(0, 10),
      monthlySavingAmount: 0,
      previousSavingAmount: getMemberPrevSum(firstMid),
      interest: 0,
      fine: 0,
      paymentStatus: 'Cash',
      paymentMethod: 'Saving',
      meetingStatus: 'Present',
    });
    openModal('savingForm');
  };

  const handleMemberChange = (mid: string) => {
    const m = members.find((x) => x.memberId === mid);
    setForm((prev) => ({
      ...prev,
      memberId: mid,
      memberName: m?.memberName || '',
      previousSavingAmount: getMemberPrevSum(mid),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (!form.memberId) {
      pushToast('error', 'Select a valid member.');
      return;
    }
    const safeSavingId = form.savingId.trim() || makeAutoId('SAV');
    const payload = {
      ...form,
      savingId: safeSavingId,
      monthlySavingAmount: Number(form.monthlySavingAmount || 0),
      previousSavingAmount: Number(form.previousSavingAmount || 0),
      interest: Number(form.interest || 0),
      fine: Number(form.fine || 0),
    };
    try {
      if (isOnline) {
        await apiFetch('/api/savings', { method: 'POST', body: JSON.stringify(payload) }, session.token);
        pushToast('success', 'Saving entry recorded.');
        await syncNow();
      } else {
        const receiptNo = `PROV-SAV-${Date.now().toString().slice(-6)}`;
        const localRec: Partial<SavingRecord> = {
          ...payload,
          totalSaving: computedTotal,
          receiptNumber: receiptNo,
        };
        const provisionalReceipt: ReceiptRecord = {
          id: receiptNo,
          receiptNumber: receiptNo,
          receiptType: 'Saving',
          memberId: payload.memberId,
          memberName: payload.memberName,
          date: payload.date,
          amount: computedTotal,
          paymentMethod: payload.paymentStatus,
          details: `Monthly: ₹${payload.monthlySavingAmount}, Previous: ₹${payload.previousSavingAmount}, Interest: ₹${payload.interest}, Fine: ₹${payload.fine}`,
          verificationStatus: 'Provisional / Pending Sync',
          authorizedBy: session.user.fullName,
          createdAt: new Date().toISOString(),
        };
        await queueOfflineRecord({
          store: 'savings',
          module: 'savings',
          action: 'create',
          recordId: safeSavingId,
          localRecord: localRec,
          payload,
          session,
          provisionalReceipt,
        });
        pushToast('warning', tr('savedOfflineMsg'));
        await refreshLocalView();
      }
      closeModal('savingForm');
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to save transaction.');
    }
  };

  const handleReverse = async (s: SavingRecord) => {
    if (!session || !isOnline) {
      pushToast('warning', 'Reversal entries require online server authorization.');
      return;
    }
    await askConfirm({
      title: 'Confirm Reversal Entry',
      message: `Create a negative reversal entry for ${s.savingId} (₹${s.totalSaving})? Original records are preserved for audit integrity.`,
      confirmLabel: 'Create Reversal',
      danger: true,
      onConfirm: async () => {
        try {
          await apiFetch('/api/ledger/reverse', { method: 'POST', body: JSON.stringify({ module: 'saving_register', recordId: s.savingId, reason: 'Authorized officer reversal' }) }, session.token);
          pushToast('success', 'Reversal entry recorded.');
          await syncNow();
        } catch (err: any) {
          pushToast('error', err?.message || 'Failed to reverse entry.');
        }
      },
    });
  };

  const handleReceipt = async (s: SavingRecord) => {
    const receipt: ReceiptRecord = {
      id: s.receiptNumber || s.savingId,
      receiptNumber: s.receiptNumber || s.savingId,
      receiptType: 'Saving',
      memberId: s.memberId,
      memberName: s.memberName,
      date: s.date,
      amount: s.totalSaving,
      paymentMethod: s.paymentStatus,
      details: `Monthly: ₹${s.monthlySavingAmount}, Interest: ₹${s.interest}, Fine: ₹${s.fine}`,
      verificationStatus: s.syncStatus === 'Pending' ? 'Provisional / Pending Sync' : 'Verified',
      authorizedBy: s.createdBy,
      createdAt: s.createdDate,
    };
    await downloadReceiptPdf(receipt, settings);
  };

  const filtered = useMemo(() => {
    return savings
      .filter((s) => {
        if (statusFilter && s.paymentStatus !== statusFilter) return false;
        if (dateFrom && s.date < dateFrom) return false;
        if (dateTo && s.date > dateTo) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            s.savingId.toLowerCase().includes(q) ||
            s.memberId.toLowerCase().includes(q) ||
            s.memberName.toLowerCase().includes(q) ||
            (s.receiptNumber || '').toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => (sortDir === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  }, [savings, search, statusFilter, dateFrom, dateTo, sortDir]);

  const paged = paginate(filtered, page);
  const headers = ['Saving ID', 'Member ID', 'Member Name', 'Date', 'Monthly', 'Previous Saving', 'Interest', 'Fine', 'Total', 'Status', 'Receipt'];
  const rows = filtered.map((s) => [s.savingId, s.memberId, s.memberName, s.date, s.monthlySavingAmount, s.previousSavingAmount || 0, s.interest, s.fine, s.totalSaving, s.paymentStatus, s.receiptNumber]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white">{tr('nav_saving_register')}</h2>
          <p className="text-xs text-[#667085] dark:text-slate-400">
            Total Collection: <span className="font-mono-tabular font-semibold">₹{filtered.reduce((a, b) => a + b.totalSaving, 0).toFixed(2)}</span>
          </p>
        </div>
        {canAdd && (
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#087443] hover:bg-[#065c35] text-white text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Add Saving Entry</span>
          </button>
        )}
      </div>

      {modals.savingForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="font-display text-base font-bold text-[#142D4E] dark:text-white">New Saving Entry (Form 2)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">
                Saving ID
                {canEditAutoIds && <span className="ml-1 text-[10px] text-[#087443] dark:text-emerald-400">(Editable)</span>}
              </label>
              <input
                type="text"
                required
                readOnly={!canEditAutoIds}
                value={form.savingId}
                onChange={(e) => setForm({ ...form, savingId: e.target.value })}
                onBlur={() => {
                  if (!form.savingId.trim()) {
                    setForm((prev) => ({ ...prev, savingId: makeAutoId('SAV') }));
                  }
                }}
                className={`w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 font-mono-tabular ${
                  !canEditAutoIds ? 'bg-slate-100 dark:bg-slate-800/70 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-800'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('memberId')} <span className="text-red-600">*</span></label>
              <select
                required
                value={form.memberId}
                onChange={(e) => handleMemberChange(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="">Select Member</option>
                {members.map((m) => (
                  <option key={m.memberId} value={m.memberId}>
                    {m.memberId} — {m.memberName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('date')} <span className="text-red-600">*</span></label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('monthlySavingAmt')} (₹) <span className="text-red-600">*</span></label>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={form.monthlySavingAmount}
                onChange={(e) => setForm({ ...form, monthlySavingAmount: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('previousSavingAmt')} (₹)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.previousSavingAmount}
                onChange={(e) => setForm({ ...form, previousSavingAmount: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('interest')} (₹)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.interest}
                onChange={(e) => setForm({ ...form, interest: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('fine')} (₹)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.fine}
                onChange={(e) => setForm({ ...form, fine: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('paymentStatus')}</label>
              <select
                value={form.paymentStatus}
                onChange={(e) => setForm({ ...form, paymentStatus: e.target.value as SavingRecord['paymentStatus'] })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="Cash">Cash</option>
                <option value="Online">Online</option>
                <option value="Pending">Pending</option>
                <option value="No Payment">No Payment</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('meetingStatus')}</label>
              <select
                value={form.meetingStatus}
                onChange={(e) => setForm({ ...form, meetingStatus: e.target.value as SavingRecord['meetingStatus'] })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="text-sm font-semibold text-[#142D4E] dark:text-white">
              Transaction Total: <span className="font-mono-tabular text-[#087443] dark:text-emerald-400">₹{computedTotal.toFixed(2)}</span>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => closeModal('savingForm')} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm">
                {tr('cancel')}
              </button>
              <button type="submit" className="px-5 py-2 rounded-lg bg-[#087443] hover:bg-[#065c35] text-white text-sm font-semibold">
                {tr('save')}
              </button>
            </div>
          </div>
        </form>
      )}

      <DataToolbar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        statusFilter={statusFilter}
        onStatusChange={(v) => { setStatusFilter(v); setPage(1); }}
        statusOptions={['Online', 'Cash', 'Pending', 'No Payment']}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        sortDir={sortDir}
        onToggleSort={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
        onExportPdf={() => exportTableToPdf('Saving Register', headers, rows, settings, 'GMCSL_Savings')}
        onExportExcel={() => exportTableToExcel('Savings', headers, rows, 'GMCSL_Savings')}
        onExportCsv={() => exportTableToCsv(headers, rows, 'GMCSL_Savings')}
        onPrint={() => window.print()}
      />

      {paged.items.length === 0 ? (
        <EmptyState
          title="No Saving Transactions"
          subtitle="Monthly member savings, interest, and fine transactions will appear here."
          actionLabel={canAdd ? 'Record Saving Entry' : undefined}
          onAction={canAdd ? openAdd : undefined}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <th className="py-3 px-4">Date / ID</th>
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4 text-right">Monthly</th>
                  <th className="py-3 px-4 text-right">Previous</th>
                  <th className="py-3 px-4 text-right">Interest</th>
                  <th className="py-3 px-4 text-right">Fine</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Sync</th>
                  <th className="py-3 px-4 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paged.items.map((s) => (
                  <tr key={s.savingId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <p className="font-mono-tabular font-medium">{s.date}</p>
                      <p className="text-xs font-mono-tabular text-slate-500">{s.savingId}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium">{s.memberName}</p>
                      <p className="text-xs font-mono-tabular text-slate-500">{s.memberId}</p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular">₹{s.monthlySavingAmount.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono-tabular">₹{Number(s.previousSavingAmount || 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono-tabular">₹{s.interest.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono-tabular">₹{s.fine.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-[#087443] dark:text-emerald-400">₹{s.totalSaving.toFixed(2)}</td>
                    <td className="py-3 px-4"><StatusLabel status={s.paymentStatus} /></td>
                    <td className="py-3 px-4"><StatusLabel status={s.syncStatus || 'Synced'} /></td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      <button onClick={() => handleReceipt(s)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline">
                        <Download className="w-3.5 h-3.5" />
                        <span>{s.syncStatus === 'Pending' ? 'Provisional' : 'PDF'}</span>
                      </button>
                      {!readOnlyOwn && !s.isReversal && hasPermission('saving_register', 'edit') && (
                        <button onClick={() => handleReverse(s)} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline" title="Create reversal entry">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {paged.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <span>Page {paged.page} of {paged.totalPages}</span>
              <div className="flex gap-2">
                <button disabled={paged.page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded border disabled:opacity-40">Prev</button>
                <button disabled={paged.page >= paged.totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded border disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 3. SHARE REGISTER (FORM 5)
// ==========================================
export const ShareRegisterView: React.FC<{ readOnlyOwn?: boolean }> = ({ readOnlyOwn }) => {
  const { session, snapshot, isOnline, tr, pushToast, syncNow, refreshLocalView, hasPermission, canEditAutoIds, modals, openModal, closeModal } = useApp();
  const shares = snapshot?.shares || [];
  const members = snapshot?.members || [];
  const settings = snapshot?.settings!;

  const canAdd = !readOnlyOwn && hasPermission('share_register', 'add');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    shareId: '',
    memberId: '',
    memberName: '',
    numberOfShares: 1,
    faceValuePerShare: 100,
    date: new Date().toISOString().slice(0, 10),
    note: '',
  });

  const totalShareVal = Math.round(Number(form.numberOfShares || 0) * Number(form.faceValuePerShare || 0) * 100) / 100;

  const openAdd = () => {
    setForm({
      shareId: makeAutoId('SHR'),
      memberId: members[0]?.memberId || '',
      memberName: members[0]?.memberName || '',
      numberOfShares: 1,
      faceValuePerShare: 100,
      date: new Date().toISOString().slice(0, 10),
      note: '',
    });
    openModal('shareForm');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !form.memberId) return;
    const safeShareId = form.shareId.trim() || makeAutoId('SHR');
    const payload = { ...form, shareId: safeShareId };
    try {
      if (isOnline) {
        await apiFetch('/api/shares', { method: 'POST', body: JSON.stringify(payload) }, session.token);
        pushToast('success', 'Share capital entry recorded.');
        await syncNow();
      } else {
        await queueOfflineRecord({
          store: 'shares',
          module: 'shares',
          action: 'create',
          recordId: safeShareId,
          localRecord: { ...payload, totalShareValue: totalShareVal },
          payload,
          session,
        });
        pushToast('warning', tr('savedOfflineMsg'));
        await refreshLocalView();
      }
      closeModal('shareForm');
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to save share record.');
    }
  };

  const filtered = shares.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.shareId.toLowerCase().includes(q) || s.memberId.toLowerCase().includes(q) || s.memberName.toLowerCase().includes(q);
  });

  const headers = ['Share ID', 'Member ID', 'Member Name', 'Shares', 'Face Value', 'Total Value', 'Date', 'Note'];
  const rows = filtered.map((s) => [s.shareId, s.memberId, s.memberName, s.numberOfShares, s.faceValuePerShare, s.totalShareValue, s.date, s.note]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white">{tr('nav_share_register')}</h2>
          <p className="text-xs text-[#667085] dark:text-slate-400">
            Total Shares: <span className="font-mono-tabular font-semibold">{filtered.reduce((a, b) => a + b.numberOfShares, 0)}</span> · Total Capital: <span className="font-mono-tabular font-semibold">₹{filtered.reduce((a, b) => a + b.totalShareValue, 0).toFixed(2)}</span>
          </p>
        </div>
        {canAdd && (
          <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#087443] hover:bg-[#065c35] text-white text-sm font-semibold">
            <Plus className="w-4 h-4" />
            <span>Issue Shares</span>
          </button>
        )}
      </div>

      {modals.shareForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="font-display text-base font-bold text-[#142D4E] dark:text-white">Share Register Entry (Form 5)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">
                Share ID
                {canEditAutoIds && <span className="ml-1 text-[10px] text-[#087443] dark:text-emerald-400">(Editable)</span>}
              </label>
              <input
                type="text"
                required
                readOnly={!canEditAutoIds}
                value={form.shareId}
                onChange={(e) => setForm({ ...form, shareId: e.target.value })}
                onBlur={() => {
                  if (!form.shareId.trim()) {
                    setForm((prev) => ({ ...prev, shareId: makeAutoId('SHR') }));
                  }
                }}
                className={`w-full px-3 py-2 text-sm rounded-lg border font-mono-tabular ${
                  !canEditAutoIds ? 'bg-slate-100 dark:bg-slate-800/70 cursor-not-allowed' : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('memberId')} <span className="text-red-600">*</span></label>
              <select
                required
                value={form.memberId}
                onChange={(e) => {
                  const m = members.find((x) => x.memberId === e.target.value);
                  setForm({ ...form, memberId: e.target.value, memberName: m?.memberName || '' });
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="">Select Member</option>
                {members.map((m) => <option key={m.memberId} value={m.memberId}>{m.memberId} — {m.memberName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('date')}</label>
              <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('numberOfShares')} <span className="text-red-600">*</span></label>
              <input type="number" min={1} required value={form.numberOfShares} onChange={(e) => setForm({ ...form, numberOfShares: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('faceValuePerShare')} (₹) <span className="text-red-600">*</span></label>
              <input type="number" min={1} step="0.01" required value={form.faceValuePerShare} onChange={(e) => setForm({ ...form, faceValuePerShare: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('remarks')}</label>
              <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-sm font-semibold">Total Share Value: <span className="font-mono-tabular text-[#087443]">₹{totalShareVal.toFixed(2)}</span></span>
            <div className="flex gap-3">
              <button type="button" onClick={() => closeModal('shareForm')} className="px-4 py-2 rounded-lg border text-sm">{tr('cancel')}</button>
              <button type="submit" className="px-5 py-2 rounded-lg bg-[#087443] text-white text-sm font-semibold">{tr('save')}</button>
            </div>
          </div>
        </form>
      )}

      <DataToolbar
        search={search}
        onSearchChange={setSearch}
        onExportPdf={() => exportTableToPdf('Share Register', headers, rows, settings, 'GMCSL_Shares')}
        onExportExcel={() => exportTableToExcel('Shares', headers, rows, 'GMCSL_Shares')}
        onExportCsv={() => exportTableToCsv(headers, rows, 'GMCSL_Shares')}
        onPrint={() => window.print()}
      />

      {filtered.length === 0 ? (
        <EmptyState title="No Share Records" subtitle="Issued member shares will appear here." actionLabel={canAdd ? 'Issue First Share' : undefined} onAction={canAdd ? openAdd : undefined} />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
                <th className="py-3 px-4">Share ID</th>
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Shares</th>
                <th className="py-3 px-4 text-right">Face Value</th>
                <th className="py-3 px-4 text-right">Total Value</th>
                <th className="py-3 px-4">Sync</th>
                <th className="py-3 px-4 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((s: ShareRecord) => (
                <tr key={s.shareId}>
                  <td className="py-3 px-4 font-mono-tabular">{s.shareId}</td>
                  <td className="py-3 px-4">{s.memberName} <span className="text-xs text-slate-500 font-mono-tabular">({s.memberId})</span></td>
                  <td className="py-3 px-4 font-mono-tabular">{s.date}</td>
                  <td className="py-3 px-4 text-right font-mono-tabular">{s.numberOfShares}</td>
                  <td className="py-3 px-4 text-right font-mono-tabular">₹{s.faceValuePerShare.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-[#087443]">₹{s.totalShareValue.toFixed(2)}</td>
                  <td className="py-3 px-4"><StatusLabel status={s.syncStatus || 'Synced'} /></td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() =>
                        downloadReceiptPdf(
                          {
                            id: s.shareId,
                            receiptNumber: s.shareId,
                            receiptType: 'Share Purchase',
                            memberId: s.memberId,
                            memberName: s.memberName,
                            date: s.date,
                            amount: s.totalShareValue,
                            paymentMethod: 'Cash',
                            details: `${s.numberOfShares} Shares @ ₹${s.faceValuePerShare}. ${s.note}`,
                            verificationStatus: s.syncStatus === 'Pending' ? 'Provisional / Pending Sync' : 'Verified',
                            authorizedBy: s.createdBy,
                            createdAt: s.createdDate,
                          },
                          settings
                        )
                      }
                      className="text-xs font-semibold text-[#2563EB] hover:underline"
                    >
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 4. LOAN REGISTER & REPAYMENT (FORM 3)
// ==========================================
export const LoanRegisterView: React.FC<{ readOnlyOwn?: boolean; defaultRepayMode?: boolean }> = ({
  readOnlyOwn,
  defaultRepayMode,
}) => {
  const { session, snapshot, isOnline, tr, pushToast, syncNow, refreshLocalView, hasPermission, canEditAutoIds, modals, openModal, closeModal } = useApp();
  const loans = snapshot?.loans || [];
  const members = snapshot?.members || [];
  const approvedUnDisbursed = (snapshot?.loanApplications || []).filter((a) => a.applicationStatus === 'Approved' && !a.disbursed);
  const settings = snapshot?.settings!;

  const canAdd = !readOnlyOwn && hasPermission('loan_register', 'add');
  const [repayLoan, setRepayLoan] = useState<LoanRecord | null>(null);
  const [repayForm, setRepayForm] = useState({
    repaymentAmount: 0,
    interest: 0,
    fine: 0,
    date: new Date().toISOString().slice(0, 10),
    nextDueDate: '',
    paymentStatus: 'Cash',
    paymentMethod: 'Loan',
  });

  const [form, setForm] = useState({
    loanId: '',
    loanNumber: '',
    memberId: '',
    memberName: '',
    loanDate: new Date().toISOString().slice(0, 10),
    loanAmount: 0,
    loanRepayment: 0,
    interest: 0,
    fine: 0,
    nextDueDate: '',
    paymentStatus: 'Cash' as LoanRecord['paymentStatus'],
    loanStatus: 'Active' as LoanRecord['loanStatus'],
    paymentMethod: 'Loan' as LoanRecord['paymentMethod'],
    memberSignatureUrl: '',
    secretarySignatureUrl: '',
    presidentSignatureUrl: '',
    applicationId: '',
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const openDisburse = (fromApp?: any) => {
    const count = loans.length + 1;
    setForm({
      loanId: makeAutoId('LN'),
      loanNumber: `${settings?.loanNumberPrefix || 'GMCSL-LN'}${String(count).padStart(4, '0')}`,
      memberId: fromApp?.memberId || members[0]?.memberId || '',
      memberName: fromApp?.memberName || members[0]?.memberName || '',
      loanDate: new Date().toISOString().slice(0, 10),
      loanAmount: fromApp?.approvedAmount || 0,
      loanRepayment: 0,
      interest: 0,
      fine: 0,
      nextDueDate: '',
      paymentStatus: 'Cash',
      loanStatus: 'Active',
      paymentMethod: 'Loan',
      memberSignatureUrl: '',
      secretarySignatureUrl: '',
      presidentSignatureUrl: '',
      applicationId: fromApp?.applicationId || '',
    });
    openModal('loanForm');
  };

  const handleDisburseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !form.memberId) return;
    const safeLoanId = form.loanId.trim() || makeAutoId('LN');
    const safeLoanNumber = form.loanNumber.trim() || `${settings?.loanNumberPrefix || 'GMCSL-LN'}${String(loans.length + 1).padStart(4, '0')}`;
    const payload = { ...form, loanId: safeLoanId, loanNumber: safeLoanNumber };
    const bal = Math.round((Number(payload.loanAmount) - Number(payload.loanRepayment)) * 100) / 100;
    if (bal < 0) {
      pushToast('error', 'Repayment cannot exceed Loan Amount.');
      return;
    }
    try {
      if (isOnline) {
        await apiFetch('/api/loans', { method: 'POST', body: JSON.stringify(payload) }, session.token);
        pushToast('success', 'Loan disbursement recorded.');
        await syncNow();
      } else {
        await queueOfflineRecord({
          store: 'loans',
          module: 'loans',
          action: 'create',
          recordId: safeLoanId,
          localRecord: { ...payload, previousLoanAmount: 0, totalLoanAmount: payload.loanAmount, currentLoanBalance: bal },
          payload,
          session,
        });
        pushToast('warning', tr('savedOfflineMsg'));
        await refreshLocalView();
      }
      closeModal('loanForm');
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to record loan.');
    }
  };

  const handleRepaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !repayLoan) return;
    if (!isOnline) {
      pushToast('warning', 'Loan installment updates on existing server loans require online synchronization to maintain accurate principal balance.');
      return;
    }
    try {
      const res = await apiFetch<{ loan: LoanRecord; receiptNumber: string }>(
        `/api/loans/${repayLoan.loanId}/repay`,
        { method: 'POST', body: JSON.stringify(repayForm) },
        session.token
      );
      pushToast('success', `Installment recorded (${res.receiptNumber}). Remaining Balance: ₹${res.loan.currentLoanBalance}`);
      closeModal('loanRepayForm');
      setRepayLoan(null);
      await syncNow();
    } catch (err: any) {
      pushToast('error', err?.message || 'Repayment failed.');
    }
  };

  const filtered = loans.filter((l) => {
    if (statusFilter && l.loanStatus !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        l.loanNumber.toLowerCase().includes(q) ||
        l.memberId.toLowerCase().includes(q) ||
        l.memberName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const headers = ['Loan No', 'Member ID', 'Member Name', 'Date', 'Loan Amt', 'Repaid', 'Interest', 'Fine', 'Balance', 'Next Due', 'Status'];
  const rows = filtered.map((l) => [l.loanNumber, l.memberId, l.memberName, l.loanDate, l.loanAmount, l.loanRepayment, l.interest, l.fine, l.currentLoanBalance, l.nextDueDate, l.loanStatus]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white">
            {defaultRepayMode ? tr('nav_loan_repayment') : tr('nav_loan_register')}
          </h2>
          <p className="text-xs text-[#667085] dark:text-slate-400">
            Outstanding Principal: <span className="font-mono-tabular font-semibold">₹{filtered.reduce((a, b) => a + b.currentLoanBalance, 0).toFixed(2)}</span>
          </p>
        </div>
        {canAdd && !defaultRepayMode && (
          <button onClick={() => openDisburse()} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#087443] hover:bg-[#065c35] text-white text-sm font-semibold">
            <Plus className="w-4 h-4" />
            <span>Disburse Loan</span>
          </button>
        )}
      </div>

      {canAdd && approvedUnDisbursed.length > 0 && !defaultRepayMode && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4">
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-2">
            Approved Loan Applications Awaiting Separate Disbursement ({approvedUnDisbursed.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {approvedUnDisbursed.map((app) => (
              <button
                key={app.applicationId}
                onClick={() => openDisburse(app)}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 text-xs font-medium hover:bg-emerald-100"
              >
                Disburse {app.applicationId}: {app.memberName} (₹{app.approvedAmount})
              </button>
            ))}
          </div>
        </div>
      )}

      {modals.loanForm && (
        <form onSubmit={handleDisburseSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="font-display text-base font-bold text-[#142D4E] dark:text-white">Loan Disbursement Entry (Form 3)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">
                Loan ID
                {canEditAutoIds && <span className="ml-1 text-[10px] text-[#087443] dark:text-emerald-400">(Editable)</span>}
              </label>
              <input
                type="text"
                required
                value={form.loanId}
                readOnly={!canEditAutoIds}
                onChange={(e) => setForm({ ...form, loanId: e.target.value })}
                onBlur={() => {
                  if (!form.loanId.trim()) {
                    setForm((prev) => ({ ...prev, loanId: makeAutoId('LN') }));
                  }
                }}
                className={`w-full px-3 py-2 text-sm rounded-lg border font-mono-tabular ${
                  !canEditAutoIds ? 'bg-slate-100 dark:bg-slate-800/70 cursor-not-allowed' : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                {tr('loanNumber')}
                {canEditAutoIds && <span className="ml-1 text-[10px] text-[#087443] dark:text-emerald-400">(Editable)</span>}
              </label>
              <input
                type="text"
                required
                readOnly={!canEditAutoIds}
                value={form.loanNumber}
                onChange={(e) => setForm({ ...form, loanNumber: e.target.value })}
                onBlur={() => {
                  if (!form.loanNumber.trim()) {
                    setForm((prev) => ({
                      ...prev,
                      loanNumber: `${settings?.loanNumberPrefix || 'GMCSL-LN'}${String(loans.length + 1).padStart(4, '0')}`,
                    }));
                  }
                }}
                className={`w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 font-mono-tabular ${
                  !canEditAutoIds ? 'bg-slate-100 dark:bg-slate-800/70 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-800'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('memberId')} <span className="text-red-600">*</span></label>
              <select
                required
                value={form.memberId}
                onChange={(e) => {
                  const m = members.find((x) => x.memberId === e.target.value);
                  setForm({ ...form, memberId: e.target.value, memberName: m?.memberName || '' });
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="">Select Member</option>
                {members.map((m) => <option key={m.memberId} value={m.memberId}>{m.memberId} — {m.memberName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Loan Date</label>
              <input type="date" required value={form.loanDate} onChange={(e) => setForm({ ...form, loanDate: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('loanAmount')} (₹) <span className="text-red-600">*</span></label>
              <input type="number" min={1} step="0.01" required value={form.loanAmount} onChange={(e) => setForm({ ...form, loanAmount: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('nextDueDate')}</label>
              <input type="date" value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('paymentStatus')}</label>
              <select value={form.paymentStatus} onChange={(e) => setForm({ ...form, paymentStatus: e.target.value as any })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <option value="Cash">Cash</option>
                <option value="Online">Online</option>
                <option value="Pending">Pending</option>
                <option value="No Payment">No Payment</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('loanStatus')}</label>
              <select value={form.loanStatus} onChange={(e) => setForm({ ...form, loanStatus: e.target.value as any })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <option value="Active">Active</option>
                <option value="Running">Running</option>
                <option value="Close">Close</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <FileUploadField label="Member Signature" value={form.memberSignatureUrl} onChange={(u) => setForm({ ...form, memberSignatureUrl: u })} />
            <FileUploadField label="Secretary Signature" value={form.secretarySignatureUrl} onChange={(u) => setForm({ ...form, secretarySignatureUrl: u })} />
            <FileUploadField label="President Signature" value={form.presidentSignatureUrl} onChange={(u) => setForm({ ...form, presidentSignatureUrl: u })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => closeModal('loanForm')} className="px-4 py-2 rounded-lg border text-sm">{tr('cancel')}</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#087443] text-white text-sm font-semibold">{tr('save')}</button>
          </div>
        </form>
      )}

      {modals.loanRepayForm && repayLoan && (
        <form onSubmit={handleRepaySubmit} className="bg-white dark:bg-slate-900 border border-[#087443] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-[#142D4E] dark:text-white">
              Loan Installment Repayment — {repayLoan.loanNumber} ({repayLoan.memberName})
            </h3>
            <span className="text-xs font-mono-tabular font-semibold">Current Balance: ₹{repayLoan.currentLoanBalance.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Repayment Date</label>
              <input type="date" required value={repayForm.date} onChange={(e) => setRepayForm({ ...repayForm, date: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Principal Repayment (₹)</label>
              <input type="number" min={0} max={repayLoan.currentLoanBalance} step="0.01" value={repayForm.repaymentAmount} onChange={(e) => setRepayForm({ ...repayForm, repaymentAmount: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Interest Received (₹)</label>
              <input type="number" min={0} step="0.01" value={repayForm.interest} onChange={(e) => setRepayForm({ ...repayForm, interest: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Fine Received (₹)</label>
              <input type="number" min={0} step="0.01" value={repayForm.fine} onChange={(e) => setRepayForm({ ...repayForm, fine: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Next Due Date</label>
              <input type="date" value={repayForm.nextDueDate} onChange={(e) => setRepayForm({ ...repayForm, nextDueDate: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-slate-600 dark:text-slate-300">
              Remaining Principal After Payment: <strong className="font-mono-tabular">₹{(repayLoan.currentLoanBalance - repayForm.repaymentAmount).toFixed(2)}</strong>
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  closeModal('loanRepayForm');
                  setRepayLoan(null);
                }}
                className="px-4 py-2 rounded-lg border text-sm"
              >
                {tr('cancel')}
              </button>
              <button type="submit" className="px-5 py-2 rounded-lg bg-[#087443] text-white text-sm font-semibold">Record Installment</button>
            </div>
          </div>
        </form>
      )}

      <DataToolbar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        statusOptions={['Active', 'Running', 'Close', 'Inactive']}
        onExportPdf={() => exportTableToPdf('Loan Register', headers, rows, settings, 'GMCSL_Loans')}
        onExportExcel={() => exportTableToExcel('Loans', headers, rows, 'GMCSL_Loans')}
        onExportCsv={() => exportTableToCsv(headers, rows, 'GMCSL_Loans')}
        onPrint={() => window.print()}
      />

      {filtered.length === 0 ? (
        <EmptyState title="No Loan Records" subtitle="Disbursed member loans and repayment ledgers will appear here." />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
                <th className="py-3 px-4">Loan No / Date</th>
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4 text-right">Disbursed</th>
                <th className="py-3 px-4 text-right">Principal Repaid</th>
                <th className="py-3 px-4 text-right">Interest / Fine</th>
                <th className="py-3 px-4 text-right">Balance</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((l) => (
                <tr key={l.loanId}>
                  <td className="py-3 px-4">
                    <p className="font-mono-tabular font-semibold">{l.loanNumber}</p>
                    <p className="text-xs font-mono-tabular text-slate-500">{l.loanDate}</p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-medium">{l.memberName}</p>
                    <p className="text-xs font-mono-tabular text-slate-500">{l.memberId}</p>
                  </td>
                  <td className="py-3 px-4 text-right font-mono-tabular">₹{l.loanAmount.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-mono-tabular">₹{l.loanRepayment.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-mono-tabular text-xs">₹{l.interest.toFixed(2)} / ₹{l.fine.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-mono-tabular font-bold text-[#142D4E] dark:text-white">₹{l.currentLoanBalance.toFixed(2)}</td>
                  <td className="py-3 px-4"><StatusLabel status={l.loanStatus} /></td>
                  <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                    {canAdd && l.currentLoanBalance > 0 && l.syncStatus !== 'Pending' && (
                      <button
                        onClick={() => {
                          setRepayLoan(l);
                          setRepayForm({ repaymentAmount: 0, interest: 0, fine: 0, date: new Date().toISOString().slice(0, 10), nextDueDate: l.nextDueDate, paymentStatus: 'Cash', paymentMethod: 'Loan' });
                          openModal('loanRepayForm');
                        }}
                        className="text-xs font-semibold text-[#087443] dark:text-emerald-400 hover:underline"
                      >
                        Repay
                      </button>
                    )}
                    <button
                      onClick={() =>
                        downloadReceiptPdf(
                          {
                            id: l.loanId,
                            receiptNumber: l.loanNumber,
                            receiptType: 'Loan Disbursement',
                            memberId: l.memberId,
                            memberName: l.memberName,
                            date: l.loanDate,
                            amount: l.loanAmount,
                            paymentMethod: l.paymentStatus,
                            details: `Repaid: ₹${l.loanRepayment}, Balance: ₹${l.currentLoanBalance}, Interest: ₹${l.interest}, Fine: ₹${l.fine}`,
                            verificationStatus: l.syncStatus === 'Pending' ? 'Provisional / Pending Sync' : 'Verified',
                            authorizedBy: l.createdBy,
                            createdAt: l.createdDate,
                          },
                          settings
                        )
                      }
                      className="text-xs font-semibold text-[#2563EB] hover:underline"
                    >
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 5. CASH BOOK REGISTER (FORM 4)
// ==========================================
export const CashBookView: React.FC = () => {
  const { session, snapshot, isOnline, tr, pushToast, syncNow, refreshLocalView, hasPermission, canEditAutoIds, askConfirm, modals, openModal, closeModal } = useApp();
  const entries = snapshot?.cashBook || [];
  const settings = snapshot?.settings!;
  const canAdd = hasPermission('cash_book', 'add');

  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    transactionId: '',
    date: new Date().toISOString().slice(0, 10),
    paymentMode: 'Deposit' as 'Deposit' | 'Payment',
    description: '',
    bankAmount: 0,
    cashAmount: 0,
    referenceNumber: '',
    notes: '',
    allowAdjustment: false,
  });

  const totalAmount = Math.round((Number(form.bankAmount || 0) + Number(form.cashAmount || 0)) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (totalAmount <= 0) {
      pushToast('error', 'Total Amount must be greater than zero.');
      return;
    }
    const safeTxnId = form.transactionId.trim() || makeAutoId('CB');
    const payload = { ...form, transactionId: safeTxnId };
    try {
      if (isOnline) {
        await apiFetch('/api/cashbook', { method: 'POST', body: JSON.stringify(payload) }, session.token);
        pushToast('success', 'Cash Book transaction recorded.');
        await syncNow();
      } else {
        await queueOfflineRecord({
          store: 'cash_book',
          module: 'cash_book',
          action: 'create',
          recordId: safeTxnId,
          localRecord: {
            ...payload,
            totalAmount,
            depositAmount: payload.paymentMode === 'Deposit' ? totalAmount : 0,
            paymentAmount: payload.paymentMode === 'Payment' ? totalAmount : 0,
            balance: 0,
          },
          payload,
          session,
        });
        pushToast('warning', tr('savedOfflineMsg'));
        await refreshLocalView();
      }
      closeModal('cashBookForm');
    } catch (err: any) {
      pushToast('error', err?.message || 'Cash book entry failed.');
    }
  };

  const handleReverse = async (c: CashBookRecord) => {
    if (!session || !isOnline) {
      pushToast('warning', 'Reversal requires internet connection.');
      return;
    }
    await askConfirm({
      title: 'Reverse Cash Book Entry',
      message: `Post an offsetting reversal entry for ${c.transactionId} (${c.paymentMode} ₹${c.totalAmount})?`,
      confirmLabel: 'Post Reversal',
      danger: true,
      onConfirm: async () => {
        try {
          await apiFetch('/api/ledger/reverse', { method: 'POST', body: JSON.stringify({ module: 'cash_book', recordId: c.transactionId, reason: 'Authorized Cash Book reversal' }) }, session.token);
          pushToast('success', 'Cash Book reversal posted.');
          await syncNow();
        } catch (err: any) {
          pushToast('error', err?.message || 'Reversal failed.');
        }
      },
    });
  };

  const filtered = entries.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.transactionId.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.referenceNumber.toLowerCase().includes(q);
  });

  const headers = ['Txn ID', 'Date', 'Mode', 'Description', 'Bank', 'Cash', 'Total', 'Running Balance', 'Ref'];
  const rows = filtered.map((c) => [c.transactionId, c.date, c.paymentMode, c.description, c.bankAmount, c.cashAmount, c.totalAmount, c.balance, c.referenceNumber]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white">{tr('nav_cash_book')}</h2>
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#667085] dark:text-slate-400 mt-0.5">
            <span className="inline-flex items-center gap-1"><Wallet className="w-3.5 h-3.5 text-[#087443]" /> Bank Balance: <strong className="font-mono-tabular text-[#1D2939] dark:text-white">₹{(snapshot?.stats.totalBankBalance || 0).toFixed(2)}</strong></span>
            <span>Cash Balance: <strong className="font-mono-tabular text-[#1D2939] dark:text-white">₹{(snapshot?.stats.totalCashBalance || 0).toFixed(2)}</strong></span>
          </div>
        </div>
        {canAdd && (
          <button
            onClick={() => {
              setForm({
                transactionId: `CB-${Date.now().toString(36).toUpperCase()}`,
                date: new Date().toISOString().slice(0, 10),
                paymentMode: 'Deposit',
                description: '',
                bankAmount: 0,
                cashAmount: 0,
                referenceNumber: '',
                notes: '',
                allowAdjustment: false,
              });
              openModal('cashBookForm');
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#087443] hover:bg-[#065c35] text-white text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>New Cash Book Entry</span>
          </button>
        )}
      </div>

      {modals.cashBookForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="font-display text-base font-bold text-[#142D4E] dark:text-white">Cash Book Register (Form 4)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">
                Transaction ID
                {canEditAutoIds && <span className="ml-1 text-[10px] text-[#087443] dark:text-emerald-400">(Editable)</span>}
              </label>
              <input
                type="text"
                required
                readOnly={!canEditAutoIds}
                value={form.transactionId}
                onChange={(e) => setForm({ ...form, transactionId: e.target.value })}
                onBlur={() => {
                  if (!form.transactionId.trim()) {
                    setForm((prev) => ({ ...prev, transactionId: makeAutoId('CB') }));
                  }
                }}
                className={`w-full px-3 py-2 text-sm rounded-lg border font-mono-tabular ${
                  !canEditAutoIds ? 'bg-slate-100 dark:bg-slate-800/70 cursor-not-allowed' : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('paymentMode')}</label>
              <select value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value as any })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <option value="Deposit">Deposit (Inflow)</option>
                <option value="Payment">Payment (Outflow)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('date')}</label>
              <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('referenceNumber')}</label>
              <input type="text" value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">{tr('description')} <span className="text-red-600">*</span></label>
              <input type="text" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('bankAmount')} (₹)</label>
              <input type="number" min={0} step="0.01" value={form.bankAmount} onChange={(e) => setForm({ ...form, bankAmount: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('cashAmount')} (₹)</label>
              <input type="number" min={0} step="0.01" value={form.cashAmount} onChange={(e) => setForm({ ...form, cashAmount: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-sm font-semibold">Total Transaction Amount: <span className="font-mono-tabular text-[#087443]">₹{totalAmount.toFixed(2)}</span></span>
            <div className="flex gap-3">
              <button type="button" onClick={() => closeModal('cashBookForm')} className="px-4 py-2 rounded-lg border text-sm">{tr('cancel')}</button>
              <button type="submit" className="px-5 py-2 rounded-lg bg-[#087443] text-white text-sm font-semibold">{tr('save')}</button>
            </div>
          </div>
        </form>
      )}

      <DataToolbar
        search={search}
        onSearchChange={setSearch}
        onExportPdf={() => exportTableToPdf('Cash Book', headers, rows, settings, 'GMCSL_CashBook')}
        onExportExcel={() => exportTableToExcel('CashBook', headers, rows, 'GMCSL_CashBook')}
        onExportCsv={() => exportTableToCsv(headers, rows, 'GMCSL_CashBook')}
        onPrint={() => window.print()}
      />

      {filtered.length === 0 ? (
        <EmptyState title="No Cash Book Entries" subtitle="Deposits and payments across Society Cash and Bank accounts appear here." />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
                <th className="py-3 px-4">Date / Txn ID</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-right">Bank</th>
                <th className="py-3 px-4 text-right">Cash</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((c) => (
                <tr key={c.transactionId}>
                  <td className="py-3 px-4">
                    <p className="font-mono-tabular">{c.date}</p>
                    <p className="text-xs font-mono-tabular text-slate-500">{c.transactionId}</p>
                  </td>
                  <td className="py-3 px-4"><StatusLabel status={c.paymentMode === 'Deposit' ? 'Active' : 'Pending'} /> <span className="text-xs ml-1">({c.paymentMode})</span></td>
                  <td className="py-3 px-4">{c.description}</td>
                  <td className="py-3 px-4 text-right font-mono-tabular">₹{c.bankAmount.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-mono-tabular">₹{c.cashAmount.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-mono-tabular font-semibold">₹{c.totalAmount.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() =>
                        downloadReceiptPdf(
                          {
                            id: c.transactionId,
                            receiptNumber: c.transactionId,
                            receiptType: 'Cash Book Voucher',
                            memberId: 'SOCIETY',
                            memberName: 'GMCSL Cash Book',
                            date: c.date,
                            amount: c.totalAmount,
                            paymentMethod: c.paymentMode,
                            details: `${c.description} (Bank: ₹${c.bankAmount}, Cash: ₹${c.cashAmount})`,
                            verificationStatus: c.syncStatus === 'Pending' ? 'Provisional / Pending Sync' : 'Verified',
                            authorizedBy: c.createdBy,
                            createdAt: c.createdDate,
                          },
                          settings
                        )
                      }
                      className="text-xs font-semibold text-[#2563EB] hover:underline"
                    >
                      Voucher PDF
                    </button>
                    {!c.isReversal && hasPermission('cash_book', 'edit') && (
                      <button onClick={() => handleReverse(c)} className="text-xs text-red-600 hover:underline">
                        Reverse
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 6. DEDICATED ACTIVE-LOAN REPAYMENT MODULE
// ==========================================
export const LoanRepaymentView: React.FC<{ readOnlyOwn?: boolean }> = ({ readOnlyOwn }) => {
  const {
    session,
    snapshot,
    isOnline,
    tr,
    pushToast,
    syncNow,
    refreshLocalView,
    hasPermission,
    canEditAutoIds,
    askConfirm,
    modals,
    openModal,
    closeModal,
  } = useApp();

  const loans = snapshot?.loans || [];
  const repayments = snapshot?.loanRepayments || [];
  const settings = snapshot?.settings!;

  const canAdd = !readOnlyOwn && hasPermission('loan_repayment', 'add');
  const canEdit = !readOnlyOwn && hasPermission('loan_repayment', 'edit');
  const canDelete = !readOnlyOwn && hasPermission('loan_repayment', 'delete');

  // Filter ONLY active loans with positive outstanding balance
  const activeLoans = useMemo(
    () =>
      loans.filter(
        (l) => (l.loanStatus === 'Active' || l.loanStatus === 'Running') && Number(l.currentLoanBalance || 0) > 0
      ),
    [loans]
  );

  // Unique borrowers who have at least one active loan
  const activeBorrowers = useMemo(() => {
    const map = new Map<string, { memberId: string; memberName: string }>();
    for (const l of activeLoans) {
      if (!map.has(l.memberId)) {
        map.set(l.memberId, { memberId: l.memberId, memberName: l.memberName });
      }
    }
    return Array.from(map.values());
  }, [activeLoans]);

  const [search, setSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [form, setForm] = useState({
    repaymentId: '',
    loanId: '',
    date: new Date().toISOString().slice(0, 10),
    principalPaid: 0,
    interestPaid: 0,
    finePaid: 0,
    paymentMode: 'Cash' as LoanRepaymentRecord['paymentMode'],
    memberSignatureUrl: '',
    secretarySignatureUrl: '',
    presidentSignatureUrl: '',
    photoUrl: '',
    notes: '',
  });

  const [editingRepay, setEditingRepay] = useState<LoanRepaymentRecord | null>(null);
  const [editForm, setEditForm] = useState({
    date: '',
    principalPaid: 0,
    interestPaid: 0,
    finePaid: 0,
    paymentMode: 'Cash' as LoanRepaymentRecord['paymentMode'],
    notes: '',
  });

  const memberActiveLoans = useMemo(
    () => activeLoans.filter((l) => l.memberId === selectedMemberId),
    [activeLoans, selectedMemberId]
  );

  const selectedLoan = useMemo(
    () => activeLoans.find((l) => l.loanId === form.loanId) || null,
    [activeLoans, form.loanId]
  );

  const openAdd = () => {
    const firstBorrower = activeBorrowers[0];
    const firstLoan = firstBorrower ? activeLoans.find((l) => l.memberId === firstBorrower.memberId) : undefined;
    setSelectedMemberId(firstBorrower?.memberId || '');
    setForm({
      repaymentId: makeAutoId('LREP'),
      loanId: firstLoan?.loanId || '',
      date: new Date().toISOString().slice(0, 10),
      principalPaid: 0,
      interestPaid: 0,
      finePaid: 0,
      paymentMode: 'Cash',
      memberSignatureUrl: '',
      secretarySignatureUrl: '',
      presidentSignatureUrl: '',
      photoUrl: '',
      notes: '',
    });
    openModal('loanRepayForm');
  };

  const handleBorrowerChange = (mid: string) => {
    setSelectedMemberId(mid);
    const firstLoan = activeLoans.find((l) => l.memberId === mid);
    setForm((prev) => ({
      ...prev,
      loanId: firstLoan?.loanId || '',
      principalPaid: 0,
    }));
  };

  const balanceBefore = Number(selectedLoan?.currentLoanBalance || 0);
  const balanceAfter = Math.max(0, Math.round((balanceBefore - Number(form.principalPaid || 0)) * 100) / 100);
  const savingCredit = Math.round((Number(form.interestPaid || 0) + Number(form.finePaid || 0)) * 100) / 100;
  const totalCollected = Math.round((Number(form.principalPaid || 0) + savingCredit) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !selectedLoan) {
      pushToast('error', 'Select a borrower and an active loan.');
      return;
    }
    const principalPaid = Number(form.principalPaid || 0);
    const interestPaid = Number(form.interestPaid || 0);
    const finePaid = Number(form.finePaid || 0);
    if (principalPaid < 0 || interestPaid < 0 || finePaid < 0 || principalPaid + interestPaid + finePaid <= 0) {
      pushToast('error', 'Enter a positive Principal, Interest, or Fine amount.');
      return;
    }
    if (principalPaid > balanceBefore) {
      pushToast('error', `Principal Paid (₹${principalPaid}) cannot exceed Current Loan Balance (₹${balanceBefore}).`);
      return;
    }
    const safeId = form.repaymentId.trim() || makeAutoId('LREP');
    const payload = {
      ...form,
      repaymentId: safeId,
      principalPaid,
      interestPaid,
      finePaid,
    };
    try {
      if (isOnline) {
        await apiFetch('/api/loan-repayments', { method: 'POST', body: JSON.stringify(payload) }, session.token);
        pushToast(
          'success',
          savingCredit > 0
            ? `Repayment saved. Remaining loan balance: ₹${balanceAfter.toFixed(2)}. Interest/Fine ₹${savingCredit.toFixed(2)} credited to Saving Register.`
            : `Repayment saved. Remaining loan balance: ₹${balanceAfter.toFixed(2)}.`
        );
        await syncNow();
      } else {
        const receiptNo = `PROV-LREP-${Date.now().toString().slice(-6)}`;
        const localRec: Partial<LoanRepaymentRecord> = {
          ...payload,
          loanNumber: selectedLoan.loanNumber,
          memberId: selectedLoan.memberId,
          memberName: selectedLoan.memberName,
          loanBalanceBefore: balanceBefore,
          totalPaid: totalCollected,
          loanBalanceAfter: balanceAfter,
          receiptNumber: receiptNo,
          savingId: savingCredit > 0 ? `PROV-SAV-${Date.now().toString().slice(-5)}` : '',
        };
        const provisionalReceipt: ReceiptRecord = {
          id: receiptNo,
          receiptNumber: receiptNo,
          receiptType: 'Loan Repayment',
          memberId: selectedLoan.memberId,
          memberName: selectedLoan.memberName,
          date: payload.date,
          amount: totalCollected,
          paymentMethod: payload.paymentMode,
          details: `Loan ${selectedLoan.loanNumber}: Principal ₹${principalPaid}, Interest ₹${interestPaid}, Fine ₹${finePaid}. Balance After: ₹${balanceAfter}`,
          verificationStatus: 'Provisional / Pending Sync',
          authorizedBy: session.user.fullName,
          createdAt: new Date().toISOString(),
        };
        await queueOfflineRecord({
          store: 'loan_repayments',
          module: 'loan_repayments',
          action: 'create',
          recordId: safeId,
          localRecord: localRec,
          payload,
          session,
          provisionalReceipt,
        });
        pushToast('warning', tr('savedOfflineMsg'));
        await refreshLocalView();
      }
      closeModal('loanRepayForm');
    } catch (err: any) {
      pushToast('error', err?.message || 'Loan repayment failed.');
    }
  };

  const openEditModal = (r: LoanRepaymentRecord) => {
    setEditingRepay(r);
    setEditForm({
      date: r.date,
      principalPaid: r.principalPaid,
      interestPaid: r.interestPaid,
      finePaid: r.finePaid,
      paymentMode: r.paymentMode,
      notes: r.notes || '',
    });
    openModal('loanRepaymentEditForm');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !editingRepay || !isOnline) {
      pushToast('warning', 'Editing repayments requires live server synchronization.');
      return;
    }
    try {
      await apiFetch(
        `/api/loan-repayments/${editingRepay.repaymentId}`,
        { method: 'PUT', body: JSON.stringify(editForm) },
        session.token
      );
      pushToast('success', `Repayment ${editingRepay.repaymentId} updated with recalculated loan & saving balances.`);
      closeModal('loanRepaymentEditForm');
      setEditingRepay(null);
      await syncNow();
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to update repayment.');
    }
  };

  const handleDeleteRepay = async (r: LoanRepaymentRecord) => {
    if (!session || !isOnline) {
      pushToast('warning', 'Deleting repayments requires live server synchronization.');
      return;
    }
    await askConfirm({
      title: 'Delete Repayment Entry',
      message: `Delete ${r.repaymentId} (Principal ₹${r.principalPaid}, Interest+Fine ₹${(r.interestPaid + r.finePaid).toFixed(2)})? This will restore ₹${r.principalPaid} to loan ${r.loanNumber} and remove any linked interest/fine saving entry.`,
      confirmLabel: 'Delete & Reverse Balances',
      danger: true,
      onConfirm: async () => {
        try {
          await apiFetch(`/api/loan-repayments/${r.repaymentId}`, { method: 'DELETE' }, session.token);
          pushToast('info', `Repayment ${r.repaymentId} deleted and balances restored.`);
          await syncNow();
        } catch (err: any) {
          pushToast('error', err?.message || 'Failed to delete repayment.');
        }
      },
    });
  };

  const filtered = repayments.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.repaymentId.toLowerCase().includes(q) ||
      r.loanNumber.toLowerCase().includes(q) ||
      r.memberId.toLowerCase().includes(q) ||
      r.memberName.toLowerCase().includes(q)
    );
  });

  const headers = ['Repayment ID', 'Date', 'Loan No', 'Member ID', 'Member Name', 'Principal', 'Interest', 'Fine', 'Total Paid', 'Bal After', 'Mode'];
  const rows = filtered.map((r) => [
    r.repaymentId,
    r.date,
    r.loanNumber,
    r.memberId,
    r.memberName,
    r.principalPaid,
    r.interestPaid,
    r.finePaid,
    r.totalPaid,
    r.loanBalanceAfter,
    r.paymentMode,
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white">{tr('nav_loan_repayment')}</h2>
          <p className="text-xs text-[#667085] dark:text-slate-400">
            Active Borrowers: <span className="font-mono-tabular font-semibold">{activeBorrowers.length}</span> · Principal Reduces Loan Balance · Interest &amp; Fine Credit Savings Automatically
          </p>
        </div>
        {canAdd && (
          <button
            onClick={openAdd}
            disabled={activeBorrowers.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#087443] hover:bg-[#065c35] text-white text-sm font-semibold disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Record Loan Repayment</span>
          </button>
        )}
      </div>

      {modals.loanRepayForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-[#087443] rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-display text-base font-bold text-[#142D4E] dark:text-white">Active Loan Installment Collection</h3>
            {selectedLoan && (
              <span className="text-xs font-mono-tabular font-semibold text-amber-700 dark:text-amber-400">
                Current Loan Balance: ₹{balanceBefore.toFixed(2)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">
                Repayment ID
                {canEditAutoIds && <span className="ml-1 text-[10px] text-[#087443] dark:text-emerald-400">(Editable)</span>}
              </label>
              <input
                type="text"
                required
                readOnly={!canEditAutoIds}
                value={form.repaymentId}
                onChange={(e) => setForm({ ...form, repaymentId: e.target.value })}
                onBlur={() => {
                  if (!form.repaymentId.trim()) {
                    setForm((prev) => ({ ...prev, repaymentId: makeAutoId('LREP') }));
                  }
                }}
                className={`w-full px-3 py-2 text-sm rounded-lg border font-mono-tabular ${
                  !canEditAutoIds ? 'bg-slate-100 dark:bg-slate-800/70 cursor-not-allowed' : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Active Borrower <span className="text-red-600">*</span></label>
              <select
                required
                value={selectedMemberId}
                onChange={(e) => handleBorrowerChange(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="">Select Borrower with Active Loan</option>
                {activeBorrowers.map((b) => (
                  <option key={b.memberId} value={b.memberId}>
                    {b.memberId} — {b.memberName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Active Loan Account <span className="text-red-600">*</span></label>
              <select
                required
                value={form.loanId}
                onChange={(e) => setForm({ ...form, loanId: e.target.value, principalPaid: 0 })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular"
              >
                <option value="">Select Loan</option>
                {memberActiveLoans.map((l) => (
                  <option key={l.loanId} value={l.loanId}>
                    {l.loanNumber} (Bal: ₹{l.currentLoanBalance.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('date')} <span className="text-red-600">*</span></label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Principal Repayment (₹)</label>
              <input
                type="number"
                min={0}
                max={balanceBefore}
                step="0.01"
                value={form.principalPaid}
                onChange={(e) => setForm({ ...form, principalPaid: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Interest Paid (₹ → Saving)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.interestPaid}
                onChange={(e) => setForm({ ...form, interestPaid: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Fine Paid (₹ → Saving)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.finePaid}
                onChange={(e) => setForm({ ...form, finePaid: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('paymentMode')}</label>
              <select
                value={form.paymentMode}
                onChange={(e) => setForm({ ...form, paymentMode: e.target.value as any })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="Cash">Cash</option>
                <option value="Online">Online</option>
                <option value="UPI">UPI</option>
                <option value="Bank">Bank</option>
                <option value="Saving">Saving</option>
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-xs font-medium mb-1">{tr('remarks')}</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Installment remarks or voucher note"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <FileUploadField label="Member Signature (Optional)" value={form.memberSignatureUrl} onChange={(u) => setForm({ ...form, memberSignatureUrl: u })} />
            <FileUploadField label="Secretary Signature (Optional)" value={form.secretarySignatureUrl} onChange={(u) => setForm({ ...form, secretarySignatureUrl: u })} />
            <FileUploadField label="President Signature (Optional)" value={form.presidentSignatureUrl} onChange={(u) => setForm({ ...form, presidentSignatureUrl: u })} />
            <FileUploadField label="Member / Receipt Photo (Optional)" accept="image/*" value={form.photoUrl} onChange={(u) => setForm({ ...form, photoUrl: u })} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs">
            <div>
              <span className="text-slate-500">Total Collected:</span>{' '}
              <strong className="font-mono-tabular text-[#142D4E] dark:text-white">₹{totalCollected.toFixed(2)}</strong>
            </div>
            <div>
              <span className="text-slate-500">New Loan Balance:</span>{' '}
              <strong className="font-mono-tabular text-[#087443] dark:text-emerald-400">₹{balanceAfter.toFixed(2)}</strong>
            </div>
            <div>
              <span className="text-slate-500">Auto-Credited to Saving (Int+Fine):</span>{' '}
              <strong className="font-mono-tabular text-blue-700 dark:text-blue-400">₹{savingCredit.toFixed(2)}</strong>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => closeModal('loanRepayForm')} className="px-4 py-2 rounded-lg border text-sm">
              {tr('cancel')}
            </button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#087443] hover:bg-[#065c35] text-white text-sm font-semibold">
              Confirm &amp; Record Repayment
            </button>
          </div>
        </form>
      )}

      {modals.loanRepaymentEditForm && editingRepay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 no-print">
          <form onSubmit={handleEditSubmit} className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4 shadow-2xl">
            <h3 className="font-display text-base font-bold text-[#142D4E] dark:text-white">
              Edit Repayment {editingRepay.repaymentId} ({editingRepay.loanNumber})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">{tr('date')}</label>
                <input type="date" required value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{tr('paymentMode')}</label>
                <select value={editForm.paymentMode} onChange={(e) => setEditForm({ ...editForm, paymentMode: e.target.value as any })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <option value="Cash">Cash</option>
                  <option value="Online">Online</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank">Bank</option>
                  <option value="Saving">Saving</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Principal Paid (₹)</label>
                <input type="number" min={0} step="0.01" value={editForm.principalPaid} onChange={(e) => setEditForm({ ...editForm, principalPaid: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Interest Paid (₹)</label>
                <input type="number" min={0} step="0.01" value={editForm.interestPaid} onChange={(e) => setEditForm({ ...editForm, interestPaid: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Fine Paid (₹)</label>
                <input type="number" min={0} step="0.01" value={editForm.finePaid} onChange={(e) => setEditForm({ ...editForm, finePaid: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{tr('remarks')}</label>
                <input type="text" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  closeModal('loanRepaymentEditForm');
                  setEditingRepay(null);
                }}
                className="px-4 py-2 rounded-lg border text-sm"
              >
                {tr('cancel')}
              </button>
              <button type="submit" className="px-5 py-2 rounded-lg bg-[#087443] text-white text-sm font-semibold">
                Save Update
              </button>
            </div>
          </form>
        </div>
      )}

      <DataToolbar
        search={search}
        onSearchChange={setSearch}
        onExportPdf={() => exportTableToPdf('Loan Repayments', headers, rows, settings, 'GMCSL_Loan_Repayments')}
        onExportExcel={() => exportTableToExcel('LoanRepayments', headers, rows, 'GMCSL_Loan_Repayments')}
        onExportCsv={() => exportTableToCsv(headers, rows, 'GMCSL_Loan_Repayments')}
        onPrint={() => window.print()}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="No Loan Repayments Recorded"
          subtitle={
            activeBorrowers.length > 0
              ? 'Select an active borrower to collect principal, interest, and fine.'
              : 'No active loans currently require repayment.'
          }
          actionLabel={canAdd && activeBorrowers.length > 0 ? 'Record Repayment' : undefined}
          onAction={canAdd && activeBorrowers.length > 0 ? openAdd : undefined}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
                <th className="py-3 px-4">Date / Repayment ID</th>
                <th className="py-3 px-4">Loan / Member</th>
                <th className="py-3 px-4 text-right">Principal</th>
                <th className="py-3 px-4 text-right">Int / Fine (Saved)</th>
                <th className="py-3 px-4 text-right">Total Paid</th>
                <th className="py-3 px-4 text-right">Bal After</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((r) => (
                <tr key={r.repaymentId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4">
                    <p className="font-mono-tabular">{r.date}</p>
                    <p className="text-xs font-mono-tabular text-slate-500">{r.repaymentId}</p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-mono-tabular font-semibold">{r.loanNumber}</p>
                    <p className="text-xs text-slate-500">{r.memberName} ({r.memberId})</p>
                  </td>
                  <td className="py-3 px-4 text-right font-mono-tabular">₹{r.principalPaid.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-mono-tabular text-xs text-blue-700 dark:text-blue-400">
                    ₹{r.interestPaid.toFixed(2)} / ₹{r.finePaid.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-[#087443] dark:text-emerald-400">
                    ₹{r.totalPaid.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-tabular">₹{r.loanBalanceAfter.toFixed(2)}</td>
                  <td className="py-3 px-4 text-xs">{r.paymentMode}</td>
                  <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() =>
                        downloadReceiptPdf(
                          {
                            id: r.receiptNumber || r.repaymentId,
                            receiptNumber: r.receiptNumber || r.repaymentId,
                            receiptType: 'Loan Repayment',
                            memberId: r.memberId,
                            memberName: r.memberName,
                            date: r.date,
                            amount: r.totalPaid,
                            paymentMethod: r.paymentMode,
                            details: `Loan ${r.loanNumber}: Principal ₹${r.principalPaid}, Interest ₹${r.interestPaid}, Fine ₹${r.finePaid}. Remaining Balance: ₹${r.loanBalanceAfter}`,
                            verificationStatus: r.syncStatus === 'Pending' ? 'Provisional / Pending Sync' : 'Verified',
                            authorizedBy: r.createdBy,
                            createdAt: r.createdDate,
                          },
                          settings
                        )
                      }
                      className="text-xs font-semibold text-[#2563EB] hover:underline"
                    >
                      PDF
                    </button>
                    {canEdit && r.syncStatus !== 'Pending' && (
                      <button
                        onClick={() => openEditModal(r)}
                        className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#087443] hover:underline"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    )}
                    {canDelete && r.syncStatus !== 'Pending' && (
                      <button
                        onClick={() => handleDeleteRepay(r)}
                        className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-600 hover:underline"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
