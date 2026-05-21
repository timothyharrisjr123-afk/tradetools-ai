"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/app/lib/supabaseClient";

type Customer = {
  id: string;
  company_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

type CustomerForm = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

const EMPTY_FORM: CustomerForm = {
  name: "",
  email: "",
  phone: "",
  address: "",
};

export default function CustomersAdminClient({ companyId }: { companyId: string }) {
  const supabase = getSupabaseClient();
  const [rows, setRows] = useState<Customer[]>([]);
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    if (!supabase) {
      return { rows: [] as Customer[], error: "Supabase client unavailable." };
    }
    const { data, error: fetchError } = await supabase
      .from("customers")
      .select("id, company_id, name, email, phone, address")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      return { rows: [] as Customer[], error: fetchError.message };
    }
    return { rows: (data ?? []) as Customer[], error: null };
  }, [supabase, companyId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await fetchCustomers();
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
  }, [fetchCustomers]);

  async function saveCustomer() {
    if (!supabase || saving || loading) return;

    const emailTrimmed = form.email.trim();
    const nameTrimmed = form.name.trim();

    if (!emailTrimmed) {
      setError("Email is required.");
      setMessage(null);
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    const { data: existing, error: lookupError } = await supabase
      .from("customers")
      .select("id")
      .eq("company_id", companyId)
      .eq("email", emailTrimmed)
      .maybeSingle();

    if (lookupError) {
      setError(lookupError.message);
      setSaving(false);
      return;
    }

    if (existing?.id) {
      setError("Customer already exists for this company.");
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from("customers").insert({
      company_id: companyId,
      name: nameTrimmed || null,
      email: emailTrimmed,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setForm(EMPTY_FORM);
    setMessage("Customer saved.");

    const result = await fetchCustomers();
    if (result.error) {
      setError(result.error);
      setRows([]);
    } else {
      setRows(result.rows);
    }
    setSaving(false);
  }

  async function deleteCustomer(id: string) {
    if (!supabase || saving || loading) return;

    setError(null);
    setMessage(null);

    const { error: deleteError } = await supabase
      .from("customers")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setRows((prev) => prev.filter((c) => c.id !== id));
    setMessage("Customer deleted.");
  }

  const disabled = loading || saving;

  return (
    <>
      <h1 className="text-xl font-semibold mb-4">Customers</h1>

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
        <h2 className="font-medium mb-2">Add Customer</h2>
        <div className="grid grid-cols-2 gap-3">
          <input
            placeholder="name"
            className="rounded bg-white/10 p-2 text-sm"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            disabled={disabled}
          />
          <input
            placeholder="email"
            type="email"
            className="rounded bg-white/10 p-2 text-sm"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            disabled={disabled}
          />
          <input
            placeholder="phone"
            className="rounded bg-white/10 p-2 text-sm"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            disabled={disabled}
          />
          <input
            placeholder="address"
            className="rounded bg-white/10 p-2 text-sm"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            disabled={disabled}
          />
        </div>
        <button
          type="button"
          onClick={() => void saveCustomer()}
          disabled={disabled}
          className="mt-3 rounded bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-white/60">Loading customers…</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left">
              <th className="py-2">Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Address</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-white/5">
                <td className="py-2">{c.name ?? "—"}</td>
                <td>{c.email ?? "—"}</td>
                <td>{c.phone ?? "—"}</td>
                <td>{c.address ?? "—"}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => void deleteCustomer(c.id)}
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
