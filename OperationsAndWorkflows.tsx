import React, { useEffect, useState } from 'react';
import { Check, ExternalLink, Plus, QrCode, X } from 'lucide-react';
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
  generateQrDataUrl,
} from '../utils/exports';
import type { LoanApplicationRecord, OnlinePaymentRecord, ReceiptRecord } from '../types';

// ==========================================
// 6. MEETINGS & ATTENDANCE REGISTER (FORM 8)
// ==========================================
export const MeetingsView: React.FC = () => {
  const { session, snapshot, isOnline, tr, pushToast, syncNow, refreshLocalView, hasPermission, canEditAutoIds, modals, openModal, closeModal } = useApp();
  const meetings = snapshot?.meetings || [];
  const canAdd = hasPermission('meetings', 'add');
  const [form, setForm] = useState({
    meetingId: '',
    meetingNumber: '',
    meetingDate: new Date().toISOString().slice(0, 10),
    meetingType: 'General Meeting' as 'Executive Meeting' | 'General Meeting',
    meetingLocation: 'Garakhia Dhap Society Hall',
    meetingAgenda: '',
    meetingNotes: '',
  });

  const openAdd = () => {
    setForm({
      meetingId: `MTG-${Date.now().toString(36).toUpperCase()}`,
      meetingNumber: `M-${new Date().getFullYear()}-${String(meetings.length + 1).padStart(3, '0')}`,
      meetingDate: new Date().toISOString().slice(0, 10),
      meetingType: 'General Meeting',
      meetingLocation: 'Garakhia Dhap Society Hall',
      meetingAgenda: '',
      meetingNotes: '',
    });
    openModal('meetingForm');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    const safeMeetingId = form.meetingId.trim() || `MTG-${Date.now().toString(36).toUpperCase()}`;
    const safeMeetingNumber = form.meetingNumber.trim() || `M-${new Date().getFullYear()}-${String(meetings.length + 1).padStart(3, '0')}`;
    const payload = { ...form, meetingId: safeMeetingId, meetingNumber: safeMeetingNumber };
    try {
      if (isOnline) {
        await apiFetch('/api/meetings', { method: 'POST', body: JSON.stringify(payload) }, session.token);
        pushToast('success', 'Meeting registered.');
        await syncNow();
      } else {
        await queueOfflineRecord({
          store: 'meetings',
          module: 'meetings',
          action: 'create',
          recordId: safeMeetingId,
          localRecord: payload,
          payload,
          session,
        });
        pushToast('warning', tr('savedOfflineMsg'));
        await refreshLocalView();
      }
      closeModal('meetingForm');
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to save meeting.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white">{tr('nav_meetings')}</h2>
          <p className="text-xs text-[#667085] dark:text-slate-400">Create and manage Executive and General Meetings.</p>
        </div>
        {canAdd && (
          <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#087443] text-white text-sm font-semibold">
            <Plus className="w-4 h-4" />
            <span>Schedule / Record Meeting</span>
          </button>
        )}
      </div>

      {modals.meetingForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="font-display text-base font-bold">Meeting Register</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">
                Meeting ID
                {canEditAutoIds && <span className="ml-1 text-[10px] text-[#087443] dark:text-emerald-400">(Editable)</span>}
              </label>
              <input
                type="text"
                required
                readOnly={!canEditAutoIds}
                value={form.meetingId}
                onChange={(e) => setForm({ ...form, meetingId: e.target.value })}
                onBlur={() => {
                  if (!form.meetingId.trim()) {
                    setForm((prev) => ({ ...prev, meetingId: `MTG-${Date.now().toString(36).toUpperCase()}` }));
                  }
                }}
                className={`w-full px-3 py-2 text-sm rounded-lg border font-mono-tabular ${
                  !canEditAutoIds ? 'bg-slate-100 dark:bg-slate-800/70 cursor-not-allowed' : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Meeting Number <span className="text-red-600">*</span>
                {canEditAutoIds && <span className="ml-1 text-[10px] text-[#087443] dark:text-emerald-400">(Editable)</span>}
              </label>
              <input
                type="text"
                required
                readOnly={!canEditAutoIds}
                value={form.meetingNumber}
                onChange={(e) => setForm({ ...form, meetingNumber: e.target.value })}
                onBlur={() => {
                  if (!form.meetingNumber.trim()) {
                    setForm((prev) => ({
                      ...prev,
                      meetingNumber: `M-${new Date().getFullYear()}-${String(meetings.length + 1).padStart(3, '0')}`,
                    }));
                  }
                }}
                className={`w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 font-mono-tabular ${
                  !canEditAutoIds ? 'bg-slate-100 dark:bg-slate-800/70 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-800'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Meeting Date <span className="text-red-600">*</span></label>
              <input type="date" required value={form.meetingDate} onChange={(e) => setForm({ ...form, meetingDate: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Meeting Type</label>
              <select value={form.meetingType} onChange={(e) => setForm({ ...form, meetingType: e.target.value as any })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <option value="General Meeting">General Meeting</option>
                <option value="Executive Meeting">Executive Meeting</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Location <span className="text-red-600">*</span></label>
              <input type="text" required value={form.meetingLocation} onChange={(e) => setForm({ ...form, meetingLocation: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Agenda</label>
              <input type="text" value={form.meetingAgenda} onChange={(e) => setForm({ ...form, meetingAgenda: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Meeting Notes</label>
              <input type="text" value={form.meetingNotes} onChange={(e) => setForm({ ...form, meetingNotes: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => closeModal('meetingForm')} className="px-4 py-2 rounded-lg border text-sm">{tr('cancel')}</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#087443] text-white text-sm font-semibold">{tr('save')}</button>
          </div>
        </form>
      )}

      {meetings.length === 0 ? (
        <EmptyState title="No Meetings Recorded" subtitle="Schedule meetings here to link attendance tracking." actionLabel={canAdd ? 'Schedule Meeting' : undefined} onAction={canAdd ? openAdd : undefined} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {meetings.map((m) => (
            <div key={m.meetingId} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-mono-tabular font-semibold text-[#087443]">{m.meetingNumber}</span>
                <span>{m.meetingDate}</span>
              </div>
              <h3 className="font-display text-base font-bold text-[#142D4E] dark:text-white mt-1">{m.meetingType}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{m.meetingLocation}</p>
              {m.meetingAgenda && <p className="text-sm mt-3 text-slate-700 dark:text-slate-300">{m.meetingAgenda}</p>}
              {m.meetingNotes && <p className="text-xs mt-1 text-slate-500">{m.meetingNotes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const AttendanceRegisterView: React.FC<{ readOnlyOwn?: boolean }> = ({ readOnlyOwn }) => {
  const { session, snapshot, isOnline, tr, pushToast, syncNow, refreshLocalView, hasPermission, modals, openModal, closeModal } = useApp();
  const attendance = snapshot?.attendance || [];
  const members = snapshot?.members || [];
  const meetings = snapshot?.meetings || [];
  const settings = snapshot?.settings!;
  const canAdd = !readOnlyOwn && hasPermission('attendance', 'add');

  const [selectedMeetingNo, setSelectedMeetingNo] = useState('');
  const [bulkStatusMap, setBulkStatusMap] = useState<Record<string, 'Present' | 'Absent'>>({});
  const [search, setSearch] = useState('');

  const openBulk = () => {
    const firstMtg = meetings[0]?.meetingNumber || '';
    setSelectedMeetingNo(firstMtg);
    const map: Record<string, 'Present' | 'Absent'> = {};
    members.forEach((m) => (map[m.memberId] = 'Present'));
    setBulkStatusMap(map);
    openModal('attendanceBulkForm');
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !selectedMeetingNo) {
      pushToast('error', 'Select a Meeting first (create one in Meeting Register if empty).');
      return;
    }
    const mtg = meetings.find((m) => m.meetingNumber === selectedMeetingNo);
    const records = members
      .filter((m) => !attendance.some((a) => a.memberId === m.memberId && a.meetingNumber === selectedMeetingNo))
      .map((m) => ({
        attendanceId: `ATT-${Date.now().toString(36)}-${m.memberId}`,
        memberId: m.memberId,
        memberName: m.memberName,
        date: mtg?.meetingDate || new Date().toISOString().slice(0, 10),
        meetingLocation: mtg?.meetingLocation || '',
        meetingNumber: selectedMeetingNo,
        meetingMethod: mtg?.meetingType || 'General Meeting',
        attendanceStatus: bulkStatusMap[m.memberId] || 'Present',
      }));

    if (records.length === 0) {
      pushToast('warning', 'Attendance already recorded for all members in this meeting.');
      return;
    }

    try {
      if (isOnline) {
        await apiFetch('/api/attendance', { method: 'POST', body: JSON.stringify({ records }) }, session.token);
        pushToast('success', `Recorded attendance for ${records.length} member(s).`);
        await syncNow();
      } else {
        for (const r of records) {
          await queueOfflineRecord({
            store: 'attendance',
            module: 'attendance',
            action: 'create',
            recordId: r.attendanceId,
            localRecord: r,
            payload: r,
            session,
          });
        }
        pushToast('warning', tr('savedOfflineMsg'));
        await refreshLocalView();
      }
      closeModal('attendanceBulkForm');
    } catch (err: any) {
      pushToast('error', err?.message || 'Attendance save failed.');
    }
  };

  const filtered = attendance.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return a.memberId.toLowerCase().includes(q) || a.memberName.toLowerCase().includes(q) || a.meetingNumber.toLowerCase().includes(q);
  });

  const headers = ['Attendance ID', 'Meeting No', 'Date', 'Member ID', 'Member Name', 'Method', 'Status'];
  const rows = filtered.map((a) => [a.attendanceId, a.meetingNumber, a.date, a.memberId, a.memberName, a.meetingMethod, a.attendanceStatus]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white">{tr('nav_attendance')}</h2>
          <p className="text-xs text-[#667085] dark:text-slate-400">
            Present: {filtered.filter((a) => a.attendanceStatus === 'Present').length} · Absent: {filtered.filter((a) => a.attendanceStatus === 'Absent').length}
          </p>
        </div>
        {canAdd && (
          <button onClick={openBulk} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#087443] text-white text-sm font-semibold">
            <Plus className="w-4 h-4" />
            <span>Bulk Attendance Entry</span>
          </button>
        )}
      </div>

      {modals.attendanceBulkForm && (
        <form onSubmit={handleBulkSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="font-display text-base font-bold">Bulk Meeting Attendance (Form 8)</h3>
          <div>
            <label className="block text-xs font-medium mb-1">Select Meeting <span className="text-red-600">*</span></label>
            <select required value={selectedMeetingNo} onChange={(e) => setSelectedMeetingNo(e.target.value)} className="w-full max-w-md px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <option value="">Choose Meeting</option>
              {meetings.map((m) => (
                <option key={m.meetingId} value={m.meetingNumber}>
                  {m.meetingNumber} — {m.meetingDate} ({m.meetingType})
                </option>
              ))}
            </select>
          </div>
          <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
            {members.map((m) => (
              <div key={m.memberId} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span><strong>{m.memberName}</strong> <span className="text-xs font-mono-tabular text-slate-500">({m.memberId})</span></span>
                <div className="flex gap-2">
                  {(['Present', 'Absent'] as const).map((st) => (
                    <button
                      type="button"
                      key={st}
                      onClick={() => setBulkStatusMap({ ...bulkStatusMap, [m.memberId]: st })}
                      className={`px-3 py-1 rounded text-xs font-semibold ${
                        bulkStatusMap[m.memberId] === st
                          ? st === 'Present'
                            ? 'bg-[#087443] text-white'
                            : 'bg-red-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => closeModal('attendanceBulkForm')} className="px-4 py-2 rounded-lg border text-sm">{tr('cancel')}</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#087443] text-white text-sm font-semibold">Save Attendance</button>
          </div>
        </form>
      )}

      <DataToolbar
        search={search}
        onSearchChange={setSearch}
        onExportPdf={() => exportTableToPdf('Attendance Register', headers, rows, settings, 'GMCSL_Attendance')}
        onExportExcel={() => exportTableToExcel('Attendance', headers, rows, 'GMCSL_Attendance')}
        onExportCsv={() => exportTableToCsv(headers, rows, 'GMCSL_Attendance')}
      />

      {filtered.length === 0 ? (
        <EmptyState title="No Attendance Records" subtitle="Meeting attendance records will appear here." />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
                <th className="py-3 px-4">Meeting No / Date</th>
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Type / Location</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((a) => (
                <tr key={a.attendanceId}>
                  <td className="py-3 px-4 font-mono-tabular">{a.meetingNumber} · {a.date}</td>
                  <td className="py-3 px-4">{a.memberName} <span className="text-xs font-mono-tabular text-slate-500">({a.memberId})</span></td>
                  <td className="py-3 px-4 text-xs">{a.meetingMethod} · {a.meetingLocation}</td>
                  <td className="py-3 px-4"><StatusLabel status={a.attendanceStatus} /></td>
                  <td className="py-3 px-4"><StatusLabel status={a.syncStatus || 'Synced'} /></td>
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
// 7. LOAN APPLICATION & APPROVAL DESK (FORM 6)
// ==========================================
export const LoanApplicationView: React.FC<{ approvalMode?: boolean }> = ({ approvalMode }) => {
  const { session, snapshot, isOnline, tr, pushToast, syncNow, refreshLocalView, hasPermission, canEditAutoIds, modals, openModal, closeModal } = useApp();
  const apps = snapshot?.loanApplications || [];
  const members = snapshot?.members || [];
  const isMember = session?.user.role === 'Member';
  const canAdd = hasPermission('loan_application', 'add');
  const canReview = !isMember && hasPermission('loan_application', 'edit');

  const [reviewApp, setReviewApp] = useState<LoanApplicationRecord | null>(null);
  const [reviewForm, setReviewForm] = useState({
    applicationStatus: 'Approved' as LoanApplicationRecord['applicationStatus'],
    approvedAmount: 0,
    approvalNote: '',
    presidentSignature: '',
    secretarySignature: '',
  });

  const [form, setForm] = useState({
    applicationId: '',
    memberId: session?.user.memberId || '',
    applicationDate: new Date().toISOString().slice(0, 10),
    loanAmountRequired: 0,
    purposeOfLoan: 'Agriculture' as LoanApplicationRecord['purposeOfLoan'],
    additionalNote: '',
    supportingDocumentUrl: '',
  });

  const openApply = () => {
    setForm({
      applicationId: `LAPP-${Date.now().toString(36).toUpperCase()}`,
      memberId: session?.user.memberId || members[0]?.memberId || '',
      applicationDate: new Date().toISOString().slice(0, 10),
      loanAmountRequired: 0,
      purposeOfLoan: 'Agriculture',
      additionalNote: '',
      supportingDocumentUrl: '',
    });
    openModal('loanApplicationForm');
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    const safeAppId = form.applicationId.trim() || `LAPP-${Date.now().toString(36).toUpperCase()}`;
    const payload = { ...form, applicationId: safeAppId };
    const targetMember = members.find((m) => m.memberId === payload.memberId) || session.memberProfile;
    try {
      if (isOnline) {
        await apiFetch('/api/loan-applications', { method: 'POST', body: JSON.stringify(payload) }, session.token);
        pushToast('success', 'Loan application submitted.');
        await syncNow();
      } else {
        await queueOfflineRecord({
          store: 'loan_applications',
          module: 'loan_applications',
          action: 'create',
          recordId: safeAppId,
          localRecord: {
            ...payload,
            memberName: targetMember?.memberName || session.user.fullName,
            mobileNumber: targetMember?.mobileNumber || session.user.mobileNumber,
            applicationStatus: 'Pending',
            approvalNote: '',
            approvedAmount: 0,
            approvedBy: '',
            approvalDate: '',
            presidentSignature: '',
            secretarySignature: '',
          },
          payload,
          session,
        });
        pushToast('warning', tr('savedOfflineMsg'));
        await refreshLocalView();
      }
      closeModal('loanApplicationForm');
    } catch (err: any) {
      pushToast('error', err?.message || 'Loan application failed.');
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !reviewApp) return;
    if (!isOnline) {
      pushToast('warning', tr('serverApprovalMsg'));
      return;
    }
    try {
      await apiFetch(
        `/api/loan-applications/${reviewApp.applicationId}/review`,
        { method: 'PUT', body: JSON.stringify(reviewForm) },
        session.token
      );
      pushToast('success', `Application ${reviewApp.applicationId} updated to ${reviewForm.applicationStatus}.`);
      closeModal('loanReviewForm');
      setReviewApp(null);
      await syncNow();
    } catch (err: any) {
      pushToast('error', err?.message || 'Review update failed.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white">
            {approvalMode ? tr('nav_loan_approval') : tr('nav_loan_applications')}
          </h2>
          <p className="text-xs text-[#667085] dark:text-slate-400">
            Approval and actual loan disbursement are recorded separately for financial control.
          </p>
        </div>
        {canAdd && !approvalMode && (
          <button onClick={openApply} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#087443] text-white text-sm font-semibold">
            <Plus className="w-4 h-4" />
            <span>{tr('nav_apply_loan')}</span>
          </button>
        )}
      </div>

      {modals.loanApplicationForm && (
        <form onSubmit={handleApplySubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="font-display text-base font-bold">Loan Application (Form 6)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">
                Application ID
                {canEditAutoIds && <span className="ml-1 text-[10px] text-[#087443] dark:text-emerald-400">(Editable)</span>}
              </label>
              <input
                type="text"
                required
                readOnly={!canEditAutoIds}
                value={form.applicationId}
                onChange={(e) => setForm({ ...form, applicationId: e.target.value })}
                onBlur={() => {
                  if (!form.applicationId.trim()) {
                    setForm((prev) => ({ ...prev, applicationId: `LAPP-${Date.now().toString(36).toUpperCase()}` }));
                  }
                }}
                className={`w-full px-3 py-2 text-sm rounded-lg border font-mono-tabular ${
                  !canEditAutoIds ? 'bg-slate-100 dark:bg-slate-800/70 cursor-not-allowed' : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
                }`}
              />
            </div>
            {!isMember && (
              <div>
                <label className="block text-xs font-medium mb-1">Applicant Member</label>
                <select required value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  {members.map((m) => <option key={m.memberId} value={m.memberId}>{m.memberId} — {m.memberName}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1">{tr('loanAmountRequired')} (₹) <span className="text-red-600">*</span></label>
              <input type="number" min={100} required value={form.loanAmountRequired} onChange={(e) => setForm({ ...form, loanAmountRequired: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{tr('purposeOfLoan')}</label>
              <select value={form.purposeOfLoan} onChange={(e) => setForm({ ...form, purposeOfLoan: e.target.value as any })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <option value="Agriculture">Agriculture</option>
                <option value="Business">Business</option>
                <option value="Farmer">Farmer</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Application Date</label>
              <input type="date" required value={form.applicationDate} onChange={(e) => setForm({ ...form, applicationDate: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Additional Note</label>
              <input type="text" value={form.additionalNote} onChange={(e) => setForm({ ...form, additionalNote: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <FileUploadField label="Supporting Document (Optional)" accept="image/*,.pdf" value={form.supportingDocumentUrl} onChange={(u) => setForm({ ...form, supportingDocumentUrl: u })} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => closeModal('loanApplicationForm')} className="px-4 py-2 rounded-lg border text-sm">{tr('cancel')}</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#087443] text-white text-sm font-semibold">{tr('submit')}</button>
          </div>
        </form>
      )}

      {modals.loanReviewForm && reviewApp && (
        <form onSubmit={handleReviewSubmit} className="bg-white dark:bg-slate-900 border border-[#087443] rounded-xl p-5 space-y-4">
          <h3 className="font-display text-base font-bold text-[#142D4E] dark:text-white">
            Review Application {reviewApp.applicationId} — {reviewApp.memberName} (Requested: ₹{reviewApp.loanAmountRequired})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Decision / Status</label>
              <select value={reviewForm.applicationStatus} onChange={(e) => setReviewForm({ ...reviewForm, applicationStatus: e.target.value as any })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <option value="Under Review">Under Review</option>
                <option value="Recommended">Recommended (Forward to President)</option>
                {session?.user.role !== 'Secretary' && <option value="Approved">Approved</option>}
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Approved Amount (₹)</label>
              <input type="number" min={0} value={reviewForm.approvedAmount} onChange={(e) => setReviewForm({ ...reviewForm, approvedAmount: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Approval / Processing Note</label>
              <input type="text" value={reviewForm.approvalNote} onChange={(e) => setReviewForm({ ...reviewForm, approvalNote: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <FileUploadField label="Officer Signature Upload" value={session?.user.role === 'President' ? reviewForm.presidentSignature : reviewForm.secretarySignature} onChange={(u) => setReviewForm(session?.user.role === 'President' ? { ...reviewForm, presidentSignature: u } : { ...reviewForm, secretarySignature: u })} />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                closeModal('loanReviewForm');
                setReviewApp(null);
              }}
              className="px-4 py-2 rounded-lg border text-sm"
            >
              {tr('cancel')}
            </button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#087443] text-white text-sm font-semibold">Save Review</button>
          </div>
        </form>
      )}

      {apps.length === 0 ? (
        <EmptyState title="No Loan Applications" subtitle="Submitted loan applications appear here." actionLabel={canAdd ? tr('nav_apply_loan') : undefined} onAction={canAdd ? openApply : undefined} />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
                <th className="py-3 px-4">App ID / Date</th>
                <th className="py-3 px-4">Applicant</th>
                <th className="py-3 px-4">Purpose</th>
                <th className="py-3 px-4 text-right">Requested</th>
                <th className="py-3 px-4 text-right">Approved</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Approval Note</th>
                {canReview && <th className="py-3 px-4 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {apps.map((a) => (
                <tr key={a.applicationId}>
                  <td className="py-3 px-4">
                    <p className="font-mono-tabular font-semibold">{a.applicationId}</p>
                    <p className="text-xs font-mono-tabular text-slate-500">{a.applicationDate}</p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-medium">{a.memberName}</p>
                    <p className="text-xs font-mono-tabular text-slate-500">{a.memberId} · {a.mobileNumber}</p>
                  </td>
                  <td className="py-3 px-4">{a.purposeOfLoan}</td>
                  <td className="py-3 px-4 text-right font-mono-tabular">₹{a.loanAmountRequired.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-mono-tabular">{a.approvedAmount > 0 ? `₹${a.approvedAmount.toFixed(2)}` : '—'}</td>
                  <td className="py-3 px-4"><StatusLabel status={a.applicationStatus} /></td>
                  <td className="py-3 px-4 text-xs">{a.approvalNote || a.additionalNote || '—'}</td>
                  {canReview && (
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setReviewApp(a);
                          setReviewForm({
                            applicationStatus: session?.user.role === 'Secretary' ? 'Recommended' : 'Approved',
                            approvedAmount: a.approvedAmount || a.loanAmountRequired,
                            approvalNote: a.approvalNote || '',
                            presidentSignature: a.presidentSignature || '',
                            secretarySignature: a.secretarySignature || '',
                          });
                          openModal('loanReviewForm');
                        }}
                        className="text-xs font-semibold text-[#087443] hover:underline"
                      >
                        Review
                      </button>
                    </td>
                  )}
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
// 8. ONLINE PAYMENT & VERIFICATION (FORM 7)
// ==========================================
export const OnlinePaymentView: React.FC<{ verificationDesk?: boolean }> = ({ verificationDesk }) => {
  const { lang, session, snapshot, isOnline, tr, pushToast, syncNow, refreshLocalView, hasPermission, canEditAutoIds } = useApp();
  const payments = snapshot?.onlinePayments || [];
  const settings = snapshot?.settings!;
  const isMember = session?.user.role === 'Member';
  const canAdd = hasPermission('online_payment', 'add');
  const canVerify = !isMember && hasPermission('online_payment', 'edit');

  const [qrPreview, setQrPreview] = useState('');
  const [form, setForm] = useState({
    paymentId: `PAY-${Date.now().toString(36).toUpperCase()}`,
    memberId: session?.user.memberId || snapshot?.members[0]?.memberId || '',
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    paymentMethod: 'Saving' as OnlinePaymentRecord['paymentMethod'],
    upiTransactionId: '',
    paymentScreenshotUrl: '',
    notes: '',
  });

  useEffect(() => {
    if (settings?.upiQrImageUrl) {
      setQrPreview(settings.upiQrImageUrl);
    } else if (settings?.upiId) {
      generateQrDataUrl(`upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(settings.shortName || 'GMCSL')}&cu=INR`)
        .then(setQrPreview)
        .catch(() => undefined);
    }
  }, [settings?.upiId, settings?.upiQrImageUrl, settings?.shortName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (!form.upiTransactionId.trim()) {
      pushToast('error', 'UPI Transaction ID is required.');
      return;
    }
    const safePaymentId = form.paymentId.trim() || `PAY-${Date.now().toString(36).toUpperCase()}`;
    const payload = { ...form, paymentId: safePaymentId };
    const targetMember = snapshot?.members.find((m) => m.memberId === payload.memberId) || session.memberProfile;
    try {
      if (isOnline) {
        await apiFetch('/api/online-payments', { method: 'POST', body: JSON.stringify(payload) }, session.token);
        pushToast('info', tr('paymentPendingMsg'));
        await syncNow();
      } else {
        // Offline submissions MUST remain Pending until verified online
        await queueOfflineRecord({
          store: 'online_payments',
          module: 'online_payments',
          action: 'create',
          recordId: safePaymentId,
          localRecord: {
            ...payload,
            memberName: targetMember?.memberName || session.user.fullName,
            verificationStatus: 'Pending',
            verifiedBy: '',
            verificationDate: '',
            receiptNumber: '',
          },
          payload,
          session,
        });
        pushToast('warning', `${tr('savedOfflineMsg')} ${tr('paymentPendingMsg')}`);
        await refreshLocalView();
      }
      setForm({
        ...form,
        paymentId: `PAY-${Date.now().toString(36).toUpperCase()}`,
        amount: 0,
        upiTransactionId: '',
        paymentScreenshotUrl: '',
        notes: '',
      });
    } catch (err: any) {
      pushToast('error', err?.message || 'Payment submission failed.');
    }
  };

  const handleVerify = async (p: OnlinePaymentRecord, decision: 'Verified' | 'Rejected') => {
    if (!session) return;
    if (!isOnline) {
      pushToast('warning', 'Payment verification requires live server connectivity.');
      return;
    }
    try {
      await apiFetch(
        `/api/online-payments/${p.paymentId}/verify`,
        { method: 'POST', body: JSON.stringify({ decision, notes: decision === 'Verified' ? 'Verified against bank/UPI statement' : 'Transaction ID not found' }) },
        session.token
      );
      pushToast('success', `Payment ${p.paymentId} marked as ${decision}.`);
      await syncNow();
    } catch (err: any) {
      pushToast('error', err?.message || 'Verification failed.');
    }
  };

  const upiLink = settings?.upiId
    ? `upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(settings.shortName || 'GMCSL')}&am=${form.amount > 0 ? form.amount : ''}&cu=INR`
    : '';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white">
          {verificationDesk ? tr('nav_payment_verification') : tr('nav_online_payments')}
        </h2>
        <p className="text-xs text-[#667085] dark:text-slate-400">
          Submitted UPI payments remain Pending until verified online by an authorized officer.
        </p>
      </div>

      {!verificationDesk && canAdd && settings?.onlinePaymentEnabled !== false && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Society UPI QR Card */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col items-center text-center">
            <h3 className="font-display text-sm font-bold text-[#142D4E] dark:text-white mb-3">Official Society UPI QR</h3>
            {settings?.showUpiQr !== false && qrPreview ? (
              <img src={qrPreview} alt="Society UPI QR" className="w-44 h-44 rounded-xl border border-slate-200 p-2 bg-white object-contain" />
            ) : (
              <div className="w-44 h-44 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-xs text-slate-400 p-4">
                <QrCode className="w-8 h-8 mb-2" />
                <span>UPI QR not configured by System yet.</span>
              </div>
            )}
            {settings?.upiId && (
              <p className="mt-3 text-xs font-mono-tabular font-semibold text-[#087443] dark:text-emerald-400">
                UPI ID: {settings.upiId}
              </p>
            )}
            <p className="mt-2 text-xs text-[#667085] dark:text-slate-400 leading-relaxed">
              {lang === 'as' && settings?.paymentInstructionsAs ? settings.paymentInstructionsAs : settings?.paymentInstructions}
            </p>
            {upiLink && (
              <a
                href={upiLink}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#142D4E] text-white text-xs font-semibold hover:bg-[#0f223b]"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Pay Now via UPI App</span>
              </a>
            )}
          </div>

          {/* Payment Submission Form 7 */}
          <form onSubmit={handleSubmit} className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="font-display text-base font-bold text-[#142D4E] dark:text-white">Submit Payment Proof (Form 7)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Payment ID
                  {canEditAutoIds && <span className="ml-1 text-[10px] text-[#087443] dark:text-emerald-400">(Editable)</span>}
                </label>
                <input
                  type="text"
                  required
                  readOnly={!canEditAutoIds}
                  value={form.paymentId}
                  onChange={(e) => setForm({ ...form, paymentId: e.target.value })}
                  onBlur={() => {
                    if (!form.paymentId.trim()) {
                      setForm((prev) => ({ ...prev, paymentId: `PAY-${Date.now().toString(36).toUpperCase()}` }));
                    }
                  }}
                  className={`w-full px-3 py-2 text-sm rounded-lg border font-mono-tabular ${
                    !canEditAutoIds ? 'bg-slate-100 dark:bg-slate-800/70 cursor-not-allowed' : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
                  }`}
                />
              </div>
              {!isMember && (
                <div>
                  <label className="block text-xs font-medium mb-1">{tr('memberId')}</label>
                  <select value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    {(snapshot?.members || []).map((m) => <option key={m.memberId} value={m.memberId}>{m.memberId} — {m.memberName}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium mb-1">{tr('date')} <span className="text-red-600">*</span></label>
                <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{tr('amount')} (₹) <span className="text-red-600">*</span></label>
                <input type="number" min={1} step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{tr('paymentMethod')}</label>
                <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as any })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <option value="Saving">Saving</option>
                  <option value="Loan">Loan</option>
                  <option value="Interest">Interest</option>
                  <option value="Fine">Fine</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{tr('upiTransactionId')} <span className="text-red-600">*</span></label>
                <input type="text" required value={form.upiTransactionId} onChange={(e) => setForm({ ...form, upiTransactionId: e.target.value })} placeholder="Enter UTR / Transaction ID" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{tr('remarks')}</label>
                <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
              </div>
              <FileUploadField label="Payment Screenshot Upload" value={form.paymentScreenshotUrl} onChange={(u) => setForm({ ...form, paymentScreenshotUrl: u })} />
            </div>
            <div className="flex justify-end">
              <button type="submit" className="px-5 py-2.5 rounded-lg bg-[#087443] hover:bg-[#065c35] text-white text-sm font-semibold">
                Submit Payment for Verification
              </button>
            </div>
          </form>
        </div>
      )}

      {payments.length === 0 ? (
        <EmptyState title="No Online Payment Submissions" subtitle="Member UPI payment submissions and verification statuses appear here." />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
                <th className="py-3 px-4">Date / ID</th>
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">UPI Txn ID</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Verification</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {payments.map((p) => (
                <tr key={p.paymentId}>
                  <td className="py-3 px-4">
                    <p className="font-mono-tabular">{p.date}</p>
                    <p className="text-xs font-mono-tabular text-slate-500">{p.paymentId}</p>
                  </td>
                  <td className="py-3 px-4">{p.memberName} <span className="text-xs font-mono-tabular text-slate-500">({p.memberId})</span></td>
                  <td className="py-3 px-4 font-mono-tabular">{p.upiTransactionId}</td>
                  <td className="py-3 px-4">{p.paymentMethod}</td>
                  <td className="py-3 px-4 text-right font-mono-tabular font-semibold">₹{p.amount.toFixed(2)}</td>
                  <td className="py-3 px-4"><StatusLabel status={p.verificationStatus} /></td>
                  <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                    {canVerify && p.verificationStatus === 'Pending' && p.syncStatus !== 'Pending' && (
                      <>
                        <button onClick={() => handleVerify(p, 'Verified')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 text-white text-xs font-semibold">
                          <Check className="w-3 h-3" /> Verify
                        </button>
                        <button onClick={() => handleVerify(p, 'Rejected')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-600 text-white text-xs font-semibold">
                          <X className="w-3 h-3" /> Reject
                        </button>
                      </>
                    )}
                    {p.verificationStatus === 'Verified' && (
                      <button
                        onClick={() =>
                          downloadReceiptPdf(
                            {
                              id: p.receiptNumber || p.paymentId,
                              receiptNumber: p.receiptNumber || p.paymentId,
                              receiptType: 'Online Payment',
                              memberId: p.memberId,
                              memberName: p.memberName,
                              date: p.date,
                              amount: p.amount,
                              paymentMethod: p.paymentMethod,
                              details: `UPI Transaction: ${p.upiTransactionId}`,
                              verificationStatus: 'Verified',
                              authorizedBy: p.verifiedBy,
                              createdAt: p.createdDate,
                            } as ReceiptRecord,
                            settings
                          )
                        }
                        className="text-xs font-semibold text-[#2563EB] hover:underline"
                      >
                        Verified Receipt PDF
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
