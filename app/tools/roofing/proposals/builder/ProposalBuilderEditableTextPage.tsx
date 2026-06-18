"use client";

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
import {
  BUILDER_CANVAS,
  BUILDER_CANVAS_HERO_DIVIDER,
  BUILDER_PAGE_HIDDEN_BANNER,
} from "./proposalBuilderConstants";

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

  return (
    <article className={BUILDER_CANVAS}>
      <div className={`${BUILDER_CANVAS_HERO_DIVIDER} border-b border-slate-200/80 bg-slate-50/60`}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-7 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Proposal page workspace
          </p>
          <div className="flex flex-wrap items-center gap-2">
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
                type="button"
                onClick={onStartEdit}
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Edit
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {pageVisibility?.bannerText ? (
        <div className={BUILDER_PAGE_HIDDEN_BANNER} role="status">
          {pageVisibility.bannerText}
        </div>
      ) : null}

      {isEditing ? (
        <>
          <header className={BUILDER_CANVAS_HERO_DIVIDER}>
            <div className="space-y-1 px-7 pb-5 pt-5">
              <h2 className="text-xl font-semibold leading-tight tracking-tight text-slate-950">
                {title}
              </h2>
              <p className="text-[13px] text-slate-500">Editing draft page content</p>
            </div>
          </header>
          <ProposalBuilderPageEditor
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
        </>
      ) : (
        <ProposalBuilderCustomerPage
          pageType={pageType}
          title={title}
          bodyMarkdown={displayBody}
          emptyStateText={emptyStateText}
          contractorNotice={contractorNotice}
          showEditHint={canEdit}
        />
      )}
    </article>
  );
}
