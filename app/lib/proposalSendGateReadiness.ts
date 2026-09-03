/**
 * R18D1 — Pure Send gate readiness for Contractor Preview.
 *
 * Models send checklist + email draft preview only.
 * No DB, React, freeze RPC, mint, email delivery, or lifecycle mutation.
 */

import type { ProposalSendFreezeReadiness } from "@/app/lib/proposalSendFreezeReadiness";
import { hasPublicProposalSentSnapshot } from "@/app/lib/proposalPublicReviewReadiness";
import type { ProposalRecord } from "@/app/lib/proposalRecordTypes";
import type { JobRecord } from "@/app/lib/jobTypes";
import type { ProposalDraftGraph } from "@/app/lib/proposalRecordStore";
import type { ProposalCustomerPreviewReadiness } from "@/app/lib/proposalCustomerPreviewViewModel";
import {
  SEND_GATE_CONNECT_PAYMENTS_HREF,
  SEND_GATE_PAYMENTS_SETUP_BODY,
  SEND_GATE_PAYMENTS_SETUP_LABEL,
  type ProposalPaymentTerms,
} from "@/app/lib/proposalPaymentTerms";
import { resolveOnlineDepositSendReadiness } from "@/app/lib/proposalPaymentSendReadiness";

export const SEND_GATE_PANEL_TITLE = "Send proposal";
export const SEND_GATE_SEND_PROPOSAL_LABEL = "Send proposal";
export const SEND_GATE_SEND_REVISION_LABEL = "Send revision";

export function resolveSendGateSheetTitle(isRevisionSend: boolean): string {
  return isRevisionSend ? SEND_GATE_SEND_REVISION_LABEL : SEND_GATE_SEND_PROPOSAL_LABEL;
}

export const SEND_GATE_PANEL_INTRO = "Review before sending to your customer.";

export const SEND_GATE_DELIVERY_DISABLED_MESSAGE = "Email delivery is not configured yet.";

export const SEND_GATE_EMAIL_SEND_DISCLAIMER =
  "Sends the proposal link by email. Does not change proposal or job status yet.";

export const SEND_GATE_SEND_PROPOSAL_BY_EMAIL_LABEL = "Send proposal by email";
export const SEND_GATE_SENDING_PROPOSAL_EMAIL_MESSAGE = "Sending proposal email…";
export const SEND_GATE_EMAIL_PROVIDER_ACCEPTED_TITLE = "Proposal emailed";
export const SEND_GATE_EMAIL_PROVIDER_ACCEPTED_BODY_PREFIX = "Submitted to";

export const SEND_GATE_LOADING_MESSAGE = "Checking send readiness…";

export const SEND_GATE_NO_SENT_SNAPSHOT_BODY =
  "Customer view needs a sent proposal snapshot before a customer link can be sent.";

export const SEND_GATE_MISSING_RECIPIENT_BODY =
  "Add a customer email before this proposal can be sent.";

export const SEND_GATE_CUSTOMER_LINK_PLACEHOLDER = "Available after send";

export const SEND_GATE_EMAIL_LINK_NOTE =
  "A secure proposal link is added automatically when the email is sent.";
export const SEND_GATE_CUSTOMER_LINK_READY_LABEL = "Customer link ready";

export const SEND_GATE_PREPARE_CUSTOMER_LINK_LABEL = "Create secure link";
export const SEND_GATE_PREPARING_CUSTOMER_LINK_MESSAGE = "Creating secure link…";
export const SEND_GATE_CUSTOMER_LINK_READY_TITLE = "Secure link ready";
export const SEND_GATE_CUSTOMER_LINK_READY_BODY =
  "Create a private link when you are ready to preview or share this proposal.";
export const SEND_GATE_CUSTOMER_LINK_HELPER =
  "Create a private link when you are ready to preview or share this proposal.";
export const SEND_GATE_SNAPSHOT_PREPARED_LABEL = "Snapshot prepared";

export const SEND_GATE_DEFERRED_SIGNATURE = "Signature — coming later";
export const SEND_GATE_DEFERRED_PDF = "PDF — coming later";

export const SEND_GATE_DEFERRED_ACTIONS = [
  { id: "signature", label: SEND_GATE_DEFERRED_SIGNATURE },
  { id: "pdf", label: SEND_GATE_DEFERRED_PDF },
] as const;

export type SendGateChecklistItemId =
  | "customer_view"
  | "sent_snapshot"
  | "pricing_scope"
  | "recipient_email"
  | "branding_identity"
  | "payments";

