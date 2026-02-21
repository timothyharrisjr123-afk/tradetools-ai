import { NextResponse } from "next/server";
import { getApproval, patchApproval } from "@/app/lib/kv";
import { Resend } from "resend";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = (body?.token || "").trim();
  if (!token)
    return NextResponse.json(
      { success: false, error: "Missing token" },
      { status: 400 }
    );

  const rec = await getApproval(token);
  if (!rec)
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404 }
    );

  if (rec.status === "approved") {
    return NextResponse.json({
      success: true,
      record: { status: rec.status, approvedAt: rec.approvedAt ?? null },
    });
  }

  const nowIso = new Date().toISOString();
  const updated = await patchApproval(token, {
    status: "approved",
    approvedAt: nowIso,
  });
  if (!updated)
    return NextResponse.json(
      { success: false, error: "Failed to update" },
      { status: 500 }
    );

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && updated.contractorEmail) {
    try {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from:
          process.env.RESEND_FROM ||
          "TradeTools AI <onboarding@resend.dev>",
        to: updated.contractorEmail,
        subject: "Estimate Approved ✅",
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.4">
            <h2>Estimate Approved ✅</h2>
            <p><strong>${updated.customerName || "Customer"}</strong> approved the estimate.</p>
            <p><strong>Job:</strong> ${updated.jobAddress || "(address not provided)"}</p>
            <p><strong>Time:</strong> ${new Date(nowIso).toLocaleString()}</p>
            <p>You can open your Saved Estimates and it will sync to <strong>Approved</strong>.</p>
          </div>
        `,
      });
    } catch {
      // non-fatal: approval still succeeds even if email fails
    }
  }

  return NextResponse.json({
    success: true,
    record: {
      status: updated.status,
      approvedAt: updated.approvedAt ?? null,
    },
  });
}
