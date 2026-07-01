import type { Department, VisaStage } from "./enums";

/**
 * Client-facing workflow event names. Mirrors the exported constants in
 * backend/src/events/events.gateway.ts — keep both sides in sync.
 */
export const WORKFLOW_EVENTS = {
  applicationClaimed: "applicationClaimed",
  stageChanged: "stageChanged",
  slaBreached: "slaBreached",
} as const;

/** Emitted when a staff member claims an application out of a pool. */
export interface ApplicationClaimedPayload {
  applicationId: string;
  previousStage: VisaStage;
  newStage: VisaStage;
  department: Department;
  claimedByUserId: string;
  assignedStaffId: string;
  at: string;
}

/** Emitted when an application advances from one stage to the next. */
export interface StageChangedPayload {
  applicationId: string;
  previousStage: VisaStage;
  newStage: VisaStage;
  performedByUserId: string;
  at: string;
}

/** Emitted when the SLA cron reverts a stalled application back to its pool. */
export interface SlaBreachedPayload {
  applicationId: string;
  previousStage: VisaStage;
  newStage: VisaStage;
  revertedStaffId: string;
  thresholdHours: number;
  at: string;
}

/** Maps each event name to its payload — the source of truth for `useSocket`. */
export interface WorkflowEventMap {
  applicationClaimed: ApplicationClaimedPayload;
  stageChanged: StageChangedPayload;
  slaBreached: SlaBreachedPayload;
}

export type WorkflowEventName = keyof WorkflowEventMap;