export type SendGateChecklistStatus =
  | "loading"
  | "ready"
  | "needs_review"
  | "missing"
  | "needs_sent_snapshot";

export type SendGateChecklistItem = {
  id: SendGateChecklistItemId;
  label: string;
  status: SendGateChecklistStatus;
  detail: string;
};

export type SendGateMessagePreview = {
  to: string;
  toMissing: boolean;
  subject: string;
  body: string;
  linkLabel: string;
};

export type SendGateReadinessPhase = "loading" | "no_sent_snapshot" | "ready";

export type ProposalSendGateReadinessViewModel = {
  phase: SendGateReadinessPhase;
  heading: string;
  summary: string;
  body: string | null;
  deliveryEnabled: boolean;
  canSend: boolean;
  canPrepareCustomerLink: boolean;
  disabledReason: string;
  emailSendDisclaimer: string;
  checklist: SendGateChecklistItem[];
  messagePreview: SendGateMessagePreview;
  deferredActions: readonly { id: string; label: string }[];
  paymentsSetupRequired: boolean;
  paymentsSetupHref: string | null;
};

export type BuildProposalSendGateReadinessInput = {
  loading?: boolean;
  hasSentSnapshot: boolean;
  sendFreezeReadiness: ProposalSendFreezeReadiness | null;
  previewReadiness: Pick<
    ProposalCustomerPreviewReadiness,
    "blockingLineCount" | "pricingComplete" | "warnings"
  > | null;
  recipientEmail: string | null;
  customerFirstName: string | null;
  companyName: string | null;
  projectAddress: string | null;
  pricingStale?: boolean;
  emailDeliveryConfigured?: boolean;
  paymentTerms?: ProposalPaymentTerms | null;
  chargesEnabled?: boolean;
};

