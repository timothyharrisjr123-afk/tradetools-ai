"use client";

import { useEffect, useRef, useState } from "react";
import {
  rankPlacesSuggestionsByLocality,
  type PlacesLocalityBias,
} from "@/app/lib/placesLocalityBias";

export type PlacesSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  fullText: string;
};

export type PlacesResolvedAddress = {
  formatted: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

const DEBOUNCE_MS = 280;

function newPlacesSessionToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `places-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function localityKey(locality?: PlacesLocalityBias | null): string {
  if (!locality) return "";
  return [
    String(locality.city ?? "").trim().toLowerCase(),
    String(locality.state ?? "").trim().toLowerCase(),
    String(locality.zip ?? "").trim(),
  ].join("|");
}

/**
 * Quiet Places assist. When unavailable, stays idle — manual address continues.
 * One sessionToken covers autocomplete typing → Place Details selection (Places New billing).
 * Optional locality (city/state/ZIP) biases ranking when already entered on New Job.
 */
export function usePlacesAddressAssist(
  streetQuery: string,
  enabled: boolean,
  locality?: PlacesLocalityBias | null
) {
  const [debounced, setDebounced] = useState(streetQuery);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [suggestions, setSuggestions] = useState<PlacesSuggestion[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const sessionTokenRef = useRef<string | null>(null);
  const localityRef = useRef(locality);
  localityRef.current = locality;
  const localityFingerprint = localityKey(locality);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(streetQuery), DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [streetQuery]);

  const active = enabled && debounced.trim().length >= 3;

  useEffect(() => {
    if (!active) {
      setSuggestions([]);
      setStatus("idle");
      return;
    }

    if (!sessionTokenRef.current) {
      sessionTokenRef.current = newPlacesSessionToken();
    }

    const controller = new AbortController();
    setStatus("loading");

    const token = sessionTokenRef.current;
    const params = new URLSearchParams({ q: debounced.trim() });
    if (token) params.set("sessionToken", token);
    const city = String(localityRef.current?.city ?? "").trim();
    const state = String(localityRef.current?.state ?? "").trim();
    const zip = String(localityRef.current?.zip ?? "").trim();
    if (city) params.set("city", city);
    if (state) params.set("state", state);
    if (zip) params.set("zip", zip);

    void fetch(`/api/places/autocomplete?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!res.ok || !json?.ok) {
          setSuggestions([]);
          setStatus("error");
          return;
        }
        setAvailable(Boolean(json.available));
        const raw = Array.isArray(json.suggestions) ? json.suggestions : [];
        setSuggestions(rankPlacesSuggestionsByLocality(raw, localityRef.current));
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSuggestions([]);
        setStatus("error");
      });

    return () => controller.abort();
  }, [active, debounced, localityFingerprint]);

  async function resolvePlace(placeId: string): Promise<PlacesResolvedAddress | null> {
    try {
      const params = new URLSearchParams({ placeId });
      const token = sessionTokenRef.current;
      if (token) params.set("sessionToken", token);
      const res = await fetch(`/api/places/details?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      // End session after details (success or fail) so the next typing starts fresh.
      sessionTokenRef.current = null;
      if (!res.ok || !json?.ok || !json.address) return null;
      return json.address as PlacesResolvedAddress;
    } catch {
      sessionTokenRef.current = null;
      return null;
    }
  }

  return {
    available,
    suggestions: available === false ? [] : suggestions,
    status: available === false ? "idle" : status,
    resolvePlace,
  };
}
