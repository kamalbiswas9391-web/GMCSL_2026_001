import type {
  AttendanceRecord,
  AuditLogRecord,
  BackupLogRecord,
  CashBookRecord,
  CertificateRecord,
  LoanApplicationRecord,
  LoanRecord,
  LoanRepaymentRecord,
  MediaItemRecord,
  MeetingRecord,
  MemberRecord,
  NoticeRecord,
  NotificationRecord,
  OnlinePaymentRecord,
  ReceiptRecord,
  SessionLogRecord,
  ShareRecord,
  SavingRecord,
  SyncStatus,
  UserRole,
} from '../src/types.ts';

function maskTail(val: string, visible = 4): string {
  if (!val) return '';
  if (val.length <= visible) return val;
  return 'X'.repeat(Math.max(4, val.length - visible)) + val.slice(-visible);
}

export function mapMember(row: any, viewerRole: UserRole, viewerMemberId?: string): MemberRecord {
  const isSelfOrSystem = viewerRole === 'System' || (viewerRole === 'Member' && viewerMemberId === row.member_id);
  const canSeeSensitive = viewerRole === 'System' || viewerRole === 'President' || viewerRole === 'Secretary' || isSelfOrSystem;
  return {
    id: row.id,
    memberId: row.member_id,
    memberName: row.member_name,
    fatherName: row.father_name || '',
    joinDate: row.join_date,
    dateOfBirth: row.date_of_birth || '',
    aadhaarNumber: viewerRole === 'System' || isSelfOrSystem ? (row.aadhaar_number || '') : maskTail(row.aadhaar_number || ''),
    panNumber: viewerRole === 'System' || isSelfOrSystem ? (row.pan_number || '') : maskTail(row.pan_number || ''),
    voterId: row.voter_id || '',
    bankAccountNumber: canSeeSensitive ? (viewerRole === 'System' || isSelfOrSystem ? (row.bank_account_number || '') : maskTail(row.bank_account_number || '')) : '',
    ifscCode: row.ifsc_code || '',
    branchName: row.branch_name || '',
    mobileNumber: row.mobile_number,
    gmailId: row.gmail_id || '',
    state: row.state || 'Assam',
    district: row.district || '',
    developmentBlock: row.development_block || '',
    village: row.village || '',
    postOffice: row.post_office || '',
    pinCode: row.pin_code || '',
    panchayat: row.panchayat || '',
    photoUrl: row.photo_url || '',
    signatureUrl: row.signature_url || '',
    hasPin: Boolean(row.member_pin_hash),
    accountStatus: row.account_status as 'Active' | 'Inactive',
    isLocked: Boolean(row.is_locked),
    createdDate: row.created_date,
    updatedDate: row.updated_date,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    syncStatus: (row.sync_status || 'Synced') as SyncStatus,
    lastSyncedTime: row.last_synced_time || '',
    recordVersion: Number(row.record_version || 1),
    offlineOperationId: row.offline_operation_id || undefined,
  };
}

export function mapSaving(row: any): SavingRecord {
  return {
    id: row.id,
    savingId: row.saving_id,
    memberId: row.member_id,
    memberName: row.member_name,
    date: row.date,
    monthlySavingAmount: Number(row.monthly_saving_amount || 0),
    previousSavingAmount: Number(row.previous_saving_amount || 0),
    interest: Number(row.interest || 0),
    fine: Number(row.fine || 0),
    totalSaving: Number(row.total_saving || 0),
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    meetingStatus: row.meeting_status,
    receiptNumber: row.receipt_number || '',
    isReversal: Boolean(row.is_reversal),
    reversedRecordId: row.reversed_record_id || undefined,
    createdDate: row.created_date,
    updatedDate: row.updated_date,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    syncStatus: (row.sync_status || 'Synced') as SyncStatus,
    lastSyncedTime: row.last_synced_time || '',
    recordVersion: Number(row.record_version || 1),
    offlineOperationId: row.offline_operation_id || undefined,
  };
}

