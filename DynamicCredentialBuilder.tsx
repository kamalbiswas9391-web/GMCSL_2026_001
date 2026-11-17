import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Code2,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../offline/syncEngine';
import { FileUploadField } from './UiPrimitives';
import type {
  CredentialElement,
  CredentialTemplateConfig,
  MemberRecord,
  SocietySettings,
} from '../types';

export interface CredentialPreset {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  borderStyle: 'solid' | 'double' | 'ornate' | 'none';
}

export const CREDENTIAL_PRESETS: CredentialPreset[] = [
  {
    id: 'classic_emerald',
    name: 'Classic Emerald',
    primaryColor: '#087443',
    secondaryColor: '#142D4E',
    accentColor: '#D5A642',
    backgroundColor: '#FFFFFF',
    textColor: '#1D2939',
    borderStyle: 'ornate',
  },
  {
    id: 'royal_navy',
    name: 'Royal Navy',
    primaryColor: '#142D4E',
    secondaryColor: '#1E3A8A',
    accentColor: '#EAB308',
    backgroundColor: '#F8FAFC',
    textColor: '#0F172A',
    borderStyle: 'double',
  },
  {
    id: 'heritage_gold',
    name: 'Heritage Gold',
    primaryColor: '#92400E',
    secondaryColor: '#451A03',
    accentColor: '#D97706',
    backgroundColor: '#FFFBEB',
    textColor: '#292524',
    borderStyle: 'ornate',
  },
  {
    id: 'modern_teal',
    name: 'Modern Teal',
    primaryColor: '#0F766E',
    secondaryColor: '#134E4A',
    accentColor: '#14B8A6',
    backgroundColor: '#FFFFFF',
    textColor: '#1E293B',
    borderStyle: 'solid',
  },
  {
    id: 'crimson_crest',
    name: 'Crimson Crest',
    primaryColor: '#991B1B',
    secondaryColor: '#450A0A',
    accentColor: '#F59E0B',
    backgroundColor: '#FFFDFD',
    textColor: '#1F2937',
    borderStyle: 'double',
  },
  {
    id: 'minimal_slate',
    name: 'Minimal Slate',
    primaryColor: '#334155',
    secondaryColor: '#0F172A',
    accentColor: '#64748B',
    backgroundColor: '#FFFFFF',
    textColor: '#0F172A',
    borderStyle: 'solid',
  },
];

export const DEFAULT_ID_CARD_TEMPLATE: CredentialTemplateConfig = {
  presetId: 'classic_emerald',
  title: 'OFFICIAL MEMBER ID CARD',
  subtitle: '{{societyName}}',
  primaryColor: '#087443',
  secondaryColor: '#142D4E',
  accentColor: '#D5A642',
  backgroundColor: '#FFFFFF',
  textColor: '#1D2939',
  borderStyle: 'solid',
  showLogo: true,
  showPhoto: true,
  showQr: true,
  showSecretarySignature: true,
  showPresidentSignature: false,
  showCustomSignature: false,
  customSignatureLabel: 'Authorized Signatory',
  customSignatureUrl: '',
  footerText: 'Verified Digital Member Credential · {{shortName}}',
  elements: [
    { id: 'el_name', label: 'Name', valueTemplate: '{{memberName}}', x: 24, y: 21, fontSize: 8, fontWeight: 'bold', color: '#142D4E', align: 'left', visible: true },
    { id: 'el_id', label: 'Member ID', valueTemplate: 'ID: {{memberId}}', x: 24, y: 25.5, fontSize: 6.5, fontWeight: 'bold', color: '#087443', align: 'left', visible: true },
    { id: 'el_mob', label: 'Mobile', valueTemplate: 'Mobile: {{mobileNumber}}', x: 24, y: 29.5, fontSize: 6.5, fontWeight: 'normal', color: '#1D2939', align: 'left', visible: true },
    { id: 'el_join', label: 'Joined', valueTemplate: 'Join Date: {{joinDate}}', x: 24, y: 33.5, fontSize: 6.5, fontWeight: 'normal', color: '#1D2939', align: 'left', visible: true },
    { id: 'el_vil', label: 'Village', valueTemplate: 'Village: {{village}}', x: 24, y: 37.5, fontSize: 6.5, fontWeight: 'normal', color: '#1D2939', align: 'left', visible: true },
    { id: 'el_stat', label: 'Status', valueTemplate: 'Status: {{accountStatus}}', x: 24, y: 41.5, fontSize: 6.5, fontWeight: 'bold', color: '#087443', align: 'left', visible: true },
  ],
};

