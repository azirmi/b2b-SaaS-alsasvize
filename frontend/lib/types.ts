import type {
  ApplicationType,
  Department,
  DocAssistantConstraintLabel,
  DocAssistantDocumentStatus,
  DocAssistantDocumentType,
  FileType,
  OcrStatus,
  Role,
  VisaStage,
} from "./enums";

/** Authenticated principal returned by `GET /auth/me`. Mirrors backend `AuthenticatedUser`. */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: Role;
}

/** Minimal customer projection embedded in application list responses. */
export interface ApplicationCustomer {
  id: string;
  email: string;
  fullName: string;
}

/**
 * Application shape returned by `GET /applications/pool` and `/applications/mine`
 * (Prisma `APPLICATION_INCLUDE`). Dates arrive as ISO strings over JSON.
 */
export interface VisaApplicationSummary {
  id: string;
  currentStage: VisaStage;
  applicationType: ApplicationType;
  customerId: string;
  assignedSalesId: string | null;
  assignedDocId: string | null;
  assignedSecId: string | null;
  stageUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
  customer: ApplicationCustomer;
}

/** Workspace row from `GET /applications/assigned` — summary plus a document count. */
export interface AssignedApplication extends VisaApplicationSummary {
  _count: { documents: number };
}

/** Full customer projection (password omitted) embedded in the detail response. */
export interface CustomerProfile {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  phone?: string | null;
  residenceCity?: string | null;
  targetCountry?: string | null;
  appointmentCity?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Staff profile with its owning user, embedded in the detail response. */
export interface StaffProfile {
  id: string;
  userId: string;
  department: Department;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
  user: CustomerProfile;
}

/** A document attached to an application (scalar fields from Prisma `Document`). */
export interface DocumentRecord {
  id: string;
  applicationId: string;
  uploadedById: string;
  fileType: FileType;
  docAssistantType: DocAssistantDocumentType | null;
  fileUrl: string;
  isApproved: boolean;
  rejectionReason: string | null;
  ocrStatus: OcrStatus | null;
  createdAt: string;
  updatedAt: string;
}

/** An immutable audit-trail entry from the detail response. */
export interface AuditLogEntry {
  id: string;
  applicationId: string;
  performedById: string;
  actionType: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

/** Backend-calculated DOC checklist used for explicit missing/pending warnings. */
export interface DocChecklistState {
  requiredTypes: FileType[];
  optionalTypes: FileType[];
  missingTypes: FileType[];
  pendingApprovalTypes: FileType[];
  prepaidLocked: boolean;
}

/** One card row persisted for the DOC assistant dashboard. */
export interface DocAssistantItem {
  id: string;
  applicationId: string;
  type: DocAssistantDocumentType;
  constraintLabel: DocAssistantConstraintLabel;
  status: DocAssistantDocumentStatus;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Snapshot of one file card delivered to the customer portal package. */
export interface DeliveredCustomerFile {
  cardType: DocAssistantDocumentType;
  title: string;
  documentId: string;
  fileType: FileType;
  fileUrl: string;
  deliveredAt: string;
}

/** Full application detail returned by `GET /applications/:id` (`APPLICATION_DETAIL_INCLUDE`). */
export interface VisaApplicationDetail {
  id: string;
  currentStage: VisaStage;
  applicationType: ApplicationType;
  customerId: string;
  assignedSalesId: string | null;
  assignedDocId: string | null;
  assignedSecId: string | null;
  stageUpdatedAt: string;
  isDeliveredToCustomer: boolean;
  deliveredToCustomerAt: string | null;
  deliveredToCustomerFiles: DeliveredCustomerFile[] | null;
  createdAt: string;
  updatedAt: string;
  metadata: ApplicationMetadata | null;
  customer: CustomerProfile;
  assignedSales: StaffProfile | null;
  assignedDoc: StaffProfile | null;
  assignedSec: StaffProfile | null;
  documents: DocumentRecord[];
  docAssistantItems: DocAssistantItem[];
  details: ApplicationDetailsData | null;
  applicationFormSubmitted: boolean;
  salesReadonlyData?: SalesReadonlyData | null;
  docChecklist: DocChecklistState;
  crmData: CrmData | null;
  auditLogs: AuditLogEntry[];
}

/** Presigned download URL response from `GET /documents/:id/download`. */
export interface DownloadUrlResponse {
  url: string;
  expiresIn: number;
}

/** Result of a mutating server action — drives inline error UI on the client. */
export interface ActionResult {
  ok: boolean;
  error?: string;
}

/** Sales CRM + finance record, persisted in `ApplicationCrmData`. */
export interface CrmData {
  salesDate: string;
  appointmentCity: string | null;
  appointmentDate: string | null;
  appointmentNote?: string | null;
  paymentType: "NORMAL" | "PREPAID";
  totalAmount: number;
  upfrontPaid: number | null;
  dijizinKvkkVerified: boolean;
  appointmentExpense?: number | null;
  hasVisaFee?: boolean;
  visaFeeAmount?: number | null;
  visaFeeReceiptDocumentId?: string | null;
  receiptFileId: string | null;
  updatedById?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** One active/inactive form definition from Dijizin's system catalog. */
export interface DijizinSystemForm {
  formId: string;
  name: string;
  isActive: boolean;
}

/** One form instance already sent to the current customer in Dijizin. */
export interface DijizinCustomerForm {
  formId: string;
  name: string;
  status: string | null;
  sentAt: string | null;
  answeredAt: string | null;
}

/** Snapshot payload for the Sales-side Dijizin panel. */
export interface DijizinFormsSnapshot {
  kvkkVerified: boolean;
  availableForms: DijizinSystemForm[];
  customerForms: DijizinCustomerForm[];
  message?: string;
}

/** Free-form application metadata (the legacy `metadata` JSON column). */
export interface ApplicationMetadata {
  [key: string]: unknown;
}

/**
 * The customer's comprehensive application form ("Başvuru Formu").
 * Mirrors the backend `VisaApplicationDetails` model (all fields required).
 */
export interface ApplicationDetailsData {
  firstName: string;
  lastName: string;
  maidenSurname?: string;
  nationalId: string;
  dateOfBirth: string;
  placeOfBirth: string;
  nationality: string;
  gender: string;
  maritalStatus: string;