export function mapShare(row: any): ShareRecord {
  return {
    id: row.id,
    shareId: row.share_id,
    memberId: row.member_id,
    memberName: row.member_name,
    numberOfShares: Number(row.number_of_shares || 0),
    faceValuePerShare: Number(row.face_value_per_share || 0),
    totalShareValue: Number(row.total_share_value || 0),
    date: row.date,
    note: row.note || '',
    createdDate: row.created_date,
    updatedDate: row.updated_date,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    syncStatus: (row.sync_status || 'Synced') as SyncStatus,
    lastSyncedTime: row.last_synced_time || '',
    recordVersion: Number(row.record_version || 1),
    offlineOperationId: row.offline_operation_id || undefined,
  };
}

export function mapLoan(row: any): LoanRecord {
  return {
    id: row.id,
    loanId: row.loan_id,
    loanNumber: row.loan_number,
    memberId: row.member_id,
    memberName: row.member_name,
    loanDate: row.loan_date,
    loanAmount: Number(row.loan_amount || 0),
    previousLoanAmount: Number(row.previous_loan_amount || 0),
    totalLoanAmount: Number(row.total_loan_amount || 0),
    loanRepayment: Number(row.loan_repayment || 0),
    interest: Number(row.interest || 0),
    fine: Number(row.fine || 0),
    currentLoanBalance: Number(row.current_loan_balance || 0),
    nextDueDate: row.next_due_date || '',
    paymentStatus: row.payment_status,
    loanStatus: row.loan_status,
    paymentMethod: row.payment_method,
    memberSignatureUrl: row.member_signature_url || '',
    secretarySignatureUrl: row.secretary_signature_url || '',
    presidentSignatureUrl: row.president_signature_url || '',
    applicationId: row.application_id || undefined,
    isDisbursement: Boolean(row.is_disbursement),
    isReversal: Boolean(row.is_reversal),
    reversedRecordId: row.reversed_record_id || undefined,
    createdDate: row.created_date,
    updatedDate: row.updated_date,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    syncStatus: (row.sync_status || 'Synced') as SyncStatus,
    lastSyncedTime: row.last_synced_time || '',
    recordVersion: Number(row.record_version || 1),
    offlineOperationId: row.offline_operation_id || undefined,
  };
}

export function mapLoanRepayment(row: any): LoanRepaymentRecord {
  return {
    id: row.id,
    repaymentId: row.repayment_id,
    loanId: row.loan_id,
    loanNumber: row.loan_number,
    memberId: row.member_id,
    memberName: row.member_name,
    date: row.date,
    loanBalanceBefore: Number(row.loan_balance_before || 0),
    principalPaid: Number(row.principal_paid || 0),
    interestPaid: Number(row.interest_paid || 0),
    finePaid: Number(row.fine_paid || 0),
    totalPaid: Number(row.total_paid || 0),
    loanBalanceAfter: Number(row.loan_balance_after || 0),
    paymentMode: row.payment_mode || 'Cash',
    memberSignatureUrl: row.member_signature_url || '',
    secretarySignatureUrl: row.secretary_signature_url || '',
    presidentSignatureUrl: row.president_signature_url || '',
    photoUrl: row.photo_url || '',
    receiptNumber: row.receipt_number || '',
    savingId: row.saving_id || '',
    notes: row.notes || '',
    createdDate: row.created_date,
    updatedDate: row.updated_date,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    syncStatus: (row.sync_status || 'Synced') as SyncStatus,
    lastSyncedTime: row.last_synced_time || '',
    recordVersion: Number(row.record_version || 1),
    offlineOperationId: row.offline_operation_id || undefined,
  };
}

