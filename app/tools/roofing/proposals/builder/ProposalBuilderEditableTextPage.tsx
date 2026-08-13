"use client";

import { useEffect, useRef } from "react";
import type { ProposalPageType } from "@/app/lib/proposalPageTypes";
import type { ProposalDocumentContext } from "@/app/lib/proposalDocumentTokenTypes";
import type { ProposalPageVisibilityState } from "@/app/lib/proposalPageVisibilityEditing";
import {
  proposalDocumentBodyContractorNotice,
  renderProposalDocumentPageBody,
} from "@/app/lib/proposalDocumentBodyRenderer";
import ProposalBuilderCustomerPage from "./ProposalBuilderCustomerPage";
import ProposalBuilderPageEditor from "./ProposalBuilderPageEditor";
import ProposalBuilderPageVisibilityControl from "./ProposalBuilderPageVisibilityControl";
import { BUILDER_CANVAS } from "./proposalBuilderConstants";

type ProposalBuilderEditableTextPageProps = {
  pageType: ProposalPageType;
  title: string;
  rawBodyMarkdown: string | null;
  emptyStateText: string;
  proposalDocumentContext?: ProposalDocumentContext | null;
  pricingComplete?: boolean;
  isEditing: boolean;
  editDraftBody: string;
  onEditDraftBodyChange: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  saveDisabled?: boolean;
  saveInFlight?: boolean;
  saveError?: string | null;
  canEdit?: boolean;
  pageVisibility?: ProposalPageVisibilityState | null;
  onToggleVisibility?: () => void;
  visibilityToggleInFlight?: boolean;
};

export default function ProposalBuilderEditableTextPage({
  pageType,
  title,
  rawBodyMarkdown,
  emptyStateText,
  proposalDocumentContext = null,
  pricingComplete = false,
  isEditing,
  editDraftBody,
  onEditDraftBodyChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  saveDisabled = false,
  saveInFlight = false,
  saveError = null,
  canEdit = true,
  pageVisibility = null,
  onToggleVisibility,
  visibilityToggleInFlight = false,
}: ProposalBuilderEditableTextPageProps) {
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const wasEditingRef = useRef(isEditing);

  useEffect(() => {
    if (wasEditingRef.current && !isEditing) {
      editButtonRef.current?.focus();
    }
    wasEditingRef.current = isEditing;
  }, [isEditing]);

  let displayBody = rawBodyMarkdown;
  let contractorNotice: string | null = null;

  if (!isEditing && proposalDocumentContext && rawBodyMarkdown) {
    const rendered = renderProposalDocumentPageBody(rawBodyMarkdown, proposalDocumentContext, {
      pricingComplete,
    });
    displayBody = rendered.displayText;
    contractorNotice = proposalDocumentBodyContractorNotice(rendered.diagnostics);
  }

  const showVisibilityControl =
    pageVisibility != null &&
    (pageVisibility.canToggle || pageVisibility.requiredNotice != null);
  const hiddenFromCustomer = pageVisibility?.visibleToCustomer === false;

  return (
    <article
      className={BUILDER_CANVAS}
      data-builder-document-page
      data-builder-page-editing={isEditing ? "true" : "false"}
      data-builder-page-hidden={hiddenFromCustomer ? "true" : undefined}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 py-4 sm:px-8">
        <div className="min-w-0">
          <h2 className="text-[1.35rem] font-semibold leading-tight tracking-tight text-slate-950">
            {title}
          </h2>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {showVisibilityControl ? (
            <ProposalBuilderPageVisibilityControl
              pageTitle={title}
              visibleToCustomer={pageVisibility!.visibleToCustomer}
              canToggle={pageVisibility!.canToggle}
              requiredNotice={pageVisibility!.requiredNotice}
              onToggle={onToggleVisibility}
              toggleInFlight={visibilityToggleInFlight}
            />
          ) : null}
          {canEdit && !isEditing ? (
            <button
              ref={editButtonRef}
              type="button"
              onClick={onStartEdit}
              className="inline-flex min-h-[44px] items-center justify-center rounded-md px-3 text-[13px] font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:min-h-0 sm:h-9"
              data-builder-page-edit-trigger
            >
              Edit
            </button>
          ) : null}
        </div>
      </header>

      {isEditing ? (
        <ProposalBuilderPageEditor
          pageTitle={title}
          draftBody={editDraftBody}
          onDraftBodyChange={onEditDraftBodyChange}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
          saveDisabled={saveDisabled}
          saveInFlight={saveInFlight}
          saveError={saveError}
          proposalDocumentContext={proposalDocumentContext}
          pricingComplete={pricingComplete}
        />
      ) : (
        <ProposalBuilderCustomerPage
          pageType={pageType}
          title={title}
          bodyMarkdown={displayBody}
          emptyStateText={emptyStateText}
          contractorNotice={contractorNotice}
        />
      )}
    </article>
  );
}
