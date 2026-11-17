export type UserRole = 'System' | 'President' | 'Secretary' | 'Member';
export type AppLanguage = 'en' | 'as';
export type ThemeMode = 'light' | 'dark' | 'auto';
export type SyncStatus = 'Synced' | 'Pending' | 'Syncing' | 'Failed' | 'Conflict' | 'Requires Review';

export type ModuleKey =
  | 'member_register'
  | 'saving_register'
  | 'loan_register'
  | 'loan_repayment'
  | 'cash_book'
  | 'share_register'
  | 'attendance'
  | 'loan_application'
  | 'online_payment'
  | 'reports'
  | 'notices'
  | 'meetings'
  | 'id_certificates'
  | 'media_manager';

export interface RolePermission {
  id: string;
  role: Exclude<UserRole, 'System'>;
  moduleKey: ModuleKey;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isHidden: boolean;
  updatedBy: string;
  updatedAt: string;
}

export interface BaseRecordMeta {
  id: string;
  createdDate: string;
  updatedDate: string;
  createdBy: string;
  updatedBy: string;
  syncStatus: SyncStatus;
  lastSyncedTime: string;
  recordVersion: number;
  offlineOperationId?: string;
}

// 1. Member_Register_Sheet
export interface MemberRecord extends BaseRecordMeta {
  memberId: string;
  memberName: string;
  fatherName: string;
  joinDate: string;
  dateOfBirth: string;
  aadhaarNumber: string;
  panNumber: string;
  voterId: string;
  bankAccountNumber: string;
  ifscCode: string;
  branchName: string;
  mobileNumber: string;
  gmailId: string;
  state: string;
  district: string;
  developmentBlock: string;
  village: string;
  postOffice: string;
  pinCode: string;
  panchayat: string;
  photoUrl: string;
  signatureUrl: string;
  memberPinHash?: string; // server only, never sent to frontend
  hasPin?: boolean;
  accountStatus: 'Active' | 'Inactive';
  isLocked?: boolean;
}

// 2. Saving_register_Sheet
export interface SavingRecord extends BaseRecordMeta {
  savingId: string;
  memberId: string;
  memberName: string;
  date: string;
  monthlySavingAmount: number;
  previousSavingAmount: number;
  interest: number;
  fine: number;
  totalSaving: number;
  paymentStatus: 'Online' | 'Cash' | 'Pending' | 'No Payment';
  paymentMethod: 'Saving' | 'Online' | 'Cash' | 'UPI' | 'Other';
  meetingStatus: 'Present' | 'Absent';
  receiptNumber: string;
  isReversal?: boolean;
  reversedRecordId?: string;
}

// 3. Share_Register_Sheet
export interface ShareRecord extends BaseRecordMeta {
  shareId: string;
  memberId: string;
  memberName: string;
  numberOfShares: number;
  faceValuePerShare: number;
  totalShareValue: number;
  date: string;
  note: string;
}

// 4. Loan_Register_Sheet
export interface LoanRecord extends BaseRecordMeta {
  loanId: string;
  loanNumber: string;
  memberId: string;
  memberName: string;
  loanDate: string;
  loanAmount: number;
  previousLoanAmount: number;
  totalLoanAmount: number;
  loanRepayment: number;
  interest: number;
  fine: number;
  currentLoanBalance: number;
  nextDueDate: string;
  paymentStatus: 'Online' | 'Cash' | 'Pending' | 'No Payment';
  loanStatus: 'Active' | 'Close' | 'Inactive' | 'Running';
  paymentMethod: 'Saving' | 'Interest' | 'Loan' | 'Fine' | 'Other';
  memberSignatureUrl: string;
  secretarySignatureUrl: string;
  presidentSignatureUrl: string;
  applicationId?: string;
  isDisbursement?: boolean;
  isReversal?: boolean;
  reversedRecordId?: string;
}

