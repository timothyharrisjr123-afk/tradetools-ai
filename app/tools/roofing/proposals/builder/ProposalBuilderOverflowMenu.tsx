"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, EyeOff } from "lucide-react";
import {
  resolveOverflowMenuTriggerState,
  type BuilderPageContextId,
  type PageStripItem,
} from "@/app/lib/proposalBuilderNavigation";
import { formatProposalPageTypeLabel } from "@/app/lib/proposalPageTypes";
import {
  BUILDER_OVERFLOW_MENU_ARIA_LABEL,
  BUILDER_OVERFLOW_MENU_HEADING,
  BUILDER_PAGE_STRIP_OVERFLOW_COUNT_BADGE,
  BUILDER_PAGE_STRIP_OVERFLOW_MENU,
  BUILDER_PAGE_STRIP_OVERFLOW_MENU_HEADING,
  BUILDER_PAGE_STRIP_OVERFLOW_MENU_ITEM,
  BUILDER_PAGE_STRIP_OVERFLOW_MENU_ITEM_ACTIVE,
  BUILDER_PAGE_STRIP_OVERFLOW_MENU_ITEM_LABEL,
  BUILDER_PAGE_STRIP_OVERFLOW_MENU_ITEM_TYPE,
  BUILDER_PAGE_STRIP_HIDDEN_INDICATOR,
  BUILDER_PAGE_STRIP_OVERFLOW_TRIGGER,
  BUILDER_PAGE_STRIP_OVERFLOW_TRIGGER_ACTIVE,
  BUILDER_PAGE_STRIP_OVERFLOW_TRIGGER_IDLE,
} from "./proposalBuilderConstants";

type ProposalBuilderOverflowMenuProps = {
  overflowPages: PageStripItem[];
  activePageContextId: BuilderPageContextId;
  onSelectPageContext: (id: BuilderPageContextId) => void;
};

type MenuPosition = {
  top: number;
  left: number;
};

export default function ProposalBuilderOverflowMenu({
  overflowPages,
  activePageContextId,
  onSelectPageContext,
}: ProposalBuilderOverflowMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const triggerState = resolveOverflowMenuTriggerState(activePageContextId, overflowPages);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 8,
      left: rect.left,
    });
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuPosition(null);
      return;
    }
    updateMenuPosition();
  }, [menuOpen, updateMenuPosition, triggerState.label]);

  useEffect(() => {
    if (!menuOpen) return;

    function handleReposition() {
      updateMenuPosition();
    }

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [menuOpen, updateMenuPosition]);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuPanelRef.current?.contains(target)) {
        return;
      }
      setMenuOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    const frameId = requestAnimationFrame(() => {
      document.addEventListener("pointerdown", handlePointerDown);
    });
    document.addEventListener("keydown", handleEscape);

    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  if (overflowPages.length === 0) {
    return null;
  }

  const menuPanel =
    menuOpen && menuPosition != null ? (
      <div
        ref={menuPanelRef}
        className={BUILDER_PAGE_STRIP_OVERFLOW_MENU}
        role="menu"
        aria-label={BUILDER_OVERFLOW_MENU_HEADING}
        style={{
          position: "fixed",
          top: menuPosition.top,
          left: menuPosition.left,
          zIndex: 60,
        }}
      >
        <div className={BUILDER_PAGE_STRIP_OVERFLOW_MENU_HEADING}>{BUILDER_OVERFLOW_MENU_HEADING}</div>
        {overflowPages.map((page) => {
          const isActive = activePageContextId === page.id;
          const pageTypeLabel =
            page.pageType != null ? formatProposalPageTypeLabel(page.pageType) : null;

          return (
            <button
              key={page.id}
              type="button"
              role="menuitem"
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                setMenuOpen(false);
                onSelectPageContext(page.id);
              }}
              className={`${BUILDER_PAGE_STRIP_OVERFLOW_MENU_ITEM} ${
                isActive ? BUILDER_PAGE_STRIP_OVERFLOW_MENU_ITEM_ACTIVE : ""
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className={BUILDER_PAGE_STRIP_OVERFLOW_MENU_ITEM_LABEL}>{page.label}</span>
                {pageTypeLabel ? (
                  <span className={`block ${BUILDER_PAGE_STRIP_OVERFLOW_MENU_ITEM_TYPE}`}>
                    {pageTypeLabel}
                  </span>
                ) : null}
              </span>
              {page.customerVisible === false ? (
                <EyeOff
                  className={`mt-0.5 h-4 w-4 shrink-0 ${BUILDER_PAGE_STRIP_HIDDEN_INDICATOR}`}
                  aria-label="Hidden from customer"
                />
              ) : null}
              {isActive ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden /> : null}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={BUILDER_OVERFLOW_MENU_ARIA_LABEL}
        aria-current={triggerState.isOverflowActive ? "page" : undefined}
        onClick={() => setMenuOpen((open) => !open)}
        className={`${BUILDER_PAGE_STRIP_OVERFLOW_TRIGGER} ${
          triggerState.isOverflowActive
            ? BUILDER_PAGE_STRIP_OVERFLOW_TRIGGER_ACTIVE
            : BUILDER_PAGE_STRIP_OVERFLOW_TRIGGER_IDLE
        }`}
      >
        <span className="truncate">{triggerState.label}</span>
        {!triggerState.isOverflowActive ? (
          <span className={BUILDER_PAGE_STRIP_OVERFLOW_COUNT_BADGE} aria-hidden>
            {triggerState.overflowCount}
          </span>
        ) : null}
        <ChevronDown
          className={`h-4 w-4 shrink-0 ${triggerState.isOverflowActive ? "text-blue-700" : "text-slate-500"}`}
          aria-hidden
        />
      </button>
      {typeof document !== "undefined" && menuPanel != null
        ? createPortal(menuPanel, document.body)
        : null}
    </>
  );
}
