"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

export type RowMenuAction = {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  dataAttr?: string;
};

type ProposalBuilderWorkbenchRowMenuProps = {
  rowId: string;
  rowLabel: string;
  openMenuId: string | null;
  onOpenMenuIdChange: (rowId: string | null) => void;
  actions: RowMenuAction[];
};

/**
 * Block 4E — portal-anchored row ⋯ menu (no clipping; closes on outside/Esc/action).
 */
export default function ProposalBuilderWorkbenchRowMenu({
  rowId,
  rowLabel,
  openMenuId,
  onOpenMenuIdChange,
  actions,
}: ProposalBuilderWorkbenchRowMenuProps) {
  const open = openMenuId === rowId;
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setCoords(null);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 176;
    const padding = 8;
    let left = rect.right - menuWidth;
    left = Math.max(padding, Math.min(left, window.innerWidth - menuWidth - padding));
    let top = rect.bottom + 4;
    const estimatedHeight = 88;
    if (top + estimatedHeight > window.innerHeight - padding) {
      top = Math.max(padding, rect.top - estimatedHeight - 4);
    }
    setCoords({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      onOpenMenuIdChange(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenMenuIdChange(null);
    }

    function handleScroll() {
      onOpenMenuIdChange(null);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [open, onOpenMenuIdChange]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 ${
          open ? "bg-slate-100 text-slate-700" : ""
        }`}
        aria-label={`More actions for ${rowLabel}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-builder-included-row-menu
        data-builder-included-row-menu-for={rowId}
        onClick={() => onOpenMenuIdChange(open ? null : rowId)}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {open && coords && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              className="fixed z-[90] min-w-[10.5rem] overflow-hidden rounded-lg border border-slate-200/90 bg-white py-1 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
              style={{ top: coords.top, left: coords.left }}
              data-builder-row-menu-portal
              data-builder-row-menu-for={rowId}
            >
              {actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  role="menuitem"
                  disabled={action.disabled}
                  className={`block w-full px-3 py-2 text-left text-[12px] font-medium transition hover:bg-slate-50 disabled:opacity-60 ${
                    action.id === "remove"
                      ? "text-slate-600"
                      : "text-slate-800"
                  }`}
                  data-builder-remove-from-proposal={
                    action.id === "remove" ? "true" : undefined
                  }
                  data-builder-view-line-details={
                    action.id === "details" ? "true" : undefined
                  }
                  onClick={() => {
                    if (action.disabled) return;
                    onOpenMenuIdChange(null);
                    action.onSelect();
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
