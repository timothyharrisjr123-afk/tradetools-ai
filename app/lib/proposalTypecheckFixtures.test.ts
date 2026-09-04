import type {
  ProposalVersionContextEcho,
  ProposalVersionPolicyEcho,
} from "./proposalVersionTypes";

export function proposalContextEchoFixture(
  jobId: string,
  templateId = "44444444-4444-4444-8444-444444444444"
): ProposalVersionContextEcho {
  return {
    job_id: jobId,
    job_name: "Test job",
    customer_id: null,
    customer_name: "Test customer",
    customer_email: null,
    customer_phone: null,
    address_formatted: null,
    company_name: "Test company",
    company_logo_url: null,
    template_id: templateId,
    template_name: "Test template",
    measurement_record_id: null,
    measurement_quantities_display: null,
  };
}

export function proposalPolicyEchoFixture(): ProposalVersionPolicyEcho {
  return {
    pricing_policy_id: null,
    configured: true,
    profitability_type: "margin",
    default_profitability_pct: 35,
    sales_tax_rate_pct: 0,
    discount_kind: null,
    discount_value: null,
    waste_model: "adjusted_measurement",
    quantity_rounding: "exact",
  };
}
