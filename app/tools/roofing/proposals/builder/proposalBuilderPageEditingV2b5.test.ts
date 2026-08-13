/**
 * V2B5 — customer-facing page editing as a document, not a CMS workspace.
 * Run: npx tsx --test app/tools/roofing/proposals/builder/proposalBuilderPageEditingV2b5.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import path from "node:path";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("V2B5 customer-facing page editing", () => {
  test("editable page types are the existing text pages only", () => {
    const editing = read("app/lib/proposalPageContentEditing.ts");
    assert.match(editing, /"project_overview"/);
    assert.match(editing, /"terms"/);
    assert.match(editing, /"warranty"/);
    assert.match(editing, /"custom_text"/);
    assert.doesNotMatch(editing, /EDITABLE_PROPOSAL_PAGE_TYPES = \[[^\]]*cover/);
    assert.doesNotMatch(editing, /EDITABLE_PROPOSAL_PAGE_TYPES = \[[^\]]*estimate/);
    assert.doesNotMatch(editing, /EDITABLE_PROPOSAL_PAGE_TYPES = \[[^\]]*photos/);
  });

  test("read mode is a document surface without CMS chrome or token toolbar", () => {
    const page = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderEditableTextPage.tsx"
    );
    const customer = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderCustomerPage.tsx"
    );
    assert.match(page, /data-builder-document-page/);
    assert.match(page, /data-builder-page-edit-trigger/);
    assert.doesNotMatch(page, /Proposal page workspace/i);
    assert.doesNotMatch(page, /Editing draft page content/);
    assert.doesNotMatch(page, /ProposalBuilderTokenPickerMenu/);
    assert.doesNotMatch(customer, /BUILDER_DOCUMENT_READ_ONLY_FOOTER/);
    assert.doesNotMatch(customer, /Select Edit above/);
    assert.doesNotMatch(customer, /FileText/);
    assert.doesNotMatch(customer, /formatProposalPageTypeLabel/);
  });

  test("Edit opens the existing inline editor; open writes nothing", () => {
    const page = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderEditableTextPage.tsx"
    );
    const client = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
    );
    assert.match(page, /isEditing \? \(/);
    assert.match(page, /ProposalBuilderPageEditor/);
    const start = client.slice(
      client.indexOf("const handleStartPageEdit"),
      client.indexOf("const handleCancelPageEdit")
    );
    assert.match(start, /setPageEditDraftBody\(rawBody \?\? ""\)/);
    assert.doesNotMatch(start, /updateDraftProposalPageContent/);
    assert.doesNotMatch(start, /await /);
  });

  test("Save persists once via existing draft page content action; Cancel writes nothing", () => {
    const client = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
    );
    const editor = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPageEditor.tsx"
    );
    const save = client.slice(
      client.indexOf("const handleSavePageEdit"),
      client.indexOf("const handleTogglePageVisibility")
    );
    assert.match(save, /if \(pageEditSaveInFlightRef\.current\) return/);
    assert.match(save, /updateDraftProposalPageContent/);
    assert.match(save, /setPersistedGraph\(updated\)/);
    assert.match(save, /setPageEditSaveError/);
    const cancel = client.slice(
      client.indexOf("const handleCancelPageEdit"),
      client.indexOf("const handleSavePageEdit")
    );
    assert.match(cancel, /clearPageEditSession/);
    assert.doesNotMatch(cancel, /updateDraftProposalPageContent/);
    assert.match(editor, /data-builder-page-save/);
    assert.match(editor, /data-builder-page-cancel/);
    assert.match(editor, /disabled=\{saveDisabled \|\| saveInFlight\}/);
  });

  test("Insert field is edit-only and uses existing token insertion", () => {
    const page = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderEditableTextPage.tsx"
    );
    const editor = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPageEditor.tsx"
    );
    assert.doesNotMatch(page, /ProposalBuilderTokenPickerMenu/);
    assert.match(editor, /ProposalBuilderTokenPickerMenu/);
    assert.match(editor, /assertInsertableDocumentToken/);
    assert.match(editor, /formatProposalDocumentTokenPlaceholder/);
    assert.match(editor, /insertTextAtCursor/);
    assert.doesNotMatch(editor, /BUILDER_PAGE_EDIT_HELPER_COPY/);
    assert.doesNotMatch(editor, /BUILDER_PAGE_EDIT_MERGE_PREVIEW_LABEL/);
    const picker = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderTokenPickerMenu.tsx"
    );
    assert.match(picker, /openUpward/);
    assert.match(picker, /maxHeight/);
    assert.match(picker, /assertInsertableDocumentToken|onInsertToken/);
  });

  test("visibility uses existing persist and stays a secondary control", () => {
    const page = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderEditableTextPage.tsx"
    );
    const client = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
    );
    const visibility = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPageVisibilityControl.tsx"
    );
    assert.match(page, /ProposalBuilderPageVisibilityControl/);
    assert.match(page, /data-builder-page-hidden=\{hiddenFromCustomer \? "true" : undefined\}/);
    assert.doesNotMatch(page, /role="status"/);
    assert.match(client, /updateDraftProposalPageVisibility/);
    assert.match(visibility, /aria-pressed=\{visibleToCustomer\}/);
    assert.match(visibility, /Visible to customer/);
    assert.match(visibility, /Hidden from customer/);
    assert.match(visibility, /<span>\{label\}<\/span>/);
  });

  test("system pages do not gain a fake Edit control", () => {
    const canvas = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderCanvas.tsx"
    );
    assert.match(canvas, /data-builder-readonly-page="cover"/);
    assert.match(canvas, /data-builder-readonly-page/);
    assert.doesNotMatch(canvas, /Proposal page workspace/i);
    const coverBlock = canvas.slice(
      canvas.indexOf("if (isCoverPageContext(activePageContextId)"),
      canvas.indexOf("const persistedPage")
    );
    assert.doesNotMatch(coverBlock, /onStartPageEdit/);
    assert.doesNotMatch(coverBlock, /data-builder-page-edit-trigger/);
    assert.doesNotMatch(coverBlock, />Edit</);
    const photosBlock = canvas.slice(
      canvas.indexOf("function CustomerPagePanel"),
      canvas.indexOf("export default function ProposalBuilderCanvas")
    );
    assert.doesNotMatch(photosBlock, /onStartEdit|data-builder-page-edit-trigger/);
  });

  test("desktop/mobile document editing stays keyboard reachable with 44px targets", () => {
    const page = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderEditableTextPage.tsx"
    );
    const editor = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderPageEditor.tsx"
    );
    assert.match(page, /min-h-\[44px\]/);
    assert.match(editor, /min-h-\[44px\]/);
    assert.match(editor, /event\.key !== "Escape"/);
    assert.match(editor, /resize-none/);
    assert.match(editor, /max-h-\[min\(18rem,calc\(100dvh-22rem\)\)\]/);
    assert.match(editor, /sticky bottom-0/);
    assert.match(editor, /el\.focus\(\)/);
    assert.match(editor, /aria-describedby/);
    assert.match(editor, /role="alert"/);
    assert.match(page, /editButtonRef\.current\?\.focus/);
  });

  test("V2B1–V2B4 surfaces and persist paths remain in place", () => {
    const estimate = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx"
    );
    const upgrades = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchUpgradesZone.tsx"
    );
    const packageZone = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchPackageZone.tsx"
    );
    const client = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx"
    );
    const actions = read(
      "app/tools/roofing/proposals/builder/ProposalBuilderDisabledActions.tsx"
    );
    assert.match(estimate, /data-builder-review-upgrades/);
    assert.match(estimate, /data-builder-review-quantities/);
    assert.match(upgrades, /data-builder-optional-upgrades/);
    assert.match(packageZone, /ProposalBuilderPackageSelector/);
    assert.match(actions, /BUILDER_CUSTOMER_REVIEW_LABEL/);
    assert.match(client, /updateDraftSelectedOption/);
    assert.match(client, /upsertUpgradeChoiceSelection/);
    assert.match(client, /applyManualQuantityScopeDecision/);
    assert.match(client, /updateDraftProposalPageContent/);
    assert.doesNotMatch(client, /proposalPricingEngine/);
  });
});
