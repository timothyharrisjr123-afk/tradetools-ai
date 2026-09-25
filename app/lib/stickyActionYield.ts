"use client";

import { useEffect, useState } from "react";

/** Open overlays that must own the bottom of the viewport on phones. */
export const STICKY_ACTION_OVERLAY_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [data-overlay-open="true"]';

const TEXT_ENTRY_INPUT_TYPES = new Set([
  "",
  "text",
  "search",
  "email",
  "tel",
  "url",
  "number",
  "password",
  "date",
  "time",
  "datetime-local",
]);

export type StickyActionYieldInput = {
  activeTagName: string | null;
  activeInputType: string | null;
  activeIsContentEditable: boolean;
  openOverlayCount: number;
};

/** True when the phone sticky CTA should step aside for a menu, dialog, or on-screen keyboard. */
export function shouldStickyActionYield(input: StickyActionYieldInput): boolean {
  if (input.openOverlayCount > 0) return true;
  if (input.activeIsContentEditable) return true;
  const tag = input.activeTagName?.toUpperCase() ?? null;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    return TEXT_ENTRY_INPUT_TYPES.has((input.activeInputType ?? "").toLowerCase());
  }
  return false;
}

function readYield(): boolean {
  if (typeof document === "undefined") return false;
  const active = document.activeElement as HTMLElement | null;
  return shouldStickyActionYield({
    activeTagName: active?.tagName ?? null,
    activeInputType:
      active && active.tagName === "INPUT" ? (active as HTMLInputElement).type : null,
    activeIsContentEditable: Boolean(active?.isContentEditable),
    openOverlayCount: document.querySelectorAll(STICKY_ACTION_OVERLAY_SELECTOR).length,
  });
}

export function useStickyActionYield(enabled: boolean): boolean {
  const [yieldNow, setYieldNow] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setYieldNow(false);
      return;
    }
    const update = () => setYieldNow(readYield());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["role", "data-overlay-open"],
    });
    const updateAfterBlur = () => window.setTimeout(update, 0);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", updateAfterBlur);
    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", updateAfterBlur);
    };
  }, [enabled]);

  return yieldNow;
}
