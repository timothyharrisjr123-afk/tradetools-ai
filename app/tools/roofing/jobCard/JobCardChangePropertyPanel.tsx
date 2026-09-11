"use client";

import { useCallback, useMemo, useState } from "react";
import { getSupabaseClient } from "@/app/lib/supabaseClient";
import { changeJobPropertyViaRpc } from "@/app/lib/jobPropertyChange";
import { JobPacketAddressCombobox } from "@/app/tools/roofing/JobPacketAddressCombobox";
import {
  usePlacesAddressAssist,
  type PlacesSuggestion,
} from "@/app/tools/roofing/usePlacesAddressAssist";

type Props = {
  open: boolean;
  jobId: string;
  companyId: string;
  currentAddressLabel: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

function sanitizeZip(value: string): string {
  return value.replace(/[^\d]/g, "").slice(0, 10);
}

export function JobCardChangePropertyPanel({
  open,
  jobId,
  companyId,
  currentAddressLabel,
  onClose,
  onSaved,
}: Props) {
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [selectedFormatted, setSelectedFormatted] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locality = useMemo(
    () => ({ city: city || null, state: state || null, zip: zip || null }),
    [city, state, zip]
  );

  const {
    suggestions,
    status,
    resolvePlace,
    abandonSession,
  } = usePlacesAddressAssist(line1, open && !manualMode, locality);

  const reset = useCallback(() => {
    setLine1("");
    setLine2("");
    setCity("");
    setState("");
    setZip("");
    setManualMode(false);
    setSelectedPlaceId(null);
    setSelectedFormatted(null);
    setError(null);
    setBusy(false);
    abandonSession();
  }, [abandonSession]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSelectSuggestion = async (suggestion: PlacesSuggestion) => {
    const resolved = await resolvePlace(suggestion.placeId);
    if (resolved) {
      setSelectedPlaceId(resolved.placeId);
      setSelectedFormatted(resolved.address.formatted);
      setLine1(resolved.address.line1 || suggestion.primaryText);
      if (resolved.address.line2) setLine2(resolved.address.line2);
      if (resolved.address.city) setCity(resolved.address.city);
      if (resolved.address.state) setState(resolved.address.state);
      if (resolved.address.zip) setZip(sanitizeZip(resolved.address.zip));
      return;
    }
    setLine1(suggestion.primaryText || suggestion.fullText);
    setManualMode(true);
    setSelectedPlaceId(null);
    setSelectedFormatted(null);
  };

  const canSave =
    Boolean(companyId && jobId) &&
    (Boolean(line1.trim()) || Boolean(selectedFormatted)) &&
    !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setError("Could not save address. Try again.");
        return;
      }
      const result = await changeJobPropertyViaRpc(supabase, {
        companyId,
        jobId,
        address: {
          line1: line1.trim() || selectedFormatted || null,
          line2: line2.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          zip: zip.trim() || null,
          formatted: selectedFormatted || null,
        },
        placesPlaceId: selectedPlaceId,
      });
      if (!result.ok) {
        setError(
          result.code === "forbidden"
            ? "That property is not available for this company."
            : result.code === "property_address_invalid"
              ? "Enter a complete street address."
              : "Address could not be updated. Try again."
        );
        return;
      }
      reset();
      await onSaved();
      onClose();
    } catch {
      setError("Address could not be updated. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="border-b border-slate-200/80 bg-slate-50/80 px-5 py-4 sm:px-6"
      data-jobcard-change-property-panel
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">Change property</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            Current: {currentAddressLabel || "No address"}
          </p>
        </div>
        <button
          type="button"
          className="text-xs font-medium text-slate-500 hover:text-slate-800"
          onClick={handleClose}
          data-jobcard-change-property-cancel
        >
          Cancel
        </button>
      </div>

      <div className="mt-3 space-y-3">
        <JobPacketAddressCombobox
          value={line1}
          suggestions={suggestions}
          status={status}
          manualMode={manualMode}
          selectedAddress={
            selectedPlaceId && selectedFormatted
              ? {
                  placeId: selectedPlaceId,
                  address: {
                    formatted: selectedFormatted,
                    line1,
                    line2: line2 || undefined,
                    city,
                    state,
                    zip,
                    country: "US",
                  },
                }
              : null
          }
          onValueChange={(v) => {
            setLine1(v);
            setSelectedPlaceId(null);
            setSelectedFormatted(null);
          }}
          onValueBlur={(v) => setLine1(v)}
          onSelect={onSelectSuggestion}
          onManual={() => {
            abandonSession();
            setManualMode(true);
            setSelectedPlaceId(null);
            setSelectedFormatted(null);
          }}
          onSearch={() => {
            abandonSession();
            setManualMode(false);
            setSelectedPlaceId(null);
            setSelectedFormatted(null);
          }}
          onChangeSelected={() => {
            abandonSession();
            setSelectedPlaceId(null);
            setSelectedFormatted(null);
            setManualMode(false);
          }}
          onClear={() => {
            abandonSession();
            setLine1("");
            setSelectedPlaceId(null);
            setSelectedFormatted(null);
          }}
        />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block text-xs text-slate-600">
            Unit / Apt / Suite
            <input
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              value={line2}
              onChange={(e) => setLine2(e.target.value)}
              placeholder="Optional"
              data-jobcard-change-property-line2
            />
          </label>
          <label className="block text-xs text-slate-600">
            City
            <input
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              data-jobcard-change-property-city
            />
          </label>
          <label className="block text-xs text-slate-600">
            State
            <input
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              value={state}
              onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
              data-jobcard-change-property-state
            />
          </label>
          <label className="block text-xs text-slate-600">
            ZIP
            <input
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              value={zip}
              onChange={(e) => setZip(sanitizeZip(e.target.value))}
              data-jobcard-change-property-zip
            />
          </label>
        </div>

        {error ? (
          <p className="text-xs text-red-600" data-jobcard-change-property-error>
            {error}
          </p>
        ) : null}

        <div className="flex justify-end">
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void save()}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            data-jobcard-change-property-save
          >
            {busy ? "Saving…" : "Save address"}
          </button>
        </div>
      </div>
    </div>
  );
}
