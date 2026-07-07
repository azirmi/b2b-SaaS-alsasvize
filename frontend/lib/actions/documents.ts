"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/api.server";
import { FileType } from "@/lib/enums";
import type { ActionResult, DocumentUploadResult } from "@/lib/types";

/** Guards the path param before it is interpolated into the API URL. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Approves a customer-uploaded document (DOC staff / admin). Runs server-side so
 * auth rides the forwarded HTTP-only cookie. Revalidates the dashboard subtree so
 * the detail view reflects the approval and the stage-advance gate updates.
 */
export async function approveDocument(id: string): Promise<ActionResult> {
  if (!UUID_RE.test(id)) {
    return { ok: false, error: "Geçersiz evrak referansı." };
  }

  try {
    await serverApi.patch(`/documents/${id}/approve`);
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Evrak onaylanamadı. Lütfen tekrar deneyin." };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

/**
 * Rejects a customer-uploaded document with a reason (DOC staff / admin). The
 * reason is surfaced to the customer so they can upload a replacement.
 */
export async function rejectDocument(
  id: string,
  reason: string,
): Promise<ActionResult> {
  if (!UUID_RE.test(id)) {
    return { ok: false, error: "Geçersiz evrak referansı." };
  }
  const trimmed = reason.trim().slice(0, 500);
  if (!trimmed) {
    return { ok: false, error: "Reddetme nedeni zorunludur." };
  }

  try {
    await serverApi.patch(`/documents/${id}/reject`, { reason: trimmed });
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Evrak reddedilemedi. Lütfen tekrar deneyin." };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

/**
 * Deletes a document. The customer may delete only their own files (the API
 * enforces ownership); admins may delete any. Revalidates so the file drops from
 * the list; the backend also removes the stored object.
 */
export async function deleteDocument(id: string): Promise<ActionResult> {
  if (!UUID_RE.test(id)) {
    return { ok: false, error: "Geçersiz evrak referansı." };
  }

  try {
    await serverApi.del(`/documents/${id}`);
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Evrak silinemedi. Lütfen tekrar deneyin." };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

/**
 * Mints a presigned upload URL for a customer document. The backend creates the
 * `Document` record (unapproved, OCR queued for passports) and returns the URL;
 * the client then PUTs the raw bytes straight to storage. Runs server-side so
 * auth rides the forwarded HTTP-only cookie. No revalidation here — the caller
 * refreshes only after the file transfer succeeds.
 */
export async function requestDocumentUpload(
  applicationId: string,
  fileType: FileType,
  fileName: string,
): Promise<DocumentUploadResult> {
  if (!UUID_RE.test(applicationId)) {
    return { ok: false, error: "Geçersiz başvuru referansı." };
  }
  const cleanName = fileName.trim().slice(0, 255);
  if (!cleanName) {
    return { ok: false, error: "Dosya adı zorunludur." };
  }
  if (!Object.values(FileType).includes(fileType)) {
    return { ok: false, error: "Desteklenmeyen belge türü." };
  }

  try {
    const response = await serverApi.post<{
      document: { id: string };
      uploadUrl: string;
    }>("/documents/presigned-url", {
      applicationId,
      fileName: cleanName,
      fileType,
    });
    return {
      ok: true,
      uploadUrl: response.uploadUrl,
      documentId: response.document.id,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Yükleme başlatılamadı. Lütfen tekrar deneyin." };
  }
}
