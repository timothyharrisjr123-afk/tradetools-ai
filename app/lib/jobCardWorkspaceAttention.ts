/**
 * Live Job Card Attention contract for Slice 1.
 * Keep real interventions; drop setup nags and redundant acceptance banners.
 */

import type { JobAttentionSafeItem } from "@/app/lib/jobAttentionReadModel";

export function isPaymentsNotConnectedAttention(
  item: Pick<JobAttentionSafeItem, "attentionType">
): boolean {
  return item.attentionType === "payments_not_connected";
}

export function isOverviewOwnedApproveAttention(
  item: JobAttentionSafeItem
): boolean {
  return (
    item.attentionType === "acceptance_confirmation_required" &&
    item.acceptance?.attentionAction === "approve_job"
  );
}

export function filterJobCardWorkspaceAttentionItems(
  items: readonly JobAttentionSafeItem[],
  input: { overviewOwnsApprove: boolean }
): JobAttentionSafeItem[] {
  return items.filter((item) => {
    if (isPaymentsNotConnectedAttention(item)) return false;
    if (input.overviewOwnsApprove && isOverviewOwnedApproveAttention(item)) {
      return false;
    }
    return true;
  });
}

export function attentionRoutesToPayments(
  item: Pick<JobAttentionSafeItem, "attentionType">
): boolean {
  return item.attentionType === "payment_failed";
}

export function attentionRoutesToProposals(
  item: Pick<JobAttentionSafeItem, "attentionType">
): boolean {
  return (
    item.attentionType === "customer_question" ||
    item.attentionType === "customer_package_request" ||
    item.attentionType === "acceptance_confirmation_required"
  );
}
