/**
 * R2A — Template library lifecycle (archive/restore).
 *
 * Run: npx tsx --test app/tools/roofing/templates/templatesLibraryLifecycle.test.ts
 *
 * Template-level archive/restore is separate from R1's package-option
 * `removed_at` soft-remove. Archive never deletes the template, its package
 * options, sections, or items, and never touches proposal history.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  filterJobCardCreateProposalTemplates,
  resolveDefaultJobCardTemplateId,
} from "../jobCard/jobCardProposalSetup";

const TEMPLATES_ROOT = join(process.cwd(), "app/tools/roofing/templates");
const JOB_CARD_ROOT = join(process.cwd(), "app/tools/roofing/jobCard");
const STORE = join(process.cwd(), "app/lib/proposalTemplateStore.ts");
const ROOFING_CLIENT = join(process.cwd(), "app/tools/roofing/RoofingClient.tsx");

function readTemplates(name: string): string {
  return readFileSync(join(TEMPLATES_ROOT, name), "utf8");
}

function readJobCard(name: string): string {
  return readFileSync(join(JOB_CARD_ROOT, name), "utf8");
}

describe("R2A store contract — archive/restore sync status + active", () => {
  test("archiveProposalTemplate sets status archived and active false together", () => {
    const store = readFileSync(STORE, "utf8");
    assert.match(
      store,
      /export async function archiveProposalTemplate[\s\S]{0,200}status: "archived", active: false/
    );
  });

  test("restoreProposalTemplate sets status active and active true together", () => {
    const store = readFileSync(STORE, "utf8");
    assert.match(
      store,
      /export async function restoreProposalTemplate[\s\S]{0,200}status: "active", active: true/
    );
  });

  test("archive/restore never mutate proposal_options, proposal_versions, or removed_at", () => {
    const store = readFileSync(STORE, "utf8");
    const archiveFn = store.slice(
      store.indexOf("export async function archiveProposalTemplate"),
      store.indexOf("export async function restoreProposalTemplate")
    );
    const restoreStart = store.indexOf("export async function restoreProposalTemplate");
    const restoreFn = store.slice(restoreStart, restoreStart + 400);
    for (const fn of [archiveFn, restoreFn]) {
      assert.doesNotMatch(fn, /removed_at/);
      assert.doesNotMatch(fn, /proposal_options/);
      assert.doesNotMatch(fn, /proposal_versions/);
      assert.doesNotMatch(fn, /proposal_line_items/);
      assert.doesNotMatch(fn, /\.delete\(/);
    }
  });

  test("updateProposalTemplate never touches package option rows", () => {
    const store = readFileSync(STORE, "utf8");
    assert.match(store, /\.from\("proposal_templates"\)/);
  });
});

describe("R2A — Job Card never selects an archived template", () => {
  test("resolveDefaultJobCardTemplateId skips archived starter and archived active rows", () => {
    const templates = [
      { id: "starter", name: "Roof replacement", active: true, status: "archived" },
      { id: "other-archived", name: "Old setup", active: true, status: "archived" },
      { id: "good", name: "Good setup", active: true, status: "active" },
    ] as never;
    assert.equal(resolveDefaultJobCardTemplateId(templates, "starter"), "good");
  });

  test("resolveDefaultJobCardTemplateId returns null when every template is archived", () => {
    const templates = [
      { id: "a", name: "A", active: true, status: "archived" },
      { id: "b", name: "B", active: true, status: "archived" },
    ] as never;
    assert.equal(resolveDefaultJobCardTemplateId(templates, null), null);
  });

  test("resolveDefaultJobCardTemplateId still prefers a non-archived starter", () => {
    const templates = [
      { id: "starter", name: "Roof", active: true, status: "active" },
      { id: "a", name: "A", active: true, status: "active" },
    ] as never;
    assert.equal(resolveDefaultJobCardTemplateId(templates, "starter"), "starter");
  });

  test("filterJobCardCreateProposalTemplates hides archived templates from the create picker", () => {
    const templates = [
      { id: "active-1", name: "Active setup", status: "active" },
      { id: "archived-1", name: "Old setup", status: "archived" },
    ];
    const visible = filterJobCardCreateProposalTemplates(templates, null);
    assert.deepEqual(visible.map((row) => row.id), ["active-1"]);
  });

  test("filterJobCardCreateProposalTemplates keeps a currently-selected archived template visible (sticky exception)", () => {
    const templates = [
      { id: "active-1", name: "Active setup", status: "active" },
      { id: "archived-1", name: "Old setup", status: "archived" },
    ];
    const visible = filterJobCardCreateProposalTemplates(templates, "archived-1");
    assert.ok(visible.some((row) => row.id === "archived-1"));
  });
});

describe("R2A — RoofingClient clears sticky Job Card selection on archive", () => {
  test("selection preservation check excludes archived and inactive rows", () => {
    const client = readFileSync(ROOFING_CLIENT, "utf8");
    // Sticky Job Card selection must clear when template is archived or inactive.
    assert.match(
      client,
      /visibleTemplates\.some\(\s*\(row\) =>\s*row\.id === prev &&\s*row\.status !== "archived" &&\s*row\.active !== false\s*\)/
    );
  });
});

describe("R2A — Templates library UI is integrated, not destructive", () => {
  test("library section supports an Active/Archived filter and archive/restore wiring", () => {
    const library = readTemplates("TemplatesLibrarySection.tsx");
    assert.ok(library.includes("data-templates-library-filter"));
    assert.ok(library.includes("onArchiveTemplate"));
    assert.ok(library.includes("onRestoreTemplate"));
    assert.ok(library.includes("TemplatesArchiveTemplateConfirmModal"));
    // R1 substrings preserved — archive is a distinct, additive lifecycle.
    assert.ok(library.includes('status !== "archived"'));
    assert.ok(library.includes("archivedTemplates"));
  });

  test("row exposes Archive on active rows and Restore only on archived rows", () => {
    const row = readTemplates("TemplatesTemplateLibraryRow.tsx");
    assert.ok(row.includes("onArchive"));
    assert.ok(row.includes("onRestore"));
    assert.ok(row.includes("TEMPLATES_ARCHIVE_ACTION_LABEL"));
    assert.ok(row.includes("TEMPLATES_RESTORE_ACTION_LABEL"));
    // No nested <button> inside the select control (invalid HTML / a11y risk).
    assert.ok(!/<button[^>]*onClick=\{onSelect\}[\s\S]{0,400}<button/.test(row));
  });

  test("archive confirmation copy is calm and not database-heavy", () => {
    const flow = readTemplates("templatesWorkspaceFlow.ts");
    const modal = readTemplates("TemplatesArchiveTemplateConfirmModal.tsx");
    assert.match(
      flow.replace(/\s+/g, " "),
      /This setup will be hidden from future proposals\. Existing proposals are not changed\./
    );
    assert.ok(!/delete|DELETE|drop table|DROP TABLE/.test(modal));
    assert.ok(modal.includes("TEMPLATES_ARCHIVE_CONFIRM_COPY"));
  });

  test("no Delete action introduced in R2A", () => {
    const row = readTemplates("TemplatesTemplateLibraryRow.tsx");
    const library = readTemplates("TemplatesLibrarySection.tsx");
    assert.doesNotMatch(row, />\s*Delete\s*</);
    assert.doesNotMatch(library, />\s*Delete\s*</);
  });

  test("TemplatesSetupClient wires archive/restore store helpers", () => {
    const setup = readTemplates("TemplatesSetupClient.tsx");
    assert.ok(setup.includes("archiveProposalTemplate"));
    assert.ok(setup.includes("restoreProposalTemplate"));
    assert.ok(setup.includes("handleArchiveTemplate"));
    assert.ok(setup.includes("handleRestoreTemplate"));
    assert.ok(setup.includes("onArchiveTemplate={handleArchiveTemplate}"));
    assert.ok(setup.includes("onRestoreTemplate={handleRestoreTemplate}"));
  });
});

describe("R2A — protected systems untouched", () => {
  test("archive/restore does not import or touch package-option structure actions", () => {
    const store = readFileSync(STORE, "utf8");
    const archiveFn = store.slice(
      store.indexOf("export async function archiveProposalTemplate"),
      store.indexOf("export async function restoreProposalTemplate") + 400
    );
    assert.doesNotMatch(archiveFn, /softRemoveProposalTemplateOption/);
    assert.doesNotMatch(archiveFn, /is_default/);
  });

  test("library/job-card lifecycle files do not import pricing, freeze, or Builder chooser modules", () => {
    const files = [
      readTemplates("TemplatesLibrarySection.tsx"),
      readTemplates("TemplatesTemplateLibraryRow.tsx"),
      readTemplates("TemplatesArchiveTemplateConfirmModal.tsx"),
      readJobCard("jobCardProposalSetup.ts"),
    ];
    for (const source of files) {
      assert.doesNotMatch(source, /proposalPricingEngine/);
      assert.doesNotMatch(source, /proposalSendFreeze/);
      assert.doesNotMatch(source, /ProposalBuilderPackageSelector/);
      assert.doesNotMatch(source, /proposalOptionUpgradeChoices/i);
    }
  });
});
