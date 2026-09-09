"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

export type PlacesResolvedSelection = {
  placeId: string;
  address: PlacesResolvedAddress;
};

export type PlacesAssistStatus = "idle" | "loading" | "ready" | "unavailable";

export const PLACES_DEBOUNCE_MS = 280;
export const PLACES_MIN_QUERY_LENGTH = 3;
export const PLACES_SESSION_IDLE_MS = 3 * 60 * 1_000;

export function placesQueryIsEligible(value: string): boolean {
  return value.trim().length >= PLACES_MIN_QUERY_LENGTH;
}

export function movePlacesActiveIndex(
  current: number,
  optionCount: number,
  key: "ArrowDown" | "ArrowUp" | "Home" | "End"
): number {
  if (optionCount <= 0) return -1;
  if (key === "Home") return 0;
  if (key === "End") return optionCount - 1;
  if (key === "ArrowDown") return current < 0 ? 0 : (current + 1) % optionCount;
  return current < 0 ? optionCount - 1 : (current - 1 + optionCount) % optionCount;
}

function newPlacesSessionToken(): string {
  return crypto.randomUUID();
}

function localityKey(locality?: PlacesLocalityBias | null): string {
  if (!locality) return "";
  return [
    String(locality.city ?? "").trim().toLowerCase(),
    String(locality.state ?? "").trim().toLowerCase(),
    String(locality.zip ?? "").trim(),
  ].join("|");
}

/** Client lifecycle for one Autocomplete (New) -> Details (New) session. */
export function usePlacesAddressAssist(
  streetQuery: string,
  enabled: boolean,
  locality?: PlacesLocalityBias | null
) {
  const [debounced, setDebounced] = useState(streetQuery);
  const [suggestions, setSuggestions] = useState<PlacesSuggestion[]>([]);
  const [status, setStatus] = useState<PlacesAssistStatus>("idle");
  const sessionTokenRef = useRef<string | null>(null);
  const sessionIdleTimerRef = useRef<number | null>(null);
  const requestSequenceRef = useRef(0);
  const localityRef = useRef(locality);
  localityRef.current = locality;
  const localityFingerprint = localityKey(locality);

  const clearSessionTimer = useCallback(() => {
    if (sessionIdleTimerRef.current != null) {
      window.clearTimeout(sessionIdleTimerRef.current);
      sessionIdleTimerRef.current = null;
    }
  }, []);

  const abandonSession = useCallback(() => {
    requestSequenceRef.current += 1;
    sessionTokenRef.current = null;
    clearSessionTimer();
    setSuggestions([]);
    setStatus("idle");
  }, [clearSessionTimer]);

  const touchSession = useCallback(() => {
    clearSessionTimer();
    sessionIdleTimerRef.current = window.setTimeout(() => {
      sessionTokenRef.current = null;
      sessionIdleTimerRef.current = null;
      requestSequenceRef.current += 1;
      setSuggestions([]);
      setStatus("idle");
    }, PLACES_SESSION_IDLE_MS);
  }, [clearSessionTimer]);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(streetQuery), PLACES_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [streetQuery]);

  useEffect(() => {
    if (streetQuery.trim().length === 0) abandonSession();
  }, [abandonSession, streetQuery]);

  const active = enabled && placesQueryIsEligible(debounced);

  useEffect(() => {
    if (!enabled) {
      abandonSession();
      return;
    }
    if (!active) {
      setSuggestions([]);
      setStatus("idle");
      return;
    }

    if (!sessionTokenRef.current) sessionTokenRef.current = newPlacesSessionToken();
    touchSession();
    const controller = new AbortController();
    const requestSequence = ++requestSequenceRef.current;
    setStatus("loading");
    const params = new URLSearchParams({ q: debounced.trim() });
    params.set("sessionToken", sessionTokenRef.current);
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
        if (controller.signal.aborted || requestSequence !== requestSequenceRef.current) return;
        if (!res.ok || !json?.ok || json.available === false) {
          setStatus("unavailable");
          return;
        }
        const raw = Array.isArray(json.suggestions) ? json.suggestions.slice(0, 5) : [];
        setSuggestions(rankPlacesSuggestionsByLocality(raw, localityRef.current));
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || requestSequence !== requestSequenceRef.current) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("unavailable");
      });

    return () => controller.abort();
  }, [abandonSession, active, debounced, enabled, localityFingerprint, touchSession]);

  useEffect(() => () => {
    requestSequenceRef.current += 1;
    sessionTokenRef.current = null;
    if (sessionIdleTimerRef.current != null) window.clearTimeout(sessionIdleTimerRef.current);
  }, []);

  const resolvePlace = useCallback(async (placeId: string): Promise<PlacesResolvedSelection | null> => {
    const token = sessionTokenRef.current;
    if (!token) return null;
    clearSessionTimer();
    try {
      const params = new URLSearchParams({ placeId, sessionToken: token });
      const res = await fetch(`/api/places/details?${params.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || !json.address) return null;
      return { placeId, address: json.address as PlacesResolvedAddress };
    } catch {
      return null;
    } finally {
      sessionTokenRef.current = null;
      requestSequenceRef.current += 1;
      setSuggestions([]);
      setStatus("idle");
    }
  }, [clearSessionTimer]);

  return { suggestions, status, resolvePlace, abandonSession };
}