function readContextEchoString(
  echo: ProposalDraftGraph["version"]["context_echo"],
  key: string
): string | null {
  if (echo == null || typeof echo !== "object" || Array.isArray(echo)) return null;
  const value = (echo as Record<string, unknown>)[key];
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveSendGateRecipientEmail(input: {
  graph: ProposalDraftGraph | null;
  job: JobRecord | null;
}): string | null {
  const fromEcho = input.graph
    ? readContextEchoString(input.graph.version.context_echo, "customer_email")
    : null;
  if (fromEcho) return fromEcho;

  const fromJobContact = (input.job?.contact?.customer_email ?? "").trim();
  if (fromJobContact) return fromJobContact;

  return null;
}

export function resolveSendGateCustomerFirstName(customerName: string | null): string | null {
  const trimmed = (customerName ?? "").trim();
  if (!trimmed) return null;
  const first = trimmed.split(/\s+/)[0]?.trim();
  return first && first.length > 0 ? first : null;
}

export function resolveSendGateCompanyName(
  graph: ProposalDraftGraph | null
): string | null {
  if (!graph) return null;
  return readContextEchoString(graph.version.context_echo, "company_name");
}

export function resolveSendGateProjectAddress(
  graph: ProposalDraftGraph | null
): string | null {
  if (!graph) return null;
  return (
    readContextEchoString(graph.version.context_echo, "address_formatted") ??
    readContextEchoString(graph.version.context_echo, "customer_address")
  );
}

export function resolveSendGateCustomerName(
  graph: ProposalDraftGraph | null,
  job: JobRecord | null
): string | null {
  const fromEcho = graph
    ? readContextEchoString(graph.version.context_echo, "customer_name")
    : null;
  if (fromEcho) return fromEcho;
  const fromJob = (job?.contact?.customer_name ?? "").trim();
  return fromJob.length > 0 ? fromJob : null;
}

export function hasProposalSendSnapshot(proposal: Pick<
  ProposalRecord,
  "signed_version_id" | "latest_sent_version_id"
> | null): boolean {
  if (!proposal) return false;
  return hasPublicProposalSentSnapshot(proposal);
}

export function isSendPrepReadinessBlocking(input: {
  sendFreezeReadiness: ProposalSendFreezeReadiness | null;
  previewReadiness: Pick<
    ProposalCustomerPreviewReadiness,
    "blockingLineCount" | "pricingComplete"
  > | null;
  recipientEmail: string | null;
  paymentTerms?: ProposalPaymentTerms | null;
  chargesEnabled?: boolean;
}): boolean {
  if (!input.recipientEmail) {
    return true;
  }
  if (!input.sendFreezeReadiness?.ready) {
    return true;
  }
  if ((input.previewReadiness?.blockingLineCount ?? 0) > 0) {
    return true;
  }
  if (input.previewReadiness?.pricingComplete === false) {
    return true;
  }
  if (
    resolveOnlineDepositSendReadiness({
      terms: input.paymentTerms ?? null,
      chargesEnabled: input.chargesEnabled === true,
    }).blocked
  ) {
    return true;
  }
  return false;
}

export function canPrepareCustomerSendLink(input: {
  loading: boolean;
  prepPending?: boolean;
  sendFreezeReadiness: ProposalSendFreezeReadiness | null;
  previewReadiness: Pick<
    ProposalCustomerPreviewReadiness,
    "blockingLineCount" | "pricingComplete"
  > | null;
  recipientEmail: string | null;
  paymentTerms?: ProposalPaymentTerms | null;
  chargesEnabled?: boolean;
}): boolean {
  if (input.loading || input.prepPending) {
    return false;
  }
  return !isSendPrepReadinessBlocking(input);
}

export function resolveSendGateDeliveryEnabled(emailDeliveryConfigured?: boolean): boolean {
  return emailDeliveryConfigured === true;
}

export function resolveSendGateCanSend(input: {
  loading?: boolean;
  sendFreezeReadiness: ProposalSendFreezeReadiness | null;
  previewReadiness: Pick<
    ProposalCustomerPreviewReadiness,
    "blockingLineCount" | "pricingComplete"
  > | null;
  recipientEmail: string | null;
  emailDeliveryConfigured?: boolean;
  paymentTerms?: ProposalPaymentTerms | null;
  chargesEnabled?: boolean;
}): boolean {
  if (input.loading) {
    return false;
  }
  if (!resolveSendGateDeliveryEnabled(input.emailDeliveryConfigured)) {
    return false;
  }
  return !isSendPrepReadinessBlocking(input);
}

function resolveSendGateDisabledReason(input: {
  deliveryEnabled: boolean;
  canSend: boolean;
  recipientEmail: string | null;
  sendFreezeReadiness: ProposalSendFreezeReadiness | null;
  previewReadiness: Pick<
    ProposalCustomerPreviewReadiness,
    "blockingLineCount" | "pricingComplete"
  > | null;
  paymentTerms?: ProposalPaymentTerms | null;
  chargesEnabled?: boolean;
}): string {
  if (!input.deliveryEnabled) {
    return SEND_GATE_DELIVERY_DISABLED_MESSAGE;
  }
  if (!input.recipientEmail) {
    return SEND_GATE_MISSING_RECIPIENT_BODY;
  }
  if (!input.canSend) {
    const payments = resolveOnlineDepositSendReadiness({
      terms: input.paymentTerms ?? null,
      chargesEnabled: input.chargesEnabled === true,
    });
    if (payments.blocked) {
      return SEND_GATE_PAYMENTS_SETUP_BODY;
    }
    if (!input.sendFreezeReadiness?.ready) {
      return input.sendFreezeReadiness?.blockingReasons[0] ?? "Proposal readiness needs review.";
    }
    if ((input.previewReadiness?.blockingLineCount ?? 0) > 0) {
      return "Pricing or scope needs review before sending.";
    }
    if (input.previewReadiness?.pricingComplete === false) {
      return "Pricing or scope needs review before sending.";
    }
    return "Proposal readiness needs review before sending.";
  }
  return "";
}

function buildDefaultSubject(companyName: string | null): string {
  const company = (companyName ?? "").trim() || "your contractor";
  return `Your proposal from ${company}`;
}

export function buildDefaultProposalEmailBody(input: {
  customerFirstName: string | null;
  companyName: string | null;
  projectAddress: string | null;
}): string {
  const greetingName = (input.customerFirstName ?? "").trim() || "there";
  const company = (input.companyName ?? "").trim() || "Your contractor";

  return `Hi ${greetingName},

${company} has prepared your roofing proposal for your project.

Review the proposal details using the secure link below.`;
}

function buildDefaultBody(input: {
  customerFirstName: string | null;
  companyName: string | null;
  projectAddress: string | null;
}): string {
  return buildDefaultProposalEmailBody(input);
}

function checklistStatusLabel(status: SendGateChecklistStatus): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "needs_review":
      return "Needs review";
    case "missing":
      return "Missing";
    case "needs_sent_snapshot":
      return "Needs sent snapshot";
    case "loading":
      return "Checking…";
    default:
      return "Needs review";
  }
}

