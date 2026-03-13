"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  type CompanyProfile,
  loadCompanyProfileFromSupabase,
  saveCompanyProfile,
} from "@/app/lib/companyProfile";
import { ArrowLeft } from "lucide-react";

const inputClass =
  "w-full rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 text-white/95 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-blue-500/35 focus:border-white/25 text-sm";

export default function SettingsPage() {
  const [profile, setProfile] = useState<CompanyProfile>({
    companyName: "",
    phone: "",
    email: "",
    license: "",
    logoDataUrl: "",
    notificationsEmail: "",
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadCompanyProfileFromSupabase().then(setProfile);
  }, []);

  const handleSave = async () => {
    await saveCompanyProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      setProfile((p) => ({ ...p, logoDataUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <main className="min-h-screen bg-[#0b0f19] text-white p-4 sm:p-6 lg:p-8 pb-10">
      <div className="mx-auto max-w-xl">
        <Link
          href="/tools"
          className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white/90 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tools
        </Link>

        <h1 className="text-xl font-semibold text-white/95 mb-2">Settings</h1>
        <p className="text-sm text-white/60 mb-6">
          Company details can be used on proposals and PDFs.
        </p>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <h2 className="text-sm font-semibold text-white/90 mb-1">Company Profile</h2>
          <p className="text-xs text-white/60 mb-4">Shown on estimates and documents.</p>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="company-name" className="block text-sm font-medium text-slate-300">
                Company Name
              </label>
              <input
                id="company-name"
                type="text"
                value={profile.companyName}
                onChange={(e) => setProfile((p) => ({ ...p, companyName: e.target.value }))}
                placeholder="Your company name"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="company-phone" className="block text-sm font-medium text-slate-300">
                Phone
              </label>
              <input
                id="company-phone"
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                placeholder="(555) 123-4567"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="company-email" className="block text-sm font-medium text-slate-300">
                Email
              </label>
              <input
                id="company-email"
                type="email"
                value={profile.email}
                onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                placeholder="contact@company.com"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="company-license" className="block text-sm font-medium text-slate-300">
                License <span className="text-white/50">(optional)</span>
              </label>
              <input
                id="company-license"
                type="text"
                value={profile.license}
                onChange={(e) => setProfile((p) => ({ ...p, license: e.target.value }))}
                placeholder="License number"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs text-white/70 mb-1">Approval notifications email</label>
              <input
                type="email"
                placeholder="Where approval notifications should be sent"
                value={profile.notificationsEmail ?? ""}
                onChange={(e) => setProfile((p) => ({ ...p, notificationsEmail: e.target.value }))}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-white/50">
                When a customer approves, we&apos;ll notify you at this email.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-300">Logo</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="block w-full text-sm text-white/80 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-white/90 hover:file:bg-white/15"
              />
              {profile.logoDataUrl ? (
                <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.06] p-3 inline-block">
                  <img
                    src={profile.logoDataUrl}
                    alt="Company logo"
                    className="max-h-20 max-w-[200px] object-contain"
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/15 active:scale-[0.99]"
            >
              Save
            </button>
            {saved && (
              <span className="text-xs text-emerald-400/90">Saved</span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
