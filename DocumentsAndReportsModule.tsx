import React, { useEffect, useState } from 'react';
import { Award, Bell, CreditCard, Download, Palette, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../offline/syncEngine';
import { EmptyState, StatusLabel } from '../components/UiPrimitives';
import {
  DynamicCredentialBuilder,
  renderTemplateText,
  resolveCredentialTemplate,
} from '../components/DynamicCredentialBuilder';
import {
  downloadMemberIdCardPdf,
  downloadMembershipCertificatePdf,
  downloadReceiptPdf,
  exportTableToCsv,
  exportTableToExcel,
  exportTableToPdf,
  generateQrDataUrl,
} from '../utils/exports';
import type { MemberRecord, NoticeRecord } from '../types';

// ==========================================
// ID CARD & MEMBERSHIP CERTIFICATE HUB
// ==========================================
export const IdAndCertificateHub: React.FC<{ onlyOwn?: boolean; defaultTab?: 'id' | 'cert' }> = ({
  onlyOwn,
  defaultTab = 'id',
}) => {
  const { session, snapshot, isOnline, tr, pushToast, syncNow, hasPermission } = useApp();
  const members = snapshot?.members || [];
  const settings = snapshot?.settings!;
  const canCustomize = !onlyOwn && (session?.user.role === 'System' || hasPermission('id_certificates', 'edit'));

  const [tab, setTab] = useState<'id' | 'cert'>(defaultTab);
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(
    onlyOwn ? session?.user.memberId || '' : members[0]?.memberId || ''
  );
  const [qrUrl, setQrUrl] = useState('');

  const selectedMember: MemberRecord | undefined =
    members.find((m) => m.memberId === selectedMemberId) || members[0];

  useEffect(() => {
    if (selectedMember) {
      generateQrDataUrl(`GMCSL-VERIFY:${selectedMember.memberId}|${selectedMember.memberName}|${selectedMember.joinDate}`)
        .then(setQrUrl)
        .catch(() => undefined);
    }
  }, [selectedMember?.memberId]);

  const handleGenerate = async (type: 'ID Card' | 'Membership Certificate') => {
    if (!selectedMember || !session) return;
    const certNo = `${type === 'ID Card' ? 'IDC' : 'CERT'}-${selectedMember.memberId}`;
    if (isOnline && session.user.role !== 'Member') {
      await apiFetch(
        '/api/certificates',
        {
          method: 'POST',
          body: JSON.stringify({
            certificateNumber: certNo,
            certificateType: type,
            memberId: selectedMember.memberId,
            memberName: selectedMember.memberName,
          }),
        },
        session.token
      ).catch(() => undefined);
      await syncNow();
    }
    if (type === 'ID Card') {
      await downloadMemberIdCardPdf(selectedMember, settings);
      pushToast('success', 'Digital ID Card PDF downloaded.');
    } else {
      await downloadMembershipCertificatePdf(selectedMember, certNo, settings);
      pushToast('success', 'Membership Certificate PDF downloaded.');
    }
  };

  if (!selectedMember) {
    return <EmptyState title="No Member Selected" subtitle="Register or select a member to preview and download ID Cards or Certificates." />;
  }

  const idTpl = resolveCredentialTemplate('id', settings);
  const certTpl = resolveCredentialTemplate('cert', settings);
  const certNo = `CERT-${selectedMember.memberId}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white">{tr('nav_id_certificates')}</h2>
          <p className="text-xs text-[#667085] dark:text-slate-400">Preview, customize templates, generate, and download official QR-verified PDF credentials.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg">
            <button
              onClick={() => setTab('id')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md ${tab === 'id' ? 'bg-white dark:bg-slate-900 text-[#142D4E] dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}
            >
              Digital ID Card
            </button>
            <button
              onClick={() => setTab('cert')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md ${tab === 'cert' ? 'bg-white dark:bg-slate-900 text-[#142D4E] dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}
            >
              Membership Certificate
            </button>
          </div>
          {canCustomize && (
            <button
              type="button"
              onClick={() => setShowBuilder((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border ${
                showBuilder
                  ? 'bg-[#142D4E] text-white border-[#142D4E]'
                  : 'bg-white dark:bg-slate-900 text-[#142D4E] dark:text-white border-slate-300 dark:border-slate-700'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>{showBuilder ? 'Hide Template Designer' : 'Design & Customize Templates'}</span>
            </button>
          )}
        </div>
      </div>

      {canCustomize && showBuilder && (
        <DynamicCredentialBuilder mode={tab} />
      )}

      {!onlyOwn && (
        <div className="max-w-sm">
          <label className="block text-xs font-medium mb-1">Select Member</label>
          <select
            value={selectedMember.memberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            {members.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.memberId} — {m.memberName}
              </option>
            ))}
          </select>
        </div>
      )}

      {tab === 'id' ? (
        <div
          style={{
            backgroundColor: idTpl.backgroundColor,
            color: idTpl.textColor,
            borderColor: idTpl.borderStyle === 'none' ? 'transparent' : idTpl.primaryColor,
          }}
          className={`max-w-lg rounded-2xl overflow-hidden shadow-sm ${
            idTpl.borderStyle === 'double' || idTpl.borderStyle === 'ornate'
              ? 'border-4'
              : idTpl.borderStyle === 'solid'
                ? 'border-2'
                : 'border-0'
          }`}
        >
          <div
            style={{ backgroundColor: idTpl.secondaryColor, borderBottomColor: idTpl.primaryColor }}
            className="text-white px-5 py-3 flex items-center justify-between border-b-4"
          >
            <div className="flex items-center gap-2.5">
              {idTpl.showLogo && <img src={settings?.logoUrl || '/icon.svg'} alt="Logo" className="w-7 h-7 rounded bg-white p-0.5" />}
              <div>
                <p className="text-xs font-bold tracking-wide">{renderTemplateText(idTpl.title || settings?.shortName || 'GMCSL', selectedMember, settings)}</p>
                <p className="text-[11px] opacity-80 truncate max-w-[260px]">{renderTemplateText(idTpl.subtitle, selectedMember, settings)}</p>
              </div>
            </div>
            <CreditCard className="w-5 h-5" style={{ color: idTpl.accentColor }} />
          </div>
          <div className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              {idTpl.showPhoto && (
                selectedMember.photoUrl ? (
                  <img src={selectedMember.photoUrl} alt={selectedMember.memberName} className="w-20 h-24 rounded-lg object-cover border border-slate-200" />
                ) : (
                  <div className="w-20 h-24 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">
                    PHOTO
                  </div>
                )
              )}
              <div className="space-y-1 text-xs">
                {idTpl.elements.filter((e) => e.visible).map((el) => (
                  <p
                    key={el.id}
                    style={{ color: el.color || idTpl.textColor }}
                    className={el.fontWeight === 'bold' ? 'font-bold text-sm' : 'font-mono-tabular'}
                  >
                    {renderTemplateText(el.valueTemplate, selectedMember, settings)}
                  </p>
                ))}
              </div>
            </div>
            {idTpl.showQr && qrUrl && (
              <img src={qrUrl} alt="Verification QR" className="w-20 h-20 rounded border border-slate-200 bg-white p-1 shrink-0" />
            )}
          </div>
          {(idTpl.showSecretarySignature || idTpl.showPresidentSignature || idTpl.showCustomSignature) && (
            <div className="px-5 pb-3 flex items-end justify-between text-[10px]">
              <span className="opacity-70">{renderTemplateText(idTpl.footerText, selectedMember, settings)}</span>
              <div className="text-center border-t border-slate-400 pt-1 px-2">
                {idTpl.showCustomSignature && idTpl.customSignatureUrl && (
                  <img src={idTpl.customSignatureUrl} alt="Sign" className="h-5 mx-auto mb-0.5 object-contain" />
                )}
                <span>
                  {idTpl.showSecretarySignature
                    ? 'Secretary Signature'
                    : idTpl.showPresidentSignature
                      ? 'President Signature'
                      : idTpl.customSignatureLabel || 'Authorized Signature'}
                </span>
              </div>
            </div>
          )}
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              onClick={() => handleGenerate('ID Card')}
              style={{ backgroundColor: idTpl.primaryColor }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-xs font-semibold"
            >
              <Download className="w-4 h-4" />
              <span>Download ID Card PDF</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: certTpl.backgroundColor,
            color: certTpl.textColor,
            borderColor: certTpl.borderStyle === 'none' ? 'transparent' : certTpl.primaryColor,
          }}
          className={`max-w-3xl rounded-xl p-6 sm:p-10 shadow-sm relative ${
            certTpl.borderStyle === 'none' ? 'border-0' : 'border-4'
          }`}
        >
          <div
            style={{ borderColor: certTpl.borderStyle === 'ornate' || certTpl.borderStyle === 'double' ? certTpl.accentColor : 'transparent' }}
            className={`${certTpl.borderStyle === 'ornate' || certTpl.borderStyle === 'double' ? 'border-2' : ''} rounded-lg p-6 text-center space-y-4`}
          >
            <div className="flex items-center justify-center gap-3">
              {certTpl.showLogo && <img src={settings?.logoUrl || '/icon.svg'} alt="Logo" className="w-10 h-10 rounded" />}
              <h3 style={{ color: certTpl.secondaryColor }} className="font-display text-xl sm:text-2xl font-bold">
                {renderTemplateText(certTpl.subtitle, selectedMember, settings, certNo)}
              </h3>
            </div>
            <div style={{ backgroundColor: certTpl.primaryColor }} className="inline-block px-5 py-1.5 text-white text-xs font-bold tracking-widest rounded">
              {renderTemplateText(certTpl.title, selectedMember, settings, certNo)}
            </div>
            <div className="flex justify-between text-xs font-mono-tabular opacity-75 pt-2">
              <span>Cert No: {certNo}</span>
              <span>Date: {new Date().toISOString().slice(0, 10)}</span>
            </div>
            <div className="space-y-2 py-2">
              {certTpl.elements.filter((e) => e.visible).map((el) => (
                <p
                  key={el.id}
                  style={{ color: el.color || certTpl.textColor, fontSize: `${Math.max(12, el.fontSize)}px` }}
                  className={el.fontWeight === 'bold' ? 'font-display font-bold' : ''}
                >
                  {renderTemplateText(el.valueTemplate, selectedMember, settings, certNo)}
                </p>
              ))}
            </div>
            <div className="pt-6 flex flex-wrap items-end justify-between gap-4">
              {certTpl.showQr && qrUrl && <img src={qrUrl} alt="Verify QR" className="w-20 h-20 border bg-white p-1 rounded" />}
              <div className="flex flex-wrap gap-8 text-xs ml-auto">
                {certTpl.showSecretarySignature && (
                  <div className="border-t border-slate-400 pt-1 px-3">Secretary Signature</div>
                )}
                {certTpl.showPresidentSignature && (
                  <div className="border-t border-slate-400 pt-1 px-3">President Signature</div>
                )}
                {certTpl.showCustomSignature && (
                  <div className="border-t border-slate-400 pt-1 px-3 text-center">
                    {certTpl.customSignatureUrl && (
                      <img src={certTpl.customSignatureUrl} alt="Custom Sig" className="h-6 mx-auto mb-1 object-contain" />
                    )}
                    <span>{certTpl.customSignatureLabel || 'Authorized Signature'}</span>
                  </div>
                )}
              </div>
            </div>
            {certTpl.footerText && (
              <p className="text-[11px] opacity-70 pt-2">{renderTemplateText(certTpl.footerText, selectedMember, settings, certNo)}</p>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => handleGenerate('Membership Certificate')}
              style={{ backgroundColor: certTpl.primaryColor }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-xs font-semibold"
            >
              <Award className="w-4 h-4" />
              <span>Download Certificate PDF</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// NOTICE BOARD & NOTIFICATIONS
// ==========================================
export const NoticeBoardView: React.FC = () => {
  const { lang, session, snapshot, isOnline, tr, pushToast, syncNow, hasPermission, modals, setModalOpen, closeModal } = useApp();
  const notices = snapshot?.notices || [];
  const canAdd = hasPermission('notices', 'add');
  const canDelete = hasPermission('notices', 'delete');
  const [form, setForm] = useState({
    title: '',
    titleAs: '',
    content: '',
    contentAs: '',
    category: 'General' as NoticeRecord['category'],
    targetRole: 'Everyone' as NoticeRecord['targetRole'],
    publishDate: new Date().toISOString().slice(0, 10),
    expiryDate: '',
    isPublished: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !isOnline) {
      pushToast('warning', 'Publishing notices requires online connectivity.');
      return;
    }
    try {
      await apiFetch('/api/notices', { method: 'POST', body: JSON.stringify(form) }, session.token);
      pushToast('success', 'Notice published.');
      closeModal('noticeForm');
      await syncNow();
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to publish notice.');
    }
  };

  const handleDelete = async (noticeId: string) => {
    if (!session || !isOnline) return;
    await apiFetch(`/api/notices/${noticeId}`, { method: 'DELETE' }, session.token);
    pushToast('info', 'Notice removed.');
    await syncNow();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white">{tr('nav_notices')}</h2>
          <p className="text-xs text-[#667085] dark:text-slate-400">Society announcements, meeting notices, and emergency circulars.</p>
        </div>
        {canAdd && (
          <button onClick={() => setModalOpen('noticeForm', !modals.noticeForm)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#087443] text-white text-sm font-semibold">
            <Plus className="w-4 h-4" />
            <span>Publish Notice</span>
          </button>
        )}
      </div>

      {modals.noticeForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Title (English) <span className="text-red-600">*</span></label>
              <input type="text" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Title (Assamese - অসমীয়া)</label>
              <input type="text" value={form.titleAs} onChange={(e) => setForm({ ...form, titleAs: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as any })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <option value="General">General</option>
                <option value="Meeting">Meeting</option>
                <option value="Payment">Payment</option>
                <option value="Important Announcement">Important Announcement</option>
                <option value="Emergency">Emergency</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Target Role</label>
              <select value={form.targetRole} onChange={(e) => setForm({ ...form, targetRole: e.target.value as any })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <option value="Everyone">Everyone</option>
                <option value="Member">Member</option>
                <option value="Secretary">Secretary</option>
                <option value="President">President</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Content (English) <span className="text-red-600">*</span></label>
              <textarea required rows={3} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Content (Assamese - অসমীয়া)</label>
              <textarea rows={2} value={form.contentAs} onChange={(e) => setForm({ ...form, contentAs: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => closeModal('noticeForm')} className="px-4 py-2 rounded-lg border text-sm">{tr('cancel')}</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#087443] text-white text-sm font-semibold">Publish</button>
          </div>
        </form>
      )}

      {notices.length === 0 ? (
        <EmptyState title="No Notices Published" subtitle="Published society announcements and circulars will appear here." />
      ) : (
        <div className="space-y-4">
          {notices.map((n) => (
            <div key={n.noticeId} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-[#087443]">{n.category}</span>
                  <span>·</span>
                  <span>Target: {n.targetRole}</span>
                  <span>·</span>
                  <span className="font-mono-tabular">{n.publishDate}</span>
                </div>
                <h3 className="font-display text-base font-bold text-[#142D4E] dark:text-white mt-1">
                  {lang === 'as' && n.titleAs ? n.titleAs : n.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                  {lang === 'as' && n.contentAs ? n.contentAs : n.content}
                </p>
              </div>
              {canDelete && (
                <button onClick={() => handleDelete(n.noticeId)} className="text-red-600 hover:bg-red-50 p-2 rounded-lg shrink-0" title="Delete notice">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const NotificationsCenterView: React.FC = () => {
  const { session, snapshot, isOnline, syncNow, tr } = useApp();
  const list = snapshot?.notifications || [];

  const markAll = async () => {
    if (!session || !isOnline) return;
    await apiFetch('/api/notifications/mark-all-read', { method: 'POST' }, session.token);
    await syncNow();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white">{tr('notifications')}</h2>
        {list.some((n) => !n.isRead) && isOnline && (
          <button onClick={markAll} className="text-xs font-semibold text-[#087443] hover:underline">
            {tr('markAllRead')}
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <EmptyState title={tr('noNotifications')} subtitle="Loan updates, saving entries, payment verifications, and notices appear here." />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
          {list.map((n) => (
            <div key={n.notificationId} className={`p-4 flex items-start gap-3 ${!n.isRead ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''}`}>
              <Bell className="w-4 h-4 text-[#087443] mt-1 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-[#142D4E] dark:text-slate-200">{n.type}</span>
                  <span className="font-mono-tabular">{new Date(n.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm font-semibold mt-0.5">{n.title}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ==========================================
// REPORTS & STATEMENTS (16 SOCIETY + 6 MEMBER)
// ==========================================
export const ReportsCenterView: React.FC = () => {
  const { session, snapshot, tr } = useApp();
  const isMember = session?.user.role === 'Member';
  const settings = snapshot?.settings!;

  const reportDefs = isMember
    ? [
        { id: 'member_saving', title: 'My Saving Statement' },
        { id: 'member_loan', title: 'My Loan Statement' },
        { id: 'member_share', title: 'My Share Statement' },
        { id: 'member_payment', title: 'My Online Payment History' },
        { id: 'member_attendance', title: 'My Attendance History' },
        { id: 'member_receipt', title: 'My Receipt History' },
      ]
    : [
        { id: 'monthly_saving', title: 'Monthly Saving Report' },
        { id: 'annual_saving', title: 'Annual Saving Report' },
        { id: 'loan_register', title: 'Loan Register Report' },
        { id: 'loan_repayment', title: 'Loan Repayment Report' },
        { id: 'outstanding_loan', title: 'Outstanding Loan Report' },
        { id: 'interest_report', title: 'Interest Report' },
        { id: 'fine_report', title: 'Fine Report' },
        { id: 'cash_book', title: 'Cash Book Report' },
        { id: 'bank_statement', title: 'Bank Statement' },
        { id: 'share_register', title: 'Share Register Report' },
        { id: 'member_register', title: 'Member Register Report' },
        { id: 'attendance', title: 'Attendance Report' },
        { id: 'online_payment', title: 'Online Payment Report' },
        { id: 'pending_payment', title: 'Pending Payment Report' },
        { id: 'income_expense', title: 'Income and Expense Report' },
        { id: 'consolidated', title: 'Consolidated Financial Statement' },
      ];

  const [activeId, setActiveId] = useState(reportDefs[0].id);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const inRange = (d: string) => (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);

  const buildReportData = (): { title: string; headers: string[]; rows: Array<Array<string | number>> } => {
    const title = reportDefs.find((r) => r.id === activeId)?.title || 'Report';
    const sav = (snapshot?.savings || []).filter((s) => inRange(s.date));
    const lns = (snapshot?.loans || []).filter((l) => inRange(l.loanDate));
    const shr = (snapshot?.shares || []).filter((s) => inRange(s.date));
    const cb = (snapshot?.cashBook || []).filter((c) => inRange(c.date));
    const att = (snapshot?.attendance || []).filter((a) => inRange(a.date));
    const pay = (snapshot?.onlinePayments || []).filter((p) => inRange(p.date));
    const mem = snapshot?.members || [];
    const rec = (snapshot?.receipts || []).filter((r) => inRange(r.date));

    switch (activeId) {
      case 'member_saving':
      case 'monthly_saving':
      case 'annual_saving':
        return {
          title,
          headers: ['Saving ID', 'Date', 'Member ID', 'Member Name', 'Monthly', 'Interest', 'Fine', 'Total', 'Status'],
          rows: sav.map((s) => [s.savingId, s.date, s.memberId, s.memberName, s.monthlySavingAmount, s.interest, s.fine, s.totalSaving, s.paymentStatus]),
        };
      case 'member_loan':
      case 'loan_register':
      case 'loan_repayment':
        return {
          title,
          headers: ['Loan No', 'Date', 'Member ID', 'Member Name', 'Disbursed', 'Repaid', 'Interest', 'Fine', 'Balance', 'Status'],
          rows: lns.map((l) => [l.loanNumber, l.loanDate, l.memberId, l.memberName, l.loanAmount, l.loanRepayment, l.interest, l.fine, l.currentLoanBalance, l.loanStatus]),
        };
      case 'outstanding_loan':
        return {
          title,
          headers: ['Loan No', 'Member ID', 'Member Name', 'Disbursed', 'Repaid', 'Outstanding Balance', 'Next Due'],
          rows: lns.filter((l) => l.currentLoanBalance > 0).map((l) => [l.loanNumber, l.memberId, l.memberName, l.loanAmount, l.loanRepayment, l.currentLoanBalance, l.nextDueDate]),
        };
      case 'interest_report':
        return {
          title,
          headers: ['Source', 'Record ID', 'Member Name', 'Date', 'Interest Amount'],
          rows: [
            ...sav.filter((s) => s.interest > 0).map((s) => ['Saving', s.savingId, s.memberName, s.date, s.interest]),
            ...lns.filter((l) => l.interest > 0).map((l) => ['Loan', l.loanNumber, l.memberName, l.loanDate, l.interest]),
          ],
        };
      case 'fine_report':
        return {
          title,
          headers: ['Source', 'Record ID', 'Member Name', 'Date', 'Fine Amount'],
          rows: [
            ...sav.filter((s) => s.fine > 0).map((s) => ['Saving', s.savingId, s.memberName, s.date, s.fine]),
            ...lns.filter((l) => l.fine > 0).map((l) => ['Loan', l.loanNumber, l.memberName, l.loanDate, l.fine]),
          ],
        };
      case 'cash_book':
      case 'bank_statement':
        return {
          title,
          headers: ['Txn ID', 'Date', 'Mode', 'Description', 'Bank Amt', 'Cash Amt', 'Total', 'Ref'],
          rows: cb.map((c) => [c.transactionId, c.date, c.paymentMode, c.description, c.bankAmount, c.cashAmount, c.totalAmount, c.referenceNumber]),
        };
      case 'member_share':
      case 'share_register':
        return {
          title,
          headers: ['Share ID', 'Date', 'Member ID', 'Member Name', 'Shares', 'Face Value', 'Total Value'],
          rows: shr.map((s) => [s.shareId, s.date, s.memberId, s.memberName, s.numberOfShares, s.faceValuePerShare, s.totalShareValue]),
        };
      case 'member_register':
        return {
          title,
          headers: ['Member ID', 'Name', 'Mobile', 'Join Date', 'Village', 'Status'],
          rows: mem.map((m) => [m.memberId, m.memberName, m.mobileNumber, m.joinDate, m.village, m.accountStatus]),
        };
      case 'member_attendance':
      case 'attendance':
        return {
          title,
          headers: ['Attendance ID', 'Meeting No', 'Date', 'Member ID', 'Member Name', 'Status'],
          rows: att.map((a) => [a.attendanceId, a.meetingNumber, a.date, a.memberId, a.memberName, a.attendanceStatus]),
        };
      case 'member_payment':
      case 'online_payment':
        return {
          title,
          headers: ['Payment ID', 'Date', 'Member', 'Category', 'Amount', 'UPI Txn ID', 'Status'],
          rows: pay.map((p) => [p.paymentId, p.date, p.memberName, p.paymentMethod, p.amount, p.upiTransactionId, p.verificationStatus]),
        };
      case 'pending_payment':
        return {
          title,
          headers: ['Payment ID', 'Date', 'Member', 'Amount', 'UPI Txn ID', 'Status'],
          rows: pay.filter((p) => p.verificationStatus === 'Pending').map((p) => [p.paymentId, p.date, p.memberName, p.amount, p.upiTransactionId, p.verificationStatus]),
        };
      case 'member_receipt':
        return {
          title,
          headers: ['Receipt No', 'Type', 'Date', 'Amount', 'Method', 'Status'],
          rows: rec.map((r) => [r.receiptNumber, r.receiptType, r.date, r.amount, r.paymentMethod, r.verificationStatus]),
        };
      case 'income_expense':
      case 'consolidated':
      default: {
        const st = snapshot?.stats;
        return {
          title,
          headers: ['Financial Metric', 'Amount / Count'],
          rows: [
            ['Total Members', st?.totalMembers || 0],
            ['Total Savings Collected', `₹${(st?.totalSavings || 0).toFixed(2)}`],
            ['Total Share Capital', `₹${(st?.totalShareValue || 0).toFixed(2)}`],
            ['Total Loans Disbursed', `₹${(st?.totalLoanDisbursed || 0).toFixed(2)}`],
            ['Total Loan Principal Repaid', `₹${(st?.totalLoanRepaid || 0).toFixed(2)}`],
            ['Total Outstanding Loan Balance', `₹${(st?.totalLoanBalance || 0).toFixed(2)}`],
            ['Total Loan Interest Collected', `₹${(st?.totalLoanInterest || 0).toFixed(2)}`],
            ['Total Loan Fine Collected', `₹${(st?.totalLoanFine || 0).toFixed(2)}`],
            ['Current Bank Balance', `₹${(st?.totalBankBalance || 0).toFixed(2)}`],
            ['Current Cash Balance', `₹${(st?.totalCashBalance || 0).toFixed(2)}`],
          ],
        };
      }
    }
  };

  const report = buildReportData();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white">{tr('nav_reports')}</h2>
        <p className="text-xs text-[#667085] dark:text-slate-400">
          Financial Year {settings?.financialYear || '2026-2027'} · Permission-filtered statements with PDF, Excel, CSV, and Print export.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-1 max-h-[520px] overflow-y-auto no-print">
          {reportDefs.map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveId(r.id)}
              className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                activeId === r.id
                  ? 'bg-[#087443] text-white'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {r.title}
            </button>
          ))}
        </div>

        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 no-print">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
              <span>to</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => exportTableToPdf(report.title, report.headers, report.rows, settings, `GMCSL_${activeId}`)} className="px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-slate-50">
                {tr('exportPdf')}
              </button>
              <button onClick={() => exportTableToExcel(report.title, report.headers, report.rows, `GMCSL_${activeId}`)} className="px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-slate-50">
                {tr('exportExcel')}
              </button>
              <button onClick={() => exportTableToCsv(report.headers, report.rows, `GMCSL_${activeId}`)} className="px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-slate-50">
                {tr('exportCsv')}
              </button>
              <button onClick={() => window.print()} className="px-3 py-1.5 rounded-lg bg-[#142D4E] text-white text-xs font-semibold">
                {tr('print')}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-[#142D4E] dark:text-white">{report.title}</h3>
              <span className="text-xs font-mono-tabular text-slate-500">{report.rows.length} rows</span>
            </div>
            {report.rows.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">No records match this report filter.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800">
                      {report.headers.map((h) => (
                        <th key={h} className="py-2.5 px-4 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {report.rows.map((row, idx) => (
                      <tr key={idx}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="py-2.5 px-4 font-mono-tabular">
                            {String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeId === 'member_receipt' && (snapshot?.receipts || []).length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <h4 className="text-sm font-semibold mb-3">Download Individual Receipt PDFs</h4>
          <div className="flex flex-wrap gap-2">
            {(snapshot?.receipts || []).map((r) => (
              <button
                key={r.receiptNumber}
                onClick={() => downloadReceiptPdf(r, settings)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:border-[#087443] flex items-center gap-2"
              >
                <span className="font-mono-tabular">{r.receiptNumber}</span>
                <StatusLabel status={r.verificationStatus} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
