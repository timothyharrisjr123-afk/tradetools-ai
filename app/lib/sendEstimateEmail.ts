export type SendEstimateEmailMeta = {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;

  tier: "Core" | "Enhanced" | "Premium";
  totalPrice: number;

  // LOCKED GPT outputs (already allowed)
  packageDescription: string; // 1 sentence, technical
  scheduleCta: string; // 1 sentence
};

function formatMoney(n: number) {
  // deterministic money format
  return `$${Math.round((n + Number.EPSILON) * 100) / 100}`.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ","
  );
}

export function buildSendEstimateSubject(meta: SendEstimateEmailMeta) {
  const name = meta.customerName?.trim() || "there";
  return `Your Roofing Estimate (${meta.tier}) — ${name}`;
}

export function buildSendEstimateBody(meta: SendEstimateEmailMeta) {
  const name = meta.customerName?.trim() || "there";
  const total = formatMoney(meta.totalPrice);

  const lines: string[] = [];

  lines.push(`Hi ${name},`);
  lines.push("");
  lines.push("Thanks for the opportunity to provide your roofing estimate.");
  lines.push("");
  lines.push(`Selected Package: ${meta.tier}`);
  lines.push(`Total Investment: ${total}`);
  lines.push("");

  // Include address if present (deterministic, no parsing)
  const addrParts = [
    meta.addressLine1,
    meta.addressLine2,
    [meta.city, meta.state, meta.zip].filter(Boolean).join(" "),
  ].filter(Boolean);
  if (addrParts.length) {
    lines.push("Property Address:");
    lines.push(addrParts.join("\n"));
    lines.push("");
  }

  // LOCKED GPT content (already approved)
  if (meta.packageDescription?.trim()) {
    lines.push(meta.packageDescription.trim());
    lines.push("");
  }

  if (meta.scheduleCta?.trim()) {
    lines.push(meta.scheduleCta.trim());
    lines.push("");
  }

  lines.push("If you have any questions, reply to this email and we'll help right away.");
  lines.push("");
  lines.push("Best regards,");
  lines.push("—");

  return lines.join("\n");
}
