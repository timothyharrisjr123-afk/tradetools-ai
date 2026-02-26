import { NextResponse } from "next/server";
import { getApprovalRecord, markApproved, approvalKey } from "@/app/lib/kv";
import { Resend } from "resend";

const isEmail = (s: unknown): boolean =>
  typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

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

    const customerEmail = safeEmail(updated.customerEmail);
    const contractorNotifyEmailRaw = updated?.notifyEmail;
    const contractorNotifyEmail = isEmail(contractorNotifyEmailRaw)
      ? String(contractorNotifyEmailRaw).trim()
      : "";

    console.log("[APPROVAL] token =", token);
    console.log("[APPROVAL] record.notifyEmail =", contractorNotifyEmailRaw);
    console.log("[APPROVAL] chosen contractor email =", contractorNotifyEmail || "(none)");

    if (!contractorNotifyEmail) {
      console.log("[APPROVAL] Skipping contractor notification: missing/invalid notifyEmail");
    }

    const customerName = updated.customerName || "Customer";
    const addressLine = updated.addressLine || "";
    const tierLabel = updated.tierLabel || "";
    const total = fmtMoney(updated.total);
    const approvedAt = updated.approvedAt || new Date().toISOString();

    const toContractor = contractorNotifyEmail;
    const toCustomer =
      customerEmail && customerEmail.toLowerCase() !== toContractor.toLowerCase() ? customerEmail : "";

    const resendKey = process.env.RESEND_API_KEY?.trim();
    const resendFrom = process.env.RESEND_FROM || "Onboarding <onboarding@resend.dev>";

    let contractorSend: unknown = null;
    let customerSend: unknown = null;

    if (resendKey) {
      const resend = new Resend(resendKey);

      if (toContractor) {
        const contractorSubject = `Estimate Approved — ${customerName}${addressLine ? ` (${addressLine})` : ""}`;
        const contractorHtml = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height:1.5">
        <h2 style="margin:0 0 8px">Estimate Approved ✅</h2>
        <p style="margin:0 0 12px">A customer approved an estimate. Please reach out to schedule the job.</p>
        <div style="padding:12px; border:1px solid #e5e7eb; border-radius:12px">
          <div><b>Customer:</b> ${customerName}</div>
          <div><b>Customer Email:</b> ${updated.customerEmail ?? ""}</div>
          ${addressLine ? `<div><b>Address:</b> ${addressLine}</div>` : ""}
          ${tierLabel ? `<div><b>Package:</b> ${tierLabel}</div>` : ""}
          ${total ? `<div><b>Total:</b> ${total}</div>` : ""}
          <div><b>Approved At:</b> ${new Date(approvedAt).toLocaleString()}</div>
        </div>
      </div>
    `;

        try {
          contractorSend = await resend.emails.send({
            from: resendFrom,
            to: toContractor,
            subject: contractorSubject,
            html: contractorHtml,
          });
        } catch (e) {
          console.error("[APPROVAL NOTIFY] contractor send failed", e);
          contractorSend = { error: e instanceof Error ? e.message : String(e) };
        }
      }

      if (toCustomer) {
        const customerSubject = `You're approved ✅ — Next step: scheduling`;
        const customerHtml = `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height:1.5">
          <h2 style="margin:0 0 8px">Approved ✅</h2>
          <p style="margin:0 0 12px">
            Thanks, ${customerName}. We've received your approval.
            <b>Someone from our team will reach out shortly to schedule your start date.</b>
          </p>
          <div style="padding:12px; border:1px solid #e5e7eb; border-radius:12px">
            ${addressLine ? `<div><b>Address:</b> ${addressLine}</div>` : ""}
            ${tierLabel ? `<div><b>Package:</b> ${tierLabel}</div>` : ""}
            ${total ? `<div><b>Total:</b> ${total}</div>` : ""}
          </div>
        </div>
      `;

        try {
          customerSend = await resend.emails.send({
            from: resendFrom,
            to: toCustomer,
            subject: customerSubject,
            html: customerHtml,
          });
        } catch (e) {
          console.error("[APPROVAL NOTIFY] customer send failed", e);
          customerSend = { error: e instanceof Error ? e.message : String(e) };
        }
      }
    }

    return NextResponse.json({
      success: true,
      ok: true,
      approvedAt,
      estimateId: updated.estimateId ?? null,
      debug: {
        token,
        key,
        customerEmail,
        notifyEmail: contractorNotifyEmailRaw,
        chosenContractorEmail: toContractor || "(none)",
        sentTo: {
          contractor: toContractor || "(skipped)",
          customer: toCustomer || "(deduped or missing)",
        },
        resend: {
          contractor: contractorSend,
          customer: customerSend,
        },
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
