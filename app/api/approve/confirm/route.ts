import { NextResponse } from "next/server";
import { getApprovalRecord, markApproved } from "@/app/lib/kv";
import { Resend } from "resend";

function money(n?: number | null) {
  if (typeof n !== "number" || !isFinite(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { token?: string } | null;
    const token = body?.token?.trim();

    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
    }

    const record = await getApprovalRecord(token);
    if (!record) {
      return NextResponse.json({ ok: false, error: "Invalid or expired" }, { status: 404 });
    }

    if (record.approvedAt) {
      return NextResponse.json({ ok: true, alreadyApproved: true, approvedAt: record.approvedAt, record });
    }

    const updated = await markApproved(token);
    if (!updated) {
      return NextResponse.json({ ok: false, error: "Failed to update" }, { status: 500 });
    }

    const notifyTo = process.env.APPROVAL_NOTIFY_EMAIL?.trim();
    const resendKey = process.env.RESEND_API_KEY?.trim();
    const resendFrom = process.env.RESEND_FROM?.trim();

    if (notifyTo && resendKey && resendFrom) {
      try {
        const resend = new Resend(resendKey);
        const subject = `✅ Estimate Approved — ${updated.customerName ?? "Customer"} (${updated.tierLabel ?? "Package"})`;
        const text = [
          `Estimate Approved ✅`,
          ``,
          `Customer: ${updated.customerName ?? "—"}`,
          `Email: ${updated.customerEmail ?? "—"}`,
          `Address: ${updated.addressLine ?? "—"}`,
          `Package: ${updated.tierLabel ?? "—"}`,
          `Total: ${money(updated.total)}`,
          `Approved At: ${new Date(updated.approvedAt!).toLocaleString()}`,
          ``,
          `Next step: Reach out to schedule the start date.`,
        ].join("\n");

        await resend.emails.send({
          from: resendFrom,
          to: notifyTo,
          subject,
          text,
        });
      } catch (e) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[approve/confirm] Contractor notification email failed", e);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      approvedAt: updated.approvedAt ?? null,
      estimateId: updated.estimateId ?? null,
      record: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Approval confirm failed" },
      { status: 500 }
    );
  }
}
