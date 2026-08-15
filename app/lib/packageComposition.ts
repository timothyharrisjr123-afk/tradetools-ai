/**
 * Package composition domain engine (V2E2A).
 *
 * Pure derivation: compare explicit package compositions.
 * No React, routes, Tailwind, package-name assumptions, or database tables.
 * No proposal totals, tax, waste, or pricing-engine math.
 *
 * Matching:
 * 1. group (included vs optional_upgrade arrays) + compositionSlotKey
 *    when both sides have that slot exactly once
 * 2. else provenanceKey when both sides have one
 * 3. else productId when both sides have one
 * 4. else unmatched add/remove
 *
 * Duplicate non-null slots in a group are never paired as replacements.
 * PRODUCT_REPLACEMENT is proven by unique shared slot or shared provenance
 * with different productIds. Names are never used.
 */

export const PACKAGE_COMPOSITION_MATCHING_LIMITATION =
  "Entries match by unique group+compositionSlotKey, else provenanceKey, else productId. Duplicate slots in a group are not paired as replacements. Product replacement without shared slot or provenance appears as removed + added included scope — no invented semantic identity from names." as const;

export type CompositionEntryRole = "included" | "optional_upgrade";

export type CompositionQuantityConfig = {
  /** Normalized reusable quantity mode (inherit / fixed / measurement / multiplier / custom). */
  mode: string;
  /** Contractor-readable description. */
  summary: string;
  /** Equality fingerprint — not customer copy. */
  fingerprint: string;
};

export type CompositionEntry = {
  entryId: string;
  packageId: string;
  /** Included vs optional-upgrade group. */
  role: CompositionEntryRole;
  /** Functional family. Informational; matching uses group + slot. */
  compositionRole?: string | null;
  /** Stable instance of the family within this group. */
  compositionSlotKey?: string | null;
  /** Catalog / product identity. */
  productId: string | null;
  /** Install/seed or other durable provenance — not a display name. */
  provenanceKey: string | null;
  customerLabel: string;
  productName: string | null;
  quantity: CompositionQuantityConfig;
  /** Optional Catalog unit price (cents). Never a project total. */
  unitPriceCents: number | null;
};

export type PackageComposition = {
  packageId: string;
  customerLabel: string;
  /** Persisted display order. Step-up follows this, not starting-default. */
  order: number;
  /** Proposal-creation default. Not the step-up predecessor. */
  isStartingDefault?: boolean;
  included: readonly CompositionEntry[];
  optionalUpgrades: readonly CompositionEntry[];
};

export type CompositionDiffKind =
  | "UNCHANGED"
  | "LABEL_ONLY"
  | "PRODUCT_REPLACEMENT"
  | "QUANTITY_CHANGE"
  | "ADDED_INCLUDED_SCOPE"
  | "REMOVED_INCLUDED_SCOPE"
  | "OPTIONAL_UPGRADE_ADDED"
  | "OPTIONAL_UPGRADE_REMOVED"
  | "OPTIONAL_UPGRADE_CHANGED";

export type CompositionDiffEntry = {
  kind: CompositionDiffKind;
  title: string;
  base: CompositionEntry | null;
  target: CompositionEntry | null;
  detail: string;
  unitPriceDeltaCents: number | null;
  sameProduct: boolean;
};

export type CompositionDiffCounts = {
  unchanged: number;
  labelOnly: number;
  productReplacement: number;
  quantityChange: number;
  addedIncluded: number;
  removedIncluded: number;
  upgradeAdded: number;
  upgradeRemoved: number;
  upgradeChanged: number;
};

export type CompositionSlotAmbiguity = {
  group: CompositionEntryRole;
  compositionSlotKey: string;
  baseEntryIds: string[];
  targetEntryIds: string[];
};

export type PackageCompositionDiff = {
  basePackageId: string;
  baseLabel: string;
  targetPackageId: string;
  targetLabel: string;
  isComparison: boolean;
  counts: CompositionDiffCounts;
  entries: CompositionDiffEntry[];
  changeCount: number;
  matchingLimitation: string;
  /** Duplicate group+slot keys that were not used for replacement matching. */
  slotAmbiguities: readonly CompositionSlotAmbiguity[];
};

export type PackageStepUpItem = {
  package: PackageComposition;
  /** Null for the first ordered package. */
  previous: PackageComposition | null;
  diff: PackageCompositionDiff;
};