function buildCustomerViewChecklist(hasSentSnapshot: boolean): SendGateChecklistItem {
  return {
    id: "customer_view",
    label: "Customer view",
    status: "ready",
    detail: hasSentSnapshot
      ? checklistStatusLabel("ready")
      : "Created when sent",
  };
}

function buildSentSnapshotChecklist(hasSentSnapshot: boolean): SendGateChecklistItem {
  return {
    id: "sent_snapshot",
    label: "Sent snapshot",
    status: "ready",
    detail: hasSentSnapshot
      ? checklistStatusLabel("ready")
      : "Created when sent",
  };
}

function buildPricingScopeChecklist(input: {
  sendFreezeReadiness: ProposalSendFreezeReadiness | null;
  previewReadiness: Pick<
    ProposalCustomerPreviewReadiness,
    "blockingLineCount" | "pricingComplete" | "warnings"
  > | null;
  pricingStale?: boolean;
}): SendGateChecklistItem {
  const blockingLineCount = input.previewReadiness?.blockingLineCount ?? 0;
  const sendReady = input.sendFreezeReadiness?.ready === true;
  const pricingComplete = input.previewReadiness?.pricingComplete ?? false;

  if (!input.sendFreezeReadiness || !sendReady || blockingLineCount > 0 || !pricingComplete) {
    const reason =
      input.sendFreezeReadiness?.blockingReasons[0] ??
      (blockingLineCount > 0
        ? `${blockingLineCount} line item${blockingLineCount === 1 ? "" : "s"} need pricing attention.`
        : "Pricing or scope needs review.");
    return {
      id: "pricing_scope",
      label: "Pricing & scope",
      status: "needs_review",
      detail: reason,
    };
  }

  if (input.pricingStale) {
    return {
      id: "pricing_scope",
      label: "Pricing & scope",
      status: "needs_review",
      detail: "Draft pricing may be stale; refresh before sending.",
    };
  }

  return {
    id: "pricing_scope",
    label: "Pricing & scope",
    status: "ready",
    detail: checklistStatusLabel("ready"),
  };
}

function buildRecipientChecklist(recipientEmail: string | null): SendGateChecklistItem {
  if (!recipientEmail) {
    return {
      id: "recipient_email",
      label: "Recipient email",
      status: "missing",
      detail: checklistStatusLabel("missing"),
    };
  }
  return {
    id: "recipient_email",
    label: "Recipient email",
    status: "ready",
    detail: checklistStatusLabel("ready"),
  };
}

function buildBrandingChecklist(
  sendFreezeReadiness: ProposalSendFreezeReadiness | null
): SendGateChecklistItem {
  if (!sendFreezeReadiness) {
    return {
      id: "branding_identity",
      label: "Branding & identity",
      status: "needs_review",
      detail: checklistStatusLabel("needs_review"),
    };
  }

  const companyBlocking = sendFreezeReadiness.blockingReasons.some((reason) =>
    /company identity/i.test(reason)
  );
  if (companyBlocking) {
    return {
      id: "branding_identity",
      label: "Branding & identity",
      status: "needs_review",
      detail: "Company identity is missing.",
    };
  }

  return {
    id: "branding_identity",
    label: "Branding & identity",
    status: "ready",
    detail: checklistStatusLabel("ready"),
  };
}

function buildPaymentsChecklist(input: {
  paymentTerms?: ProposalPaymentTerms | null;
  chargesEnabled?: boolean;
}): SendGateChecklistItem {
  const payments = resolveOnlineDepositSendReadiness({
    terms: input.paymentTerms ?? null,
    chargesEnabled: input.chargesEnabled === true,
  });
  if (!payments.onlineDepositRequired) {
    return {
      id: "payments",
      label: "Payments",
      status: "ready",
      detail: "No online deposit",
    };
  }
  if (payments.blocked) {
    return {
      id: "payments",
      label: SEND_GATE_PAYMENTS_SETUP_LABEL,
      status: "missing",
      detail: SEND_GATE_PAYMENTS_SETUP_BODY,
    };
  }
  return {
    id: "payments",
    label: "Payments",
    status: "ready",
    detail: checklistStatusLabel("ready"),
  };
}