export function mapCashBook(row: any): CashBookRecord {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    date: row.date,
    paymentMode: row.payment_mode,
    description: row.description,
    bankAmount: Number(row.bank_amount || 0),
    cashAmount: Number(row.cash_amount || 0),
    totalAmount: Number(row.total_amount || 0),
    depositAmount: Number(row.deposit_amount || 0),
    paymentAmount: Number(row.payment_amount || 0),
    balance: Number(row.balance || 0),
    bankBalanceAfter: Number(row.bank_balance_after || 0),
    cashBalanceAfter: Number(row.cash_balance_after || 0),
    referenceNumber: row.reference_number || '',
    notes: row.notes || '',
    allowAdjustment: Boolean(row.allow_adjustment),
    isReversal: Boolean(row.is_reversal),
    reversedRecordId: row.reversed_record_id || undefined,
    createdDate: row.created_date,
    updatedDate: row.updated_date,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    syncStatus: (row.sync_status || 'Synced') as SyncStatus,
    lastSyncedTime: row.last_synced_time || '',
    recordVersion: Number(row.record_version || 1),
    offlineOperationId: row.offline_operation_id || undefined,
  };
}

export function mapAttendance(row: any): AttendanceRecord {
  return {
    id: row.id,
    attendanceId: row.attendance_id,
    memberId: row.member_id,
    memberName: row.member_name,
    date: row.date,
    meetingLocation: row.meeting_location || '',
    meetingNumber: row.meeting_number,
    meetingMethod: row.meeting_method,
    attendanceStatus: row.attendance_status,
    createdDate: row.created_date,
    updatedDate: row.updated_date,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    syncStatus: (row.sync_status || 'Synced') as SyncStatus,
    lastSyncedTime: row.last_synced_time || '',
    recordVersion: Number(row.record_version || 1),
    offlineOperationId: row.offline_operation_id || undefined,
  };
}

export function mapLoanApplication(row: any): LoanApplicationRecord {
  return {
    id: row.id,
    applicationId: row.application_id,
    memberId: row.member_id,
    memberName: row.member_name,
    mobileNumber: row.mobile_number,
    applicationDate: row.application_date,
    loanAmountRequired: Number(row.loan_amount_required || 0),
    purposeOfLoan: row.purpose_of_loan,
    additionalNote: row.additional_note || '',
    supportingDocumentUrl: row.supporting_document_url || '',
    applicationStatus: row.application_status,
    approvalNote: row.approval_note || '',
    approvedAmount: Number(row.approved_amount || 0),
    approvedBy: row.approved_by || '',
    approvalDate: row.approval_date || '',
    presidentSignature: row.president_signature || '',
    secretarySignature: row.secretary_signature || '',
    disbursed: Boolean(row.disbursed),
    createdDate: row.created_date,
    updatedDate: row.updated_date,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    syncStatus: (row.sync_status || 'Synced') as SyncStatus,
    lastSyncedTime: row.last_synced_time || '',
    recordVersion: Number(row.record_version || 1),
    offlineOperationId: row.offline_operation_id || undefined,
  };
}

export function mapOnlinePayment(row: any): OnlinePaymentRecord {
  return {
    id: row.id,
    paymentId: row.payment_id,
    memberId: row.member_id,
    memberName: row.member_name,
    date: row.date,
    amount: Number(row.amount || 0),
    paymentMethod: row.payment_method,
    upiTransactionId: row.upi_transaction_id,
    paymentScreenshotUrl: row.payment_screenshot_url || '',
    verificationStatus: row.verification_status,
    verifiedBy: row.verified_by || '',
    verificationDate: row.verification_date || '',
    receiptNumber: row.receipt_number || '',
    notes: row.notes || '',
    createdDate: row.created_date,
    updatedDate: row.updated_date,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    syncStatus: (row.sync_status || 'Synced') as SyncStatus,
    lastSyncedTime: row.last_synced_time || '',
    recordVersion: Number(row.record_version || 1),
    offlineOperationId: row.offline_operation_id || undefined,
  };
}