function norm(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

export function inheritCatalogQuantity(): CompositionQuantityConfig {
  return {
    mode: "inherit_catalog",
    summary: "Uses Catalog quantity",
    fingerprint: "inherit_catalog",
  };
}

export function orderPackageCompositions(
  packages: readonly PackageComposition[]
): PackageComposition[] {
  return [...packages].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.packageId.localeCompare(b.packageId);
  });
}

export function resolveStepUpBasePackageId(
  packages: readonly PackageComposition[]
): string | null {
  return orderPackageCompositions(packages)[0]?.packageId ?? null;
}

export function resolveStartingDefaultPackageId(
  packages: readonly PackageComposition[]
): string | null {
  const ordered = orderPackageCompositions(packages);
  const marked = ordered.find((pkg) => pkg.isStartingDefault === true);
  return marked?.packageId ?? ordered[0]?.packageId ?? null;
}

function matchKey(entry: CompositionEntry): string {
  const provenance = norm(entry.provenanceKey);
  if (provenance) return `provenance:${provenance}`;
  const productId = norm(entry.productId);
  if (productId) return `product:${productId}`;
  return `unmatched:${entry.entryId}`;
}

function compositionSlot(entry: CompositionEntry): string | null {
  const slot = norm(entry.compositionSlotKey);
  return slot || null;
}

function slotEntryIds(
  entries: readonly CompositionEntry[]
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const entry of entries) {
    const slot = compositionSlot(entry);
    if (!slot) continue;
    const ids = map.get(slot) ?? [];
    ids.push(entry.entryId);
    map.set(slot, ids);
  }
  return map;
}

function collectSlotAmbiguities(
  baseEntries: readonly CompositionEntry[],
  targetEntries: readonly CompositionEntry[],
  group: CompositionEntryRole
): CompositionSlotAmbiguity[] {
  const baseIds = slotEntryIds(baseEntries);
  const targetIds = slotEntryIds(targetEntries);
  const keys = [...new Set([...baseIds.keys(), ...targetIds.keys()])].sort();
  const ambiguities: CompositionSlotAmbiguity[] = [];
  for (const compositionSlotKey of keys) {
    const baseEntryIds = baseIds.get(compositionSlotKey) ?? [];
    const targetEntryIds = targetIds.get(compositionSlotKey) ?? [];
    if (baseEntryIds.length > 1 || targetEntryIds.length > 1) {
      ambiguities.push({
        group,
        compositionSlotKey,
        baseEntryIds,
        targetEntryIds,
      });
    }
  }
  return ambiguities;
}

function uniquePairableSlots(
  baseEntries: readonly CompositionEntry[],
  targetEntries: readonly CompositionEntry[]
): string[] {
  const baseIds = slotEntryIds(baseEntries);
  const targetIds = slotEntryIds(targetEntries);
  return [...baseIds.keys()]
    .filter((slot) => {
      const base = baseIds.get(slot) ?? [];
      const target = targetIds.get(slot) ?? [];
      return base.length === 1 && target.length === 1;
    })
    .sort();
}

function indexEntries(
  entries: readonly CompositionEntry[]
): Map<string, CompositionEntry[]> {
  const map = new Map<string, CompositionEntry[]>();
  for (const entry of entries) {
    const key = matchKey(entry);
    const rows = map.get(key) ?? [];
    rows.push(entry);
    map.set(key, rows);
  }
  return map;
}

function takeNext(
  map: Map<string, CompositionEntry[]>,
  key: string
): CompositionEntry | null {
  const rows = map.get(key);
  if (!rows || rows.length === 0) return null;
  const next = rows.shift() ?? null;
  if (!rows.length) map.delete(key);
  else map.set(key, rows);
  return next;
}

function emptyCounts(): CompositionDiffCounts {
  return {
    unchanged: 0,
    labelOnly: 0,
    productReplacement: 0,
    quantityChange: 0,
    addedIncluded: 0,
    removedIncluded: 0,
    upgradeAdded: 0,
    upgradeRemoved: 0,
    upgradeChanged: 0,
  };
}

