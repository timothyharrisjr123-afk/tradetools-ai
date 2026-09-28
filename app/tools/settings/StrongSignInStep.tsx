"use client";

import { useEffect, useRef, useState } from "react";
import {
  FOCUSED_EDITOR_HINT,
  FOCUSED_EDITOR_INPUT,
  FOCUSED_EDITOR_LABEL,
  FOCUSED_EDITOR_SAVE,
} from "@/app/components/ui/FocusedEditor";
import {
  confirmStrongSignIn,
  startStrongSignInOnce,
  type StrongSignInClient,
  type StrongSignInStart,
} from "@/app/lib/auth/strongSignIn";
import { TEAM_STRONG_AUTH } from "@/app/lib/access/teamAccessPresentation";
import { createClient } from "@/app/lib/supabase/client";

type StrongSignInStepProps = {
  onConfirmed: () => void;
  onCancel: () => void;
};

/** Inline authenticator step for changes the database marks as needing a recent strong sign-in. */
export default function StrongSignInStep({ onConfirmed, onCancel }: StrongSignInStepProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const clientRef = useRef<StrongSignInClient | null>(null);

  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: "nearest" });
  }, []);
  const [start, setStart] = useState<StrongSignInStart | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const client = createClient() as unknown as StrongSignInClient;
    clientRef.current = client;
    startStrongSignInOnce(client)
      .then((next) => {
        if (!cancelled) setStart(next);
      })
      .catch(() => {
        if (!cancelled) setStart({ kind: "unavailable" });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const submit = async () => {
    const client = clientRef.current;
    if (!client || !start || start.kind === "unavailable") return;
    setBusy(true);
    setMessage(null);
    const result = await confirmStrongSignIn(client, start.factorId, code).catch(() => ({
      ok: false as const,
      message: "We couldn't confirm the code right now. Try again.",
    }));
    setBusy(false);
    if (result.ok) {
      onConfirmed();
      return;
    }
    setMessage(result.message);
  };

  return (
    <div ref={rootRef} className="space-y-3" data-team-strong-sign-in>
      <p className="text-sm text-slate-800">{TEAM_STRONG_AUTH}</p>
      {start == null ? (
        <p className={FOCUSED_EDITOR_HINT}>Preparing your authenticator step…</p>
      ) : start.kind === "unavailable" ? (
        <div className="space-y-3" data-team-strong-sign-in-unavailable>
          <p className="text-sm text-slate-800">
            We couldn&apos;t set up your authenticator step. Nothing was changed.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              className={`${FOCUSED_EDITOR_SAVE} w-full sm:w-auto`}
              onClick={() => {
                setStart(null);
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </button>
            <button
              type="button"
              className="inline-flex min-h-[44px] items-center justify-center px-2 text-sm font-medium text-slate-600"
              onClick={onCancel}
            >
              Not now
            </button>
          </div>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {start.kind === "enroll" ? (
            <div className="space-y-2" data-team-strong-sign-in-enroll>
              <p className="text-sm text-slate-700">
                Scan this with an authenticator app, such as Google Authenticator or 1Password. You only set this up once.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={start.qrCode} alt="Authenticator setup code" className="h-44 w-44" />
              <p className={FOCUSED_EDITOR_HINT}>
                Can&apos;t scan? Enter this key: <span className="break-all font-mono text-slate-700">{start.secret}</span>
              </p>
            </div>
          ) : null}
          <label className={FOCUSED_EDITOR_LABEL}>
            6-digit code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className={FOCUSED_EDITOR_INPUT}
            />
          </label>
          {message ? <p className="text-sm text-rose-700">{message}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button type="submit" className={`${FOCUSED_EDITOR_SAVE} w-full sm:w-auto`} disabled={busy}>
              {busy ? "Confirming…" : "Confirm and continue"}
            </button>
            <button
              type="button"
              className="inline-flex min-h-[44px] items-center justify-center px-2 text-sm font-medium text-slate-600"
              onClick={onCancel}
              disabled={busy}
            >
              Not now
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
