import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { buildDbJobCardHref } from "@/app/lib/jobBoardAdapter";
import { resolveCanonicalJobStageLabel } from "@/app/lib/jobLifecycleMapper";
import type { JobStage } from "@/app/lib/jobTypes";
import {
  buildCustomerWorkspaceHref,
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
  context: { params: Promise<{ propertyId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const companyId = await getUserCompanyId(supabase, user.id);
  if (!companyId) return forbidden();

  const { propertyId } = await context.params;
  if (!isUuidLike(propertyId)) return notFound();

  const { data: property, error } = await supabase
    .from("properties")
    .select(
      "id, company_id, address_line1, address_line2, address_city, address_state, address_zip, address_country, address_formatted, address_normalized, created_at"
    )
    .eq("id", propertyId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !property) return notFound();

  const { data: jobs } = await supabase
    .from("jobs")
    .select(
      "id, job_name, customer_id, customer_name, stage, address_formatted, updated_at"
    )
    .eq("company_id", companyId)
    .eq("property_id", propertyId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(40);

  const jobRows = Array.isArray(jobs) ? jobs : [];
  const customerIds = [
    ...new Set(
      jobRows
        .map((job) => String(job.customer_id ?? "").trim())
        .filter((id) => isUuidLike(id))
    ),
  ];

  const customersById = new Map<string, { id: string; name: string }>();
  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name")
      .eq("company_id", companyId)
      .in("id", customerIds);
    for (const row of Array.isArray(customers) ? customers : []) {
      customersById.set(String(row.id), {
        id: String(row.id),
        name: String(row.name ?? "").trim() || "Customer",
      });
    }
  }

  const formatted =
    String(property.address_formatted ?? "").trim() ||
    formatPropertyDisplayAddress({
      line1: property.address_line1,
      line2: property.address_line2,
      city: property.address_city,
      state: property.address_state,
      zip: property.address_zip,
    });

  return NextResponse.json({
    ok: true,
    property: {
      id: property.id,
      line1: property.address_line1,
      line2: property.address_line2,
      city: property.address_city,
      state: property.address_state,
      zip: property.address_zip,
      formatted,
    },
    jobs: jobRows.map((job) => ({
      id: job.id,
      primary: String(job.job_name || job.customer_name || "Job").trim(),
      customerName: String(job.customer_name ?? "").trim() || null,
      customerId: job.customer_id ?? null,
      stage: job.stage,
      stageLabel: resolveCanonicalJobStageLabel({ stage: job.stage as JobStage }),
      href: buildDbJobCardHref(String(job.id)),
    })),
    customers: [...customersById.values()].map((customer) => ({
      id: customer.id,
      name: customer.name,
      href: buildCustomerWorkspaceHref(customer.id),
    })),
  });
}