export function mapMeeting(row: any): MeetingRecord {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    meetingNumber: row.meeting_number,
    meetingDate: row.meeting_date,
    meetingType: row.meeting_type,
    meetingLocation: row.meeting_location,
    meetingAgenda: row.meeting_agenda || '',
    meetingNotes: row.meeting_notes || '',
    createdDate: row.created_date,
    updatedDate: row.updated_date,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    syncStatus: (row.sync_status || 'Synced') as SyncStatus,
    lastSyncedTime: row.last_synced_time || '',
    recordVersion: Number(row.record_version || 1),
    offlineOperationId: row.offline_operation_id || undefined,
  };
}

export function mapNotice(row: any): NoticeRecord {
  return {
    id: row.id,
    noticeId: row.notice_id,
    title: row.title,
    titleAs: row.title_as || '',
    content: row.content,
    contentAs: row.content_as || '',
    category: row.category,
    targetRole: row.target_role,
    attachmentUrl: row.attachment_url || '',
    attachmentType: row.attachment_type || 'Text',
    publishDate: row.publish_date,
    expiryDate: row.expiry_date || '',
    isPublished: Boolean(row.is_published),
    isBanner: Boolean(row.is_banner),
    createdDate: row.created_date,
    updatedDate: row.updated_date,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    syncStatus: (row.sync_status || 'Synced') as SyncStatus,
    lastSyncedTime: row.last_synced_time || '',
    recordVersion: Number(row.record_version || 1),
    offlineOperationId: row.offline_operation_id || undefined,
  };
}

export function mapNotification(row: any): NotificationRecord {
  return {
    id: row.id,
    notificationId: row.notification_id,
    targetRole: row.target_role,
    targetMemberId: row.target_member_id || undefined,
    type: row.type,
    title: row.title,
    message: row.message,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
    relatedId: row.related_id || undefined,
  };
}

export function mapMedia(row: any): MediaItemRecord {
  return {
    id: row.id,
    mediaId: row.media_id,
    title: row.title,
    titleAs: row.title_as || '',
    description: row.description || '',
    mediaType: row.media_type,
    dataUrl: row.data_url,
    fileName: row.file_name,
    visibility: row.visibility,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

export function mapAudit(row: any): AuditLogRecord {
  return {
    id: row.id,
    auditId: row.audit_id,
    userId: row.user_id,
    userName: row.user_name,
    userRole: row.user_role,
    action: row.action,
    module: row.module,
    recordId: row.record_id,
    previousValue: row.previous_value || '',
    updatedValue: row.updated_value || '',
    timestamp: row.timestamp,
    sessionInfo: row.session_info || '',
  };
}

export function mapReceipt(row: any): ReceiptRecord {
  return {
    id: row.id,
    receiptNumber: row.receipt_number,
    receiptType: row.receipt_type,
    memberId: row.member_id,
    memberName: row.member_name,
    date: row.date,
    amount: Number(row.amount || 0),
    paymentMethod: row.payment_method,
    details: row.details || '',
    verificationStatus: row.verification_status,
    authorizedBy: row.authorized_by,
    createdAt: row.created_at,
  };
}

export function mapCertificate(row: any): CertificateRecord {
  return {
    id: row.id,
    certificateNumber: row.certificate_number,
    certificateType: row.certificate_type,
    memberId: row.member_id,
    memberName: row.member_name,
    issueDate: row.issue_date,
    issuedBy: row.issued_by,
    verificationCode: row.verification_code,
  };
}

export function mapBackup(row: any): BackupLogRecord {
  return {
    id: row.id,
    backupId: row.backup_id,
    backupType: row.backup_type,
    createdBy: row.created_by,
    status: row.status,
    recordCount: Number(row.record_count || 0),
    timestamp: row.timestamp,
    notes: row.notes || '',
  };
}

export function mapSession(row: any): SessionLogRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    userRole: row.user_role,
    userName: row.user_name,
    loginTime: row.login_time,
    expiresAt: row.expires_at,
    isActive: Boolean(row.is_active),
    deviceInfo: row.device_info || '',
  };
}