// Dedicated Loan Repayment Record
export interface LoanRepaymentRecord extends BaseRecordMeta {
  repaymentId: string;
  loanId: string;
  loanNumber: string;
  memberId: string;
  memberName: string;
  date: string;
  loanBalanceBefore: number;
  principalPaid: number;
  interestPaid: number;
  finePaid: number;
  totalPaid: number;
  loanBalanceAfter: number;
  paymentMode: 'Cash' | 'Online' | 'UPI' | 'Bank' | 'Saving';
  memberSignatureUrl: string;
  secretarySignatureUrl: string;
  presidentSignatureUrl: string;
  photoUrl: string;
  receiptNumber: string;
  savingId: string;
  notes: string;
}

// 5. Cash_book_Sheet
export interface CashBookRecord extends BaseRecordMeta {
  transactionId: string;
  date: string;
  paymentMode: 'Deposit' | 'Payment';
  description: string;
  bankAmount: number;
  cashAmount: number;
  totalAmount: number;
  depositAmount: number;
  paymentAmount: number;
  balance: number;
  bankBalanceAfter?: number;
  cashBalanceAfter?: number;
  referenceNumber: string;
  notes: string;
  allowAdjustment?: boolean;
  isReversal?: boolean;
  reversedRecordId?: string;
}

// 6. Attendance_Register_Sheet
export interface AttendanceRecord extends BaseRecordMeta {
  attendanceId: string;
  memberId: string;
  memberName: string;
  date: string;
  meetingLocation: string;
  meetingNumber: string;
  meetingMethod: 'Executive Meeting' | 'General Meeting';
  attendanceStatus: 'Present' | 'Absent';
}

// 7. Loan_apply_Sheet
export interface LoanApplicationRecord extends BaseRecordMeta {
  applicationId: string;
  memberId: string;
  memberName: string;
  mobileNumber: string;
  applicationDate: string;
  loanAmountRequired: number;
  purposeOfLoan: 'Business' | 'Agriculture' | 'Farmer' | 'Other';
  additionalNote: string;
  supportingDocumentUrl?: string;
  applicationStatus: 'Pending' | 'Under Review' | 'Recommended' | 'Approved' | 'Rejected' | 'Cancelled';
  approvalNote: string;
  approvedAmount: number;
  approvedBy: string;
  approvalDate: string;
  presidentSignature: string;
  secretarySignature: string;
  disbursed?: boolean;
}

// 8. Online_Payments_Sheet
export interface OnlinePaymentRecord extends BaseRecordMeta {
  paymentId: string;
  memberId: string;
  memberName: string;
  date: string;
  amount: number;
  paymentMethod: 'Saving' | 'Interest' | 'Fine' | 'Loan' | 'Other';
  upiTransactionId: string;
  paymentScreenshotUrl: string;
  verificationStatus: 'Pending' | 'Verified' | 'Rejected';
  verifiedBy: string;
  verificationDate: string;
  receiptNumber: string;
  notes: string;
}

