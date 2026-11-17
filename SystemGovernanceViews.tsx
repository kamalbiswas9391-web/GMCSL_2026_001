import React, { useState } from 'react';
import { Lock, Plus, ShieldCheck, Trash2, Unlock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../offline/syncEngine';
import { EmptyState, FileUploadField, StatusLabel } from '../components/UiPrimitives';
import type { ModuleKey, RolePermission, SocietySettings, UserRole } from '../types';

// ==========================================
// 1. MEMBER PIN & OFFICER ACCOUNT MANAGER
// ==========================================
export const UsersAndPinManagerView: React.FC<{ focus?: 'members' | 'officers' | 'President' | 'Secretary' }> = ({
  focus = 'members',
}) => {
  const { session, snapshot, isOnline, pushToast, syncNow, tr, modals, openModal, closeModal, setModalOpen } = useApp();
  const members = snapshot?.members || [];
  const systemUsers = snapshot?.systemUsers || [];
  const [officerTab, setOfficerTab] = useState<'all' | 'President' | 'Secretary'>(
    focus === 'President' ? 'President' : focus === 'Secretary' ? 'Secretary' : 'all'
  );

  React.useEffect(() => {
    setOfficerTab(focus === 'President' ? 'President' : focus === 'Secretary' ? 'Secretary' : 'all');
  }, [focus]);

  const [pinTarget, setPinTarget] = useState<{ memberId?: string; userId?: string; name: string } | null>(null);
  const [newPin, setNewPin] = useState('');
  const [newMobile, setNewMobile] = useState('');

  const [officerForm, setOfficerForm] = useState({
    role: (focus === 'President' || focus === 'Secretary' ? focus : 'Secretary') as 'President' | 'Secretary',
    fullName: '',
    mobileNumber: '',
    email: '',
    pin: '',
  });

  const handleMemberAccess = async (memberId: string, action: string, pin?: string, mobileNumber?: string) => {
    if (!session || !isOnline) {
      pushToast('warning', 'Account & PIN updates require internet connectivity.');
      return;
    }
    try {
      await apiFetch(
        '/api/users/member-access',
        { method: 'POST', body: JSON.stringify({ memberId, action, pin, mobileNumber }) },
        session.token
      );
      pushToast('success', `Member access (${action}) updated.`);
      closeModal('pinManagerModal');
      setPinTarget(null);
      setNewPin('');
      await syncNow();
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to update member access.');
    }
  };

  const handleUserAction = async (userId: string, action: string, pin?: string) => {
    if (!session || !isOnline) {
      pushToast('warning', 'User security actions require internet connectivity.');
      return;
    }
    try {
      await apiFetch(`/api/users/${userId}/action`, { method: 'POST', body: JSON.stringify({ action, pin }) }, session.token);
      pushToast('success', `Account ${action} completed.`);
      closeModal('pinManagerModal');
      setPinTarget(null);
      setNewPin('');
      await syncNow();
    } catch (err: any) {
      pushToast('error', err?.message || 'Action failed.');
    }
  };

  const handleCreateOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !isOnline) return;
    try {
      await apiFetch('/api/users/officer', { method: 'POST', body: JSON.stringify(officerForm) }, session.token);
      pushToast('success', `${officerForm.role} account created.`);
      closeModal('officerForm');
      setOfficerForm({ role: officerForm.role, fullName: '', mobileNumber: '', email: '', pin: '' });
      await syncNow();
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to create officer.');
    }
  };

  const officers = systemUsers.filter((u) =>
    officerTab === 'President' || officerTab === 'Secretary'
      ? u.role === officerTab
      : u.role === 'President' || u.role === 'Secretary'
  );

  return (
    <div className="space-y-6">
      {modals.pinManagerModal && pinTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
            <h3 className="font-display text-base font-bold">Set / Reset 4-Digit PIN — {pinTarget.name}</h3>
            {pinTarget.memberId && (
              <div>
                <label className="block text-xs font-medium mb-1">Registered Mobile Number (optional update)</label>
                <input
                  type="tel"
                  value={newMobile}
                  onChange={(e) => setNewMobile(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1">New 4-Digit PIN</label>
              <input
                type="password"
                maxLength={4}
                pattern="\d{4}"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="••••"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular tracking-widest"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  closeModal('pinManagerModal');
                  setPinTarget(null);
                }}
                className="px-3 py-1.5 rounded-lg border text-xs"
              >
                {tr('cancel')}
              </button>
              <button
                type="button"
                onClick={() =>
                  pinTarget.memberId
                    ? handleMemberAccess(pinTarget.memberId, 'set_pin', newPin, newMobile || undefined)
                    : handleUserAction(pinTarget.userId!, 'reset_pin', newPin)
                }
                className="px-4 py-1.5 rounded-lg bg-[#087443] text-white text-xs font-semibold"
              >
                Save PIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Officers Management Section */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white">
              {officerTab === 'President'
                ? 'President Management'
                : officerTab === 'Secretary'
                  ? 'Secretary Management'
                  : focus === 'officers'
                    ? 'President & Secretary Management'
                    : 'Officer & Member Access Manager'}
            </h2>
            <p className="text-xs text-[#667085] dark:text-slate-400">PINs are securely hashed on the server and never exposed in plaintext.</p>
          </div>
          <button
            onClick={() => {
              if (officerTab === 'President' || officerTab === 'Secretary') {
                setOfficerForm((prev) => ({ ...prev, role: officerTab }));
              }
              setModalOpen('officerForm', !modals.officerForm);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#087443] text-white text-xs sm:text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Add President / Secretary</span>
          </button>
        </div>

        {focus !== 'members' && (
          <div className="flex flex-wrap gap-2 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg w-fit">
            {[
              { id: 'all' as const, label: 'All Officers (President & Secretary)' },
              { id: 'President' as const, label: 'President Management' },
              { id: 'Secretary' as const, label: 'Secretary Management' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setOfficerTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  officerTab === tab.id
                    ? 'bg-white dark:bg-slate-900 text-[#142D4E] dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {modals.officerForm && (
          <form onSubmit={handleCreateOfficer} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium mb-1">Role</label>
                <select value={officerForm.role} onChange={(e) => setOfficerForm({ ...officerForm, role: e.target.value as any })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <option value="President">President</option>
                  <option value="Secretary">Secretary</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Full Name *</label>
                <input type="text" required value={officerForm.fullName} onChange={(e) => setOfficerForm({ ...officerForm, fullName: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Mobile Number *</label>
                <input type="tel" required pattern="\d{10}" value={officerForm.mobileNumber} onChange={(e) => setOfficerForm({ ...officerForm, mobileNumber: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">4-Digit PIN *</label>
                <input type="password" required maxLength={4} pattern="\d{4}" value={officerForm.pin} onChange={(e) => setOfficerForm({ ...officerForm, pin: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => closeModal('officerForm')} className="px-4 py-2 rounded-lg border text-xs sm:text-sm">{tr('cancel')}</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-[#087443] text-white text-xs sm:text-sm font-semibold">Create Account</button>
            </div>
          </form>
        )}

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
                <th className="py-3 px-4">Role / ID</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Mobile</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {officers.length === 0 ? (
                <tr><td colSpan={6} className="py-6 text-center text-xs text-slate-400">No officer accounts created yet.</td></tr>
              ) : (
                officers.map((u) => (
                  <tr key={u.userId}>
                    <td className="py-3 px-4 font-semibold">{u.role} <span className="text-xs font-mono-tabular text-slate-400">({u.userId})</span></td>
                    <td className="py-3 px-4">{u.fullName}</td>
                    <td className="py-3 px-4 font-mono-tabular">{u.mobileNumber}</td>
                    <td className="py-3 px-4 text-xs font-mono-tabular">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}</td>
                    <td className="py-3 px-4"><StatusLabel status={u.isLocked ? 'Locked' : u.accountStatus} /></td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      <button onClick={() => { setPinTarget({ userId: u.userId, name: u.fullName }); setNewPin(''); setNewMobile(''); openModal('pinManagerModal'); }} className="text-xs font-semibold text-[#2563EB] hover:underline">Reset PIN</button>
                      <button onClick={() => handleUserAction(u.userId, u.isLocked ? 'unlock' : 'lock')} className="text-xs font-semibold text-amber-600 hover:underline">
                        {u.isLocked ? 'Unlock' : 'Lock'}
                      </button>
                      <button onClick={() => handleUserAction(u.userId, u.accountStatus === 'Active' ? 'deactivate' : 'activate')} className="text-xs font-semibold text-slate-600 hover:underline">
                        {u.accountStatus === 'Active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Member PIN & Login Access */}
      {focus === 'members' && (
        <div className="space-y-3">
          <h3 className="font-display text-lg font-bold text-[#142D4E] dark:text-white">Member PIN & Login Access</h3>
          {members.length === 0 ? (
            <EmptyState title="No Members Registered" subtitle="Register members in Member Register before assigning login PINs." />
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4">Mobile Number</th>
                    <th className="py-3 px-4">PIN Status</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4 text-right">Access Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {members.map((m) => (
                    <tr key={m.memberId}>
                      <td className="py-3 px-4">{m.memberName} <span className="text-xs font-mono-tabular text-slate-500">({m.memberId})</span></td>
                      <td className="py-3 px-4 font-mono-tabular">{m.mobileNumber}</td>
                      <td className="py-3 px-4 text-xs">{m.hasPin ? 'PIN Configured (Hashed)' : 'Not Set'}</td>
                      <td className="py-3 px-4"><StatusLabel status={m.isLocked ? 'Locked' : m.accountStatus} /></td>
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => { setPinTarget({ memberId: m.memberId, name: m.memberName }); setNewMobile(m.mobileNumber); setNewPin(''); openModal('pinManagerModal'); }}
                          className="text-xs font-semibold text-[#087443] hover:underline"
                        >
                          {m.hasPin ? 'Reset PIN' : 'Set PIN'}
                        </button>
                        <button
                          onClick={() => handleMemberAccess(m.memberId, m.isLocked ? 'unlock' : 'lock')}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:underline"
                        >
                          {m.isLocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                          <span>{m.isLocked ? 'Unlock' : 'Lock'}</span>
                        </button>
                        <button
                          onClick={() => handleMemberAccess(m.memberId, m.accountStatus === 'Active' ? 'deactivate' : 'activate')}
                          className="text-xs font-semibold text-slate-600 hover:underline"
                        >
                          {m.accountStatus === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 2. DYNAMIC PERMISSION SWITCHBOARD
// ==========================================
export const PermissionSwitchboardView: React.FC = () => {
  const { session, snapshot, isOnline, pushToast, syncNow } = useApp();
  const [selectedRole, setSelectedRole] = useState<Exclude<UserRole, 'System'>>('President');
  const [draft, setDraft] = useState<RolePermission[]>(snapshot?.permissions || []);
  const [autoIdRoles, setAutoIdRoles] = useState<Record<'President' | 'Secretary' | 'Member', boolean>>(
    snapshot?.settings?.autoIdEditableRoles || { President: false, Secretary: false, Member: false }
  );
  const [drilldownRoles, setDrilldownRoles] = useState<Record<'President' | 'Secretary' | 'Member', boolean>>(
    snapshot?.settings?.dashboardDrilldownRoles || { President: true, Secretary: true, Member: true }
  );

  const roleItems = (draft.length > 0 ? draft : snapshot?.permissions || []).filter((p) => p.role === selectedRole);

  const toggle = (moduleKey: ModuleKey, field: 'canView' | 'canAdd' | 'canEdit' | 'canDelete' | 'isHidden') => {
    const base = draft.length > 0 ? draft : snapshot?.permissions || [];
    setDraft(
      base.map((p) =>
        p.role === selectedRole && p.moduleKey === moduleKey ? { ...p, [field]: !p[field] } : p
      )
    );
  };

  const handleSave = async () => {
    if (!session || !isOnline) {
      pushToast('warning', 'Publishing new permissions requires internet connectivity.');
      return;
    }
    try {
      const payloadPermissions = draft.length > 0 ? draft : snapshot?.permissions || [];
      await apiFetch('/api/permissions', { method: 'PUT', body: JSON.stringify({ permissions: payloadPermissions }) }, session.token);
      await apiFetch(
        '/api/settings',
        {
          method: 'PUT',
          body: JSON.stringify({
            autoIdEditableRoles: autoIdRoles,
            dashboardDrilldownRoles: drilldownRoles,
          }),
        },
        session.token
      );
      pushToast('success', 'Role permissions and capability overrides published.');
      await syncNow();
    } catch (err: any) {
      pushToast('error', err?.message || 'Permission save failed.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#087443]" />
            <span>Dynamic Permission Switchboard</span>
          </h2>
          <p className="text-xs text-[#667085] dark:text-slate-400">
            Configure View, Add, Edit, Delete, Hide Module, Editable Auto-IDs, and Dashboard Drilldown permissions per role. Enforced server-side immediately.
          </p>
        </div>
        <button onClick={handleSave} className="px-5 py-2 rounded-lg bg-[#087443] hover:bg-[#065c35] text-white text-sm font-semibold">
          Save & Publish Permissions
        </button>
      </div>

      <div className="flex gap-2 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg w-fit">
        {(['President', 'Secretary', 'Member'] as const).map((r) => (
          <button
            key={r}
            onClick={() => setSelectedRole(r)}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold ${
              selectedRole === r ? 'bg-white dark:bg-slate-900 text-[#142D4E] dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
              <th className="py-3 px-4">Module</th>
              <th className="py-3 px-4 text-center">View</th>
              <th className="py-3 px-4 text-center">Add</th>
              <th className="py-3 px-4 text-center">Edit</th>
              <th className="py-3 px-4 text-center">Delete</th>
              <th className="py-3 px-4 text-center">Hide Module</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {roleItems.map((p) => (
              <tr key={p.id}>
                <td className="py-3 px-4 font-medium capitalize">{p.moduleKey.replace(/_/g, ' ')}</td>
                {(['canView', 'canAdd', 'canEdit', 'canDelete', 'isHidden'] as const).map((field) => (
                  <td key={field} className="py-3 px-4 text-center">
                    <input
                      type="checkbox"
                      checked={Boolean(p[field])}
                      onChange={() => toggle(p.moduleKey, field)}
                      className="w-4 h-4 accent-[#087443] cursor-pointer"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role Capability Overrides */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div>
          <h3 className="font-display text-sm font-bold text-[#142D4E] dark:text-white">
            System Admin Capability Overrides (Auto-IDs &amp; Dashboard Metrics)
          </h3>
          <p className="text-xs text-[#667085] dark:text-slate-400">
            System Admin always retains full privileges. Grant or revoke special operational capabilities below.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
                <th className="py-2.5 px-4">Capability</th>
                <th className="py-2.5 px-4 text-center">System</th>
                <th className="py-2.5 px-4 text-center">President</th>
                <th className="py-2.5 px-4 text-center">Secretary</th>
                <th className="py-2.5 px-4 text-center">Member</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
              <tr>
                <td className="py-3 px-4 font-medium">
                  Allow Editing Auto-Generated IDs (Member, Saving, Share, Loan, Repayment, Cash Book)
                </td>
                <td className="py-3 px-4 text-center text-emerald-700 font-semibold">Always On</td>
                {(['President', 'Secretary', 'Member'] as const).map((r) => (
                  <td key={r} className="py-3 px-4 text-center">
                    <input
                      type="checkbox"
                      checked={Boolean(autoIdRoles[r])}
                      onChange={() => setAutoIdRoles((prev) => ({ ...prev, [r]: !prev[r] }))}
                      className="w-4 h-4 accent-[#087443] cursor-pointer"
                    />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium">
                  Enable Clickable Dashboard Metric Drilldown &amp; Exports
                </td>
                <td className="py-3 px-4 text-center text-emerald-700 font-semibold">Always On</td>
                {(['President', 'Secretary', 'Member'] as const).map((r) => (
                  <td key={r} className="py-3 px-4 text-center">
                    <input
                      type="checkbox"
                      checked={Boolean(drilldownRoles[r])}
                      onChange={() => setDrilldownRoles((prev) => ({ ...prev, [r]: !prev[r] }))}
                      className="w-4 h-4 accent-[#087443] cursor-pointer"
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. SOCIETY SETTINGS, THEME, CONTENT, QR & MEDIA
// ==========================================
export const SocietySettingsView: React.FC<{ section: 'settings' | 'content' | 'theme' | 'media' }> = ({ section }) => {
  const { session, snapshot, isOnline, pushToast, syncNow, setThemeMode, themeMode } = useApp();
  const [form, setForm] = useState<SocietySettings>(snapshot?.settings!);
  const [mediaForm, setMediaForm] = useState({
    title: '',
    titleAs: '',
    description: '',
    mediaType: 'Image' as 'Image' | 'Photo' | 'Video' | 'PDF' | 'Document' | 'Notice',
    dataUrl: '',
    fileName: '',
    visibility: 'Everyone' as 'Everyone' | 'President' | 'Secretary' | 'Member' | 'System',
  });

  if (!form) return null;

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !isOnline) {
      pushToast('warning', 'Saving System settings requires internet connectivity.');
      return;
    }
    try {
      await apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(form) }, session.token);
      setThemeMode(form.themeMode);
      pushToast('success', 'Settings saved.');
      await syncNow();
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to save settings.');
    }
  };

  const handleUploadMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !isOnline || !mediaForm.dataUrl) {
      pushToast('warning', 'Select a file while online to upload to Media Manager.');
      return;
    }
    try {
      await apiFetch('/api/media', { method: 'POST', body: JSON.stringify(mediaForm) }, session.token);
      pushToast('success', 'Media item uploaded.');
      setMediaForm({ title: '', titleAs: '', description: '', mediaType: 'Image', dataUrl: '', fileName: '', visibility: 'Everyone' });
      await syncNow();
    } catch (err: any) {
      pushToast('error', err?.message || 'Media upload failed.');
    }
  };

  const handleDeleteMedia = async (id: string) => {
    if (!session || !isOnline) return;
    await apiFetch(`/api/media/${id}`, { method: 'DELETE' }, session.token);
    pushToast('info', 'Media removed.');
    await syncNow();
  };

  if (section === 'media') {
    const items = snapshot?.media || [];
    return (
      <div className="space-y-6">
        <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white">Media Manager</h2>
        <form onSubmit={handleUploadMedia} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Title (English) *</label>
            <input type="text" required value={mediaForm.title} onChange={(e) => setMediaForm({ ...mediaForm, title: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Title (Assamese)</label>
            <input type="text" value={mediaForm.titleAs} onChange={(e) => setMediaForm({ ...mediaForm, titleAs: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Media Type</label>
            <select value={mediaForm.mediaType} onChange={(e) => setMediaForm({ ...mediaForm, mediaType: e.target.value as any })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <option value="Image">Image</option>
              <option value="Photo">Photo</option>
              <option value="Video">Video</option>
              <option value="PDF">PDF</option>
              <option value="Document">Document</option>
              <option value="Notice">Notice</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Visibility</label>
            <select value={mediaForm.visibility} onChange={(e) => setMediaForm({ ...mediaForm, visibility: e.target.value as any })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <option value="Everyone">Everyone (Public + All Roles)</option>
              <option value="Member">Member</option>
              <option value="Secretary">Secretary</option>
              <option value="President">President</option>
            </select>
          </div>
          <FileUploadField
            label="Upload File"
            accept="image/*,video/*,.pdf,.doc,.docx"
            value={mediaForm.dataUrl}
            onChange={(url, name) => setMediaForm({ ...mediaForm, dataUrl: url, fileName: name })}
            required
          />
          <div className="flex items-end">
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#087443] text-white text-sm font-semibold">Upload Media</button>
          </div>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((m) => (
            <div key={m.mediaId} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{m.title}</p>
                <p className="text-xs text-slate-500">{m.mediaType} · {m.visibility}</p>
              </div>
              <button onClick={() => handleDeleteMedia(m.mediaId)} className="text-red-600 p-1.5 rounded hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={saveSettings} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white">
          {section === 'content'
            ? 'Live Content, Banners & Dynamic UPI QR Manager'
            : section === 'theme'
              ? 'Theme & Appearance Settings'
              : 'Society Settings & Branding'}
        </h2>
        <button type="submit" className="px-5 py-2 rounded-lg bg-[#087443] text-white text-sm font-semibold">
          Save Changes
        </button>
      </div>

      {section === 'settings' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Society Name (English)</label>
            <input type="text" value={form.societyName} onChange={(e) => setForm({ ...form, societyName: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Society Name (Assamese)</label>
            <input type="text" value={form.societyNameAs} onChange={(e) => setForm({ ...form, societyNameAs: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Registration Details (Official)</label>
            <input type="text" value={form.registrationDetails} onChange={(e) => setForm({ ...form, registrationDetails: e.target.value })} placeholder="Enter official registration number" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Financial Year</label>
            <input type="text" value={form.financialYear} onChange={(e) => setForm({ ...form, financialYear: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Society Address</label>
            <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Contact Phone</label>
            <input type="text" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Official Email</label>
            <input type="email" value={form.officialEmail} onChange={(e) => setForm({ ...form, officialEmail: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Bank Account Details</label>
            <input type="text" value={form.bankDetails} onChange={(e) => setForm({ ...form, bankDetails: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Receipt Prefix</label>
            <input type="text" value={form.receiptPrefix} onChange={(e) => setForm({ ...form, receiptPrefix: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Member ID Prefix</label>
            <input type="text" value={form.memberIdPrefix} onChange={(e) => setForm({ ...form, memberIdPrefix: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
          </div>
          <FileUploadField label="Society Logo Upload" value={form.logoUrl} onChange={(u) => setForm({ ...form, logoUrl: u })} />
          <FileUploadField label="Official Digital Signature" value={form.officialSignatureUrl} onChange={(u) => setForm({ ...form, officialSignatureUrl: u })} />
        </div>
      )}

      {section === 'content' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 font-display text-sm font-bold text-[#142D4E] dark:text-white">Dynamic UPI QR Code Manager</div>
            <div>
              <label className="block text-xs font-medium mb-1">Society UPI ID</label>
              <input type="text" value={form.upiId} onChange={(e) => setForm({ ...form, upiId: e.target.value })} placeholder="society@upi" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
            </div>
            <FileUploadField label="Upload / Replace Custom UPI QR Image" value={form.upiQrImageUrl} onChange={(u) => setForm({ ...form, upiQrImageUrl: u })} />
            <div>
              <label className="block text-xs font-medium mb-1">Payment Instructions (English)</label>
              <textarea rows={2} value={form.paymentInstructions} onChange={(e) => setForm({ ...form, paymentInstructions: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Payment Instructions (Assamese)</label>
              <textarea rows={2} value={form.paymentInstructionsAs} onChange={(e) => setForm({ ...form, paymentInstructionsAs: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <label className="flex items-center gap-2 text-xs font-medium">
              <input type="checkbox" checked={form.showUpiQr} onChange={(e) => setForm({ ...form, showUpiQr: e.target.checked })} className="accent-[#087443]" />
              Show Society UPI QR on Payment Screens
            </label>
            <label className="flex items-center gap-2 text-xs font-medium">
              <input type="checkbox" checked={form.onlinePaymentEnabled} onChange={(e) => setForm({ ...form, onlinePaymentEnabled: e.target.checked })} className="accent-[#087443]" />
              Activate Online Payment Submission Option
            </label>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 font-display text-sm font-bold text-[#142D4E] dark:text-white">Homepage & Banner Content</div>
            <div>
              <label className="block text-xs font-medium mb-1">Homepage Hero Title (English)</label>
              <input type="text" value={form.homepageHeroTitle} onChange={(e) => setForm({ ...form, homepageHeroTitle: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Homepage Hero Title (Assamese)</label>
              <input type="text" value={form.homepageHeroTitleAs} onChange={(e) => setForm({ ...form, homepageHeroTitleAs: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Announcement Bar (English)</label>
              <input type="text" value={form.announcementTicker} onChange={(e) => setForm({ ...form, announcementTicker: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Announcement Bar (Assamese)</label>
              <input type="text" value={form.announcementTickerAs} onChange={(e) => setForm({ ...form, announcementTickerAs: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
          </div>
        </div>
      )}

      {section === 'theme' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Appearance Mode</label>
            <select
              value={themeMode}
              onChange={(e) => {
                const m = e.target.value as any;
                setThemeMode(m);
                setForm({ ...form, themeMode: m });
              }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            >
              <option value="light">Light Mode</option>
              <option value="dark">Dark Mode</option>
              <option value="auto">Automatic (System Preference)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Primary Brand Color</label>
            <input type="color" value={form.themePrimary} onChange={(e) => setForm({ ...form, themePrimary: e.target.value })} className="h-10 w-full rounded border cursor-pointer" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Secondary / Sidebar Color</label>
            <input type="color" value={form.themeSecondary} onChange={(e) => setForm({ ...form, themeSecondary: e.target.value })} className="h-10 w-full rounded border cursor-pointer" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Accent Gold Color</label>
            <input type="color" value={form.themeAccent} onChange={(e) => setForm({ ...form, themeAccent: e.target.value })} className="h-10 w-full rounded border cursor-pointer" />
          </div>
        </div>
      )}
    </form>
  );
};
