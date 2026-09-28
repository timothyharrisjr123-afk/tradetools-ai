"use client";

import { useState, type FormEvent } from "react";
import { FOCUSED_EDITOR_INPUT, FOCUSED_EDITOR_LABEL } from "@/app/components/ui/FocusedEditor";
import { ENTRY_PRIMARY_ACTION, ENTRY_SECONDARY_ACTION } from "@/app/components/ui/surfaceStyles";

export function CreateBusinessForm({
  acknowledgePendingInvitations,
  secondary = false,
}: {
  acknowledgePendingInvitations: boolean;
  /** When an invitation is the main path on the page. */
  secondary?: boolean;
}) {
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
        // A full load, so the new membership is read fresh everywhere.
        window.location.assign("/tools/roofing/saved");
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
    <form onSubmit={onSubmit} className="mt-5 space-y-4 text-left">
      <div>
        <label className={FOCUSED_EDITOR_LABEL} htmlFor="company-name">
          Business name
        </label>
        <input
          id="company-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          placeholder="My Company"
          className={FOCUSED_EDITOR_INPUT}
        />
      </div>
      {error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={secondary ? ENTRY_SECONDARY_ACTION : ENTRY_PRIMARY_ACTION}>
        {pending ? "Creating…" : "Create business"}
      </button>
    </form>
  );
}
