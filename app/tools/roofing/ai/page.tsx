"use client";

import { useEffect, useState } from "react";
import RoofingTabs from "@/app/tools/roofing/RoofingTabs";
import {
  loadCompanyVoiceProfile,
  saveCompanyVoiceProfile,
  type VoiceTone,
} from "@/app/lib/companyVoiceProfile";

export default function AILibraryPage() {
  const [tone, setTone] = useState<VoiceTone>("professional");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const v = loadCompanyVoiceProfile();
    setTone(v.tone);
    setNotes(v.styleNotes || "");
  }, []);

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

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="text-[11px] text-white/50">Tone</label>
              <select
                value={tone}
                onChange={(e) => {
                  const t = e.target.value as VoiceTone;
                  setTone(t);
                  saveCompanyVoiceProfile({ tone: t, styleNotes: notes });
                }}
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/85 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="direct">Direct</option>
                <option value="premium">Premium</option>
              </select>
            </div>

            <label className="mt-3 block text-[11px] text-white/50">Style notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => {
                const v = e.target.value;
                setNotes(v);
                saveCompanyVoiceProfile({ tone, styleNotes: v });
              }}
              rows={3}
              placeholder="Example: End CTA with 'Reply APPROVE'. Avoid 'inspection'. Keep it short."
              className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/80 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
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
