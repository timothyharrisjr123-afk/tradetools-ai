"use client";

import { useEffect, useState } from "react";
import RoofingTabs from "@/app/tools/roofing/RoofingTabs";

const STORAGE_KEY_VOICE_PROFILE = "ttai_companyVoiceProfile";

export default function AILibraryPage() {
  const [voiceTone, setVoiceTone] = useState("Professional");
  const [voiceStyleNotes, setVoiceStyleNotes] = useState("");
  const [voiceDirty, setVoiceDirty] = useState(false);
  const [voiceSavedAt, setVoiceSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = localStorage.getItem(STORAGE_KEY_VOICE_PROFILE);
    if (!raw) {
      setVoiceDirty(false);
      setVoiceSavedAt(null);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (parsed?.tone) setVoiceTone(parsed.tone);
      if (typeof parsed?.styleNotes === "string") setVoiceStyleNotes(parsed.styleNotes);

      setVoiceDirty(false);
      setVoiceSavedAt(Date.now());
    } catch {
      setVoiceDirty(false);
      setVoiceSavedAt(null);
    }
  }, []);

  function saveVoiceProfile() {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      STORAGE_KEY_VOICE_PROFILE,
      JSON.stringify({
        tone: voiceTone,
        styleNotes: voiceStyleNotes,
      })
    );
    setVoiceSavedAt(Date.now());
    setVoiceDirty(false);
  }

  return (
    <div className="min-h-screen bg-[#0b1220] px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-5xl">
      <RoofingTabs active="ai" />

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="text-sm font-semibold text-white/90">AI Library</div>
        <div className="text-xs text-white/55 mt-0.5">
          Manage your company voice and saved AI wording so estimates stay consistent.
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Company Voice */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs font-semibold text-white/85">Company Voice Profile</div>
            <div className="text-[11px] text-white/55 mt-0.5">
              This guides tone for AI wording (still no pricing).
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <div className="text-xs font-semibold text-white/70">Tone</div>
                <select
                  value={voiceTone}
                  onChange={(e) => {
                    setVoiceTone(e.target.value);
                    setVoiceDirty(true);
                  }}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none"
                >
                  <option>Professional</option>
                  <option>Friendly</option>
                  <option>Confident</option>
                  <option>Direct</option>
                  <option>Premium</option>
                </select>
              </div>

              <div>
                <div className="text-xs font-semibold text-white/70">Style notes (optional)</div>
                <textarea
                  value={voiceStyleNotes}
                  onChange={(e) => {
                    setVoiceStyleNotes(e.target.value);
                    setVoiceDirty(true);
                  }}
                  placeholder="Example: End CTA with 'Reply APPROVE'. Avoid 'inspection'. Keep it short."
                  className="mt-2 w-full min-h-[110px] resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/90 outline-none"
                />
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs">
                  {voiceDirty ? (
                    <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-amber-200">
                      Unsaved changes
                    </span>
                  ) : voiceSavedAt ? (
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-emerald-200">
                      Saved · {new Date(voiceSavedAt).toLocaleTimeString()}
                    </span>
                  ) : (
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-white/60">
                      Not saved yet
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={saveVoiceProfile}
                  className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60"
                  disabled={!voiceDirty && !!voiceSavedAt}
                  title={!voiceDirty && !!voiceSavedAt ? "Already saved" : "Save voice profile"}
                >
                  Save Voice Profile
                </button>
              </div>
            </div>
          </div>

          {/* Favorites placeholder */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs font-semibold text-white/85">Saved AI Favorites</div>
            <div className="text-[11px] text-white/55 mt-0.5">
              Coming next: save your best Package + CTA per tier and lock them.
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[11px] text-white/50 mb-1">What this will do</div>
              <ul className="text-[12px] text-white/70 space-y-1">
                <li>• Save favorite wording per tier (Core/Enhanced/Premium)</li>
                <li>• Lock favorites so they never change</li>
                <li>• Quick apply to an estimate in 1 click</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
