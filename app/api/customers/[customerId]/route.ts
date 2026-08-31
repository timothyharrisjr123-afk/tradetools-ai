import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { buildDbJobCardHref } from "@/app/lib/jobBoardAdapter";
import { resolveCanonicalJobStageLabel } from "@/app/lib/jobLifecycleMapper";
import type { JobStage } from "@/app/lib/jobTypes";
import {
  buildPropertyWorkspaceHref,
  formatPropertyDisplayAddress,
} from "@/app/lib/propertyAddressNormalize";
import { createClient } from "@/app/lib/supabase/server";
import { isUuidLike } from "@/app/lib/uuid";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 });
}

function notFound() {
  return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ customerId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const companyId = await getUserCompanyId(supabase, user.id);
  if (!companyId) return forbidden();

  const { customerId } = await context.params;
  if (!isUuidLike(customerId)) return notFound();

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, company_id, name, email, phone, address, created_at")
    .eq("id", customerId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (customerError || !customer) return notFound();

  const { data: jobs } = await supabase
    .from("jobs")
    .select(
      "id, job_name, customer_name, stage, address_line1, address_city, address_state, address_zip, address_formatted, property_id, updated_at"
    )
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(40);

  const jobRows = Array.isArray(jobs) ? jobs : [];
  const propertyIds = [
    ...new Set(
      jobRows
        .map((job) => String(job.property_id ?? "").trim())
        .filter((id) => isUuidLike(id))
    ),
  ];

  const propertiesById = new Map<
    string,
    { id: string; line1: string | null; formatted: string | null; city: string | null; state: string | null; zip: string | null }
  >();
  if (propertyIds.length > 0) {
    const { data: properties } = await supabase
      .from("properties")
      .select("id, address_line1, address_city, address_state, address_zip, address_formatted")
      .eq("company_id", companyId)
      .in("id", propertyIds);
    for (const row of Array.isArray(properties) ? properties : []) {
      propertiesById.set(String(row.id), {
        id: String(row.id),
        line1: row.address_line1 ?? null,
        formatted: row.address_formatted ?? null,
        city: row.address_city ?? null,
        state: row.address_state ?? null,
        zip: row.address_zip ?? null,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    customer: {
      id: customer.id,
      name: customer.name ?? "",
      email: customer.email ?? null,
      phone: customer.phone ?? null,
      address: customer.address ?? null,
    },
    jobs: jobRows.map((job) => ({
      id: job.id,
      primary: String(job.job_name || job.customer_name || "Job").trim(),
      address:
        String(job.address_formatted || "").trim() ||
        formatPropertyDisplayAddress({
          line1: job.address_line1,
          city: job.address_city,
          state: job.address_state,
          zip: job.address_zip,
        }),
      stage: job.stage,
      stageLabel: resolveCanonicalJobStageLabel({ stage: job.stage as JobStage }),
      href: buildDbJobCardHref(String(job.id)),
      propertyId: job.property_id ?? null,
    })),
    properties: [...propertiesById.values()].map((property) => {
      const jobCount = jobRows.filter((job) => String(job.property_id ?? "") === property.id)
        .length;
      return {
        id: property.id,
        primary:
          property.line1 ||
          formatPropertyDisplayAddress({
            line1: property.line1,
            city: property.city,
            state: property.state,
            zip: property.zip,
            formatted: property.formatted,
          }),
        secondary: [property.city, property.state, property.zip].filter(Boolean).join(", ") || null,
        jobCount,
        href: buildPropertyWorkspaceHref(property.id),
      };
    }),
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ customerId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const companyId = await getUserCompanyId(supabase, user.id);
  if (!companyId) return forbidden();

  const { customerId } = await context.params;
  if (!isUuidLike(customerId)) return notFound();

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    email?: string | null;
    phone?: string | null;
  } | null;
  if (!body) {
    return NextResponse.json({ ok: false, code: "invalid_body" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, code: "name_required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("customers")
    .update({
      name,
      email: String(body.email ?? "").trim() || null,
      phone: String(body.phone ?? "").trim() || null,
    })
    .eq("id", customerId)
    .eq("company_id", companyId)
    .select("id, name, email, phone")
    .maybeSingle();

  if (error || !data) return notFound();

  return NextResponse.json({
    ok: true,
    customer: {
      id: data.id,
      name: data.name,
      email: data.email,
      phone: data.phone,
    },
  });
}
