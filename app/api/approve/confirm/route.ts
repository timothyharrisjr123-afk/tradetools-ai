import { NextResponse } from "next/server";
import { getApprovalRecord, markApproved, approvalKey } from "@/app/lib/kv";
import { Resend } from "resend";

type EmailAttempt = {
  kind: "customer" | "contractor";
  to: string;
  subject: string;
  ok: boolean;
  error?: string;
};

const isEmail = (s: unknown): boolean =>
  typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

const safeTrim = (s: unknown): string => (typeof s === "string" ? s.trim() : "");

function safeEmail(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function fmtMoney(n: unknown): string {
  const num = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const token =
      safeEmail(body?.token) ||
      safeEmail((body?.params as Record<string, unknown>)?.token) ||
      safeEmail(body?.tokenFromUrl);

    if (!token) {
      return NextResponse.json({ success: false, ok: false, error: "Missing token" }, { status: 400 });
    }

    const key = approvalKey(token);
    const record = await getApprovalRecord(token);

    if (!record) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          error: "Approval link invalid or expired",
          debug: { token, key, found: false },
        },
        { status: 404 }
      );
    }

    const updated = await markApproved(token);
    if (!updated) {
      return NextResponse.json(
        { success: false, ok: false, error: "Failed to update" },
        { status: 500 }
      );
    }

    const emailAttempts: EmailAttempt[] = [];

    const customerEmailRaw = isEmail(updated?.customerEmail) ? safeTrim(updated?.customerEmail) : "";
    const contractorEmailRaw = isEmail(updated?.notifyEmail) ? safeTrim(updated?.notifyEmail) : "";

    const toContractor = contractorEmailRaw;
    const toCustomer =
      customerEmailRaw &&
      (!toContractor || customerEmailRaw.toLowerCase() !== toContractor.toLowerCase())
        ? customerEmailRaw
        : "";

    console.log("[APPROVAL] token:", token);
    console.log("[APPROVAL] customerEmail (record):", updated?.customerEmail, "=>", customerEmailRaw || "(invalid)");
    console.log("[APPROVAL] notifyEmail   (record):", updated?.notifyEmail, "=>", contractorEmailRaw || "(invalid)");

    const resendKey = process.env.RESEND_API_KEY?.trim();
    const resendFrom = process.env.RESEND_FROM || "Onboarding <onboarding@resend.dev>";
    const resend = resendKey ? new Resend(resendKey) : null;

    async function sendEmailAttempt(
      kind: "customer" | "contractor",
      to: string,
      subject: string,
      html: string
    ) {
      if (!to) {
        emailAttempts.push({ kind, to: "(missing)", subject, ok: false, error: "missing/invalid recipient" });
        console.log(`[APPROVAL] ${kind} email skipped: missing recipient`);
        return;
      }
      if (!resend || !resendFrom) {
        emailAttempts.push({ kind, to, subject, ok: false, error: "RESEND_API_KEY or RESEND_FROM missing" });
        console.log(`[APPROVAL] ${kind} email skipped: Resend not configured`);
        return;
      }
      try {
        const result = await resend.emails.send({
          from: resendFrom,
          to,
          subject,
          html,
        });
        emailAttempts.push({ kind, to, subject, ok: true });
        console.log(`[APPROVAL] ${kind} email sent OK =>`, to, "id:", (result as any)?.data?.id || "(no id)");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        emailAttempts.push({ kind, to, subject, ok: false, error: msg });
        console.log(`[APPROVAL] ${kind} email FAILED =>`, to, msg);
      }
    }

    const customerName = updated.customerName || "Customer";
    const addressLine = updated.addressLine || "";
    const tierLabel = updated.tierLabel || "";
    const total = fmtMoney(updated.total);

    const customerSubject = "Your roofing estimate was approved ✅";
    const customerHtml = `
  <div style="font-family: Arial, sans-serif; line-height:1.5;">
    <h2>Approved ✅</h2>
    <p>Thanks — we received your approval.</p>
    <p><b>Next:</b> We'll reach out shortly to schedule your start date.</p>
  </div>
`;

    const contractorSubject = "Estimate approved — ready to schedule ✅";
    const contractorHtml = `
  <div style="font-family: Arial, sans-serif; line-height:1.5;">
    <h2>Estimate Approved ✅</h2>
    <p><b>Customer:</b> ${customerName}</p>
    <p><b>Address:</b> ${addressLine}</p>
    <p><b>Package:</b> ${tierLabel}</p>
    <p><b>Total:</b> ${total || "$0.00"}</p>
    <hr/>
    <p><b>Next:</b> Please reach out to schedule.</p>
  </div>
`;

    await sendEmailAttempt("customer", toCustomer, customerSubject, customerHtml);
    await sendEmailAttempt("contractor", toContractor, contractorSubject, contractorHtml);

    const approvedAt = updated.approvedAt || new Date().toISOString();

    return NextResponse.json({
      success: true,
      ok: true,
      approved: true,
      approvedAt,
      estimateId: updated.estimateId ?? null,
      emailAttempts,
      debug: {
        token,
        key,
        customerEmail: customerEmailRaw,
        notifyEmail: contractorEmailRaw,
        sentTo: { contractor: toContractor || "(skipped)", customer: toCustomer || "(deduped or missing)" },
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Approval confirm failed";
    console.error("[APPROVAL CONFIRM]", err);
    return NextResponse.json(
      {
        success: false,
        ok: false,
        error: message,
        debug: err instanceof Error ? { name: err.name, message: err.message } : undefined,
      },
      { status: 500 }
    );
  }
}