// Supporting Sheets
export interface SystemUserRecord {
  id: string;
  userId: string;
  role: UserRole;
  memberId?: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  accountStatus: 'Active' | 'Inactive';
  isLocked: boolean;
  failedAttempts: number;
  lockedUntil?: string;
  mustChangePassword?: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingRecord extends BaseRecordMeta {
  meetingId: string;
  meetingNumber: string;
  meetingDate: string;
  meetingType: 'Executive Meeting' | 'General Meeting';
  meetingLocation: string;
  meetingAgenda: string;
  meetingNotes: string;
}

export interface NoticeRecord extends BaseRecordMeta {
  noticeId: string;
  title: string;
  titleAs?: string;
  content: string;
  contentAs?: string;
  category: 'General' | 'Meeting' | 'Payment' | 'Important Announcement' | 'Emergency';
  targetRole: 'Everyone' | UserRole;
  attachmentUrl?: string;
  attachmentType?: 'Text' | 'Image' | 'PDF' | 'Document';
  publishDate: string;
  expiryDate?: string;
  isPublished: boolean;
  isBanner?: boolean;
}

export interface NotificationRecord {
  id: string;
  notificationId: string;
  targetRole: 'Everyone' | UserRole;
  targetMemberId?: string;
  type:
    | 'New Loan Application'
    | 'Loan Approved'
    | 'Loan Rejected'
    | 'Payment Submitted'
    | 'Payment Verified'
    | 'Payment Rejected'
    | 'Saving Entry'
    | 'Loan Repayment'
    | 'New Notice'
    | 'Upcoming Meeting'
    | 'Due Date Reminder'
    | 'Sync Alert';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedId?: string;
}

export interface MediaItemRecord {
  id: string;
  mediaId: string;
  title: string;
  titleAs?: string;
  description?: string;
  mediaType: 'Image' | 'Photo' | 'Video' | 'PDF' | 'Document' | 'Notice';
  dataUrl: string;
  fileName: string;
  visibility: 'Everyone' | 'President' | 'Secretary' | 'Member' | 'System';
  uploadedBy: string;
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  auditId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  module: string;
  recordId: string;
  previousValue: string;
  updatedValue: string;
  timestamp: string;
  sessionInfo: string;
}

export interface ReceiptRecord {
  id: string;
  receiptNumber: string;
  receiptType: 'Saving' | 'Loan Repayment' | 'Loan Disbursement' | 'Online Payment' | 'Share Purchase' | 'Cash Book Voucher';
  memberId: string;
  memberName: string;
  date: string;
  amount: number;
  paymentMethod: string;
  details: string;
  verificationStatus: 'Verified' | 'Provisional / Pending Sync' | 'Pending Verification';
  authorizedBy: string;
  createdAt: string;
}

export interface CertificateRecord {
  id: string;
  certificateNumber: string;
  certificateType: 'ID Card' | 'Membership Certificate';
  memberId: string;
  memberName: string;
  issueDate: string;
  issuedBy: string;
  verificationCode: string;
}

export interface BackupLogRecord {
  id: string;
  backupId: string;
  backupType: 'Full JSON Snapshot' | 'Excel Export' | 'CSV Export' | 'Local Offline Encrypted';
  createdBy: string;
  status: 'Completed' | 'Restored' | 'Failed';
  recordCount: number;
  timestamp: string;
  notes?: string;
}

export interface SessionLogRecord {
  id: string;
  sessionId: string;
  userId: string;
  userRole: UserRole;
  userName: string;
  loginTime: string;
  expiresAt: string;
  isActive: boolean;
  deviceInfo: string;
}

export interface SocietySettings {
  societyName: string;
  societyNameAs: string;
  shortName: string;
  registrationDetails: string;
  address: string;
  addressAs: string;
  contactPhone: string;
  officialEmail: string;
  upiId: string;
  upiQrImageUrl: string;
  showUpiQr: boolean;
  onlinePaymentEnabled: boolean;
  paymentInstructions: string;
  paymentInstructionsAs: string;
  bankDetails: string;
  financialYear: string;
  currencySymbol: string;
  dateFormat: string;
  defaultLanguage: AppLanguage;
  logoUrl: string;
  dashboardBannerUrl: string;
  officialSignatureUrl: string;
  presidentSignatureUrl: string;
  secretarySignatureUrl: string;
  receiptPrefix: string;
  memberIdPrefix: string;
  loanNumberPrefix: string;
  homepageHeroTitle: string;
  homepageHeroTitleAs: string;
  homepageHeroSubtitle: string;
  homepageHeroSubtitleAs: string;
  homepageIntro: string;
  homepageIntroAs: string;
  announcementTicker: string;
  announcementTickerAs: string;
  showPhotoGallery: boolean;
  showVideoGallery: boolean;
  showDocumentsSection: boolean;
  themePrimary: string;
  themeSecondary: string;
  themeAccent: string;
  themeSidebar: string;
  themeHeader: string;
  themeMode: ThemeMode;
  buttonStyle: 'rounded' | 'sharp' | 'soft';
  cardStyle: 'bordered' | 'elevated' | 'flat';
  allowOfflineSystemSettings: boolean;
  autoIdEditableRoles?: Record<'President' | 'Secretary' | 'Member', boolean>;
  dashboardDrilldownRoles?: Record<'President' | 'Secretary' | 'Member', boolean>;
  firebaseConfig?: DynamicFirebaseConfig | null;
  idCardTemplate?: CredentialTemplateConfig;
  certificateTemplate?: CredentialTemplateConfig;
  updatedAt: string;
}

export interface DynamicFirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
  firestoreDatabaseId?: string;
}

