"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function CreateBusinessForm({
  acknowledgePendingInvitations,
}: {
  acknowledgePendingInvitations: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/access/create-business", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companyName: name.trim() || null,
          acknowledgePendingInvitations,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      if (response.status === 503 || !payload) {
        setError("We couldn't create the business. Nothing was saved. Try again.");
        setPending(false);
        return;
      }
      if (payload.ok) {
        router.push("/tools/roofing/saved");
        router.refresh();
        return;
      }
      setError("This account can't create a business right now.");
      setPending(false);
    } catch {
      setError("We couldn't create the business. Nothing was saved. Try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3 text-left">
      <label className="block text-sm text-white/70" htmlFor="company-name">
        Business name
      </label>
      <input
        id="company-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={80}
        placeholder="My Company"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
      />
      {error ? <p className="text-sm text-amber-200">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create business"}
      </button>
    </form>
  );
}
