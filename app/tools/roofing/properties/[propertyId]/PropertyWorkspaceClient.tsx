"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import FieldDiveWorkspaceShell, {
  WorkspaceEmpty,
  WorkspaceLinkRow,
  WorkspaceSection,
} from "@/app/tools/roofing/workspace/FieldDiveWorkspaceShell";

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
  email?: string | null;
  phone?: string | null;
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

  const locality = property
    ? [property.city, property.state, property.zip].filter(Boolean).join(", ")
    : "";

  return (
    <FieldDiveWorkspaceShell
      eyebrow="Property"
      title={property?.line1 || property?.formatted || "Property"}
      status={status}
      loadingLabel="Loading property…"
      errorLabel="Could not load this property."
      meta={
        property && locality ? (
          <div className="flex min-w-0 items-start gap-1.5 text-sm text-slate-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} aria-hidden />
            <span className="truncate">{locality}</span>
          </div>
        ) : null
      }
    >
      {property ? (
        <>
          <WorkspaceSection title="Customers">
            {customers.length === 0 ? (
              <WorkspaceEmpty>No customers linked through jobs yet.</WorkspaceEmpty>
            ) : (
              <div className="border-b border-slate-100">
                {customers.map((customer) => {
                  const contact = [customer.phone, customer.email]
                    .map((value) => String(value ?? "").trim())
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <WorkspaceLinkRow
                      key={customer.id}
                      href={customer.href}
                      primary={customer.name}
                      secondary={contact || null}
                    />
                  );
                })}
              </div>
            )}
          </WorkspaceSection>

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
                    secondary={[job.customerName, job.stageLabel].filter(Boolean).join(" · ")}
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
