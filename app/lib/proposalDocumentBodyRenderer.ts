/**
 * FieldDive Proposal Document Body Renderer (R14).
 *
 * Display-time token merge for persisted body_markdown using frozen context + R13 resolver.
 * No I/O, stores, JobRecord, pricing engine, or live reads.
 */

import type { ProposalDocumentContext } from "@/app/lib/proposalDocumentTokenTypes";
import {
  isAvailableProposalDocumentToken,
} from "@/app/lib/proposalDocumentTokenRegistry";
import {
  resolveProposalDocumentToken,
} from "@/app/lib/proposalDocumentTokenResolver";

/** Matches `{{token_name}}` placeholders — same contract as R13 resolver. */
const TOKEN_SUBSTITUTION_PATTERN = /\{\{([a-z][a-z0-9_]*)\}\}/g;

const PRICING_MONEY_TOKENS = new Set(["proposal_total", "selected_package_total"]);

export type RenderProposalDocumentPageBodyOptions = {
  /** When false, money tokens resolve to empty string — no fabricated totals. */
  pricingComplete?: boolean;
};

export type ProposalDocumentPageBodyDiagnostics = {
  /** Distinct registry token placeholders found in raw body. */
  tokensFound: string[];
  /** Registry-unavailable or unknown token names removed from output. */
  unknownTokensRemoved: string[];
  /** Count of money-token placeholders suppressed due to incomplete pricing. */
  moneyTokensSuppressed: number;
  /** True when output still contains `{{` (malformed/unmatched placeholders). */
  hasMalformedPlaceholders: boolean;
};

export type RenderProposalDocumentPageBodyResult = {
  displayText: string;
  diagnostics: ProposalDocumentPageBodyDiagnostics;
};

function collectUniqueTokenNames(rawBody: string): string[] {
  const found = new Set<string>();
  const pattern = new RegExp(TOKEN_SUBSTITUTION_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(rawBody)) !== null) {
    found.add(match[1]!);
  }
  return [...found];
}

function substituteBodyTokens(
  rawBody: string,
  context: ProposalDocumentContext,
  pricingComplete: boolean
): { displayText: string; unknownTokensRemoved: string[]; moneyTokensSuppressed: number } {
  const unknownTokensRemoved: string[] = [];
  let moneyTokensSuppressed = 0;

  const displayText = rawBody.replace(
    TOKEN_SUBSTITUTION_PATTERN,
    (_match, rawName: string) => {
      if (!isAvailableProposalDocumentToken(rawName)) {
        unknownTokensRemoved.push(rawName);
        return "";
      }

      if (!pricingComplete && PRICING_MONEY_TOKENS.has(rawName)) {
        moneyTokensSuppressed += 1;
        return "";
      }

      return resolveProposalDocumentToken(rawName, context).value;
    }
  );

  return { displayText, unknownTokensRemoved, moneyTokensSuppressed };
}

/**
 * Render persisted body markdown for customer-facing display.
 * Does not mutate `rawBodyMarkdown`.
 */
export function renderProposalDocumentPageBody(
  rawBodyMarkdown: string | null | undefined,
  context: ProposalDocumentContext,
  options?: RenderProposalDocumentPageBodyOptions
): RenderProposalDocumentPageBodyResult {
  const rawBody = rawBodyMarkdown ?? "";
  const pricingComplete = options?.pricingComplete ?? false;
  const tokensFound = collectUniqueTokenNames(rawBody);

  if (rawBody.length === 0) {
    return {
      displayText: "",
      diagnostics: {
        tokensFound: [],
        unknownTokensRemoved: [],
        moneyTokensSuppressed: 0,
        hasMalformedPlaceholders: false,
      },
    };
  }

  const { displayText, unknownTokensRemoved, moneyTokensSuppressed } = substituteBodyTokens(
    rawBody,
    context,
    pricingComplete
  );

  return {
    displayText,
    diagnostics: {
      tokensFound,
      unknownTokensRemoved,
      moneyTokensSuppressed,
      hasMalformedPlaceholders: displayText.includes("{{"),
    },
  };
}

/** Builder-only muted notice when token merge suppressed or removed placeholders. */
export function proposalDocumentBodyContractorNotice(
  diagnostics: ProposalDocumentPageBodyDiagnostics
): string | null {
  const parts: string[] = [];

  if (diagnostics.moneyTokensSuppressed > 0) {
    parts.push("Pricing totals are hidden until pricing is complete.");
  }

  if (diagnostics.unknownTokensRemoved.length > 0) {
    parts.push("Unsupported document placeholders were omitted from this preview.");
  }

  if (diagnostics.hasMalformedPlaceholders) {
    parts.push("Some placeholders use invalid syntax and were not merged.");
  }

  if (parts.length === 0) return null;
  return parts.join(" ");
}
