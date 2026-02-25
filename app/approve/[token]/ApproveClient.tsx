"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const STORAGE_KEY_SAVED_ESTIMATES = "ttai_saved_estimates";

function coerceToken(val: unknown): string {
  if (!val) return "";
  if (Array.isArray(val)) return String(val[0] ?? "");
  return String(val);
}

export default function ApproveClient() {
  const params = useParams();
  const token = coerceToken((params as any)?.token);

  const [status, setStatus] = useState<
    "checking" | "approved" | "invalid"
  >("checking");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    const raw = localStorage.getItem(STORAGE_KEY_SAVED_ESTIMATES);
    if (!raw) {
      setStatus("invalid");
      return;
    }

    const list = JSON.parse(raw);

    const matchIndex = list.findIndex(
      (e: any) => e.approvalToken === token
    );

    if (matchIndex === -1) {
      setStatus("invalid");
      return;
    }

    // Mark as approved
    list[matchIndex] = {
      ...list[matchIndex],
      status: "approved",
      approvedAt: new Date().toISOString(),
    };

    localStorage.setItem(
      STORAGE_KEY_SAVED_ESTIMATES,
      JSON.stringify(list)
    );

    setStatus("approved");
  }, [token]);

  if (status === "checking") {
    return (
      <div style={{ padding: 40 }}>
        Checking approval…
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div style={{ padding: 40 }}>
        ❌ This approval link is invalid or expired.
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      ✅ Estimate Approved

      <div style={{ marginTop: 16 }}>
        Thank you. Your contractor will contact you shortly to schedule.
      </div>
    </div>
  );
}
