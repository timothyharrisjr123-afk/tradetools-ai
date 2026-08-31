"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Phone } from "lucide-react";
import FieldDiveWorkspaceShell, {
  WorkspaceEmpty,
  WorkspaceLinkRow,
  WorkspaceSection,
} from "@/app/tools/roofing/workspace/FieldDiveWorkspaceShell";

type WorkspaceJob = {
  id: string;
  primary: string;
  address: string;
  stageLabel: string;
  href: string;
  propertyId?: string | null;
};

type WorkspaceProperty = {
  id: string;
  primary: string;
  secondary: string | null;
  href: string;
  jobCount?: number;
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
  const [editing, setEditing] = useState(false);
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
      setEditing(false);
      setSaveState("idle");
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const beginEdit = () => {
    if (!customer) return;
    setName(customer.name ?? "");
    setEmail(customer.email ?? "");
    setPhone(customer.phone ?? "");
    setSaveState("idle");
    setEditing(true);
  };

  const cancelEdit = () => {
    if (!customer) return;
    setName(customer.name ?? "");
    setEmail(customer.email ?? "");
    setPhone(customer.phone ?? "");
    setSaveState("idle");
    setEditing(false);
  };

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
      setEditing(false);
      window.setTimeout(() => setSaveState("idle"), 1800);
    } catch {
      setSaveState("error");
    }
  };

  const phoneValue = (customer?.phone ?? "").trim();
  const emailValue = (customer?.email ?? "").trim();

  const propertyRows = properties.map((property) => {
    const count =
      typeof property.jobCount === "number"
        ? property.jobCount
        : jobs.filter((job) => job.propertyId === property.id).length;
    const countLabel =
      count > 0 ? `${count} job${count === 1 ? "" : "s"}` : null;
    const secondary = [property.secondary, countLabel].filter(Boolean).join(" · ") || null;
    return { ...property, secondary };
  });

  return (
    <FieldDiveWorkspaceShell
      eyebrow="Customer"
      title={customer?.name || "Customer"}
      status={status}
      loadingLabel="Loading customer…"
      errorLabel="Could not load this customer."
      meta={
        customer && !editing && (phoneValue || emailValue) ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
            {phoneValue ? (
              <span className="inline-flex items-center gap-1.5 text-slate-700">
                <Phone className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} aria-hidden />
                {phoneValue}
              </span>
            ) : null}
            {emailValue ? (
              <span className="inline-flex min-w-0 items-center gap-1.5 text-slate-700">
                <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} aria-hidden />
                <span className="truncate">{emailValue}</span>
              </span>
            ) : null}
          </div>
        ) : null
      }
      actions={
        customer && !editing ? (
          <button
            type="button"
            onClick={beginEdit}
            className="text-sm font-medium text-sky-700 underline-offset-2 hover:underline"
            data-testid="customer-edit-action"
          >
            Edit customer
          </button>
        ) : null
      }
    >
      {customer ? (
        <>
          {editing ? (
            <section className="max-w-md space-y-2" data-testid="customer-edit-form">
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaveState("idle");
                }}
                placeholder="Customer name"
                aria-label="Customer name"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
              />
              <input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSaveState("idle");
                }}
                placeholder="Email"
                aria-label="Email"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
              />
              <input
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setSaveState("idle");
                }}
                placeholder="Phone"
                aria-label="Phone"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
              />
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => void saveIdentity()}
                  className="h-9 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="h-9 rounded-lg px-2 text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <span className="text-xs text-slate-500">
                  {saveState === "saving"
                    ? "Saving…"
                    : saveState === "error"
                      ? "Could not save"
                      : ""}
                </span>
              </div>
            </section>
          ) : saveState === "saved" ? (
            <p className="text-xs text-slate-500" data-testid="customer-saved-hint">
              Saved
            </p>
          ) : null}

          <WorkspaceSection title="Jobs">
            {jobs.length === 0 ? (
              <WorkspaceEmpty>No jobs yet.</WorkspaceEmpty>
            ) : (
              <div className="border-b border-slate-100">
                {jobs.map((job) => (
                  <WorkspaceLinkRow
                    key={job.id}
                    href={job.href}
                    primary={job.primary}
                    secondary={[job.address, job.stageLabel].filter(Boolean).join(" · ")}
                  />
                ))}
              </div>
            )}
          </WorkspaceSection>

          <WorkspaceSection title="Properties">
            {propertyRows.length === 0 ? (
              <WorkspaceEmpty>No properties yet.</WorkspaceEmpty>
            ) : (
              <div className="border-b border-slate-100">
                {propertyRows.map((property) => (
                  <WorkspaceLinkRow
                    key={property.id}
                    href={property.href}
                    primary={property.primary}
                    secondary={property.secondary}
                  />
                ))}
              </div>
            )}
          </WorkspaceSection>
        </>
      ) : null}
    </FieldDiveWorkspaceShell>
  );
}
