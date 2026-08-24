/**
 * Route-level contractor capability auth.
 *
 * Membership is derived from the authenticated session, never from a
 * client-supplied company ID. Wrong-company / missing resources collapse to
 * not_found so existence is not leaked.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";

export type ContractorSessionOk = {
  ok: true;
  userId: string;
  companyId: string;
};

export type ContractorSessionDenied = {
  ok: false;
  status: 401 | 403;
  code: "unauthorized" | "forbidden";
};

export type ContractorSessionResult = ContractorSessionOk | ContractorSessionDenied;

export type ContractorOwnedResourceDenied = {
  ok: false;
  status: 404;
  code: "not_found";
};

export function mapContractorSession(input: {
  userId: string | null | undefined;
  companyId: string | null | undefined;
}): ContractorSessionResult {
  const userId = typeof input.userId === "string" ? input.userId.trim() : "";
  if (!userId) {
    return { ok: false, status: 401, code: "unauthorized" };
  }
  const companyId =
    typeof input.companyId === "string" ? input.companyId.trim() : "";
  if (!companyId) {
    return { ok: false, status: 403, code: "forbidden" };
  }
  return { ok: true, userId, companyId };
}

export function mapContractorOwnedJob(input: {
  sessionCompanyId: string;
  resourceCompanyId: string | null | undefined;
}): { ok: true } | ContractorOwnedResourceDenied {
  const session = String(input.sessionCompanyId ?? "").trim();
  const resource =
    typeof input.resourceCompanyId === "string"
      ? input.resourceCompanyId.trim()
      : "";
  if (!session || !resource || resource !== session) {
    return { ok: false, status: 404, code: "not_found" };
  }
  return { ok: true };
}

export async function resolveContractorCompanySession(
  supabase: SupabaseClient
): Promise<ContractorSessionResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return mapContractorSession({ userId: null, companyId: null });
  }
  const companyId = await getUserCompanyId(supabase, user.id);
  return mapContractorSession({ userId: user.id, companyId });
}

export async function resolveOwnedJobCompany(
  supabase: SupabaseClient,
  sessionCompanyId: string,
  jobId: string
): Promise<{ ok: true } | ContractorOwnedResourceDenied> {
  const { data, error } = await supabase
    .from("jobs")
    .select("company_id")
    .eq("id", jobId)
    .maybeSingle();
  if (error) {
    return { ok: false, status: 404, code: "not_found" };
  }
  return mapContractorOwnedJob({
    sessionCompanyId,
    resourceCompanyId: data?.company_id ?? null,
  });
}

export function contractorDeniedJson(
  denied: ContractorSessionDenied,
  shape: "success" | "error"
): { body: Record<string, unknown>; status: number } {
  const message =
    denied.code === "unauthorized" ? "Unauthorized." : "Forbidden.";
  if (shape === "success") {
    return {
      status: denied.status,
      body: { success: false, error: message, code: denied.code },
    };
  }
  return {
    status: denied.status,
    body: { error: message, code: denied.code },
  };
}

export function contractorNotFoundJson(shape: "success" | "error"): {
  body: Record<string, unknown>;
  status: 404;
} {
  if (shape === "success") {
    return {
      status: 404,
      body: { success: false, error: "Not found.", code: "not_found" },
    };
  }
  return {
    status: 404,
    body: { error: "Not found.", code: "not_found" },
  };
}
