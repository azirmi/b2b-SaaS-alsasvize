"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/api.server";
import type { ActionResult, CrmActionState } from "@/lib/types";

/** Guards the path param before it is interpolated into the API URL. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Shared runner for application mutations. Validates the id, runs the request on
 * the server (auth rides the forwarded HTTP-only cookie via `serverApi` — the
 * browser `api` client would send nothing here), maps `ApiError` to an inline
 * message, and revalidates the `/dashboard` subtree so lists and the detail view
 * re-render without a reload. Other staff clients update via the socket events
 * the backend emits post-commit.
 */
async function runApplicationMutation(
  id: string,
  request: (applicationId: string) => Promise<unknown>,
  fallback: string,
): Promise<ActionResult> {
  if (!UUID_RE.test(id)) {
    return { ok: false, error: "Invalid application reference." };
  }

  try {
    await request(id);
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: fallback };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

/** Claims a pooled application for the current staff member (pool -> process). */
export async function claimApplication(id: string): Promise<ActionResult> {
  return runApplicationMutation(
    id,
    (applicationId) => serverApi.post(`/applications/${applicationId}/claim`),
    "Unable to claim the application. Please retry.",
  );
}

/** Advances an application from its current *_PROCESS stage to the next stage. */
export async function advanceStage(id: string): Promise<ActionResult> {
  return runApplicationMutation(
    id,
    (applicationId) => serverApi.patch(`/applications/${applicationId}/stage`),
    "Unable to advance the application. Please retry.",
  );
}

/** Pauses an in-flight application (stops the SLA clock). */
export async function pauseApplication(id: string): Promise<ActionResult> {
  return runApplicationMutation(
    id,
    (applicationId) => serverApi.patch(`/applications/${applicationId}/pause`),
    "Unable to pause the application. Please retry.",
  );
}

/** Resumes a paused application back to its pre-pause stage. */
export async function resumeApplication(id: string): Promise<ActionResult> {
  return runApplicationMutation(
    id,
    (applicationId) => serverApi.patch(`/applications/${applicationId}/resume`),
    "Unable to resume the application. Please retry.",
  );
}

/**
 * Saves the Sales CRM data entry (`PATCH /applications/:id`). Every field is
 * required: a successful save is what unlocks advancing out of SALES_PROCESS.
 * Bound to the application id, so it plugs straight into `useActionState`.
 */
export async function saveCrm(
  id: string,
  _prev: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  if (!UUID_RE.test(id)) {
    return { error: "Invalid application reference." };
  }

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const passportId = String(formData.get("passportId") ?? "").trim();
  const targetCountry = String(formData.get("targetCountry") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  const totalCost = Number(String(formData.get("totalCost") ?? "").trim());

  if (!firstName || !lastName || !passportId || !targetCountry || !currency) {
    return { error: "All fields are required." };
  }
  if (!Number.isFinite(totalCost) || totalCost <= 0) {
    return { error: "Total cost must be a positive amount." };
  }

  try {
    await serverApi.patch(`/applications/${id}`, {
      firstName,
      lastName,
      passportId,
      targetCountry,
      totalCost,
      currency,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message };
    }
    return { error: "Unable to save the CRM data. Please retry." };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
