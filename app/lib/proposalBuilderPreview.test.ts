/**
 * R16B — Estimate canvas section filter tests.
 *
 * Run: npx tsx --test app/lib/proposalBuilderPreview.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { filterSectionsForEstimateCanvas } from "./proposalBuilderPreview";
import type { ProposalTemplateSection } from "./proposalTemplateTypes";

function section(
  kind: ProposalTemplateSection["kind"],
  id: string
): ProposalTemplateSection {
  return {
    id,
    template_id: "tpl-1",
    option_id: "opt-1",
    kind,
    name: id,
    customer_title: null,
    sort_order: 0,
    customer_visibility: "customer_visible",
    content: kind === "text" ? { body_markdown: "Overview prose" } : null,
    metadata: null,
  };
}

describe("filterSectionsForEstimateCanvas", () => {
  test("keeps line_items and upgrade_group sections", () => {
    const sections = [
      section("line_items", "lines"),
      section("upgrade_group", "upgrades"),
      section("text", "overview"),
      section("terms", "terms"),
      section("warranty", "warranty"),
    ];

    const filtered = filterSectionsForEstimateCanvas(sections);
    assert.deepEqual(
      filtered.map((s) => s.kind),
      ["line_items", "upgrade_group"]
    );
  });

  test("filters text, terms, warranty, and image sections from Estimate canvas", () => {
    const sections = [
      section("text", "overview"),
      section("terms", "terms"),
      section("warranty", "warranty"),
      section("image", "photos"),
    ];

    assert.equal(filterSectionsForEstimateCanvas(sections).length, 0);
  });
});
