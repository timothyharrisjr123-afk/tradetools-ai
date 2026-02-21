"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";

const STORAGE_KEY_ESTIMATES = "roofing_estimates";
const STORAGE_KEY_LAST_LOADED = "roofing_last_loaded";

type RoofingEstimate = {
  id: string;
  savedAt: number;
  area: string;
  waste: string;
  bundlesPerSquare: string;
  bundleCost: string;
  laborPerSquare: string;
  margin: string;
  squares: number;
  adjustedSquares: number;
  bundles: number;
  materialsCost: number;
  laborCost: number;
  subtotal: number;
  suggestedPrice: number;
};

function getStoredEstimates(): RoofingEstimate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ESTIMATES);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RoofingEstimate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ts));
}

export default function Page() {
  const router = useRouter();
  const [estimates, setEstimates] = useState<RoofingEstimate[]>([]);

  const load = useCallback(() => {
    setEstimates(getStoredEstimates().sort((a, b) => b.savedAt - a.savedAt));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleLoad = useCallback(
    (e: RoofingEstimate) => {
      if (typeof window === "undefined") return;
      localStorage.setItem(STORAGE_KEY_LAST_LOADED, JSON.stringify(e));
      router.push("/tools/roofing");
    },
    [router]
  );

  const handleDelete = useCallback((id: string) => {
    const list = getStoredEstimates().filter((x) => x.id !== id);
    localStorage.setItem(STORAGE_KEY_ESTIMATES, JSON.stringify(list));
    setEstimates(list.sort((a, b) => b.savedAt - a.savedAt));
  }, []);

  return (
    <main
      className="min-h-screen relative p-4 sm:p-6 lg:p-12 pb-20"
      style={{
        backgroundImage: `
          linear-gradient(180deg, #243347 0%, #1c2838 28%, #17202f 55%, #131c2a 82%, #121826 100%),
          repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(255,255,255,0.005) 2px, rgba(255,255,255,0.005) 3px),
          repeating-linear-gradient(90deg, transparent 0px, transparent 2px, rgba(255,255,255,0.005) 2px, rgba(255,255,255,0.005) 3px)
        `,
        backgroundSize: "100% 100%, 64px 64px, 64px 64px",
        backgroundColor: "#131c2a",
      }}
    >
      <div className="relative mx-auto max-w-3xl">
        <Link
          href="/tools/roofing"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Calculator
        </Link>

        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white/95">
            Estimate History
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Saved roofing estimates. Load one to restore it in the calculator.
          </p>
        </header>

        {estimates.length === 0 ? (
          <div className="rounded-3xl border border-white/[0.14] bg-white/[0.08] backdrop-blur-2xl p-8 sm:p-12 text-center shadow-[0_4px_24px_-4px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.06)]">
            <p className="text-slate-400">No saved estimates yet.</p>
            <Link
              href="/tools/roofing"
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-blue-500/50 bg-blue-500/20 px-5 py-2.5 text-sm font-semibold text-blue-200 hover:bg-blue-500/30 transition-colors"
            >
              Open Calculator
            </Link>
          </div>
        ) : (
          <ul className="space-y-4" role="list">
            {estimates.map((e) => (
              <li
                key={e.id}
                className="rounded-3xl border border-white/[0.14] bg-white/[0.08] backdrop-blur-2xl p-5 sm:p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.06)]"
              >
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
                  {formatDate(e.savedAt)}
                </p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
                  <dt className="text-slate-500">Roof area</dt>
                  <dd className="font-medium tabular-nums text-slate-200">{e.area} sq ft</dd>
                  <dt className="text-slate-500">Adjusted squares</dt>
                  <dd className="font-medium tabular-nums text-slate-200">{e.adjustedSquares.toFixed(2)}</dd>
                  <dt className="text-slate-500">Bundles</dt>
                  <dd className="font-medium tabular-nums text-slate-200">{e.bundles.toFixed(1)}</dd>
                  <dt className="text-slate-500">Subtotal</dt>
                  <dd className="font-medium tabular-nums text-slate-200">{formatCurrency(e.subtotal)}</dd>
                  <dt className="text-slate-500">Suggested price</dt>
                  <dd className="font-semibold tabular-nums text-white/95">{formatCurrency(e.suggestedPrice)}</dd>
                </dl>
                <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => handleLoad(e)}
                    className="inline-flex items-center gap-2 rounded-full border border-blue-500/50 bg-blue-500/20 px-4 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-500/30 transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Load
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(e.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-300 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
