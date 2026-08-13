"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import {
  buildProposalDocumentTokenPickerModel,
  type ProposalDocumentTokenPickerItem,
} from "@/app/lib/proposalDocumentTokenPicker";
import {
  BUILDER_TOKEN_PICKER_ARIA_LABEL,
  BUILDER_TOKEN_PICKER_HEADING,
  BUILDER_TOKEN_PICKER_ITEM,
  BUILDER_TOKEN_PICKER_ITEM_DESCRIPTION,
  BUILDER_TOKEN_PICKER_ITEM_HINT,
  BUILDER_TOKEN_PICKER_ITEM_LABEL,
  BUILDER_TOKEN_PICKER_ITEM_PLACEHOLDER,
  BUILDER_TOKEN_PICKER_MENU,
  BUILDER_TOKEN_PICKER_MENU_GROUP,
  BUILDER_TOKEN_PICKER_MENU_GROUP_HEADING,
  BUILDER_TOKEN_PICKER_TRIGGER,
  BUILDER_TOKEN_PICKER_TRIGGER_LABEL,
  BUILDER_TOKEN_PICKER_TRIGGER_TEXT,
} from "./proposalBuilderConstants";

type ProposalBuilderTokenPickerMenuProps = {
  pricingComplete?: boolean;
  onInsertToken: (tokenName: string) => void;
};

type MenuPosition = {
  top: number;
  left: number;
  maxHeight: number;
};

function TokenPickerMenuItem({
  item,
  onSelect,
}: {
  item: ProposalDocumentTokenPickerItem;
  onSelect: (tokenName: string) => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={BUILDER_TOKEN_PICKER_ITEM}
      onClick={() => onSelect(item.name)}
    >
      <span className="min-w-0 flex-1">
        <span className={BUILDER_TOKEN_PICKER_ITEM_LABEL}>{item.label}</span>
        <span className={`block ${BUILDER_TOKEN_PICKER_ITEM_PLACEHOLDER}`}>{item.placeholder}</span>
        <span className={`block ${BUILDER_TOKEN_PICKER_ITEM_DESCRIPTION}`}>{item.description}</span>
        {item.pricingHint ? (
          <span className={`block ${BUILDER_TOKEN_PICKER_ITEM_HINT}`}>{item.pricingHint}</span>
        ) : null}
      </span>
    </button>
  );
}

export default function ProposalBuilderTokenPickerMenu({
  pricingComplete = false,
  onInsertToken,
}: ProposalBuilderTokenPickerMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(
    () =>
      buildProposalDocumentTokenPickerModel({
        surface: "body_text",
        pricingComplete,
      }),
    [pricingComplete]
  );

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow;
    const available = Math.max(120, openUpward ? spaceAbove : spaceBelow);
    const maxHeight = Math.min(384, available);
    const menu = menuPanelRef.current;
    const menuWidth = Math.min(menu?.offsetWidth ?? 256, viewportWidth - 16);
    const menuHeight = Math.min(menu?.offsetHeight ?? maxHeight, maxHeight);
    const left = Math.max(8, Math.min(rect.left, viewportWidth - menuWidth - 8));
    const top = openUpward
      ? Math.max(8, rect.top - gap - menuHeight)
      : rect.bottom + gap;
    setMenuPosition({ top, left, maxHeight });
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) return;
    const frame = requestAnimationFrame(() => {
      updateMenuPosition();
    });
    return () => cancelAnimationFrame(frame);
  }, [menuOpen, updateMenuPosition, groups.length]);

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
        triggerRef.current?.focus();
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

  const handleSelectToken = useCallback(
    (tokenName: string) => {
      setMenuOpen(false);
      onInsertToken(tokenName);
    },
    [onInsertToken]
  );

  if (groups.length === 0) {
    return null;
  }

  const menuPanel =
    menuOpen && menuPosition != null ? (
      <div
        ref={menuPanelRef}
        className={`${BUILDER_TOKEN_PICKER_MENU} flex flex-col`}
        role="menu"
        aria-label={BUILDER_TOKEN_PICKER_HEADING}
        style={{
          position: "fixed",
          top: menuPosition.top,
          left: menuPosition.left,
          zIndex: 60,
          maxHeight: menuPosition.maxHeight,
        }}
      >
        <div className={BUILDER_TOKEN_PICKER_MENU_GROUP_HEADING}>{BUILDER_TOKEN_PICKER_HEADING}</div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.domain} className={BUILDER_TOKEN_PICKER_MENU_GROUP}>
              <div className={BUILDER_TOKEN_PICKER_MENU_GROUP_HEADING}>{group.label}</div>
              {group.items.map((item) => (
                <TokenPickerMenuItem key={item.name} item={item} onSelect={handleSelectToken} />
              ))}
            </div>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={BUILDER_TOKEN_PICKER_ARIA_LABEL}
        onClick={() => {
          if (menuOpen) {
            setMenuOpen(false);
            return;
          }
          setMenuOpen(true);
          updateMenuPosition();
        }}
        className={BUILDER_TOKEN_PICKER_TRIGGER}
      >
        <span className={BUILDER_TOKEN_PICKER_TRIGGER_TEXT}>{BUILDER_TOKEN_PICKER_TRIGGER_LABEL}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 ${menuOpen ? "text-blue-700" : "text-slate-500"}`}
          aria-hidden
        />
      </button>
      {typeof document !== "undefined" && menuPanel != null
        ? createPortal(menuPanel, document.body)
        : null}
    </>
  );
}
