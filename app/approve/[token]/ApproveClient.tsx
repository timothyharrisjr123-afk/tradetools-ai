"use client";

import { useEffect, useState } from "react";

export default function ApproveClient({ token }: { token: string }) {
  const [state, setState] = useState<
    "loading" | "invalid" | "ready" | "approved"
  >("loading");

  useEffect(() => {
    async function check() {
      const res = await fetch(`/api/approve/${token}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        setState("invalid");
        return;
      }

      setState("ready");
    }

    check();
  }, [token]);

  async function approve() {
    const res = await fetch(`/api/approve/${token}`, {
      method: "POST",
    });

    if (!res.ok) {
      setState("invalid");
      return;
    }

    setState("approved");
  }

  return (
    <div className="min-h-screen bg-[#070B14] text-white flex items-center justify-center">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">
        <h2 className="text-xl font-semibold">Roofing Estimate Approval</h2>

        <div className="mt-6">
          {state === "loading" && <div>Loading...</div>}

          {state === "invalid" && (
            <div className="text-red-400">
              This approval link is invalid or expired.
            </div>
          )}

          {state === "ready" && (
            <>
              <div className="text-white/80">
                This link is valid. Click below to approve.
              </div>
              <button
                onClick={approve}
                className="mt-4 w-full rounded-2xl bg-emerald-500 py-3 font-semibold text-black"
              >
                Approve Estimate
              </button>
            </>
          )}

          {state === "approved" && (
            <div className="text-emerald-400 font-semibold">
              Approved ✅ We will contact you shortly.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
