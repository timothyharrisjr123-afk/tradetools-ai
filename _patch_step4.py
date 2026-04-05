# Temporary script to replace Step 4 block; delete after use
path = r"app\tools\roofing\RoofingClient.tsx"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

new_block = r"""<div className="mt-12 border-t border-white/10 pt-8">
  <div className="rounded-[28px] border border-white/10 bg-white/[0.02] p-5 sm:p-6">
    <div className="mb-5">
      <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
        Step 4 — Finalize Job Setup
      </div>
    </div>

    {/* Old Roof Removal */}
    <div className="rounded-[24px] border border-white/10 bg-white/[0.025] px-4 py-2.5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight text-white/95">
            Old Roof Removal
          </h3>
          <p className="mt-1 text-[12px] text-white/50">
            Include tear-off and disposal in this estimate.
          </p>
        </div>

        <div className="flex items-center gap-2.5 pt-0.5">
          <span className="text-[12px] font-medium text-white/65">
            {includeDebrisRemoval ? "Included" : "Not included"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={includeDebrisRemoval}
            onClick={() => {
              setIncludeDebrisRemoval((v) => !v);
              markHelpSeenDebris();
            }}
            className="relative h-8 w-[54px] shrink-0 rounded-full border border-cyan-300/20 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
            style={{
              backgroundColor: includeDebrisRemoval
                ? "rgba(103, 232, 249, 0.14)"
                : "rgba(255,255,255,0.05)"
            }}
          >
            <span
              className="absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-[0_4px_12px_rgba(0,0,0,0.22)] transition-transform"
              style={{
                transform: includeDebrisRemoval
                  ? "translateX(22px)"
                  : "translateX(0)"
              }}
            />
          </button>
        </div>
      </div>

      <div className="mt-3">
        <div className="text-[13px] font-medium text-white/85">
          Roof Type
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setRemovalType("standard")}
            className={`inline-flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all ${
              removalType === "standard"
                ? "border-cyan-300/45 bg-cyan-300/10 text-white shadow-[0_0_0_1px_rgba(103,232,249,0.12)]"
                : "border-white/10 bg-white/[0.03] text-white/75 hover:border-white/20 hover:bg-white/[0.05]"
            }`}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
              <Package className="h-4 w-4 opacity-85" aria-hidden />
            </span>
            <span>Standard</span>
          </button>
          <button
            type="button"
            onClick={() => setRemovalType("architectural")}
            className={`inline-flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all ${
              removalType === "architectural"
                ? "border-cyan-300/45 bg-cyan-300/10 text-white shadow-[0_0_0_1px_rgba(103,232,249,0.12)]"
                : "border-white/10 bg-white/[0.03] text-white/75 hover:border-white/20 hover:bg-white/[0.05]"
            }`}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
              <Sparkles className="h-4 w-4 opacity-85" aria-hidden />
            </span>
            <span>Architectural</span>
          </button>
        </div>
      </div>

      <div className="mt-3 border-t border-white/10 pt-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[13px] font-medium text-white/85">
            Disposal Rate
          </div>
          <div className="text-[11px] text-white/40">
            Per ton
          </div>
        </div>
        <div className="mt-1.5 text-[12px] text-white/45">
          Enter your local landfill or disposal rate.
        </div>
        <div className="mt-3 flex items-center rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-2.5">
          <span className="mr-3 text-[16px] font-medium text-white/45">$</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={dumpFeePerTon}
            onChange={(e) => setDumpFeePerTon(e.target.value)}
            placeholder="0"
            className="min-w-0 flex-1 bg-transparent text-[17px] font-medium text-white outline-none placeholder:text-white/25 [appearance:textfield]"
          />
          <span className="ml-3 text-[14px] text-white/70">/ ton</span>
        </div>
      </div>

      <div className="mt-2.5">
        <button
          type="button"
          onClick={() => setShowDisposalAdvanced((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-2.5 text-left text-[14px] font-medium text-white/80 transition-colors hover:bg-white/[0.05] hover:text-white"
        >
          <span>Advanced</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-white/50 transition-transform duration-200 ${showDisposalAdvanced ? "rotate-180" : ""}`}
          />
        </button>
        <motion.div
          initial={false}
          animate={{ height: showDisposalAdvanced ? "auto" : 0, opacity: showDisposalAdvanced ? 1 : 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="overflow-hidden"
        >
          <div className="pt-3">
            <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4">
              <label htmlFor="disposal-override" className="block text-sm font-medium text-white/80">
                Override disposal total
              </label>
              <div className="mt-3 flex items-center rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2.5">
                <span className="mr-2 text-sm text-white/45">$</span>
                <input
                  id="disposal-override"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={disposalOverride}
                  onChange={(e) => setDisposalOverride(e.target.value)}
                  placeholder="Leave empty for calculated"
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30 [appearance:textfield]"
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>

    {/* Roofing System */}
    <div className="mt-5">
      <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
        Roofing System
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <button
          type="button"
          onClick={() => setRoofingTier("standard")}
          className={`rounded-[20px] border px-4 py-2.5 min-h-[104px] text-left transition-all ${
            roofingTier === "standard"
              ? "border-cyan-300/45 bg-cyan-300/10 shadow-[0_0_0_1px_rgba(103,232,249,0.12)]"
              : "border-white/10 bg-white/[0.03] hover:border-white/18 hover:bg-white/[0.05]"
          }`}
        >
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
            <Package className="h-4.5 w-4.5 text-cyan-100/90" aria-hidden />
          </div>
          <div className="text-[14px] font-semibold text-white">Core</div>
          <div className="mt-1.5 text-sm leading-[1.35] text-white/65">
            Simple, reliable protection
          </div>
        </button>

        <button
          type="button"
          onClick={() => setRoofingTier("enhanced")}
          className={`rounded-[20px] border px-4 py-2.5 min-h-[104px] text-left transition-all ${
            roofingTier === "enhanced"
              ? "border-cyan-300/45 bg-cyan-300/10 shadow-[0_0_0_1px_rgba(103,232,249,0.12)]"
              : "border-white/10 bg-white/[0.03] hover:border-white/18 hover:bg-white/[0.05]"
          }`}
        >
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
            <TrendingUp className="h-4.5 w-4.5 text-cyan-100/90" aria-hidden />
          </div>
          <div className="text-[14px] font-semibold text-white">Enhanced</div>
          <div className="mt-1.5 text-sm leading-[1.35] text-white/65">
            Upgraded coverage and curb appeal
          </div>
        </button>

        <button
          type="button"
          onClick={() => setRoofingTier("premium")}
          className={`rounded-[20px] border px-4 py-2.5 min-h-[104px] text-left transition-all ${
            roofingTier === "premium"
              ? "border-cyan-300/45 bg-cyan-300/10 shadow-[0_0_0_1px_rgba(103,232,249,0.12)]"
              : "border-white/10 bg-white/[0.03] hover:border-white/18 hover:bg-white/[0.05]"
          }`}
        >
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
            <Sparkles className="h-4.5 w-4.5 text-cyan-100/90" aria-hidden />
          </div>
          <div className="text-[14px] font-semibold text-white">Premium</div>
          <div className="mt-1.5 text-sm leading-[1.35] text-white/65">
            Best presentation and protection
          </div>
        </button>
      </div>
    </div>

    {/* Summary */}
    <div className="mt-4">
      <div className="rounded-[20px] border border-white/10 bg-white/[0.02] p-3.5">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
          At a glance
        </div>
        <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.03] px-3 py-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Roof area</div>
            <div className="mt-0.5 font-medium tabular-nums text-white/90">
              {typeof area === "number" && area > 0
                ? `${area} sq ft`
                : adjustedSquares > 0
                  ? `${adjustedSquares.toFixed(2)} adj. sq`
                  : "—"}
            </div>
          </div>

          <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.03] px-3 py-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Removal</div>
            <div className="mt-0.5 font-medium text-white/90">
              {includeDebrisRemoval ? "Included" : "Not included"}
            </div>
          </div>

          <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.03] px-3 py-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">System</div>
            <div className="mt-0.5 font-medium text-white/90">
              {roofingTier === "standard" ? "Core" : roofingTier === "enhanced" ? "Enhanced" : "Premium"}
            </div>
          </div>
        </div>
      </div>
    </div>

    <p className="mt-3 text-[13px] font-medium text-white/68">
      Job setup looks good — next you'll review the proposal before sending.
    </p>
  </div>
</div>
"""

new_lines = ["              " + line + "\n" for line in new_block.split("\n")]
# split drops trailing empty line if block ends with newline - handle last line
if new_block.endswith("\n"):
    pass  # last split part may be empty
out = lines[:3956] + new_lines + lines[4124:]
with open(path, "w", encoding="utf-8", newline="\n") as f:
    f.writelines(out)
print("OK", len(new_lines), "lines")
