"use client";

import { useCallback, useEffect, useState } from "react";
import AdminNavLinks from "@/app/admin/AdminNavLinks";
import { getSupabaseClient } from "@/app/lib/supabaseClient";

type Service = {
  id: string;
  company_id: string;
  name: string;
  category: string | null;
  unit_cost_cents: number | null;
  unit_price_cents: number | null;
  unit_label: string | null;
};

type ServiceForm = {
  name: string;
  category: string;
  unit_cost_dollars: string;
  unit_price_dollars: string;
  unit_label: string;
};

const EMPTY_FORM: ServiceForm = {
  name: "",
  category: "",
  unit_cost_dollars: "",
  unit_price_dollars: "",
  unit_label: "",
};

function parseDollarsToCents(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

export default function PriceBookAdminClient({ companyId }: { companyId: string }) {
  const supabase = getSupabaseClient();
  const [rows, setRows] = useState<Service[]>([]);
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    if (!supabase) {
      return { rows: [] as Service[], error: "Supabase client unavailable." };
    }
    const { data, error: fetchError } = await supabase
      .from("service_items")
      .select("id, company_id, name, category, unit_cost_cents, unit_price_cents, unit_label")
      .eq("company_id", companyId);

    if (fetchError) {
      return { rows: [] as Service[], error: fetchError.message };
    }
    return { rows: (data ?? []) as Service[], error: null };
  }, [supabase, companyId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await fetchServices();
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
        setRows([]);
      } else {
        setError(null);
        setRows(result.rows);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchServices]);

  async function saveService() {
    if (!supabase || saving || loading) return;

    const nameTrimmed = form.name.trim();
    if (!nameTrimmed) {
      setError("Name is required.");
      setMessage(null);
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    const unit_cost_cents = parseDollarsToCents(form.unit_cost_dollars);
    const unit_price_cents = parseDollarsToCents(form.unit_price_dollars);

    const { error: insertError } = await supabase.from("service_items").insert({
      company_id: companyId,
      name: nameTrimmed,
      category: form.category.trim() || null,
      unit_cost_cents,
      unit_price_cents,
      unit_label: form.unit_label.trim() || null,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setForm(EMPTY_FORM);
    setMessage("Service saved.");

    const result = await fetchServices();
    if (result.error) {
      setError(result.error);
      setRows([]);
    } else {
      setRows(result.rows);
    }
    setSaving(false);
  }

  async function deleteService(id: string) {
    if (!supabase || saving || loading) return;

    setError(null);
    setMessage(null);

    const { error: deleteError } = await supabase
      .from("service_items")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setRows((prev) => prev.filter((s) => s.id !== id));
    setMessage("Service deleted.");
  }

  const disabled = loading || saving;

  return (
    <>
      <AdminNavLinks current="price-book" />
      <h1 className="text-xl font-semibold mb-4">Price Book</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
          {message}
        </div>
      )}

      <div className="bg-white/5 rounded-lg p-4 mb-6">
        <h2 className="font-medium mb-2">Add Service</h2>
        <p className="mb-3 text-xs text-white/60">
          Amounts are entered in dollars and saved as cents. Example: 150.00 = $150.00 per square.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-white/80">Name</span>
            <input
              placeholder="Architectural Shingles"
              className="w-full rounded bg-white/10 p-2 text-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={disabled}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-white/80">Category</span>
            <input
              placeholder="Roofing"
              className="w-full rounded bg-white/10 p-2 text-sm"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              disabled={disabled}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-white/80">Unit label</span>
            <input
              placeholder="square"
              className="w-full rounded bg-white/10 p-2 text-sm"
              value={form.unit_label}
              onChange={(e) => setForm({ ...form, unit_label: e.target.value })}
              disabled={disabled}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-white/80">Unit cost (USD)</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="150.00"
              className="w-full rounded bg-white/10 p-2 text-sm"
              value={form.unit_cost_dollars}
              onChange={(e) => setForm({ ...form, unit_cost_dollars: e.target.value })}
              disabled={disabled}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-white/80">Unit price (USD)</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="250.00"
              className="w-full rounded bg-white/10 p-2 text-sm"
              value={form.unit_price_dollars}
              onChange={(e) => setForm({ ...form, unit_price_dollars: e.target.value })}
              disabled={disabled}
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void saveService()}
          disabled={disabled}
          className="mt-3 rounded bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-white/60">Loading services…</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left">
              <th className="py-2">Name</th>
              <th>Category</th>
              <th>Unit Cost ($)</th>
              <th>Unit Price ($)</th>
              <th>Unit Label</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-white/5">
                <td className="py-2">{s.name}</td>
                <td>{s.category ?? "—"}</td>
                <td>${((s.unit_cost_cents || 0) / 100).toFixed(2)}</td>
                <td>${((s.unit_price_cents || 0) / 100).toFixed(2)}</td>
                <td>{s.unit_label ?? "—"}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => void deleteService(s.id)}
                    disabled={disabled}
                    className="text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
