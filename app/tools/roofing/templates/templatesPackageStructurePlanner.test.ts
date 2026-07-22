/**
 * Run: npx tsx --test app/tools/roofing/templates/templatesPackageStructurePlanner.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type {
  ProposalTemplateItem,
  ProposalTemplateOption,
  ProposalTemplateSection,
} from "@/app/lib/proposalTemplateTypes";
import {
  BLANK_PACKAGE_SHELL_SECTIONS,
  buildCopiedPackageSummary,
  countIncludedAndUpgradeItems,
  nextPackageSortOrder,
  normalizePackageStructureDraft,
  planPackageRemove,
  planPackageReorder,
  sanitizeCopiedOptionMetadata,
} from "./templatesPackageStructurePlanner";

function option(
  partial: Partial<ProposalTemplateOption> & { id: string; name: string }
): ProposalTemplateOption {
  return {
    template_id: "t1",
    company_id: "c1",
    customer_label: partial.name,
    description: null,
    selection_mode: "single",
    is_default: false,
    visible_to_customer: true,
    sort_order: 10,
    metadata: {},
    created_at: null,
    updated_at: null,
    ...partial,
  } as ProposalTemplateOption;
}

describe("templatesPackageStructurePlanner", () => {
  test("normalizePackageStructureDraft requires name and defaults customer label", () => {
    const bad = normalizePackageStructureDraft({
      name: "  ",
      customerLabel: "",
      description: "",
      isDefault: false,
    });
    assert.equal(bad.ok, false);

    const good = normalizePackageStructureDraft({
      name: "Best Plus",
      customerLabel: "",
      description: " Extra premium ",
      isDefault: true,
    });
    assert.equal(good.ok, true);
    assert.equal(good.name, "Best Plus");
    assert.equal(good.customerLabel, "Best Plus");
    assert.equal(good.description, "Extra premium");
    assert.equal(good.isDefault, true);
  });

  test("nextPackageSortOrder appends after max", () => {
    assert.equal(nextPackageSortOrder([{ sort_order: 10 }, { sort_order: 30 }]), 40);
    assert.equal(nextPackageSortOrder([]), 10);
  });

  test("planPackageReorder moves up and down", () => {
    const options = [
      option({ id: "a", name: "Good", sort_order: 10 }),
      option({ id: "b", name: "Better", sort_order: 20 }),
      option({ id: "c", name: "Best", sort_order: 30 }),
    ];
    const up = planPackageReorder(options, "c", "up");
    assert.equal(up.ok, true);
    if (up.ok) assert.deepEqual(up.orderedIds, ["a", "c", "b"]);

    const down = planPackageReorder(options, "a", "down");
    assert.equal(down.ok, true);
    if (down.ok) assert.deepEqual(down.orderedIds, ["b", "a", "c"]);

    const edge = planPackageReorder(options, "a", "up");
    assert.equal(edge.ok, false);
  });

  test("planPackageRemove blocks last package and reassigns default", () => {
    const alone = [option({ id: "a", name: "Only", is_default: true })];
    assert.equal(
      planPackageRemove({ options: alone, removeOptionId: "a" }).ok,
      false
    );

    const options = [
      option({ id: "a", name: "Good", sort_order: 10, is_default: true }),
      option({ id: "b", name: "Better", sort_order: 20 }),
      option({ id: "c", name: "Best", sort_order: 30 }),
    ];
    const removeDefault = planPackageRemove({
      options,
      removeOptionId: "a",
      replacementDefaultOptionId: "c",
    });
    assert.equal(removeDefault.ok, true);
    if (removeDefault.ok) {
      assert.equal(removeDefault.nextDefaultOptionId, "c");
      assert.deepEqual(removeDefault.remainingOptionIds, ["b", "c"]);
    }

    const removeNonDefault = planPackageRemove({
      options,
      removeOptionId: "b",
    });
    assert.equal(removeNonDefault.ok, true);
    if (removeNonDefault.ok) {
      assert.equal(removeNonDefault.nextDefaultOptionId, "a");
    }
  });

  test("countIncludedAndUpgradeItems keeps upgrades separate", () => {
    const sections = [
      { id: "s-line", option_id: "o1", kind: "line_items" },
      { id: "s-up", option_id: "o1", kind: "upgrade_group" },
    ] as ProposalTemplateSection[];
    const items = [
      { id: "i1", section_id: "s-line", option_id: "o1" },
      { id: "i2", section_id: "s-line", option_id: "o1" },
      { id: "i3", section_id: "s-up", option_id: "o1" },
    ] as ProposalTemplateItem[];
    const counts = countIncludedAndUpgradeItems({
      optionId: "o1",
      sections,
      items,
    });
    assert.equal(counts.includedCount, 2);
    assert.equal(counts.availableUpgradeCount, 1);
  });

  test("sanitizeCopiedOptionMetadata strips seed_key", () => {
    assert.deepEqual(
      sanitizeCopiedOptionMetadata({ seed_key: "pkg_better", tier: "better" }),
      { tier: "better" }
    );
  });

  test("blank shell sections include line_items and upgrade_group with no items implied", () => {
    const kinds = BLANK_PACKAGE_SHELL_SECTIONS.map((row) => row.kind);
    assert.ok(kinds.includes("line_items"));
    assert.ok(kinds.includes("upgrade_group"));
    assert.ok(kinds.includes("text"));
  });

  test("buildCopiedPackageSummary is calm and guided", () => {
    const summary = buildCopiedPackageSummary({
      sourceLabel: "Better",
      includedCount: 4,
      availableUpgradeCount: 2,
    });
    assert.equal(summary.title, "Copied from Better");
    assert.match(summary.detail, /Included work and available upgrades will be copied/i);
    assert.doesNotMatch(summary.detail, /clone|cascade|database/i);
  });
});
