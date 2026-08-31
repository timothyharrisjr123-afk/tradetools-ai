"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";

type WorkspaceJob = {
  id: string;
  primary: string;
  address: string;
  stageLabel: string;
  href: string;
};

type WorkspaceProperty = {
  id: string;
  primary: string;
  secondary: string | null;
  href: string;
};

type CustomerPayload = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export default function CustomerWorkspaceClient({ customerId }: { customerId: string }) {
  const [customer, setCustomer] = useState<CustomerPayload | null>(null);
  const [jobs, setJobs] = useState<WorkspaceJob[]>([]);
  const [properties, setProperties] = useState<WorkspaceProperty[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || !json.customer) {
        setStatus("error");
        return;
      }
      setCustomer(json.customer);
      setName(json.customer.name ?? "");
      setEmail(json.customer.email ?? "");
      setPhone(json.customer.phone ?? "");
      setJobs(Array.isArray(json.jobs) ? json.jobs : []);
      setProperties(Array.isArray(json.properties) ? json.properties : []);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveIdentity = async () => {
    if (!name.trim() || saveState === "saving") return;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setSaveState("error");
        return;
      }
      setCustomer((prev) =>
        prev
          ? {
              ...prev,
              name: json.customer.name,
              email: json.customer.email,
              phone: json.customer.phone,
            }
          : prev
      );
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1800);
    } catch {
      setSaveState("error");
    }
  };

  return (
    <FieldDiveAppShell activeNav="jobs">
      <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-4 sm:px-6">
        <Link
          href="/tools/roofing/saved"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-800"
        >
          ← Back to Jobs
        </Link>

        {status === "loading" ? (
          <p className="mt-8 text-sm text-slate-500">Loading customer…</p>
        ) : null}
        {status === "error" ? (
          <p className="mt-8 text-sm text-slate-600">Could not load this customer.</p>
        ) : null}

        {status === "ready" && customer ? (
          <div className="mt-5 space-y-8">
            <header>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Customer
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                {customer.name || "Customer"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Live identity. Job snapshots and sent proposals stay unchanged.
              </p>
            </header>

            <section className="space-y-2">
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaveState("idle");
                }}
                placeholder="Customer name"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
              />
              <input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSaveState("idle");
                }}
                placeholder="Email"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
              />
              <input
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setSaveState("idle");
                }}
                placeholder="Phone"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void saveIdentity()}
                  className="h-9 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Save identity
                </button>
                <span className="text-xs text-slate-500">
                  {saveState === "saving"
                    ? "Saving…"
                    : saveState === "saved"
                      ? "Saved"
                      : saveState === "error"
                        ? "Could not save"
                        : ""}
                </span>
              </div>
            </section>

            <section>
              <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Jobs
              </h2>
              {jobs.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No jobs linked yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
                  {jobs.map((job) => (
                    <li key={job.id}>
                      <Link
                        href={job.href}
                        className="block py-3 hover:bg-slate-50"
                      >
                        <span className="block text-sm font-medium text-slate-900">{job.primary}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {[job.address, job.stageLabel].filter(Boolean).join(" · ")}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Properties
              </h2>
              {properties.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  No properties from this customer’s jobs yet.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
                  {properties.map((property) => (
                    <li key={property.id}>
                      <Link href={property.href} className="block py-3 hover:bg-slate-50">
                        <span className="block text-sm font-medium text-slate-900">
                          {property.primary}
                        </span>
                        {property.secondary ? (
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {property.secondary}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </FieldDiveAppShell>
  );
}
