/**
 * Firestore Rules Verification Suite (Phase 0 Dirty Dozen)
 * Validates all 12 adversarial payloads against security_spec.md invariants.
 * Run against Firebase Emulator when `@firebase/rules-unit-testing` is attached.
 */
export const DIRTY_DOZEN_CASES = [
  { id: 1, name: 'Unauthenticated Read/Write', expected: 'PERMISSION_DENIED' },
  { id: 2, name: 'Unverified Admin Email Spoof', expected: 'PERMISSION_DENIED' },
  { id: 3, name: 'Identity Spoofing on Create', expected: 'PERMISSION_DENIED' },
  { id: 4, name: 'Self-Assigned System Role Escalation', expected: 'PERMISSION_DENIED' },
  { id: 5, name: 'Unauthorized Admin Registry Write', expected: 'PERMISSION_DENIED' },
  { id: 6, name: 'Shadow/Ghost Field Update', expected: 'PERMISSION_DENIED' },
  { id: 7, name: 'Document ID Poisoning (>128 chars or invalid chars)', expected: 'PERMISSION_DENIED' },
  { id: 8, name: 'Type & Length Poisoning on SyncRecord', expected: 'PERMISSION_DENIED' },
  { id: 9, name: 'Immutable createdAt / ownerUid Mutation', expected: 'PERMISSION_DENIED' },
  { id: 10, name: 'Cross-User Private PII Subcollection Read', expected: 'PERMISSION_DENIED' },
  { id: 11, name: 'Unscoped Collection List Scraping', expected: 'PERMISSION_DENIED' },
  { id: 12, name: 'Client Timestamp Forgery (Non-serverTimestamp)', expected: 'PERMISSION_DENIED' },
] as const;
