# FieldDive UI and product cohesion standard

**Status:** Mandatory whenever any visible UI is touched.

**Applies to:** layout, styling, routing that changes what the contractor sees, client state, rendered data, copy, loading, empty, error, permission, forms, tables, cards, modals, sheets, and navigation.

**Also required:** `docs/fielddive-product-execution-standards.md`. This document does not weaken that standard, tenancy, domain ownership, or accepted product truth.

If the environment cannot support a valid visual proof, do not fake one. Record the debt and validate it at the next compatible gate.

---

## Before editing

The screen’s job, first/second/third scan order, information ownership, state-specific priorities, what to preserve/omit, allowed/disallowed visual mechanisms, and proof criteria must be explicit before editing.

SEPARATION IS NOT HIERARCHY.

---

## Screen intent

Before a material visual or UI edit, identify all of the following.

### 1. Screen job

What is this screen or state actually for?

### 2. Scan order

What should the contractor understand first, second, and third?

### 3. Information ownership

Which domain owns each piece of truth? Overview may summarize. It does not become a second authority. Payments owns money. Activity owns chronology. Calendar owns scheduling mutation. Proposal acceptance is not operational approval.

### 4. State priorities

For loading, empty, populated, error, retry, blocked, permission-limited, and success: what matters most in that state?

### 5. Preserve / omit

What is already correct and must remain? What is duplicate or noise?

### 6. Allowed visual mechanisms

Prefer, in this order of reliance:

- content order
- typography hierarchy
- spacing
- grouping
- alignment
- contextual color
- restrained depth
- progressive disclosure

### 7. Disallowed shortcuts

Do not solve hierarchy primarily with:

- gray strips
- tinted bars
- extra borders
- nested cards
- boxes inside boxes
- oversized status panels
- banner spam
- decorative containers that have no information purpose

### 8. Proof

How will visual quality and behavior be proved? Appearance alone is not proof. Exercise the changed flow.

---

## Hierarchy and depth

Separation is not hierarchy.

Gray strips, tinted bands, borders, and boxes are not substitutes for:

- content order
- spacing
- typography scale
- grouping
- alignment
- interaction priority

Create depth from:

- tone
- hierarchy
- spacing
- typography
- grouping

before introducing new containers.

Avoid box-in-box design.

---

## Cohesion

One FieldDive product. No local mini design system.

Keep coherence across typography, spacing, controls, buttons, status treatments, tabs, navigation, forms, tables, cards, sheets, modals, loading, errors, empty states, and mobile behavior.

Some screens are already good. No change is a valid positive outcome.

Do not redesign an accepted surface merely because a phase touches adjacent code.

---

## Color

COLOR IS CONTEXTUAL, NOT GLOBAL.

Yellow means warning or attention. Do not use yellow for ordinary loading.

Red means a genuine destructive action, error, or risk.

Success stays restrained.

FieldDive blue and cool tones may provide brand and depth where they help. Do not turn every action into the same blue, and do not create a rainbow of operational UI.

An operational action may have a differentiated, restrained visual meaning when glanceability benefits.

---

## Banners

Normal state changes belong in the page hierarchy.

Banners are for:

- exceptional conditions
- meaningful risk
- failure
- a blocking action
- an important temporary system state

Do not turn ordinary lifecycle information into a banner.

---

## Historical and supporting facts

Do not remove a fact merely because it is historical. Preserve any fact necessary to understand the job’s operational record at a glance, but subordinate it appropriately.

Historical and supporting truth can remain. It should not visually compete with the current primary action or state.

---

## Information density

Do not confuse a minimal UI with missing useful information.

FieldDive should surface the pertinent information required to understand the current operational state without forcing unnecessary navigation.

At the same time, do not dump everything the system knows onto the screen.

FIELDIVE SHOULD KNOW MORE THAN IT SHOWS.

POWER LIVES UNDER THE HOOD.

CLARITY LIVES IN THE INTERFACE.

FLOW WHEN NEEDED.

