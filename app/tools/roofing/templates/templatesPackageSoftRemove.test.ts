/**
 * Run: npx tsx --test app/tools/roofing/templates/templatesPackageSoftRemove.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  filterActiveTemplateGraph,
  filterActiveTemplateOptions,
  isActiveTemplateOption,
  planPackageRemove,
} from "./templatesPackageStructurePlanner";

const ROOT = join(process.cwd(), "app/tools/roofing/templates");
const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20260722_031_add_proposal_template_option_removed_at.sql"
);
const STORE = join(process.cwd(), "app/lib/proposalTemplateStore.ts");

function read(name: string): string {
  return readFileSync(join(ROOT, name), "utf8");
}

describe("R1 soft-remove schema contract", () => {
  test("migration adds removed_at without loosening sent immutability", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    const executable = sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    assert.match(sql, /add column if not exists removed_at timestamptz null/i);
    assert.match(sql, /idx_proposal_template_options_template_active_sort/);
    assert.match(sql, /where removed_at is null/i);
    assert.doesNotMatch(executable, /proposal_options_immutable_version_guard/);
    assert.doesNotMatch(executable, /drop trigger/i);
    assert.doesNotMatch(executable, /alter table public\.proposal_options/i);
    assert.doesNotMatch(executable, /proposal_versions/);
  });

  test("unique default index is preserved by clearing is_default on soft-remove", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    const store = readFileSync(STORE, "utf8");
    assert.match(
      sql,
      /idx_proposal_template_options_one_default_per_template|is_default/
    );
    assert.ok(store.includes("softRemoveProposalTemplateOption"));
    assert.ok(store.includes("is_default: false"));
    assert.ok(store.includes('removed_at: removedAt') || store.includes("removed_at:"));
    assert.ok(store.includes('.is("removed_at", null)'));
  });
});

describe("R1 soft-remove planner + actions", () => {
  test("isActiveTemplateOption treats null/empty as active", () => {
    assert.equal(isActiveTemplateOption({}), true);
    assert.equal(isActiveTemplateOption({ removed_at: null }), true);
    assert.equal(isActiveTemplateOption({ removed_at: "" }), true);
    assert.equal(isActiveTemplateOption({ removed_at: "2026-07-22T15:00:00.000Z" }), false);
  });

  test("filterActiveTemplateGraph drops removed options and their scope", () => {
    const filtered = filterActiveTemplateGraph({
      options: [
        { id: "good", removed_at: "2026-07-22T15:00:00.000Z" },
        { id: "better", removed_at: null },
      ],
      sections: [
        { option_id: "good" },
        { option_id: "better" },
      ],
      items: [
        { option_id: "good" },
        { option_id: "better" },
        { option_id: "better" },
      ],
    });
    assert.deepEqual(
      filtered.options.map((row) => row.id),
      ["better"]
    );
    assert.equal(filtered.sections.length, 1);
    assert.equal(filtered.items.length, 2);
  });

  test("planPackageRemove ignores already-removed options and blocks last active", () => {
    const options = [
      {
        id: "good",
        name: "Good",
        template_id: "t1",
        is_default: false,
        sort_order: 10,
        removed_at: "2026-07-22T15:00:00.000Z",
      },
      {
        id: "better",
        name: "Better",
        template_id: "t1",
        is_default: true,
        sort_order: 20,
        removed_at: null,
      },
    ] as const;

    assert.equal(
      planPackageRemove({
        options: options as never,
        removeOptionId: "better",
      }).ok,
      false
    );

    const three = [
      ...options,
      {
        id: "best",
        name: "Best",
        template_id: "t1",
        is_default: false,
        sort_order: 30,
        removed_at: null,
      },
    ];
    const plan = planPackageRemove({
      options: three as never,
      removeOptionId: "better",
      replacementDefaultOptionId: "best",
    });
    assert.equal(plan.ok, true);
    if (plan.ok) {
      assert.equal(plan.nextDefaultOptionId, "best");
      assert.deepEqual(plan.remainingOptionIds, ["best"]);
    }
  });

  test("actions soft-remove and never hard-delete template options", () => {
    const actions = read("templatesPackageStructureActions.ts");
    assert.ok(actions.includes("softRemoveProposalTemplateOption"));
    assert.ok(!actions.includes("deleteProposalTemplateOption("));
    assert.match(actions, /source_template_option_id stays|Soft-remove first/i);
  });

  test("UI confirm copy stays calm and selection surfaces stay filtered", () => {
    const editors = read("TemplatesSetupAuthorshipEditors.tsx");
    const setup = read("TemplatesSetupClient.tsx");
    const store = readFileSync(STORE, "utf8");
    assert.match(
      editors.replace(/\s+/g, " "),
      /Existing proposals are not changed/
    );
    assert.ok(setup.includes("removeTemplatePackage"));
    assert.ok(store.includes('includeRemoved'));
    assert.ok(filterActiveTemplateOptions([{ removed_at: null }, { removed_at: "x" }]).length === 1);
  });
});
