/**
 * Horizontal-only scroll math for the shared Job Card tab rail.
 * Keeps the active/focused tab visible without shrinking labels or scrolling the page.
 */

export type JobCardTabRailEdgeBox = {
  left: number;
  right: number;
};

export function jobCardTabRailScrollDelta(
  scroller: JobCardTabRailEdgeBox,
  tab: JobCardTabRailEdgeBox,
  inset = 8
): number {
  const visibleLeft = scroller.left + inset;
  const visibleRight = scroller.right - inset;
  if (tab.left < visibleLeft) return tab.left - visibleLeft;
  if (tab.right > visibleRight) return tab.right - visibleRight;
  return 0;
}

export function scrollJobCardTabIntoRailView(
  scroller: HTMLElement,
  tab: HTMLElement
): void {
  const delta = jobCardTabRailScrollDelta(
    scroller.getBoundingClientRect(),
    tab.getBoundingClientRect()
  );
  if (delta === 0) return;
  scroller.scrollLeft += delta;
}
