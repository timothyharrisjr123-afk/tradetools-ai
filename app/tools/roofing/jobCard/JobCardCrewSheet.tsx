"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import TeamSheet, {
  TEAM_SHEET_DESTRUCTIVE,
  TEAM_SHEET_PRIMARY,
  TEAM_SHEET_SECONDARY,
} from "@/app/tools/settings/team/TeamSheet";
import { FOCUSED_EDITOR_INPUT, FOCUSED_EDITOR_LABEL } from "@/app/components/ui/FocusedEditor";
import {
  buildTeamBoardModel,
  crewLeadCandidates,
  readTeamBoardSnapshot,
  type TeamBoardCrew,
  type TeamBoardEntry,
  type TeamBoardMemberInput,
  type TeamBoardSnapshot,
} from "@/app/lib/team/teamBoardModel";
import { primaryActiveAssignment } from "@/app/lib/jobCrewAssignmentModel";
import {
  EARLIER_CREW_LIMIT,
  crewPeopleLabel,
  dispositionChangeNote,
  earlierCrewStints,
  jobCrewDisposition,
  jobCrewErrorMessage,
  ledByLine,
  listedAtAssignmentLabel,
  stintDateRange,
} from "@/app/lib/jobCrewAssignmentView";
import type {
  JobCrewAssignmentController,
  JobCrewLeadRef,
} from "@/app/tools/roofing/jobCard/useJobCrewAssignment";

type BoardState =
  | { status: "loading" }
  | { status: "ready"; snapshot: TeamBoardSnapshot }
  | { status: "failed" }
  | { status: "denied" };

type Step = "list" | "lead" | "create";
type Message = { text: string; tone: "error" | "info" };

const ROW =
  "flex w-full min-h-[56px] items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";
const ROW_IDLE = "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50";
const ROW_SELECTED = "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500";
const SECTION_LABEL = "text-xs font-medium uppercase tracking-wide text-slate-400";
const QUIET_LINK =
  "inline-flex min-h-[40px] items-center rounded-md px-1 text-sm font-medium text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

function leadRefFromKey(key: string | null): JobCrewLeadRef {
  if (!key) return null;
  if (key.startsWith("p:")) return { personId: key.slice(2) };
  if (key.startsWith("u:")) return { userId: key.slice(2) };
  return null;
}