export interface CredentialElement {
  id: string;
  label: string;
  valueTemplate: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  color: string;
  align: 'left' | 'center' | 'right';
  visible: boolean;
}

export interface CredentialTemplateConfig {
  presetId: string;
  title: string;
  subtitle: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  borderStyle: 'solid' | 'double' | 'ornate' | 'none';
  showLogo: boolean;
  showPhoto: boolean;
  showQr: boolean;
  showSecretarySignature: boolean;
  showPresidentSignature: boolean;
  showCustomSignature: boolean;
  customSignatureLabel: string;
  customSignatureUrl: string;
  footerText: string;
  elements: CredentialElement[];
}

export interface GoogleDriveFileItem {
  id: string;
  driveFileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  webViewLink: string;
  createdAt: string;
  createdBy: string;
  source: 'Google Drive' | 'Local Snapshot';
  status: 'Synced' | 'Pending' | 'Failed';
}

export interface GoogleDriveConfigStatus {
  configured: boolean;
  hasClientId: boolean;
  clientIdMasked: string;
  hasClientSecret: boolean;
  hasAuthToken: boolean;
  folderId: string;
  folderName: string;
  syncFrequency: 'Manual' | '15m' | 'Hourly' | 'Daily';
  autoBackup: boolean;
  connected: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  files: GoogleDriveFileItem[];
}

export interface GoogleSheetsStatus {
  mode: 'service_account' | 'apps_script' | 'not_configured';
  spreadsheetId: string;
  appsScriptUrl: string;
  connected: boolean;
  lastCheckedAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  pendingCount: number;
  mappedSheets: string[];
  errorLogs: Array<{ timestamp: string; message: string; sheet?: string }>;
}

export interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  totalMonthlySavings: number;
  totalSavings: number;
  totalShares: number;
  totalShareValue: number;
  totalLoanDisbursed: number;
  totalLoanBalance: number;
  totalLoanInterest: number;
  totalLoanFine: number;
  totalLoanRepaid: number;
  activeLoans: number;
  closedLoans: number;
  inactiveLoans: number;
  totalBankBalance: number;
  totalCashBalance: number;
  totalCashDepositCount?: number;
  totalCashDepositAmount?: number;
  totalCashPaymentCount?: number;
  totalCashPaymentAmount?: number;
  totalLoanApplications?: number;
  totalOnlinePayments?: number;
  totalLoanRepayments?: number;
  pendingLoanApplications: number;
  pendingOnlinePayments: number;
  totalMeetings: number;
  isLive: boolean;
  lastSyncedAt: string;
}

export interface PendingSyncOperation {
  operationId: string;
  module: string;
  action: 'create' | 'update' | 'delete';
  recordId: string;
  baseVersion: number;
  payload: Record<string, unknown>;
  createdAt: string;
  createdBy: string;
  userRole: UserRole;
  status: SyncStatus;
  errorMessage?: string;
  conflictData?: {
    serverVersion: number;
    serverRecord: Record<string, unknown>;
    localRecord: Record<string, unknown>;
    modifiedBy: string;
    lastModifiedTime: string;
  };
}

export interface AuthSession {
  token: string;
  sessionId: string;
  user: SystemUserRecord;
  memberProfile?: MemberRecord | null;
  expiresAt: string;
  issuedAt: string;
  offlineAuthorized: boolean;
}
