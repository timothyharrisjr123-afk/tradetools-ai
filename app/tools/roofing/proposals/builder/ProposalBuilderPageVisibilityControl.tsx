"use client";

import { Eye, EyeOff } from "lucide-react";
import {
  BUILDER_PAGE_VISIBILITY_CONTROL,
  BUILDER_PAGE_VISIBILITY_CONTROL_ACTIVE,
  BUILDER_PAGE_VISIBILITY_CONTROL_HIDDEN,
  BUILDER_PAGE_VISIBILITY_CONTROL_IDLE,
  BUILDER_PAGE_VISIBILITY_REQUIRED_NOTICE,
} from "./proposalBuilderConstants";

type ProposalBuilderPageVisibilityControlProps = {
  pageTitle: string;
  visibleToCustomer: boolean;
  canToggle: boolean;
  requiredNotice?: string | null;
  onToggle?: () => void;
  toggleInFlight?: boolean;
};

export default function ProposalBuilderPageVisibilityControl({
  pageTitle,
  visibleToCustomer,
  canToggle,
  requiredNotice = null,
  onToggle,
  toggleInFlight = false,
}: ProposalBuilderPageVisibilityControlProps) {
  if (requiredNotice) {
    return (
      <span
        className={BUILDER_PAGE_VISIBILITY_REQUIRED_NOTICE}
        title={requiredNotice}
      >
        {requiredNotice}
      </span>
    );
  }

  if (!canToggle) {
    return null;
  }

  const label = visibleToCustomer ? "Visible to customer" : "Hidden from customer";
  const Icon = visibleToCustomer ? Eye : EyeOff;

  return (
    <button
      type="button"
      aria-pressed={visibleToCustomer}
      aria-label={`${visibleToCustomer ? "Hide" : "Show"} customer visibility for ${pageTitle}`}
      title={label}
      disabled={toggleInFlight}
      onClick={onToggle}
      className={`${BUILDER_PAGE_VISIBILITY_CONTROL} ${
        visibleToCustomer
          ? BUILDER_PAGE_VISIBILITY_CONTROL_IDLE
          : BUILDER_PAGE_VISIBILITY_CONTROL_HIDDEN
      } ${toggleInFlight ? BUILDER_PAGE_VISIBILITY_CONTROL_ACTIVE : ""}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
