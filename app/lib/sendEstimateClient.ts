import type { SendEstimateEmailMeta } from "@/app/lib/sendEstimateEmail";

function uint8ToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Meta shape for server-side email (subject/body built on server). */
export type EstimateSendMeta = {
  customerName?: string;
  selectedTier: "Core" | "Enhanced" | "Premium";
  jobAddress1?: string;
  jobCity?: string;
  jobState?: string;
  jobZip?: string;
  suggestedPrice: number;
  packageDescription?: string;
  scheduleCta?: string;
  companyName?: string;
};

function metaToSendMeta(meta: SendEstimateEmailMeta): EstimateSendMeta {
  return {
    customerName: meta.customerName || undefined,
    selectedTier: meta.tier,
    jobAddress1: meta.addressLine1 || undefined,
    jobCity: meta.city || undefined,
    jobState: meta.state || undefined,
    jobZip: meta.zip || undefined,
    suggestedPrice: meta.totalPrice,
    packageDescription: meta.packageDescription || undefined,
    scheduleCta: meta.scheduleCta || undefined,
    companyName: (meta as SendEstimateEmailMeta & { companyName?: string }).companyName,
  };
}

export type { SendEstimateEmailMeta };

export async function sendEstimateEmailWithPdf(args: {
  to: string;
  meta: SendEstimateEmailMeta & { companyName?: string };
  pdfBytes: Uint8Array;
  pdfFilename?: string;
  savedEstimateId?: string;
  contractorEmail?: string;
}) {
  const pdfBase64 = uint8ToBase64(args.pdfBytes);
  const pdfFilename = args.pdfFilename || "estimate.pdf";
  const sendMeta = metaToSendMeta(args.meta);

  const res = await fetch("/api/estimate/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: args.to,
      meta: sendMeta,
      pdfBase64,
      pdfFilename,
      ...(args.savedEstimateId != null && { savedEstimateId: args.savedEstimateId }),
      ...(args.contractorEmail != null && { contractorEmail: args.contractorEmail }),
    }),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      json?.error ||
      json?.message ||
      `Send failed (HTTP ${res.status}).`;
    throw new Error(msg);
  }

  return json;
}