export function buildProposalSendGateReadinessViewModel(
  input: BuildProposalSendGateReadinessInput
): ProposalSendGateReadinessViewModel {
  const deferredActions = SEND_GATE_DEFERRED_ACTIONS;
  const payments = resolveOnlineDepositSendReadiness({
    terms: input.paymentTerms ?? null,
    chargesEnabled: input.chargesEnabled === true,
  });
  const paymentsSetupRequired = payments.blocked;
  const paymentsSetupHref = paymentsSetupRequired ? SEND_GATE_CONNECT_PAYMENTS_HREF : null;
  const deliveryEnabled = resolveSendGateDeliveryEnabled(input.emailDeliveryConfigured);
  const canSend = resolveSendGateCanSend({
    loading: input.loading,
    sendFreezeReadiness: input.sendFreezeReadiness,
    previewReadiness: input.previewReadiness,
    recipientEmail: input.recipientEmail,
    emailDeliveryConfigured: input.emailDeliveryConfigured,
    paymentTerms: input.paymentTerms,
    chargesEnabled: input.chargesEnabled,
  });
  const disabledReason = resolveSendGateDisabledReason({
    deliveryEnabled,
    canSend,
    recipientEmail: input.recipientEmail,
    sendFreezeReadiness: input.sendFreezeReadiness,
    previewReadiness: input.previewReadiness,
    paymentTerms: input.paymentTerms,
    chargesEnabled: input.chargesEnabled,
  });
  const emailSendDisclaimer = SEND_GATE_EMAIL_SEND_DISCLAIMER;

  const messagePreview: SendGateMessagePreview = {
    to: input.recipientEmail ?? "",
    toMissing: !input.recipientEmail,
    subject: buildDefaultSubject(input.companyName),
    body: buildDefaultBody({
      customerFirstName: input.customerFirstName,
      companyName: input.companyName,
      projectAddress: input.projectAddress,
    }),
    linkLabel: SEND_GATE_EMAIL_LINK_NOTE,
  };

  if (input.loading) {
    return {
      phase: "loading",
      heading: SEND_GATE_PANEL_TITLE,
      summary: SEND_GATE_LOADING_MESSAGE,
      body: null,
      deliveryEnabled: false,
      canSend: false,
      canPrepareCustomerLink: false,
      disabledReason,
      emailSendDisclaimer,
      checklist: [
        {
          id: "customer_view",
          label: "Customer view",
          status: "loading",
          detail: checklistStatusLabel("loading"),
        },
        {
          id: "sent_snapshot",
          label: "Sent snapshot",
          status: "loading",
          detail: checklistStatusLabel("loading"),
        },
        {
          id: "pricing_scope",
          label: "Pricing & scope",
          status: "loading",
          detail: checklistStatusLabel("loading"),
        },
        {
          id: "recipient_email",
          label: "Recipient email",
          status: "loading",
          detail: checklistStatusLabel("loading"),
        },
        {
          id: "branding_identity",
          label: "Branding & identity",
          status: "loading",
          detail: checklistStatusLabel("loading"),
        },
        {
          id: "payments",
          label: "Payments",
          status: "loading",
          detail: checklistStatusLabel("loading"),
        },
      ],
      messagePreview,
      deferredActions,
      paymentsSetupRequired: false,
      paymentsSetupHref: null,
    };
  }

  const checklist = [
    buildCustomerViewChecklist(input.hasSentSnapshot),
    buildSentSnapshotChecklist(input.hasSentSnapshot),
    buildPricingScopeChecklist(input),
    buildRecipientChecklist(input.recipientEmail),
    buildBrandingChecklist(input.sendFreezeReadiness),
    buildPaymentsChecklist(input),
  ];

  const canPrepareCustomerLink = canPrepareCustomerSendLink({
    loading: false,
    sendFreezeReadiness: input.sendFreezeReadiness,
    previewReadiness: input.previewReadiness,
    recipientEmail: input.recipientEmail,
    paymentTerms: input.paymentTerms,
    chargesEnabled: input.chargesEnabled,
  });

  const bodyParts: string[] = [];
  if (!input.recipientEmail) {
    bodyParts.push(SEND_GATE_MISSING_RECIPIENT_BODY);
  }
  if (paymentsSetupRequired) {
    bodyParts.push(SEND_GATE_PAYMENTS_SETUP_BODY);
  }

  return {
    phase: "ready",
    heading: SEND_GATE_PANEL_TITLE,
    summary: SEND_GATE_PANEL_INTRO,
    body: bodyParts.length > 0 ? bodyParts.join(" ") : null,
    deliveryEnabled,
    canSend,
    canPrepareCustomerLink,
    disabledReason,
    emailSendDisclaimer,
    checklist,
    messagePreview,
    deferredActions,
    paymentsSetupRequired,
    paymentsSetupHref,
  };
}