  email: string;
  phone: string;
  residenceCity: string;
  registeredAddress: string;

  occupation: string;
  employmentStatus: string;
  isEmployer: boolean;
  employerName?: string;
  employerAddress?: string;
  employerPhone?: string;
  educationInstitution?: string;
  educationLevel?: string;

  passportType: string;
  passportNumber: string;
  passportIssueDate: string;
  passportExpiryDate: string;
  passportIssuePlace: string;
  appointmentLocation: string;

  fingerprintGiven: string;
  fingerprintDate?: string;
  schengenAppliedBefore: string;
  previousSchengenCountries?: string;

  purposeOfTravel: string;
  travelStartDate?: string;
  travelEndDate?: string;
  plannedTravelStartDate: string;
  plannedTravelEndDate: string;

  hasSponsor: boolean;
  sponsorFullName?: string;
  sponsorIdentity?: string;
  sponsorContact?: string;
  sponsorRelation?: string;

  submittedAt?: string;
  updatedAt?: string;
}

/** Sales-safe context values exposed even when full form details are redacted. */
export interface SalesReadonlyData {
  residenceCity: string | null;
  travelStartDate: string | null;
  travelEndDate: string | null;
  plannedTravelStartDate: string | null;
  plannedTravelEndDate: string | null;
}

/** Result state for the CRM form's server action (drives inline form feedback). */
export interface CrmActionState {
  ok?: boolean;
  error?: string;
}

/** A staff member the admin can reassign an application to (from `GET /users`). */
export interface StaffOption {
  staffId: string;
  fullName: string;
  department: Department;
}

/** A single stage's application count (admin analytics). */
export interface StageCount {
  stage: VisaStage;
  count: number;
}

/** Per-staff productivity metrics (admin analytics). */
export interface StaffPerformance {
  staffId: string;
  userId: string;
  fullName: string;
  department: Department;
  claimed: number;
  processed: number;
}

/** Payload from `GET /admin/stats`. */
export interface AdminStats {
  totalApplications: number;
  salesPipeline: StageCount[];
  salesProductivity: StaffPerformance[];
  docPipeline: StageCount[];
  docProductivity: StaffPerformance[];
  avgProcessingMs: number;
  completedCount: number;
}

/** Row for global calendar agenda (admin/doc). */
export interface AppointmentCalendarRow {
  applicationId: string;
  applicationType: ApplicationType;
  appointmentDate: string;
  appointmentCity: string;
  customerName: string;
  docStaffName: string | null;
}

/** Active sibling applications under the same customer account (DOC/admin batch ops). */
export interface LinkedActiveApplication {
  applicationId: string;
  currentStage: VisaStage;
  applicationType: ApplicationType;
  targetCountry: string;
  appointmentCity: string | null;
  appointmentDate: string | null;
}

export type DeliveryStatus = "TESLIM_EDILDI" | "BEKLIYOR" | "EKSIK";

/** Minimal assigned-staff projection embedded in the admin global table. */
export interface AssignedStaffLite {
  id: string;
  user: { fullName: string };
}

/** Row shape from `GET /applications/all` for the admin global table. */
export interface AdminApplicationRow extends AssignedApplication {
  assignedSales: AssignedStaffLite | null;
  assignedDoc: AssignedStaffLite | null;
  assignedSec: AssignedStaffLite | null;
}

/** One SLA tracking row in the admin compliance panel. */
export interface AdminComplianceRow {
  applicationId: string;
  customerName: string;
  currentStage: VisaStage;
  salesToDocAt: string;
  docClaimAt: string | null;
  waitMs: number;
  status: "CLAIMED" | "WAITING";
  docClaimedBy: string | null;
  docAssignee: string | null;
  isSlaBreached: boolean;
}

/** Payload from `GET /admin/compliance`. */
export interface AdminComplianceData {
  slaHours: number;
  totalTransferred: number;
  claimedCount: number;
  waitingCount: number;
  breachedCount: number;
  avgClaimWaitMs: number;
  maxOpenWaitMs: number;
  rows: AdminComplianceRow[];
}

/** Flat row payload from `GET /admin/master-table` for the admin Excel-like grid. */
export interface AdminMasterTableRow {
  applicationId: string;
  createdAt: string;
  applicationType: ApplicationType;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  totalAmount: number;
  upfrontPaid: number | null;
  paymentType: "NORMAL" | "PREPAID" | null;
  appointmentDate: string | null;
  appointmentNote: string | null;
  deliveryStatus: DeliveryStatus;
  salesStaff: string | null;
  docStaff: string | null;
}

/** A finance metric block for one period. */
export interface FinanceMetric {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
}

/** Pending prepaid balance row for admin finance table. */
export interface PendingPaymentRow {
  applicationId: string;
  customerName: string;
  customerEmail: string;
  currentStage: VisaStage;
  salesDate: string | null;
  totalAmount: number;
  upfrontPaid: number;
  remainingAmount: number;
  appointmentExpense: number | null;
  hasFinalReceipt: boolean;
}

/** Full finance row for every non-cancelled application. */
export interface FinanceTransactionRow {
  applicationId: string;
  customerName: string;
  customerEmail: string;
  currentStage: VisaStage;
  salesDate: string | null;
  totalAmount: number;
  appointmentExpense: number;
  netProfit: number;
}

/** Payload from `GET /admin/finance`. */
export interface AdminFinanceData {
  generatedAt: string;
  metrics: {
    daily: FinanceMetric;
    weekly: FinanceMetric;
    monthly: FinanceMetric;
    yearly: FinanceMetric;
  };
  pendingPayments: PendingPaymentRow[];
  allTransactions: FinanceTransactionRow[];
}

/** Roles creatable from the admin "Kullanıcılar" panel. */
export type AdminCreatableRole = Exclude<Role, "ADMIN">;

/** User row returned by `GET /admin/users`. */
export interface AdminUserRecord {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  staffProfile: {
    id: string;
    department: Department;
    isAvailable: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
}

/** Payload for `POST /admin/users`. */
export interface AdminCreateUserPayload {
  email: string;
  password: string;
  fullName: string;
  role: AdminCreatableRole;
}

/** Outcome of requesting a presigned document upload; the client then PUTs the file. */
export type DocumentUploadResult =
  | { ok: true; uploadUrl: string; documentId: string }
  | { ok: false; error: string };
