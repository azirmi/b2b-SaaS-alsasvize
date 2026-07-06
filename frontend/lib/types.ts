import type { Department, FileType, OcrStatus, Role, VisaStage } from "./enums";

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

/** Full application detail returned by `GET /applications/:id` (`APPLICATION_DETAIL_INCLUDE`). */
export interface VisaApplicationDetail {
  id: string;
  currentStage: VisaStage;
  customerId: string;
  assignedSalesId: string | null;
  assignedDocId: string | null;
  assignedSecId: string | null;
  stageUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
  metadata: ApplicationMetadata | null;
  customer: CustomerProfile;
  assignedSales: StaffProfile | null;
  assignedDoc: StaffProfile | null;
  assignedSec: StaffProfile | null;
  documents: DocumentRecord[];
  details: ApplicationDetailsData | null;
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

/** Sales CRM data entry, persisted under `VisaApplication.metadata.crm`. */
export interface CrmData {
  firstName: string;
  lastName: string;
  passportId: string;
  targetCountry: string;
  totalCost: number;
  currency: string;
  updatedBy?: string;
  updatedAt?: string;
}

/** Free-form application metadata (the `metadata` JSON column). */
export interface ApplicationMetadata {
  crm?: CrmData;
  [key: string]: unknown;
}

/**
 * The customer's comprehensive application form ("Başvuru Formu").
 * Mirrors the backend `VisaApplicationDetails` model (all fields required).
 */
export interface ApplicationDetailsData {
  fullName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  nationality: string;
  gender: string;
  maritalStatus: string;
  nationalId: string;
  passportNumber: string;
  passportIssueDate: string;
  passportExpiryDate: string;
  phone: string;
  email: string;
  homeAddress: string;
  city: string;
  countryOfResidence: string;
  targetCountry: string;
  visaType: string;
  purposeOfTravel: string;
  intendedArrivalDate: string;
  intendedDepartureDate: string;
  durationOfStayDays: number;
  occupation: string;
  employerName: string;
  monthlyIncome: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  submittedAt?: string;
  updatedAt?: string;
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
  byStage: StageCount[];
  staffPerformance: StaffPerformance[];
  avgProcessingMs: number;
  completedCount: number;
}

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

/** Outcome of requesting a presigned document upload; the client then PUTs the file. */
export type DocumentUploadResult =
  | { ok: true; uploadUrl: string; documentId: string }
  | { ok: false; error: string };
