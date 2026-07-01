import type { Role, VisaStage } from "./enums";

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
