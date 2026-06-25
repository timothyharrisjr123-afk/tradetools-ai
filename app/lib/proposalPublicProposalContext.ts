/**
 * R18C4A — Pure public proposal context from frozen public DTO slices.
 *
 * Builds document token context and branding blocks from allowlisted context_echo only.
 * No DB, React, stores, or draft graph reads.
 */

import {
  readProposalCompanyContextFromEcho,
  readProposalCustomerContextFromEcho,
} from "@/app/lib/proposalDraftGraphAdapter";
import type { ProposalDocumentContext } from "@/app/lib/proposalDocumentTokenTypes";
import type {
  ProposalPublicGraphDto,
  ProposalPublicGraphOptionDto,
} from "@/app/lib/proposalPublicGraphDto";

function trimOrNull(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return v ? v : null;
}

function readContextEchoString(
  contextEcho: Record<string, unknown> | null | undefined,
  key: string
): string | null {
  if (!contextEcho || typeof contextEcho !== "object") return null;
  const value = contextEcho[key];
  return typeof value === "string" ? trimOrNull(value) : null;
}

function resolveSelectedOption(
  dto: ProposalPublicGraphDto
): ProposalPublicGraphOptionDto | null {
  const options = [...dto.options].sort((a, b) => a.sort_order - b.sort_order);
  const selectedId = (dto.selected_template_option_id ?? "").trim();
  if (selectedId) {
    const selected = options.find((o) => o.source_template_option_id === selectedId);
    if (selected) return selected;
  }
  return options.find((o) => o.visible_to_customer) ?? options[0] ?? null;
}

function resolvePackageName(option: ProposalPublicGraphOptionDto | null): string | null {
  if (!option) return null;
  return trimOrNull(option.customer_label) ?? trimOrNull(option.name);
}

export function monogramFromCompanyName(name: string | null): string | null {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  const first = parts[0][0] ?? "";
  const last = parts[parts.length - 1][0] ?? "";
  const monogram = (first + last).toUpperCase();
  return monogram.length > 0 ? monogram : null;
}

export function proposalPublicAddressesMatch(
  mailingAddress: string | null,
  siteAddress: string | null
): boolean {
  const mailing = (mailingAddress ?? "").trim();
  const site = (siteAddress ?? "").trim();
  if (!mailing || !site) return false;
  return mailing.toLowerCase() === site.toLowerCase();
}

/**
 * Frozen document context for R14 body merge on public proposal pages.
 */
export function buildProposalDocumentContextFromPublicDto(
  dto: ProposalPublicGraphDto
): ProposalDocumentContext {
  const contextEcho = dto.context_echo;
  const selectedOption = resolveSelectedOption(dto);

  return {
    company: readProposalCompanyContextFromEcho(contextEcho),
    customer: readProposalCustomerContextFromEcho(contextEcho),
    jobName: readContextEchoString(contextEcho, "job_name"),
    jobAddress: readContextEchoString(contextEcho, "address_formatted"),
    measurementSummary: readContextEchoString(contextEcho, "measurement_quantities_display"),
    proposalNumber: readContextEchoString(contextEcho, "proposal_number"),
    proposalTitle: readContextEchoString(contextEcho, "template_name"),
    templateName: readContextEchoString(contextEcho, "template_name"),
    proposalCreatedDateIso: dto.frozen_at,
    selectedPackage: {
      runtimeOptionId: selectedOption?.source_template_option_id ?? null,
      packageName: resolvePackageName(selectedOption),
      customerTotalCents: selectedOption?.customer_total_cents ?? null,
    },
  };
}

export function resolveSelectedPublicOption(dto: ProposalPublicGraphDto): ProposalPublicGraphOptionDto | null {
  return resolveSelectedOption(dto);
}

export function isPublicProposalPricingComplete(dto: ProposalPublicGraphDto): boolean {
  const selected = resolveSelectedOption(dto);
  return selected?.customer_total_cents != null;
}