function tally(counts: CompositionDiffCounts, kind: CompositionDiffKind): void {
  switch (kind) {
    case "UNCHANGED":
      counts.unchanged += 1;
      break;
    case "LABEL_ONLY":
      counts.labelOnly += 1;
      break;
    case "PRODUCT_REPLACEMENT":
      counts.productReplacement += 1;
      break;
    case "QUANTITY_CHANGE":
      counts.quantityChange += 1;
      break;
    case "ADDED_INCLUDED_SCOPE":
      counts.addedIncluded += 1;
      break;
    case "REMOVED_INCLUDED_SCOPE":
      counts.removedIncluded += 1;
      break;
    case "OPTIONAL_UPGRADE_ADDED":
      counts.upgradeAdded += 1;
      break;
    case "OPTIONAL_UPGRADE_REMOVED":
      counts.upgradeRemoved += 1;
      break;
    case "OPTIONAL_UPGRADE_CHANGED":
      counts.upgradeChanged += 1;
      break;
  }
}

function changeCountFrom(counts: CompositionDiffCounts): number {
  return (
    counts.labelOnly +
    counts.productReplacement +
    counts.quantityChange +
    counts.addedIncluded +
    counts.removedIncluded +
    counts.upgradeAdded +
    counts.upgradeRemoved +
    counts.upgradeChanged
  );
}

function formatMoneyCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function sameProduct(a: CompositionEntry, b: CompositionEntry): boolean {
  return Boolean(a.productId) && Boolean(b.productId) && a.productId === b.productId;
}

function compareMatchedIncluded(
  base: CompositionEntry,
  target: CompositionEntry
): CompositionDiffEntry {
  if (!sameProduct(base, target)) {
    const basePrice = base.unitPriceCents;
    const targetPrice = target.unitPriceCents;
    const delta =
      basePrice != null && targetPrice != null ? targetPrice - basePrice : null;
    const priceDetail =
      basePrice != null && targetPrice != null
        ? `Unit price: ${formatMoneyCents(basePrice)} → ${formatMoneyCents(targetPrice)}`
        : "Catalog unit price not available on both products";
    return {
      kind: "PRODUCT_REPLACEMENT",
      title: target.customerLabel,
      base,
      target,
      detail: [
        target.productName ? `Now: ${target.productName}` : null,
        base.productName ? `Replaces: ${base.productName}` : null,
        priceDetail,
      ]
        .filter(Boolean)
        .join(" · "),
      unitPriceDeltaCents: delta,
      sameProduct: false,
    };
  }

  const sameQty = base.quantity.fingerprint === target.quantity.fingerprint;
  const sameLabel = base.customerLabel === target.customerLabel;

  if (!sameQty) {
    return {
      kind: "QUANTITY_CHANGE",
      title: target.customerLabel,
      base,
      target,
      detail: `${base.quantity.summary} → ${target.quantity.summary}`,
      unitPriceDeltaCents: null,
      sameProduct: true,
    };
  }

  if (!sameLabel) {
    return {
      kind: "LABEL_ONLY",
      title: target.customerLabel,
      base,
      target,
      detail: target.productName
        ? `Catalog product: ${target.productName}`
        : "Customer wording differs",
      unitPriceDeltaCents: null,
      sameProduct: true,
    };
  }

  return {
    kind: "UNCHANGED",
    title: target.customerLabel,
    base,
    target,
    detail: "Same product, quantity, and customer wording",
    unitPriceDeltaCents: null,
    sameProduct: true,
  };
}