export const DEFAULT_CERTIFICATE_TEMPLATE: CredentialTemplateConfig = {
  presetId: 'classic_emerald',
  title: 'CERTIFICATE OF MEMBERSHIP',
  subtitle: '{{societyName}}',
  primaryColor: '#087443',
  secondaryColor: '#142D4E',
  accentColor: '#D5A642',
  backgroundColor: '#FFFFFF',
  textColor: '#1D2939',
  borderStyle: 'ornate',
  showLogo: true,
  showPhoto: false,
  showQr: true,
  showSecretarySignature: true,
  showPresidentSignature: true,
  showCustomSignature: false,
  customSignatureLabel: 'Registrar Signature',
  customSignatureUrl: '',
  footerText: 'Issued digitally by {{societyName}} · Verify authenticity via QR code.',
  elements: [
    { id: 'cert_intro', label: 'Intro', valueTemplate: 'This is to officially certify that', x: 148.5, y: 94, fontSize: 13, fontWeight: 'normal', color: '#475467', align: 'center', visible: true },
    { id: 'cert_name', label: 'Member Name', valueTemplate: '{{memberName}}', x: 148.5, y: 110, fontSize: 22, fontWeight: 'bold', color: '#087443', align: 'center', visible: true },
    { id: 'cert_meta', label: 'Details', valueTemplate: 'S/O / D/O: {{fatherName}}   |   Member ID: {{memberId}}   |   Join Date: {{joinDate}}', x: 148.5, y: 124, fontSize: 11, fontWeight: 'normal', color: '#1D2939', align: 'center', visible: true },
    { id: 'cert_body', label: 'Body Statement', valueTemplate: 'is a registered {{accountStatus}} Member of {{societyName}}.', x: 148.5, y: 136, fontSize: 12, fontWeight: 'normal', color: '#1D2939', align: 'center', visible: true },
  ],
};

export function resolveCredentialTemplate(
  type: 'id' | 'cert',
  settings?: SocietySettings | null
): CredentialTemplateConfig {
  const base = type === 'id' ? DEFAULT_ID_CARD_TEMPLATE : DEFAULT_CERTIFICATE_TEMPLATE;
  const saved = type === 'id' ? settings?.idCardTemplate : settings?.certificateTemplate;
  if (!saved || typeof saved !== 'object') return base;
  return {
    ...base,
    ...saved,
    elements: Array.isArray(saved.elements) && saved.elements.length > 0 ? saved.elements : base.elements,
  };
}

export function renderTemplateText(
  tpl: string,
  member: MemberRecord,
  settings?: SocietySettings | null,
  certNo?: string
): string {
  const map: Record<string, string> = {
    '{{memberName}}': member.memberName || '-',
    '{{memberId}}': member.memberId || '-',
    '{{fatherName}}': member.fatherName || '-',
    '{{mobileNumber}}': member.mobileNumber || '-',
    '{{joinDate}}': member.joinDate || '-',
    '{{village}}': member.village || '-',
    '{{district}}': member.district || '-',
    '{{state}}': member.state || 'Assam',
    '{{accountStatus}}': member.accountStatus || 'Active',
    '{{certNumber}}': certNo || `CERT-${member.memberId}`,
    '{{issueDate}}': new Date().toISOString().slice(0, 10),
    '{{societyName}}': settings?.societyName || 'Garakhia Dhap Multipurpose Co-operative Society Ltd.',
    '{{shortName}}': settings?.shortName || 'GMCSL',
    '{{address}}': settings?.address || 'Garakhia Dhap, Assam',
    '{{registrationDetails}}': settings?.registrationDetails || '',
  };
  let out = String(tpl || '');
  for (const [token, val] of Object.entries(map)) {
    out = out.split(token).join(val);
  }
  return out;
}

