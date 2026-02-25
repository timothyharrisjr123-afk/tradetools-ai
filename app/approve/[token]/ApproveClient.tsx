"use client";

import React, { useEffect, useMemo, useState } from "react";

type Found = {
  key: string;
  index: number;
  estimate: any;
  list: any[];
};

function safeJsonParse(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Pull token from different possible shapes
function extractToken(obj: any): string {
  if (!obj) return "";

  const direct = obj.approvalToken;
  if (typeof direct === "string") return direct.trim();

  const meta = obj.meta?.approvalToken;
  if (typeof meta === "string") return meta.trim();

  const approval = obj.approval?.token;
  if (typeof approval === "string") return approval.trim();

  const nested = obj.sent?.approvalToken;
  if (typeof nested === "string") return nested.trim();

  // If an approvalUrl exists, extract last path segment
  const url = obj.approvalUrl || obj.meta?.approvalUrl || obj.sent?.approvalUrl;
  if (typeof url === "string") {
    const m = url.trim().match(/\/approve\/([^/?#]+)/i);
    if (m?.[1]) return String(m[1]).trim();
  }

  return "";
}

function findEstimateByToken(token: string): Found | null {
  if (typeof window === "undefined") return null;
  const t = String(token || "").trim();
  if (!t) return null;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    const parsed = safeJsonParse(localStorage.getItem(key));
    if (!Array.isArray(parsed)) continue;

    const idx = parsed.findIndex((e: any) => extractToken(e) === t);
    if (idx >= 0) return { key, index: idx, estimate: parsed[idx], list: parsed };
  }

  return null;
}

function patchFound(found: Found, patch: any) {
  const updated = [...found.list];
  updated[found.index] = { ...updated[found.index], ...patch };
  try {
    localStorage.setItem(found.key, JSON.stringify(updated));
  } catch {}
}

type DebugInfo = {
  urlToken: string;
  storageKeyCount: number;
  keys: string[];
  arraysScanned: number;
  itemsScanned: number;
  tokensFoundSample: string[];
  matchFound: boolean;
  matchKey?: string | null;
  matchStatus?: string | null;
};

function buildDebug(token: string): DebugInfo {
  const urlToken = String(token || "").trim();

  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) keys.push(k);
  }

  let arraysScanned = 0;
  let itemsScanned = 0;
  const tokensFound: string[] = [];

  for (const k of keys) {
    const parsed = safeJsonParse(localStorage.getItem(k));
    if (!Array.isArray(parsed)) continue;

    arraysScanned++;
    for (const item of parsed) {
      itemsScanned++;
      const tok = extractToken(item);
      if (tok) tokensFound.push(tok);
    }
  }

  // sample first 12 unique tokens for display
  const unique = Array.from(new Set(tokensFound)).slice(0, 12);

  const found = findEstimateByToken(urlToken);

  return {
    urlToken,
    storageKeyCount: keys.length,
    keys,
    arraysScanned,
    itemsScanned,
    tokensFoundSample: unique,
    matchFound: !!found,
    matchKey: found?.key ?? null,
    matchStatus: found?.estimate?.status ?? null,
  };
}

export default function ApproveClient({ token }: { token: string }) {
  const [found, setFound] = useState<Found | null>(null);
  const [approved, setApproved] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debug, setDebug] = useState<DebugInfo | null>(null);

  useEffect(() => {
    const f = findEstimateByToken(token);
    setFound(f);
    setApproved(false);
    setDebug(buildDebug(token));
  }, [token]);

  const canApprove = useMemo(() => !!found, [found]);

  function onApprove() {
    if (!found) return;
    patchFound(found, { status: "approved", approvedAt: new Date().toISOString() });
    setApproved(true);
    // refresh debug snapshot so we can confirm patch hit the right storage key
    setDebug(buildDebug(token));
  }

  // --- INVALID UI (still shown if not found) ---
  if (!canApprove) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-white/80">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
            This approval link is invalid or expired.
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-white/60">If this is wrong, use Debug to diagnose.</div>
            <button
              onClick={() => setShowDebug((v) => !v)}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/80 hover:bg-white/[0.06]"
            >
              {showDebug ? "Hide Debug" : "Show Debug"}
            </button>
          </div>

          {showDebug && debug && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-[12px] text-white/70">
              <div className="font-semibold text-white/85 mb-2">Approve Debug</div>

              <div><span className="text-white/50">URL token:</span> <span className="break-all">{debug.urlToken}</span></div>
              <div className="mt-1"><span className="text-white/50">localStorage keys:</span> {debug.storageKeyCount}</div>
              <div className="mt-1"><span className="text-white/50">arrays scanned:</span> {debug.arraysScanned}</div>
              <div className="mt-1"><span className="text-white/50">items scanned:</span> {debug.itemsScanned}</div>
              <div className="mt-2"><span className="text-white/50">tokens found (sample):</span></div>
              <div className="mt-1 break-all">
                {debug.tokensFoundSample.length ? debug.tokensFoundSample.join(", ") : "(none found in any arrays)"}
              </div>
              <div className="mt-2"><span className="text-white/50">matchFound:</span> {String(debug.matchFound)}</div>
              <div className="mt-1"><span className="text-white/50">matchKey:</span> {String(debug.matchKey)}</div>

              <div className="mt-3 text-white/50">Keys list:</div>
              <div className="mt-1 break-all">{debug.keys.join(", ") || "(none)"}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- VALID UI ---
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-white">
        <div className="text-lg font-semibold">Approve Estimate</div>

        <div className="mt-2 text-sm text-white/70">
          {found?.estimate?.customerName ? `Customer: ${found.estimate.customerName}` : "Customer loaded."}
        </div>

        <div className="mt-1 text-sm text-white/60">
          Status: <span className="text-white/80">{String(found?.estimate?.status || "")}</span>
        </div>

        {approved ? (
          <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-emerald-200">
            Approved ✅
          </div>
        ) : (
          <button
            onClick={onApprove}
            className="mt-5 w-full rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-black hover:bg-emerald-400 active:bg-emerald-600"
          >
            Approve Now
          </button>
        )}

        <div className="mt-5 flex items-center justify-between">
          <div className="text-[12px] text-white/40">Found in: {found?.key}</div>
          <button
            onClick={() => setShowDebug((v) => !v)}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/80 hover:bg-white/[0.06]"
          >
            {showDebug ? "Hide Debug" : "Show Debug"}
          </button>
        </div>

        {showDebug && debug && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-[12px] text-white/70">
            <div className="font-semibold text-white/85 mb-2">Approve Debug</div>
            <div><span className="text-white/50">URL token:</span> <span className="break-all">{debug.urlToken}</span></div>
            <div className="mt-1"><span className="text-white/50">matchKey:</span> {String(debug.matchKey)}</div>
            <div className="mt-1"><span className="text-white/50">matchStatus:</span> {String(debug.matchStatus)}</div>
            <div className="mt-2"><span className="text-white/50">tokens sample:</span> {debug.tokensFoundSample.join(", ")}</div>
          </div>
        )}
      </div>
    </div>
  );
}
