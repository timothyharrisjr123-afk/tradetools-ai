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

  const [debug, setDebug] = useState<any>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY_SAVED_ESTIMATES);

    let parsed = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        parsed = "PARSE ERROR";
      }
    }

    setDebug({
      tokenFromUrl: token,
      storageKey: STORAGE_KEY_SAVED_ESTIMATES,
      rawExists: !!raw,
      parsed,
    });
  }, [token]);

  return (
    <div style={{ padding: 40, fontFamily: "system-ui" }}>
      <h2>Approval Debug</h2>

      <pre style={{ whiteSpace: "pre-wrap" }}>
        {JSON.stringify(debug, null, 2)}
      </pre>
    </div>
  );
}
