/**
 * Customer-facing project identity for proposal documents.
 * Matches Preview cover project label: proposal title (strip trailing "proposal"),
 * never derive project from property/address.
 */

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

function looksLikePropertyAddress(
  value: string,
  propertyAddress: string | null | undefined
): boolean {
  const candidate = value.trim().toLowerCase();
  const property = (propertyAddress ?? "").trim().toLowerCase();
  if (!candidate || !property) return false;
  if (candidate === property) return true;
  // job_name often stores the street line of address_formatted
  if (property.startsWith(candidate + ",") || property.startsWith(candidate + " ")) {
    return true;
  }
  return false;
}

/**
 * Canonical customer project label for Preview / Public / PDF parity.
 * Prefer proposal title; never use property/address as project.
 * Does not invent a default label (e.g. no hard-coded "Roof replacement").
 */
export function resolveCustomerProposalProjectLabel(input: {
  proposalTitle?: string | null;
  headline?: string | null;
  jobName?: string | null;
  propertyAddress?: string | null;
}): string | null {
  const fromTitle = trimOrNull(input.proposalTitle);
  if (fromTitle) {
    const stripped = fromTitle.replace(/\s+proposal$/i, "").trim();
    if (stripped && !/^proposal$/i.test(stripped)) {
      if (!looksLikePropertyAddress(stripped, input.propertyAddress)) {
        return stripped;
      }
    }
  }

  const fromHeadline = trimOrNull(input.headline);
  if (fromHeadline && !/^proposal$/i.test(fromHeadline)) {
    const stripped = fromHeadline.replace(/\s+proposal$/i, "").trim();
    if (stripped && !/^proposal$/i.test(stripped)) {
      if (!looksLikePropertyAddress(stripped, input.propertyAddress)) {
        return stripped;
      }
    }
  }

  const jobName = trimOrNull(input.jobName);
  if (jobName && !looksLikePropertyAddress(jobName, input.propertyAddress)) {
    return jobName;
  }

  return null;
}