function compareMatchedUpgrade(
  base: CompositionEntry,
  target: CompositionEntry
): CompositionDiffEntry | null {
  const productChanged = !sameProduct(base, target);
  const qtyChanged = base.quantity.fingerprint !== target.quantity.fingerprint;
  const labelChanged = base.customerLabel !== target.customerLabel;
  if (!productChanged && !qtyChanged && !labelChanged) return null;
  return {
    kind: "OPTIONAL_UPGRADE_CHANGED",
    title: target.customerLabel,
    base,
    target,
    detail: [
      productChanged && target.productName ? `Now: ${target.productName}` : null,
      qtyChanged ? `${base.quantity.summary} → ${target.quantity.summary}` : null,
      labelChanged && !productChanged && !qtyChanged ? "Customer wording differs" : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Optional upgrade changed",
    unitPriceDeltaCents:
      productChanged &&
      base.unitPriceCents != null &&
      target.unitPriceCents != null
        ? target.unitPriceCents - base.unitPriceCents
        : null,
    sameProduct: !productChanged,
  };
}

function walkPairs(
  baseEntries: readonly CompositionEntry[],
  targetEntries: readonly CompositionEntry[],
  onPair: (
    base: CompositionEntry | null,
    target: CompositionEntry | null
  ) => void
): void {
  const pairableSlots = uniquePairableSlots(baseEntries, targetEntries);
  const usedBase = new Set<string>();
  const usedTarget = new Set<string>();

  for (const slot of pairableSlots) {
    const base = baseEntries.find((entry) => compositionSlot(entry) === slot) ?? null;
    const target =
      targetEntries.find((entry) => compositionSlot(entry) === slot) ?? null;
    if (!base || !target) continue;
    usedBase.add(base.entryId);
    usedTarget.add(target.entryId);
    onPair(base, target);
  }

  const remainingBase = baseEntries.filter((entry) => !usedBase.has(entry.entryId));
  const remainingTarget = targetEntries.filter(
    (entry) => !usedTarget.has(entry.entryId)
  );
  const baseIndex = indexEntries(remainingBase);
  const targetIndex = indexEntries(remainingTarget);
  const keys = [...new Set([...baseIndex.keys(), ...targetIndex.keys()])].sort();
  for (const key of keys) {
    while (true) {
      const base = takeNext(baseIndex, key);
      const target = takeNext(targetIndex, key);
      if (!base && !target) break;
      onPair(base, target);
    }
  }
}

/**
 * Compare two explicit package compositions (arbitrary A ↔ B).
 * Pure — does not mutate inputs.
 */
export function comparePackageCompositions(
  base: PackageComposition,
  target: PackageComposition
): PackageCompositionDiff {
  const isComparison = base.packageId !== target.packageId;
  const counts = emptyCounts();
  const entries: CompositionDiffEntry[] = [];
  const slotAmbiguities = [
    ...collectSlotAmbiguities(base.included, target.included, "included"),
    ...collectSlotAmbiguities(
      base.optionalUpgrades,
      target.optionalUpgrades,
      "optional_upgrade"
    ),
  ];

  if (!isComparison) {
    return {
      basePackageId: base.packageId,
      baseLabel: base.customerLabel,
      targetPackageId: target.packageId,
      targetLabel: target.customerLabel,
      isComparison: false,
      counts,
      entries: [],
      changeCount: 0,
      matchingLimitation: PACKAGE_COMPOSITION_MATCHING_LIMITATION,
      slotAmbiguities: [],
    };
  }

  walkPairs(base.included, target.included, (baseEntry, targetEntry) => {
    if (baseEntry && targetEntry) {
      const entry = compareMatchedIncluded(baseEntry, targetEntry);
      tally(counts, entry.kind);
      if (entry.kind !== "UNCHANGED") entries.push(entry);
      return;
    }
    if (targetEntry && !baseEntry) {
      const entry: CompositionDiffEntry = {
        kind: "ADDED_INCLUDED_SCOPE",
        title: targetEntry.customerLabel,
        base: null,
        target: targetEntry,
        detail: targetEntry.productName
          ? `Catalog product: ${targetEntry.productName}`
          : "Added included work",
        unitPriceDeltaCents: null,
        sameProduct: false,
      };
      tally(counts, entry.kind);
      entries.push(entry);
      return;
    }
    if (baseEntry && !targetEntry) {
      const entry: CompositionDiffEntry = {
        kind: "REMOVED_INCLUDED_SCOPE",
        title: baseEntry.customerLabel,
        base: baseEntry,
        target: null,
        detail: baseEntry.productName
          ? `Catalog product: ${baseEntry.productName}`
          : "Removed included work",
        unitPriceDeltaCents: null,
        sameProduct: false,
      };
      tally(counts, entry.kind);
      entries.push(entry);
    }
  });

  walkPairs(base.optionalUpgrades, target.optionalUpgrades, (baseEntry, targetEntry) => {
    if (baseEntry && targetEntry) {
      const changed = compareMatchedUpgrade(baseEntry, targetEntry);
      if (!changed) return;
      tally(counts, changed.kind);
      entries.push(changed);
      return;
    }
    if (targetEntry && !baseEntry) {
      const entry: CompositionDiffEntry = {
        kind: "OPTIONAL_UPGRADE_ADDED",
        title: targetEntry.customerLabel,
        base: null,
        target: targetEntry,
        detail: "Optional upgrade available",
        unitPriceDeltaCents: null,
        sameProduct: false,
      };
      tally(counts, entry.kind);
      entries.push(entry);
      return;
    }
    if (baseEntry && !targetEntry) {
      const entry: CompositionDiffEntry = {
        kind: "OPTIONAL_UPGRADE_REMOVED",
        title: baseEntry.customerLabel,
        base: baseEntry,
        target: null,
        detail: "Optional upgrade no longer available",
        unitPriceDeltaCents: null,
        sameProduct: false,
      };
      tally(counts, entry.kind);
      entries.push(entry);
    }
  });

  return {
    basePackageId: base.packageId,
    baseLabel: base.customerLabel,
    targetPackageId: target.packageId,
    targetLabel: target.customerLabel,
    isComparison: true,
    counts,
    entries,
    changeCount: changeCountFrom(counts),
    matchingLimitation: PACKAGE_COMPOSITION_MATCHING_LIMITATION,
    slotAmbiguities,
  };
}

/**
 * Derived step-up chain: P1 base, P2 vs P1, P3 vs P2, …
 * Does not persist inheritance. Each package remains a complete composition.
 */
export function buildPackageStepUpChain(
  packages: readonly PackageComposition[]
): PackageStepUpItem[] {
  const ordered = orderPackageCompositions(packages);
  return ordered.map((pkg, index) => {
    const previous = index === 0 ? null : ordered[index - 1] ?? null;
    const diff = comparePackageCompositions(previous ?? pkg, pkg);
    return { package: pkg, previous, diff };
  });
}

export type CompositionDiffDisplayGroupId =
  | "adds"
  | "replaces"
  | "quantity"
  | "optional"
  | "wording";

export type CompositionDiffDisplayGroup = {
  id: CompositionDiffDisplayGroupId;
  label: string;
  /** One quiet group note — not repeated per row. */
  note: string | null;
  entries: CompositionDiffEntry[];
};

const DISPLAY_GROUPS: {
  id: CompositionDiffDisplayGroupId;
  label: string;
  note: string | null;
  kinds: readonly CompositionDiffKind[];
}[] = [
  {
    id: "adds",
    label: "Adds",
    note: null,
    kinds: ["ADDED_INCLUDED_SCOPE"],
  },
  {
    id: "replaces",
    label: "Replaces",
    note: null,
    kinds: ["PRODUCT_REPLACEMENT", "REMOVED_INCLUDED_SCOPE"],
  },
  {
    id: "quantity",
    label: "Changes quantity",
    note: null,
    kinds: ["QUANTITY_CHANGE"],
  },
  {
    id: "optional",
    label: "Optional",
    note: null,
    kinds: [
      "OPTIONAL_UPGRADE_ADDED",
      "OPTIONAL_UPGRADE_REMOVED",
      "OPTIONAL_UPGRADE_CHANGED",
    ],
  },
  {
    id: "wording",
    label: "Wording only",
    note: "Customer wording differs; the underlying Catalog product is unchanged.",
    kinds: ["LABEL_ONLY"],
  },
];

export function groupCompositionDiffForDisplay(
  entries: readonly CompositionDiffEntry[]
): CompositionDiffDisplayGroup[] {
  return DISPLAY_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    note: group.note,
    entries: entries.filter((entry) => group.kinds.includes(entry.kind)),
  })).filter((group) => group.entries.length > 0);
}

export function formatStepUpChangeSummary(diff: PackageCompositionDiff): string | null {
  if (!diff.isComparison) return null;
  const n = diff.changeCount;
  if (n === 0) return `No composition changes from ${diff.baseLabel}`;
  return `${n} change${n === 1 ? "" : "s"} from ${diff.baseLabel}`;
}

export function resolveCompositionDualIdentity(input: {
  customerLabel: string;
  productName: string | null | undefined;
}): {
  customerLabel: string;
  productName: string | null;
  showProductIdentity: boolean;
} {
  const customerLabel = norm(input.customerLabel) || "Line item";
  const productName = norm(input.productName) || null;
  return {
    customerLabel,
    productName,
    showProductIdentity: Boolean(
      productName && customerLabel.toLowerCase() !== productName.toLowerCase()
    ),
  };
}