function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `crew-create-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export type JobCardCrewSheetProps = {
  jobName: string;
  jobStatus: string | null | undefined;
  timezone: string | null;
  crew: JobCrewAssignmentController;
  members: readonly TeamBoardMemberInput[];
  onClose: () => void;
  /** Called after a successful write with the confirmation to show on the Job Card. */
  onSaved: (message: string) => void;
  onOpenActivity: () => void;
  /** The job's disposition changed underneath this sheet. */
  onJobChanged: () => void;
};

export default function JobCardCrewSheet({
  jobName,
  jobStatus,
  timezone,
  crew,
  members,
  onClose,
  onSaved,
  onOpenActivity,
  onJobChanged,
}: JobCardCrewSheetProps) {
  const current = crew.model ? primaryActiveAssignment(crew.model) : null;
  const disposition = jobCrewDisposition(jobStatus);
  const removeOnly = Boolean(current) && (disposition === "on_hold" || disposition === "lost");
  const currentLeadKey = current?.assignmentLeadPersonId ? `p:${current.assignmentLeadPersonId}` : null;

  const [board, setBoard] = useState<BoardState>({ status: "loading" });
  const [step, setStep] = useState<Step>("list");
  const [firstCrew, setFirstCrew] = useState(false);
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(current?.crewId ?? null);
  /** undefined = the selected Crew's default (current Lead, else usual Lead). */
  const [leadKey, setLeadKey] = useState<string | null | undefined>(undefined);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [earlierOpen, setEarlierOpen] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createLeadKey, setCreateLeadKey] = useState("");
  const createRequest = useRef<{ signature: string; requestId: string } | null>(null);
  const openedCreateForEmpty = useRef(false);

  const loadBoard = useCallback(async (): Promise<TeamBoardSnapshot | null> => {
    try {
      const res = await fetch("/api/team/board", { cache: "no-store" });
      if (res.status === 403) {
        setBoard({ status: "denied" });
        return null;
      }
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const snapshot = res.ok && body.ok === true ? readTeamBoardSnapshot(body.snapshot) : null;
      if (!snapshot) {
        setBoard({ status: "failed" });
        return null;
      }
      setBoard({ status: "ready", snapshot });
      return snapshot;
    } catch {
      setBoard({ status: "failed" });
      return null;
    }
  }, []);

  useEffect(() => {
    if (!removeOnly) void loadBoard();
  }, [loadBoard, removeOnly]);

  const model = useMemo(
    () =>
      board.status === "ready"
        ? buildTeamBoardModel({ snapshot: board.snapshot, members, accessAdmin: false })
        : null,
    [board, members]
  );
  const crews = useMemo(() => {
    if (!model) return [];
    const all = model.groups.flatMap((group) => group.crews);
    return all.sort((a, b) => {
      if (current && a.id === current.crewId) return -1;
      if (current && b.id === current.crewId) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [model, current]);

  useEffect(() => {
    if (!model || openedCreateForEmpty.current || removeOnly) return;
    openedCreateForEmpty.current = true;
    if (crews.length === 0 && !current) {
      setFirstCrew(true);
      setStep("create");
    }
  }, [model, crews.length, current, removeOnly]);

  const selectedCrew: TeamBoardCrew | null = crews.find((c) => c.id === selectedCrewId) ?? null;
  const selectedIsCurrent = Boolean(current && selectedCrewId === current.crewId);
  const selectedName = selectedCrew?.name ?? (selectedIsCurrent ? current!.crewCurrentName : "");

  const defaultLeadKey = selectedIsCurrent ? currentLeadKey : selectedCrew?.lead?.key ?? null;
  const effectiveLeadKey = leadKey === undefined ? defaultLeadKey : leadKey;
  const entryByKey = useMemo(() => new Map((model?.entries ?? []).map((e) => [e.key, e])), [model]);
  const leadName = (key: string | null): string | null => {
    if (!key) return null;
    const entry = entryByKey.get(key);
    if (entry) return entry.name;
    if (key === currentLeadKey) return current?.assignmentLeadNameSnapshot ?? null;
    return null;
  };
  const effectiveLeadName = leadName(effectiveLeadKey);

  const leadChanged = selectedIsCurrent && effectiveLeadKey !== currentLeadKey;
  const intent: "assign" | "switch" | "lead" | null = !selectedCrewId
    ? null
    : !current
      ? "assign"
      : !selectedIsCurrent
        ? "switch"
        : leadChanged
          ? "lead"
          : null;

  const earlier = useMemo(() => earlierCrewStints(crew.model), [crew.model]);

  const choose = (crewId: string) => {
    setSelectedCrewId(crewId);
    setLeadKey(undefined);
    setConfirmRemove(false);
    setMessage(null);
  };

  const handleFailure = async (code: string) => {
    const tone: Message["tone"] = code === "stale_assignment" ? "info" : "error";
    setMessage({ text: jobCrewErrorMessage(code, jobStatus), tone });
    if (code === "disposition_blocks_assignment") onJobChanged();
    if (code === "crew_not_eligible") {
      setSelectedCrewId(null);
      setLeadKey(undefined);
      await loadBoard();
    }
    if (code === "lead_not_eligible") {
      setLeadKey(undefined);
      await loadBoard();
    }
  };

  const submit = async () => {
    if (!selectedCrewId || !intent || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await crew.setPrimary({
        crewId: selectedCrewId,
        lead: leadRefFromKey(effectiveLeadKey),
        expectedPrimaryAssignmentId: current?.id ?? null,
      });
      if (result.ok) {
        onSaved(
          intent === "assign"
            ? `${selectedName} is on this job.`
            : intent === "switch"
              ? `${selectedName} is now on this job.`
              : effectiveLeadName
                ? `${effectiveLeadName} is leading ${selectedName} on this job.`
                : `No one is leading ${selectedName} on this job now.`
        );
        return;
      }
      await handleFailure(result.code);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!current || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const name = current.crewCurrentName;
      const result = await crew.end(current.id);
      if (result.ok) {
        onSaved(`${name} is off this job.`);
        return;
      }
      setConfirmRemove(false);
      await handleFailure(result.code);
    } finally {
      setBusy(false);
    }
  };

  const createCrew = async () => {
    const name = createName.trim();
    if (!name || busy) return;
    const lead = createLeadKey ? entryByKey.get(createLeadKey) ?? null : null;
    const signature = `${name}|${createLeadKey}`;
    if (createRequest.current?.signature !== signature) {
      createRequest.current = { signature, requestId: newRequestId() };
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/team/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_crew",
          name,
          lead: lead ? (lead.personId ? { personId: lead.personId } : { userId: lead.userId }) : null,
          requestId: createRequest.current.requestId,
        }),
      });
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok || body?.ok !== true || typeof body.crewId !== "string") {
        if (res.status === 403) {
          createRequest.current = null;
          setMessage({ text: "You don't have access to create crews.", tone: "error" });
        } else if (res.status >= 400 && res.status < 500) {
          createRequest.current = null;
          setMessage({ text: "Check the crew name and try again.", tone: "error" });
        } else {
          setMessage({ text: "Couldn't save. Try again.", tone: "error" });
        }
        return;
      }
      createRequest.current = null;
      await loadBoard();
      setSelectedCrewId(body.crewId);
      setLeadKey(undefined);
      setCreateName("");
      setCreateLeadKey("");
      setFirstCrew(false);
      setStep("list");
    } catch {
      setMessage({ text: "Couldn't save. Try again.", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const messageLine = message ? (
    <p
      className={`mb-2 text-sm ${message.tone === "error" ? "text-rose-700" : "text-slate-700"}`}
      role={message.tone === "error" ? "alert" : "status"}
      data-job-crew-message={message.tone}
    >
      {message.text}
    </p>
  ) : null;

  const earlierSection =
    earlier.length > 0 ? (
      <div className="mt-6 border-t border-slate-100 pt-4" data-job-crew-earlier>
        <button
          type="button"
          className="flex min-h-[40px] w-full items-center justify-between text-left text-sm font-medium text-slate-700"
          aria-expanded={earlierOpen}
          onClick={() => setEarlierOpen((open) => !open)}
        >
          Earlier on this job
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition ${earlierOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
        {earlierOpen ? (
          <div className="mt-2 space-y-3">
            <ul className="space-y-3">
              {earlier.slice(0, EARLIER_CREW_LIMIT).map((stint) => (
                <li key={stint.key} className="text-sm" data-job-crew-earlier-item>
                  <p className="font-medium text-slate-900 [overflow-wrap:anywhere]">{stint.crewName}</p>
                  <p className="text-slate-500">{stintDateRange(stint, timezone)}</p>
                  {ledByLine(stint.leadName) ? (
                    <p className="text-slate-600 [overflow-wrap:anywhere]">{ledByLine(stint.leadName)}</p>
                  ) : null}
                  <p className="text-xs text-slate-400">{listedAtAssignmentLabel(stint.rosterListedCount)}</p>
                </li>
              ))}
            </ul>
            <button type="button" className={QUIET_LINK} onClick={onOpenActivity} data-job-crew-see-activity>
              See all in Activity
            </button>
          </div>
        ) : null}
      </div>
    ) : null;

  const removeConfirmFooter = current ? (
    <div data-job-crew-remove-confirm>
      <p className="mb-3 text-sm text-slate-700 [overflow-wrap:anywhere]">
        Remove {current.crewCurrentName} from this job? You can assign a crew again anytime.
      </p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className={TEAM_SHEET_SECONDARY}
          onClick={() => setConfirmRemove(false)}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className={TEAM_SHEET_DESTRUCTIVE}
          onClick={() => void remove()}
          disabled={busy}
          data-job-crew-remove-submit
        >
          {busy ? "Removing…" : "Remove crew"}
        </button>
      </div>
    </div>
  ) : null;

  if (removeOnly && current) {
    return (
      <TeamSheet
        view="job-crew-hold"
        title="Crew on this job"
        subtitle={jobName}
        backLabel="Job"
        busy={busy}
        onClose={onClose}
        footer={
          <>
            {messageLine}
            {confirmRemove ? (
              removeConfirmFooter
            ) : (
              <div className="flex justify-end">
                <button
                  type="button"
                  className={TEAM_SHEET_SECONDARY}
                  onClick={() => setConfirmRemove(true)}
                  data-job-crew-remove
                >
                  Remove crew from job
                </button>
              </div>
            )}
          </>
        }
      >
        <div className="space-y-1" data-job-crew-current>
          <p className="text-base font-semibold text-slate-900 [overflow-wrap:anywhere]">
            {current.crewCurrentName}
          </p>
          {ledByLine(current.assignmentLeadNameSnapshot) ? (
            <p className="text-sm text-slate-600 [overflow-wrap:anywhere]">
              {ledByLine(current.assignmentLeadNameSnapshot)}
            </p>
          ) : null}
        </div>
        {message ? null : (
          <p className="mt-4 text-sm text-slate-600" data-job-crew-disposition-note>
            {dispositionChangeNote(disposition, true)}
          </p>
        )}
        {earlierSection}
      </TeamSheet>
    );
  }

  if (step === "create") {
    const leadOptions = model ? crewLeadCandidates(model) : [];
    const canGoBack = !firstCrew || crews.length > 0;
    return (
      <TeamSheet
        view="job-crew-create"
        title={firstCrew ? "Create your first crew" : "Create crew"}
        subtitle={jobName}
        backLabel={canGoBack ? "Crews" : "Job"}
        onBack={canGoBack ? () => { setMessage(null); setStep("list"); } : undefined}
        dirty={createName.trim() !== "" || createLeadKey !== ""}
        busy={busy}
        onClose={onClose}
        footer={
          <>
            {messageLine}
            <div className="flex justify-end">
              <button
                type="button"
                className={TEAM_SHEET_PRIMARY}
                disabled={busy || !createName.trim()}
                onClick={() => void createCrew()}
                data-job-crew-create-save
              >
                {busy ? "Creating…" : "Create crew"}
              </button>
            </div>
          </>
        }
      >
        <div className="space-y-4">
          {firstCrew ? (
            <p className="text-sm text-slate-600">
              A crew is the group of people who do the work. Name it now and add people from Team later.
            </p>
          ) : null}
          <label className={FOCUSED_EDITOR_LABEL}>
            Crew name
            <input
              className={FOCUSED_EDITOR_INPUT}
              value={createName}
              maxLength={80}
              placeholder="Harris Crew"
              onChange={(event) => setCreateName(event.target.value)}
              autoFocus
              data-job-crew-create-name
            />
          </label>
          <label className={FOCUSED_EDITOR_LABEL}>
            <span>
              Who usually leads this crew? <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <select
              className={FOCUSED_EDITOR_INPUT}
              value={createLeadKey}
              onChange={(event) => setCreateLeadKey(event.target.value)}
              data-job-crew-create-lead
            >
              <option value="">Choose later</option>
              {leadOptions.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </TeamSheet>
    );
  }

  if (step === "lead" && selectedCrewId) {
    const onCrewKeys = new Set<string>();
    if (selectedCrew?.lead) onCrewKeys.add(selectedCrew.lead.key);
    for (const member of selectedCrew?.members ?? []) onCrewKeys.add(member.key);
    const all = model ? crewLeadCandidates(model) : [];
    const onCrew = all.filter((entry) => onCrewKeys.has(entry.key));
    const everyoneElse = all.filter((entry) => !onCrewKeys.has(entry.key));
    const pick = (key: string | null) => {
      setLeadKey(key);
      setMessage(null);
      setStep("list");
    };
    const option = (key: string | null, label: string, hint?: string) => {
      const selected = effectiveLeadKey === key;
      return (
        <li key={key ?? "none"}>
          <button
            type="button"
            className={`${ROW} ${selected ? ROW_SELECTED : ROW_IDLE}`}
            onClick={() => pick(key)}
            aria-pressed={selected}
            data-job-crew-lead-option={key ?? "none"}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-900 [overflow-wrap:anywhere]">{label}</span>
              {hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
            </span>
            {selected ? <Check className="h-4 w-4 shrink-0 text-blue-600" aria-hidden /> : null}
          </button>
        </li>
      );
    };
    const usualKey = selectedCrew?.lead?.key ?? null;
    const renderEntry = (entry: TeamBoardEntry) =>
      option(entry.key, entry.name, entry.key === usualKey ? "Usually leads this crew" : undefined);
    return (
      <TeamSheet
        view="job-crew-lead"
        title="Who's leading this crew on this job?"
        subtitle={selectedName}
        backLabel={selectedName || "Crews"}
        onBack={() => setStep("list")}
        onClose={onClose}
      >
        <ul className="space-y-2">{option(null, "No one")}</ul>
        {onCrew.length > 0 ? (
          <div className="mt-5">
            <p className={SECTION_LABEL}>On {selectedName}</p>
            <ul className="mt-2 space-y-2">{onCrew.map(renderEntry)}</ul>
          </div>
        ) : null}
        {everyoneElse.length > 0 ? (
          <div className="mt-5">
            <p className={SECTION_LABEL}>Everyone else</p>
            <ul className="mt-2 space-y-2">{everyoneElse.map(renderEntry)}</ul>
          </div>
        ) : null}
        {board.status === "failed" ? (
          <p className="mt-4 text-sm text-slate-600">People couldn&apos;t be loaded.</p>
        ) : null}
      </TeamSheet>
    );
  }

  const primaryLabel =
    intent === "switch"
      ? `Switch to ${selectedName}`
      : intent === "lead"
        ? "Save"
        : intent === "assign"
          ? `Assign ${selectedName}`
          : current
            ? "Save"
            : "Assign crew";

  const footer = confirmRemove ? (
    <>
      {messageLine}
      {removeConfirmFooter}
    </>
  ) : (
    <>
      {messageLine}
      {selectedCrewId ? (
        <div className="mb-3 flex items-center justify-between gap-3" data-job-crew-lead-line>
          <div className="min-w-0">
            <p className="text-xs text-slate-500">Leading this crew</p>
            <p className="text-sm font-medium text-slate-900 [overflow-wrap:anywhere]" data-job-crew-lead-value>
              {effectiveLeadName ?? "No one"}
            </p>
          </div>
          <button
            type="button"
            className={QUIET_LINK}
            onClick={() => {
              setMessage(null);
              setStep("lead");
            }}
            disabled={busy || !model}
            data-job-crew-lead-change
          >
            {effectiveLeadName ? "Change" : "Add"}
          </button>
        </div>
      ) : null}
      <button
        type="button"
        className={`${TEAM_SHEET_PRIMARY} w-full`}
        disabled={busy || !intent}
        onClick={() => void submit()}
        data-job-crew-submit={intent ?? "none"}
      >
        {busy ? "Saving…" : primaryLabel}
      </button>
    </>
  );

  return (
    <TeamSheet
      view="job-crew-assign"
      title={current ? "Change crew" : "Assign crew"}
      subtitle={jobName}
      backLabel="Job"
      busy={busy}
      onClose={onClose}
      footer={footer}
    >
      {board.status === "loading" ? (
        <p className="text-sm text-slate-500" data-job-crew-board-loading>
          Loading crews…
        </p>
      ) : board.status === "denied" ? (
        <p className="text-sm text-slate-600">You don&apos;t have access to change the crew on this job.</p>
      ) : board.status === "failed" ? (
        <div className="space-y-2" data-job-crew-board-failed>
          <p className="text-sm text-slate-700">Crews couldn&apos;t be loaded.</p>
          <button type="button" className={QUIET_LINK} onClick={() => void loadBoard()}>
            Try again
          </button>
        </div>
      ) : (
        <>
          {crews.length === 0 ? (
            <p className="mb-3 text-sm text-slate-600">No crews yet.</p>
          ) : (
            <ul className="space-y-2" role="list" data-job-crew-list>
              {crews.map((row) => {
                const selected = row.id === selectedCrewId;
                const isCurrent = Boolean(current && row.id === current.crewId);
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={`${ROW} ${selected ? ROW_SELECTED : ROW_IDLE}`}
                      onClick={() => choose(row.id)}
                      aria-pressed={selected}
                      data-job-crew-option={row.id}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">
                            {row.name}
                          </span>
                          {isCurrent ? (
                            <span
                              className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                              data-job-crew-current-tag
                            >
                              Current
                            </span>
                          ) : null}
                        </span>
                        {row.lead ? (
                          <span className="block text-xs text-slate-500 [overflow-wrap:anywhere]">
                            {row.lead.name}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">{crewPeopleLabel(row.memberCount)}</span>
                      {selected ? <Check className="h-4 w-4 shrink-0 text-blue-600" aria-hidden /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <button
            type="button"
            className={`${QUIET_LINK} mt-3 gap-1.5`}
            onClick={() => {
              setMessage(null);
              setFirstCrew(false);
              setStep("create");
            }}
            disabled={busy}
            data-job-crew-create
          >
            <Plus className="h-4 w-4" aria-hidden />
            Create crew
          </button>
        </>
      )}
      {current && !confirmRemove ? (
        <div className="mt-4">
          <button
            type="button"
            className="inline-flex min-h-[40px] items-center rounded-md px-1 text-sm font-medium text-rose-700 hover:text-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            onClick={() => {
              setMessage(null);
              setConfirmRemove(true);
            }}
            disabled={busy}
            data-job-crew-remove
          >
            Remove crew from job
          </button>
        </div>
      ) : null}
      {earlierSection}
    </TeamSheet>
  );
}
