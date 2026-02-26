import { NextResponse } from "next/server";
import { getApprovalRecord, markApproved } from "@/app/lib/kv";
import { Resend } from "resend";

function extractEmail(maybeNameAndEmail?: string | null) {
  if (!maybeNameAndEmail) return "";
  const m = maybeNameAndEmail.match(/<([^>]+)>/);
  if (m?.[1]) return m[1].trim();
  return maybeNameAndEmail.includes("@") ? maybeNameAndEmail.trim() : "";
}

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

    const notifyTo =
      (updated?.notifyEmail || "").trim() ||
      extractEmail(process.env.RESEND_FROM || "") ||
      "";

    console.log("[APPROVAL NOTIFY] notifyTo =", notifyTo ? notifyTo : "(empty)");
    console.log("[APPROVAL NOTIFY] token =", token);

    if (notifyTo) {
      const resendKey = process.env.RESEND_API_KEY?.trim();
      const resendFrom = process.env.RESEND_FROM?.trim();
      if (resendKey && resendFrom) {
        try {
          const resend = new Resend(resendKey);
          const subject = `✅ Estimate Approved — ${updated.customerName ?? "Customer"} (${updated.tierLabel ?? "Package"})`;
          const text =
            `An estimate was approved.\n\n` +
            `Customer: ${updated.customerName ?? ""}\n` +
            `Email: ${updated.customerEmail ?? ""}\n` +
            `Address: ${updated.addressLine ?? ""}\n` +
            `Package: ${updated.tierLabel ?? ""}\n` +
            `Total: ${money(updated.total)}\n\n` +
            `Next step: reach out to schedule the start date.\n`;

          await resend.emails.send({
            from: resendFrom,
            to: notifyTo,
            subject,
            text,
          });

          console.log("[APPROVAL NOTIFY] sent ✅");
        } catch (e) {
          console.error("[APPROVAL NOTIFY] failed ❌", e);
        }
      } else {
        console.warn("[APPROVAL NOTIFY] skipped (RESEND_API_KEY or RESEND_FROM missing)");
      }
    } else {
      console.warn(
        "[APPROVAL NOTIFY] skipped — missing notifyEmail on record. Set Company Profile Email and re-send estimate."
      );
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
