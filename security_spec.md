# GMCSL Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Identity Integrity**: Every user profile (`/users/{userId}`), private PII document (`/users/{userId}/private/{docId}`), user record (`/users/{userId}/records/{recordId}`), and shared record (`/society_records/{recordId}`) MUST match `request.auth.uid` on create and retain immutable `uid` / `ownerUid` and `createdAt` on update.
2. **Verified Users Only**: All Firestore writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **Master Gate**: Subcollections under `/users/{userId}/...` verify parent `/users/{userId}` existence via `exists(...)` (or `existsAfter(...)` in atomic batch writes).
4. **No Self-Assigned Admin Privilege**: Users cannot create `/users/{userId}` with `role == 'System'` unless `isAdmin()`, and cannot write to `/admins/{adminUid}` unless already a verified Admin (`kamalbiswas9391@gmail.com` with `email_verified == true` or existing `/admins/{uid}`).
5. **Non-Deletion Guarantee**: Records use `isDeleted: false` by default and are never automatically deleted by sync or session expiration. Only explicit user deletion (`allow delete: if isVerified() && (isOwner(userId) || isAdmin())`) removes a document.
6. **Zero `get()`/`exists()` inside `allow list`**: Collection list rules validate strictly against `resource.data.ownerUid == request.auth.uid || isAdminToken()`.
7. **Temporal Integrity**: `createdAt` and `updatedAt` MUST equal `request.time` on creation, and `updatedAt` MUST equal `request.time` while `createdAt == existing().createdAt` on update.

## 2. The "Dirty Dozen" Adversarial Payloads (All Must Fail with PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: `db.collection('society_records').get()` with `auth: null`.
2. **Unverified Email Spoof**: Write as `{ email: 'kamalbiswas9391@gmail.com', email_verified: false }`.
3. **Identity Spoofing on Create**: User `alice` creating `/users/alice/records/rec1` with `ownerUid: 'bob'`.
4. **Self-Assigned Admin Escalation**: Regular user creating `/users/alice` with `role: 'System'`.
5. **Admin Registry Injection**: Regular user writing `/admins/alice`.
6. **Ghost Field / Shadow Update**: Updating `/society_records/rec1` with extra key `isAdminOverride: true`.
7. **ID Poisoning**: Creating `/society_records/` with 300-char ID or invalid characters `bad/id$1`.
8. **Type Poisoning**: Updating `amount` to a string `"5000"` or `summary` > 300 chars.
9. **Immutable Field Mutation**: Updating `createdAt` or `ownerUid` on an existing `/society_records/rec1`.
10. **PII Cross-Read**: User `bob` reading `/users/alice/private/info`.
11. **Unbounded List Scraping**: User `alice` querying `collection('society_records')` without `where('ownerUid', '==', 'alice')`.
12. **Client Timestamp Forgery**: Creating a record with `createdAt` set to a client string instead of `request.time`.

## 3. Test Runner Reference
See `firestore.rules.test.ts` for automated verification of all 12 adversarial payloads.
