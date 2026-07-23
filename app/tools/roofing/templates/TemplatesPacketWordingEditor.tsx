"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import {
  buildPacketWordingEditorViewModel,
  buildPacketWordingSavePlan,
  PACKET_WORDING_SLOT_LABELS,
  packetWordingPreview,
  TEMPLATES_PACKET_CANCEL_ACTION,
  TEMPLATES_PACKET_EDIT_ACTION,
  TEMPLATES_PACKET_EDITOR_HEADING,
  TEMPLATES_PACKET_EDITOR_HINT,
  TEMPLATES_PACKET_SAVE_ACTION,
  type PacketWordingDraftMap,
  type PacketWordingSavePlan,
  type PacketWordingSlotId,
} from "./templatesSetupPacketWording";

type TemplatesPacketWordingEditorProps = {
  graph: ProposalTemplateGraph;
  busy?: boolean;
  onSave: (plan: PacketWordingSavePlan) => Promise<boolean> | boolean;
};

/**
 * Setup-owned customer wording — read mode first, calm edit panel.
 * Saves reusable template sections only (mirrored across package options).
 */
export default function TemplatesPacketWordingEditor({
  graph,
  busy = false,
  onSave,
}: TemplatesPacketWordingEditorProps) {
  const view = useMemo(() => buildPacketWordingEditorViewModel(graph), [graph]);
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<PacketWordingDraftMap>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    const next: PacketWordingDraftMap = {};
    for (const slot of view.slots) {
      next[slot.slotId] = slot.body;
    }
    setDrafts(next);
    setError(null);
  }, [editing, view]);

  const locked = busy || saving;

  async function handleSave() {
    if (locked) return;
    const plan = buildPacketWordingSavePlan(graph, drafts);
    if (plan.isNoop) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const ok = await onSave(plan);
      if (ok) {
        setEditing(false);
      } else {
        setError("Could not save customer wording. Try again.");
      }
    } catch {
      setError("Could not save customer wording. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (locked) return;
    setDrafts({});
    setError(null);
    setEditing(false);
  }

  function setSlotDraft(slotId: PacketWordingSlotId, value: string) {
    setDrafts((current) => ({ ...current, [slotId]: value }));
  }

  if (view.slots.length === 0) {
    return (
      <p className="mt-3 text-sm text-slate-500" data-templates-packet-wording-empty>
        No customer wording prepared yet.
      </p>
    );
  }

  if (!editing) {
    return (
      <div className="mt-3 space-y-3" data-templates-packet-wording-read>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">{TEMPLATES_PACKET_EDITOR_HINT}</p>
          <button
            type="button"
            className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            onClick={() => setEditing(true)}
            disabled={locked}
            data-templates-edit-customer-wording
          >
            {TEMPLATES_PACKET_EDIT_ACTION}
          </button>
        </div>
        <ol
          className="overflow-hidden rounded-xl ring-1 ring-slate-200/70"
          data-templates-packet-wording-list
        >
          {view.slots.map((slot, index) => (
            <li
              key={slot.slotId}
              className="border-b border-slate-100 bg-slate-50/40 px-3.5 py-2.5 last:border-b-0"
              data-templates-packet-slot={slot.slotId}
            >
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white text-[10px] font-semibold tabular-nums text-slate-500 ring-1 ring-slate-200/80">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{slot.label}</p>
                  <p className="mt-0.5 text-xs leading-snug text-slate-500">
                    {packetWordingPreview(slot.body) || "No wording yet."}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div
      className="mt-3 space-y-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
      data-templates-packet-wording-editor
    >
      <div>
        <h4 className="text-sm font-semibold text-slate-900">{TEMPLATES_PACKET_EDITOR_HEADING}</h4>
        <p className="mt-0.5 text-xs text-slate-500">{TEMPLATES_PACKET_EDITOR_HINT}</p>
      </div>

      <div className="space-y-4">
        {view.slots.map((slot) => (
          <label
            key={slot.slotId}
            className="block space-y-1.5"
            data-templates-packet-field={slot.slotId}
          >
            <span className="text-xs font-semibold text-slate-800">
              {PACKET_WORDING_SLOT_LABELS[slot.slotId]}
            </span>
            <textarea
              className="min-h-[7.5rem] w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm leading-relaxed text-slate-800 outline-none ring-slate-900/10 focus:border-slate-300 focus:bg-white focus:ring-2"
              value={drafts[slot.slotId] ?? ""}
              onChange={(event) => setSlotDraft(slot.slotId, event.target.value)}
              disabled={locked}
              aria-label={PACKET_WORDING_SLOT_LABELS[slot.slotId]}
            />
          </label>
        ))}
      </div>

      {error ? (
        <p className="text-xs font-medium text-red-600" data-templates-packet-wording-error>
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          onClick={() => void handleSave()}
          disabled={locked}
          data-templates-packet-wording-save
        >
          {saving ? "Saving…" : TEMPLATES_PACKET_SAVE_ACTION}
        </button>
        <button
          type="button"
          className="rounded-lg px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          onClick={handleCancel}
          disabled={locked}
          data-templates-packet-wording-cancel
        >
          {TEMPLATES_PACKET_CANCEL_ACTION}
        </button>
      </div>
    </div>
  );
}