STAY QUIET WHEN NOT NEEDED.

---

## Interaction affordance

Clickable actions must look actionable.

Informational states must not accidentally look clickable.

Use shape, border, spacing, hover, focus, pressed state, and iconography appropriately.

Do not rely on color alone.

---

## Mobile

Responsive quality means more than "it fits."

Verify:

- scan order stays clear
- hierarchy stays intact
- actions stay understandable
- touch targets are usable
- there is no accidental horizontal overflow
- the screen does not assume a desktop-only interaction
- information is not removed merely to fit the phone

---

## Error, loading, and empty

Loading must look like loading.

Failure must not look empty.

Unknown must not look like zero.

Authorization unavailable must not look forbidden.

Disabled must not look like no account.

A pending invitation is not a membership. Delivery is not access.

When the contractor can do something, the recovery action should be visible.

Show the current outcome and the next useful action. Do not expose provider events, internal error codes, RPC names, or retry machinery.

ERROR != EMPTY

UNKNOWN != ZERO

FAILED != SUCCESS

---

## UI Fix-When-Found

If a real UI issue is on a surface this work touches, and the root cause is understood, the correction is bounded, and the correction is safe, fix it now.

"Not part of the original checklist" is not a reason to leave a clearly broken touched surface.

Do not turn every feature phase into a broad cohesion sweep.

---

## Visual proof

A material visual change requires an actual visual review.

Code inspection is not enough. Tests are not enough. A component render is not enough. A single screenshot of the changed screen is not enough. Confirm the behavior.

Use:

- the visible external browser
- authenticated `http://localhost:3000`
- a real desktop width
- a true 390-wide mobile width

Desktop proof: `window.innerWidth >= 1200`.

Mobile proof: `window.innerWidth === 390` and `scrollWidth <= 390`.

A desktop-sized image of a narrow viewport is not desktop proof. Do not substitute `127.0.0.1` for signed-in proof.

Capture screenshots under `tmp/fielddive-ui-review/...`. Inspect the screenshots. Open that folder in File Explorer and leave it open.

The user owns `npm run dev`. Do not start, stop, restart, or kill Node or the dev server to obtain the proof.

If schema or environment incompatibility prevents a valid runtime proof, do not fake it. Record the proof debt and validate it at the next compatible gate.

### Independent visual review

Any visible UI change requires independent GPT or user visual review before final acceptance. Cursor may collect the proof. Cursor may not self-approve the visual result, and a Cursor PASS is evidence, not acceptance.

The reviewer inspects the actual screenshots for:

- hierarchy, spacing, typography and density
- action ranking
- states
- alignment and visual noise
- clipping and overflow
- responsive behavior and desktop/mobile intent
- cohesion with the best FieldDive screens
- generic CRUD or admin feel
- reusable versus one-off interaction design
- copy, not only layout: business meaning rather than implementation narration, no internal jargon, no unneeded explanation, and no statement that assumes the wrong Job stage (`docs/fielddive-product-execution-standards.md` → "Plain-language product copy")

Standing question: if this exact screen shipped in the same product as our best FieldDive screens, would it feel intentionally designed by the same system?

### Screenshot ZIP gate

Before returning visual proof, apply this mechanically:

1. Count the final screenshot set.
2. Record both lines in the report: `Visual proof count: N` and `ZIP rule evaluated: YES`.
3. If N <= 20, individual screenshots are allowed.
4. If N > 20, a ZIP must be created under `tmp/fielddive-ui-review/`, and the report states `ZIP path: ...`. Do not return more than 20 individual screenshots as the primary proof handoff.

The ZIP contains only the relevant screenshots and an optional `INDEX.txt`. Never include credentials, cookies, browser profiles, secrets, env files, scripts or unrelated files.

Open the proof folder or the ZIP location in File Explorer.

---

## Final UI standard

WOULD THIS HOLD UP AS A PAID PRODUCT IN FRONT OF REAL CONTRACTORS?

If it would not, continue refining inside the approved scope.
