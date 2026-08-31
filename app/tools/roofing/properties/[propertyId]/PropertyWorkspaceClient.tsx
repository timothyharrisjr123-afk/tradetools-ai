"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";

type WorkspaceJob = {
  id: string;
  primary: string;
  customerName: string | null;
  customerId: string | null;
  stageLabel: string;
  href: string;
};

type WorkspaceCustomer = {
  id: string;
  name: string;
  href: string;
};

type PropertyPayload = {
  id: string;
  line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  formatted: string;
};

export default function PropertyWorkspaceClient({ propertyId }: { propertyId: string }) {
  const [property, setProperty] = useState<PropertyPayload | null>(null);
  const [jobs, setJobs] = useState<WorkspaceJob[]>([]);
  const [customers, setCustomers] = useState<WorkspaceCustomer[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || !json.property) {
        setStatus("error");
        return;
      }
      setProperty(json.property);
      setJobs(Array.isArray(json.jobs) ? json.jobs : []);
      setCustomers(Array.isArray(json.customers) ? json.customers : []);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

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
          <p className="mt-8 text-sm text-slate-500">Loading property…</p>
        ) : null}
        {status === "error" ? (
          <p className="mt-8 text-sm text-slate-600">Could not load this property.</p>
        ) : null}

        {status === "ready" && property ? (
          <div className="mt-5 space-y-8">
            <header>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Property
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                {property.line1 || property.formatted}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {[property.city, property.state, property.zip].filter(Boolean).join(", ")}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Place identity. Job work, files, and measurements stay on each Job.
              </p>
            </header>

            <section>
              <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Seen with
              </h2>
              {customers.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  No customer linked through jobs yet.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
                  {customers.map((customer) => (
                    <li key={customer.id}>
                      <Link href={customer.href} className="block py-3 text-sm font-medium text-slate-900 hover:bg-slate-50">
                        {customer.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Jobs here
              </h2>
              {jobs.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No jobs at this property yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
                  {jobs.map((job) => (
                    <li key={job.id}>
                      <Link href={job.href} className="block py-3 hover:bg-slate-50">
                        <span className="block text-sm font-medium text-slate-900">{job.primary}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {[job.customerName, job.stageLabel].filter(Boolean).join(" · ")}
                        </span>
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