export const DynamicCredentialBuilder: React.FC<{
  mode: 'id' | 'cert';
  onSaved?: () => void;
}> = ({ mode, onSaved }) => {
  const { session, snapshot, isOnline, pushToast, syncNow, tr, modals, openModal, closeModal } = useApp();
  const settings = snapshot?.settings;
  const [template, setTemplate] = useState<CredentialTemplateConfig>(() =>
    resolveCredentialTemplate(mode, settings)
  );
  const [saving, setSaving] = useState(false);
  const [jsonText, setJsonText] = useState('');

  React.useEffect(() => {
    setTemplate(resolveCredentialTemplate(mode, settings));
  }, [mode, settings?.updatedAt]);

  const applyPreset = (preset: CredentialPreset) => {
    setTemplate((prev) => ({
      ...prev,
      presetId: preset.id,
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
      accentColor: preset.accentColor,
      backgroundColor: preset.backgroundColor,
      textColor: preset.textColor,
      borderStyle: preset.borderStyle,
    }));
  };

  const addElement = () => {
    const el: CredentialElement = {
      id: `el_${Date.now().toString(36)}`,
      label: 'Custom Field',
      valueTemplate: 'District: {{district}}',
      x: mode === 'id' ? 24 : 148.5,
      y: mode === 'id' ? 45 : 148,
      fontSize: mode === 'id' ? 6.5 : 11,
      fontWeight: 'normal',
      color: template.textColor,
      align: mode === 'id' ? 'left' : 'center',
      visible: true,
    };
    setTemplate((prev) => ({ ...prev, elements: [...prev.elements, el] }));
  };

  const updateElement = (id: string, patch: Partial<CredentialElement>) => {
    setTemplate((prev) => ({
      ...prev,
      elements: prev.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  };

  const moveElement = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= template.elements.length) return;
    setTemplate((prev) => {
      const arr = [...prev.elements];
      const [item] = arr.splice(idx, 1);
      arr.splice(nextIdx, 0, item);
      return { ...prev, elements: arr };
    });
  };

  const removeElement = (id: string) => {
    setTemplate((prev) => ({
      ...prev,
      elements: prev.elements.filter((e) => e.id !== id),
    }));
  };

  const handleSave = async () => {
    if (!session || !isOnline) {
      pushToast('warning', 'Saving credential templates requires internet connectivity.');
      return;
    }
    setSaving(true);
    try {
      const payload =
        mode === 'id'
          ? { idCardTemplate: template }
          : { certificateTemplate: template };
      await apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(payload) }, session.token);
      pushToast('success', `${mode === 'id' ? 'ID Card' : 'Membership Certificate'} template saved and published.`);
      await syncNow();
      onSaved?.();
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to save template.');
    } finally {
      setSaving(false);
    }
  };

  const openJsonEditor = () => {
    setJsonText(JSON.stringify(template, null, 2));
    openModal('credentialSchemaModal');
  };

  const applyJsonSchema = () => {
    try {
      const parsed = JSON.parse(jsonText) as CredentialTemplateConfig;
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.elements)) {
        pushToast('error', 'Invalid template JSON structure (elements array is required).');
        return;
      }
      setTemplate(parsed);
      closeModal('credentialSchemaModal');
      pushToast('success', 'JSON template applied to preview. Click Save Template to publish.');
    } catch {
      pushToast('error', 'Malformed JSON syntax.');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h3 className="font-display text-base font-bold text-[#142D4E] dark:text-white flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#087443]" />
            <span>Dynamic {mode === 'id' ? 'ID Card' : 'Membership Certificate'} Designer</span>
          </h3>
          <p className="text-xs text-slate-500">
            Select a preset or customize colors, signatures, QR, fields (use variables like {'{{memberName}}'}, {'{{memberId}}'}, {'{{village}}'}), and JSON config.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTemplate(mode === 'id' ? DEFAULT_ID_CARD_TEMPLATE : DEFAULT_CERTIFICATE_TEMPLATE)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Default</span>
          </button>
          <button
            type="button"
            onClick={openJsonEditor}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Edit JSON Config</span>
          </button>
          <button
            type="button"
            disabled={saving || !isOnline}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#087443] hover:bg-[#065c35] text-white text-xs font-semibold disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save & Publish Template'}</span>
          </button>
        </div>
      </div>

      {/* 6+ Style Presets */}
      <div>
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Design Presets (6 Styles)</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {CREDENTIAL_PRESETS.map((p) => {
            const active = template.presetId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p)}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  active ? 'border-[#087443] ring-2 ring-[#087443]/30 bg-emerald-50/40 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="w-3.5 h-3.5 rounded-full border" style={{ backgroundColor: p.primaryColor }} />
                  <span className="w-3.5 h-3.5 rounded-full border" style={{ backgroundColor: p.secondaryColor }} />
                  <span className="w-3.5 h-3.5 rounded-full border" style={{ backgroundColor: p.accentColor }} />
                </div>
                <p className="text-xs font-semibold truncate">{p.name}</p>
                <p className="text-[10px] text-slate-500 capitalize">{p.borderStyle} border</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Styling & Header/Footer Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium mb-1">Header Title</label>
          <input
            type="text"
            value={template.title}
            onChange={(e) => setTemplate({ ...template, title: e.target.value })}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Subtitle / Organization</label>
          <input
            type="text"
            value={template.subtitle}
            onChange={(e) => setTemplate({ ...template, subtitle: e.target.value })}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Footer Text</label>
          <input
            type="text"
            value={template.footerText}
            onChange={(e) => setTemplate({ ...template, footerText: e.target.value })}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Border Style</label>
          <select
            value={template.borderStyle}
            onChange={(e) => setTemplate({ ...template, borderStyle: e.target.value as any })}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          >
            <option value="ornate">Ornate Double Gold</option>
            <option value="double">Double Frame</option>
            <option value="solid">Solid Clean Border</option>
            <option value="none">Borderless</option>
          </select>
        </div>
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { key: 'primaryColor' as const, label: 'Primary Color' },
          { key: 'secondaryColor' as const, label: 'Header / Dark' },
          { key: 'accentColor' as const, label: 'Accent / Gold' },
          { key: 'backgroundColor' as const, label: 'Card Background' },
          { key: 'textColor' as const, label: 'Body Text' },
        ].map((c) => (
          <div key={c.key}>
            <label className="block text-[11px] font-medium mb-1">{c.label}</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={template[c.key]}
                onChange={(e) => setTemplate({ ...template, [c.key]: e.target.value })}
                className="h-8 w-10 rounded border cursor-pointer shrink-0"
              />
              <input
                type="text"
                value={template[c.key]}
                onChange={(e) => setTemplate({ ...template, [c.key]: e.target.value })}
                className="w-full px-2 py-1 text-xs font-mono-tabular rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Visibility Toggles + Custom Signature */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
        <p className="text-xs font-semibold text-[#142D4E] dark:text-white">Visual Components & Signatures</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {[
            { key: 'showLogo' as const, label: 'Society Logo' },
            { key: 'showPhoto' as const, label: 'Member Photo' },
            { key: 'showQr' as const, label: 'Verification QR' },
            { key: 'showSecretarySignature' as const, label: 'Secretary Signature' },
            { key: 'showPresidentSignature' as const, label: 'President Signature' },
            { key: 'showCustomSignature' as const, label: 'Custom Signature' },
          ].map((t) => (
            <label key={t.key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(template[t.key])}
                onChange={(e) => setTemplate({ ...template, [t.key]: e.target.checked })}
                className="accent-[#087443]"
              />
              <span>{t.label}</span>
            </label>
          ))}
        </div>
        {template.showCustomSignature && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-xs font-medium mb-1">Custom Signature Label</label>
              <input
                type="text"
                value={template.customSignatureLabel}
                onChange={(e) => setTemplate({ ...template, customSignatureLabel: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
            <FileUploadField
              label="Custom Signature Image"
              value={template.customSignatureUrl}
              onChange={(url) => setTemplate({ ...template, customSignatureUrl: url })}
            />
          </div>
        )}
      </div>

      {/* Dynamic Fields Builder */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#142D4E] dark:text-white">Dynamic Template Fields ({template.elements.length})</p>
            <p className="text-[11px] text-slate-500">
              Variables: <code>{'{{memberName}}'}</code>, <code>{'{{memberId}}'}</code>, <code>{'{{fatherName}}'}</code>, <code>{'{{mobileNumber}}'}</code>, <code>{'{{joinDate}}'}</code>, <code>{'{{village}}'}</code>, <code>{'{{accountStatus}}'}</code>, <code>{'{{certNumber}}'}</code>
            </p>
          </div>
          <button
            type="button"
            onClick={addElement}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#142D4E] text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Field</span>
          </button>
        </div>

        <div className="space-y-2">
          {template.elements.map((el, idx) => (
            <div key={el.id} className="grid grid-cols-12 gap-2 items-center p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 text-xs">
              <div className="col-span-1 flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={el.visible}
                  onChange={(e) => updateElement(el.id, { visible: e.target.checked })}
                  className="accent-[#087443]"
                  title="Visible"
                />
              </div>
              <div className="col-span-11 sm:col-span-2">
                <input
                  type="text"
                  value={el.label}
                  onChange={(e) => updateElement(el.id, { label: e.target.value })}
                  placeholder="Field Label"
                  className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
              <div className="col-span-12 sm:col-span-4">
                <input
                  type="text"
                  value={el.valueTemplate}
                  onChange={(e) => updateElement(el.id, { valueTemplate: e.target.value })}
                  placeholder="{{memberName}}"
                  className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono-tabular"
                />
              </div>
              <div className="col-span-3 sm:col-span-1">
                <input
                  type="number"
                  step="0.5"
                  value={el.x}
                  onChange={(e) => updateElement(el.id, { x: Number(e.target.value) })}
                  title="PDF X (mm)"
                  className="w-full px-1.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono-tabular"
                />
              </div>
              <div className="col-span-3 sm:col-span-1">
                <input
                  type="number"
                  step="0.5"
                  value={el.y}
                  onChange={(e) => updateElement(el.id, { y: Number(e.target.value) })}
                  title="PDF Y (mm)"
                  className="w-full px-1.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono-tabular"
                />
              </div>
              <div className="col-span-3 sm:col-span-1">
                <input
                  type="number"
                  min={5}
                  max={36}
                  step="0.5"
                  value={el.fontSize}
                  onChange={(e) => updateElement(el.id, { fontSize: Number(e.target.value) })}
                  title="Font Size"
                  className="w-full px-1.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono-tabular"
                />
              </div>
              <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => updateElement(el.id, { fontWeight: el.fontWeight === 'bold' ? 'normal' : 'bold' })}
                  className={`px-2 py-1 rounded border text-[11px] font-bold ${el.fontWeight === 'bold' ? 'bg-[#142D4E] text-white' : ''}`}
                  title="Toggle Bold"
                >
                  B
                </button>
                <button type="button" onClick={() => moveElement(idx, -1)} className="p-1 rounded border hover:bg-slate-200 dark:hover:bg-slate-700" title="Move Up">
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button type="button" onClick={() => moveElement(idx, 1)} className="p-1 rounded border hover:bg-slate-200 dark:hover:bg-slate-700" title="Move Down">
                  <ArrowDown className="w-3 h-3" />
                </button>
                <button type="button" onClick={() => removeElement(el.id)} className="p-1 rounded border border-red-200 text-red-600 hover:bg-red-50" title="Remove">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* JSON Schema Modal (Boolean Global Modal State) */}
      {modals.credentialSchemaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 no-print">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h4 className="font-display text-sm font-bold text-[#142D4E] dark:text-white">
                JSON Template Schema ({mode === 'id' ? 'ID Card' : 'Certificate'})
              </h4>
              <button type="button" onClick={() => closeModal('credentialSchemaModal')} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <textarea
                rows={16}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="w-full p-3 text-xs font-mono-tabular rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button type="button" onClick={() => closeModal('credentialSchemaModal')} className="px-4 py-1.5 rounded-lg border text-xs font-semibold">
                {tr('cancel')}
              </button>
              <button type="button" onClick={applyJsonSchema} className="px-4 py-1.5 rounded-lg bg-[#087443] text-white text-xs font-semibold">
                Apply JSON Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
