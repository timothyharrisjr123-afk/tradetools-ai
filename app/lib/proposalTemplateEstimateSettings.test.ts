/**
 * R10a — Pure tests for proposalTemplateEstimateSettings.ts
 *
 * Run: npx tsx --test app/lib/proposalTemplateEstimateSettings.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DEFAULT_ESTIMATE_PAGE_SETTINGS,
  ESTIMATE_PAGE_SETTINGS_METADATA_KEY,
  buildEstimatePageSettingsMetadataPatch,
  buildLineItemsSectionEstimateSettingsPatch,
  buildTemplateEstimateSettingsPatch,
  mergeEstimatePageSettings,
  parseEstimatePageSettings,
  readEstimatePageSettingsFromSection,
  readEstimatePageSettingsFromTemplate,
  resolveEstimatePageSettingsForOption,
  validateEstimatePageSettingsPatch,
} from "./proposalTemplateEstimateSettings";
import type { ProposalTemplateGraph } from "./proposalTemplateStore";
import type { ProposalTemplate, ProposalTemplateSection } from "./proposalTemplateTypes";

function makeTemplate(metadata?: Record<string, unknown>): ProposalTemplate {
  return {
    id: "tpl-1",
    company_id: "co-1",
    name: "Template",
    status: "active",
    active: true,
    metadata,
  };
}

function makeLineItemsSection(
  metadata?: Record<string, unknown>
): ProposalTemplateSection {
  return {
    id: "sec-li",
    template_id: "tpl-1",
    option_id: "opt-a",
    kind: "line_items",
    name: "Estimate",
    metadata,
  };
}

describe("parseEstimatePageSettings", () => {
  test("defaults are correct", () => {
    assert.deepEqual(parseEstimatePageSettings(null), {
      ...DEFAULT_ESTIMATE_PAGE_SETTINGS,
    });
  });

  test("reads partial settings from metadata shape", () => {
    const parsed = parseEstimatePageSettings({
      show_line_prices: false,
      show_option_totals: true,
    });
    assert.equal(parsed.show_line_prices, false);
    assert.equal(parsed.show_option_totals, true);
    assert.equal(parsed.show_section_headings, true);
  });
});

describe("read and merge settings", () => {
  test("reads settings from template metadata", () => {
    const template = makeTemplate({
      [ESTIMATE_PAGE_SETTINGS_METADATA_KEY]: {
        show_line_prices: false,
      },
      other_key: "keep-me",
    });

    const settings = readEstimatePageSettingsFromTemplate(template);
    assert.equal(settings.show_line_prices, false);
    assert.equal(settings.show_option_totals, true);
  });

  test("reads settings from line_items section metadata", () => {
    const section = makeLineItemsSection({
      [ESTIMATE_PAGE_SETTINGS_METADATA_KEY]: {
        show_section_headings: false,
      },
    });

    const settings = readEstimatePageSettingsFromSection(section);
    assert.equal(settings?.show_section_headings, false);
  });

  test("updates one toggle without wiping other toggles", () => {
    const merged = mergeEstimatePageSettings(DEFAULT_ESTIMATE_PAGE_SETTINGS, {
      show_line_prices: false,
    });
    assert.equal(merged.show_line_prices, false);
    assert.equal(merged.show_option_totals, true);
    assert.equal(merged.show_section_headings, true);
  });

  test("preserves unrelated metadata", () => {
    const patch = buildEstimatePageSettingsMetadataPatch(
      { keep: "value", [ESTIMATE_PAGE_SETTINGS_METADATA_KEY]: { show_line_prices: true } },
      { show_option_totals: false }
    );

    assert.equal(patch.keep, "value");
    assert.deepEqual(patch[ESTIMATE_PAGE_SETTINGS_METADATA_KEY], {
      show_line_prices: true,
      show_option_totals: false,
      show_section_headings: true,
    });
  });

  test("handles missing/null metadata", () => {
    const sectionPatch = buildLineItemsSectionEstimateSettingsPatch(
      makeLineItemsSection(undefined),
      { show_line_prices: false }
    );
    assert.ok(sectionPatch);
    assert.deepEqual(sectionPatch?.[ESTIMATE_PAGE_SETTINGS_METADATA_KEY], {
      show_line_prices: false,
      show_option_totals: true,
      show_section_headings: true,
    });

    const templatePatch = buildTemplateEstimateSettingsPatch(makeTemplate(), {
      show_section_headings: false,
    });
    assert.deepEqual(templatePatch[ESTIMATE_PAGE_SETTINGS_METADATA_KEY], {
      show_line_prices: true,
      show_option_totals: true,
      show_section_headings: false,
    });
  });

  test("rejects invalid settings patch", () => {
    const invalid = validateEstimatePageSettingsPatch({
      show_line_prices: "yes" as unknown as boolean,
    });
    assert.equal(invalid.valid, false);

    const unknownKey = validateEstimatePageSettingsPatch({
      margin_pct: 50,
    } as Record<string, unknown>);
    assert.equal(unknownKey.valid, false);
  });

  test("does not mutate input metadata", () => {
    const metadata = {
      keep: "value",
      [ESTIMATE_PAGE_SETTINGS_METADATA_KEY]: { show_line_prices: true },
    };
    const snapshot = JSON.stringify(metadata);
    buildEstimatePageSettingsMetadataPatch(metadata, { show_option_totals: false });
    assert.equal(JSON.stringify(metadata), snapshot);
  });
});

describe("resolveEstimatePageSettingsForOption", () => {
  test("section metadata overrides template defaults", () => {
    const graph: ProposalTemplateGraph = {
      template: makeTemplate({
        [ESTIMATE_PAGE_SETTINGS_METADATA_KEY]: {
          show_line_prices: true,
          show_option_totals: true,
          show_section_headings: true,
        },
      }),
      options: [
        {
          id: "opt-a",
          template_id: "tpl-1",
          name: "Standard",
        },
      ],
      sections: [
        makeLineItemsSection({
          [ESTIMATE_PAGE_SETTINGS_METADATA_KEY]: {
            show_line_prices: false,
          },
        }),
      ],
      items: [],
    };

    const resolved = resolveEstimatePageSettingsForOption(graph, "opt-a");
    assert.equal(resolved.show_line_prices, false);
    assert.equal(resolved.show_option_totals, true);
  });
});
