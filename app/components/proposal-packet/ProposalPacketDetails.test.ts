/**
 * R3A — ProposalPacketDetails accordion (public loop for Project notes).
 * Run: npx tsx --test app/components/proposal-packet/ProposalPacketDetails.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildDetailSectionMap,
  DETAIL_SECTIONS,
  firstAvailableDetailSection,
  resolveDetailSectionKey,
} from "./ProposalPacketDetails";
import type { ProposalCustomerPacketDetailTabViewModel } from "@/app/lib/proposalCustomerPacketViewModel";

function tab(
  id: string,
  title: string,
  body = "Body copy."
): ProposalCustomerPacketDetailTabViewModel {
  return { id, title, body, isEmpty: false };
}

describe("DETAIL_SECTIONS order", () => {
  test("Project overview, Project notes, Warranty, Terms — in that order", () => {
    assert.deepEqual(
      DETAIL_SECTIONS.map((section) => section.key),
      ["overview", "scope", "warranty", "terms"]
    );
    assert.deepEqual(
      DETAIL_SECTIONS.map((section) => section.fallbackLabel),
      ["Project overview", "Project notes", "Warranty", "Terms"]
    );
  });
});

describe("resolveDetailSectionKey", () => {
  test("maps the copied Project notes custom_text tab to the scope row", () => {
    assert.equal(resolveDetailSectionKey(tab("custom_text:40", "Project notes")), "scope");
    assert.equal(resolveDetailSectionKey(tab("custom_text:40", "Scope notes")), "scope");
  });

  test("still maps core packet page types", () => {
    assert.equal(resolveDetailSectionKey(tab("project_overview:10", "Project overview")), "overview");
    assert.equal(resolveDetailSectionKey(tab("warranty:25", "Warranty and protection")), "warranty");
    assert.equal(resolveDetailSectionKey(tab("terms:60", "Next steps")), "terms");
  });

  test("does not map an unrelated custom_text title to any row", () => {
    assert.equal(resolveDetailSectionKey(tab("custom_text:45", "Special promotion")), null);
  });
});

describe("buildDetailSectionMap + firstAvailableDetailSection", () => {
  test("renders a compact, collapsed-by-default fourth row for Project notes", () => {
    const tabs = [
      tab("project_overview:10", "Project overview", "Overview body."),
      tab("custom_text:40", "Project notes", "Debris removal within 48 hours."),
      tab("warranty:25", "Warranty and protection", "Warranty body."),
      tab("terms:60", "Next steps", "Terms body."),
    ];
    const sectionMap = buildDetailSectionMap(tabs);
    const ordered = DETAIL_SECTIONS.filter((section) => sectionMap.has(section.key));

    assert.deepEqual(ordered.map((section) => section.key), ["overview", "scope", "warranty", "terms"]);
    assert.equal(sectionMap.get("scope")?.body, "Debris removal within 48 hours.");
    assert.equal(firstAvailableDetailSection(sectionMap), "overview");
  });

  test("omits the Project notes row entirely when no matching tab exists", () => {
    const tabs = [
      tab("project_overview:10", "Project overview"),
      tab("warranty:25", "Warranty and protection"),
      tab("terms:60", "Next steps"),
    ];
    const sectionMap = buildDetailSectionMap(tabs);
    const ordered = DETAIL_SECTIONS.filter((section) => sectionMap.has(section.key));
    assert.deepEqual(ordered.map((section) => section.key), ["overview", "warranty", "terms"]);
  });

  test("an arbitrary unrelated custom_text tab never occupies the Project notes row", () => {
    const tabs = [
      tab("project_overview:10", "Project overview"),
      tab("custom_text:45", "Special promotion", "Ask about our referral discount."),
    ];
    const sectionMap = buildDetailSectionMap(tabs);
    assert.equal(sectionMap.has("scope"), false);
  });
});
