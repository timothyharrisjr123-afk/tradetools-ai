"use client";

/**
 * Team Board (Phase 13C). Operations / Team.
 *
 * SCREEN JOB — Your people and crews.
 * FIRST SCAN — crews and their people. A crew with a usual Lead is shown with that
 * person, and with the jobs that person coordinates this week; a crew without one
 * is a complete crew card of its own. SECOND — people not on a crew.
 * THIRD — FieldDive invitations.
 * Access is deep administration: reached from a person, never the board's subject.
 * Access never titles, places, or orders a person on the board.
 *
 * A person is not a login. A crew is not access. Crew membership never grants
 * FieldDive access; FieldDive access never implies crew membership. Nothing is
 * inferred from names. Weekly work is Calendar truth (scheduled jobs) joined to the
 * job's coordinator; there is no crew-to-job assignment yet and none is implied.
 * There is no availability truth, so no availability is shown.
 *
 * Structure is ready for drag and drop without redesign: every crew roster and
 * the not-on-a-crew list are drop targets (data-team-drop-target) and every person
 * row is a movable unit (data-team-movable). Drag and drop is not implemented.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { FOCUSED_EDITOR_INPUT, FOCUSED_EDITOR_LABEL } from "@/app/components/ui/FocusedEditor";
import { buildJobCardHref } from "@/app/lib/proposalBuilderReadiness";
import {
  buildTeamBoardModel,
  crewAddCandidates,
  crewLeadCandidates,
  filterTeamBoard,
  readTeamBoardSnapshot,
  searchTeamEntries,
  workLabel,
  type TeamBoardCrew,
  type TeamBoardEntry,
  type TeamBoardFilter,
  type TeamBoardGroup,
  type TeamBoardInviteInput,
  type TeamBoardModel,
  type TeamBoardSnapshot,
} from "@/app/lib/team/teamBoardModel";
import { readTeamWeek, weekDayLabel, weekJobsFor, type TeamWeek, type TeamWeekJob } from "@/app/lib/team/teamWeek";
import { useCompanyMembers } from "@/app/tools/roofing/jobCard/useCompanyMembers";
import CompanyTeamClient, { type TeamAccessRequest } from "@/app/tools/settings/team/CompanyTeamClient";
import TeamSheet, { TEAM_SHEET_PRIMARY, TEAM_SHEET_SECONDARY } from "@/app/tools/settings/team/TeamSheet";

type BoardState =
  | { status: "loading" }
  | { status: "ready"; snapshot: TeamBoardSnapshot }
  | { status: "denied"; message: string }
  | { status: "failed"; message: string };

type Notice = { text: string; tone?: "error"; undo?: () => Promise<void> };

type Dialog = { type: "add_person" } | { type: "create_crew"; leadKey?: string } | { type: "person"; key: string } | null;

type CrewEdit = { crewId: string; mode: "add" | "lead" | "rename" | "archive" } | null;

const CALENDAR_HREF = "/tools/roofing/calendar";

const CARD = "min-w-0 rounded-xl bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_1px_8px_rgba(15,23,42,0.03)] ring-1 ring-slate-200/70";
const HEADER_BUTTON =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";
const SMALL_ACTION =
  "inline-flex min-h-[36px] items-center gap-1 rounded-md px-2 text-[13px] font-medium text-blue-700 transition hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";
const ICON_BUTTON =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";
// Desktop hover/focus control; on mobile, removal lives in the person detail.
const REMOVE_FROM_CREW_BUTTON =
  "hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:inline-flex sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100";
const QUIET_LINK =
  "inline-flex min-h-[44px] items-center rounded text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";
const PANEL_TITLE = "text-[11px] font-bold uppercase tracking-[0.08em] text-slate-700";

// Soft identity tints for Lead anchors, in board order. Decorative only.
const LEAD_TINTS = [
  { panel: "bg-slate-50", avatar: "bg-blue-100 text-blue-700" },
  { panel: "bg-emerald-50/70", avatar: "bg-emerald-100 text-emerald-700" },
  { panel: "bg-indigo-50/60", avatar: "bg-indigo-100 text-indigo-700" },
  { panel: "bg-amber-50/70", avatar: "bg-amber-100 text-amber-800" },
  { panel: "bg-violet-50/60", avatar: "bg-violet-100 text-violet-700" },
];

const FILTERS: { key: TeamBoardFilter; label: string }[] = [
  { key: "all", label: "All crews" },
  { key: "leads", label: "Leads" },
  { key: "not_on_crew", label: "Not on a crew" },
  { key: "invited", label: "Invited" },
];

function requestId() {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `team-board.${id}`.slice(0, 120);
}

function initials(name: string): string {
  const words = name.replace(/@.*/, "").split(/[\s._-]+/).filter((word) => /^\p{L}/u.test(word));
  const letters = words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}` : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

function expiryLabel(iso: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "";
  const date = new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return time < Date.now() ? `Expired ${date}` : `Expires ${date}`;
}

function Avatar({
  name,
  size = "md",
  muted = false,
  tint,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  muted?: boolean;
  tint?: string;
}) {
  const box = size === "lg" ? "h-11 w-11 text-[15px]" : size === "md" ? "h-9 w-9 text-xs" : "h-8 w-8 text-[11px]";
  const tone = muted ? "bg-slate-50 text-slate-300" : tint ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`${box} ${tone} inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide`} aria-hidden>
      {initials(name)}
    </span>
  );
}

/** Exceptional FieldDive state only. Active access and "no login" are not badges. */
function AccessState({ entry }: { entry: TeamBoardEntry }) {
  if (entry.access === "invited") {
    return (
      <span className="shrink-0 text-xs font-medium text-blue-600" data-team-access-state="invited">
        Invited
      </span>
    );
  }
  if (entry.access !== "removed") return null;
  return (
    <span className="shrink-0 text-xs font-medium text-slate-400" data-team-access-state="removed">
      Access removed
    </span>
  );
}

function entryRef(entry: TeamBoardEntry) {
  return entry.personId ? { personId: entry.personId } : { userId: entry.userId };
}

function Menu({ label, items }: { label: string; items: { label: string; onSelect: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  if (items.length === 0) return null;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={ICON_BUTTON}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-9 z-30 w-52 overflow-hidden rounded-lg bg-white py-1 shadow-lg ring-1 ring-slate-200">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`block min-h-[40px] w-full px-3 text-left text-sm hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none ${
                item.danger ? "text-rose-700" : "text-slate-800"
              }`}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PersonName({ entry, onOpen, className }: { entry: TeamBoardEntry; onOpen: () => void; className: string }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`max-w-full rounded text-left [overflow-wrap:anywhere] hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`}
    >
      {entry.name}
    </button>
  );
}

/**
 * Secondary line under a name: operational facts only. FieldDive access labels are
 * not titles and never appear here; they live in the person's FieldDive detail.
 */
function subline(entry: TeamBoardEntry, placement: "lead" | "not_on_crew"): string | null {
  const leads = entry.leadsCrewIds.length;
  if (placement === "lead") return leads > 1 ? `${leads} crews` : null;
  return workLabel(entry.work);
}

function crewCountLabel(crew: TeamBoardCrew): string {
  const count = crew.memberCount;
  if (count === 0) return "No people listed";
  const base = `${count} ${count === 1 ? "person" : "people"}`;
  return crew.leadIsMember && crew.lead ? `${base}, including ${crew.lead.name.split(/[\s@]/)[0]}` : base;
}

/** A support panel: tinted header strip, uppercase title, optional count and menu. */
function SidePanel({
  tone,
  icon,
  title,
  count,
  menu,
  children,
  ...rest
}: {
  tone: "not_on_crew" | "invited";
  icon: ReactNode;
  title: ReactNode;
  count?: number;
  menu?: ReactNode;
  children: ReactNode;
} & Record<`data-${string}` | "aria-label", string | undefined>) {
  const strip = tone === "invited" ? "bg-blue-50/70" : "bg-slate-50";
  const chip = tone === "invited" ? "bg-blue-100/80 text-blue-600" : "bg-slate-100 text-slate-500";
  return (
    <section className={CARD} {...rest}>
      <header className={`flex min-h-[44px] items-center gap-2.5 rounded-lg px-2 py-1.5 ${strip}`}>
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${chip}`} aria-hidden>
          {icon}
        </span>
        <h2 className={`${PANEL_TITLE} min-w-0 flex-1`}>
          {title}
          {count ? <span className="ml-1.5 font-semibold text-slate-400">{count}</span> : null}
        </h2>
        {menu}
      </header>
      {children}
    </section>
  );
}

function WeekWork({
  leadName,
  jobs,
  expanded,
  onToggle,
}: {
  leadName: string;
  jobs: TeamWeekJob[] | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (!jobs) return null;
  if (jobs.length === 0) {
    return (
      <p className="mt-3 flex min-h-[40px] items-center gap-2 rounded-lg bg-slate-50 px-3 text-[13px] text-slate-500" data-team-week="none">
        <Users className="h-4 w-4 text-slate-400" aria-hidden />
        No jobs this week
      </p>
    );
  }
  const count = (
    <>
      Coordinates <strong className="font-semibold">{jobs.length}</strong> {jobs.length === 1 ? "job" : "jobs"} this week
    </>
  );
  return (
    <div className={`mt-3 overflow-hidden rounded-lg ${expanded ? "ring-1 ring-blue-100" : ""}`} data-team-week={expanded ? "open" : "closed"}>
      <button
        type="button"
        className="flex min-h-[40px] w-full items-center gap-2 bg-blue-50/80 px-3 text-left text-[13px] text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
        aria-expanded={expanded}
        aria-label={`${leadName}: ${jobs.length} ${jobs.length === 1 ? "job" : "jobs"} this week`}
        onClick={onToggle}
        data-team-week-toggle
      >
        <Users className="h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">{count}</span>
        {expanded ? <ChevronDown className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />}
      </button>
      {expanded ? (
        <div className="bg-white" data-team-week-panel>
          <ul className="divide-y divide-slate-100 px-3">
            {jobs.map((job) => (
              <li key={job.jobId}>
                <Link
                  href={buildJobCardHref(job.jobId)}
                  className="flex min-h-[56px] min-w-0 items-center gap-3 py-2 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  data-team-week-job
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500" aria-hidden>
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-slate-900">{job.customerName}</span>
                    {job.address ? <span className="block truncate text-xs text-slate-500">{job.address}</span> : null}
                  </span>
                  <span className="shrink-0 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                    {weekDayLabel(job.startsOn)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="px-3 pb-3 pt-1">
            <Link
              href={CALENDAR_HREF}
              className="flex min-h-[36px] items-center justify-center gap-1.5 rounded-md bg-slate-50 text-xs font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              data-team-week-calendar
            >
              View in calendar
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function TeamBoardClient({ companyId }: { companyId: string }) {
  const team = useCompanyMembers(Boolean(companyId));
  const { canAdminMembers, viewerRole, viewerUserId } = team;
  const [board, setBoard] = useState<BoardState>({ status: "loading" });
  const [invitations, setInvitations] = useState<TeamBoardInviteInput[]>([]);
  const [invitationsRead, setInvitationsRead] = useState<"loading" | "ready" | "failed">("loading");
  const [week, setWeek] = useState<TeamWeek | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [edit, setEdit] = useState<CrewEdit>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [accessRequest, setAccessRequest] = useState<TeamAccessRequest | null>(null);
  const [filter, setFilter] = useState<TeamBoardFilter>("all");
  const [query, setQuery] = useState("");
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(() => new Set());

  const loadBoard = useCallback(async () => {
    try {
      const res = await fetch("/api/team/board", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.status === 403) {
        setBoard({ status: "denied", message: String(body.message ?? "Crews are managed by the people who run production.") });
        return;
      }
      const snapshot = res.ok && body.ok === true ? readTeamBoardSnapshot(body.snapshot) : null;
      if (!snapshot) {
        setBoard({ status: "failed", message: "Crews are unavailable right now." });
        return;
      }
      setBoard({ status: "ready", snapshot });
    } catch {
      setBoard({ status: "failed", message: "Crews are unavailable right now." });
    }
  }, []);

  const loadInvitations = useCallback(async () => {
    if (!canAdminMembers) return;
    try {
      const res = await fetch("/api/company/invitations/pending", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; invitations?: TeamBoardInviteInput[] };
      if (res.ok && body.ok === true && Array.isArray(body.invitations)) {
        setInvitations(body.invitations);
        setInvitationsRead("ready");
      } else {
        setInvitationsRead("failed");
      }
    } catch {
      // The board stays usable; people without a login read as unverified, never as no access.
      setInvitationsRead("failed");
    }
  }, [canAdminMembers]);

  const loadWeek = useCallback(async () => {
    try {
      const res = await fetch("/api/team/week", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; week?: unknown };
      // Unreadable work is hidden, never shown as "no jobs".
      setWeek(res.ok && body.ok === true ? readTeamWeek(body.week) : null);
    } catch {
      setWeek(null);
    }
  }, []);

  useEffect(() => {
    void loadBoard();
    void loadWeek();
  }, [loadBoard, loadWeek]);
  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  const membersReady = !team.loading && viewerRole != null;
  const model: TeamBoardModel | null = useMemo(() => {
    if (board.status !== "ready" || !membersReady) return null;
    return buildTeamBoardModel({
      snapshot: board.snapshot,
      members: team.members,
      invitations,
      invitationsRead: canAdminMembers ? invitationsRead : "hidden",
      accessAdmin: canAdminMembers,
    });
  }, [board, membersReady, team.members, invitations, invitationsRead, canAdminMembers]);
  const view = useMemo(
    () => (model ? filterTeamBoard(model, { filter, query, canSeeInvites: canAdminMembers }) : null),
    [model, filter, query, canAdminMembers]
  );

  const act = useCallback(
    async (payload: Record<string, unknown>, success?: string | ((result: Record<string, unknown>) => Notice | null)) => {
      setBusy(true);
      try {
        const res = await fetch("/api/team/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: requestId(), ...payload }),
        });
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok || body.ok !== true) {
          setNotice({ text: String(body.message ?? "That didn't save. Try again."), tone: "error" });
          await loadBoard();
          return null;
        }
        await loadBoard();
        if (typeof success === "string") setNotice({ text: success });
        else if (success) setNotice(success(body));
        return body;
      } catch {
        setNotice({ text: "That didn't save. Check your connection and try again.", tone: "error" });
        return null;
      } finally {
        setBusy(false);
      }
    },
    [loadBoard]
  );

  const openPerson = (entry: TeamBoardEntry) => setDialog({ type: "person", key: entry.key });
  const crewById = (id: string) => model?.groups.flatMap((g) => g.crews).find((c) => c.id === id) ?? null;
  const toggleWeek = (key: string) =>
    setOpenWeeks((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const removeMember = async (crew: TeamBoardCrew, entry: TeamBoardEntry) => {
    if (!entry.personId) return;
    const personId = entry.personId;
    await act({ action: "remove_member", crewId: crew.id, personId }, () => ({
      text: `${entry.name} is off ${crew.name}.`,
      undo: async () => {
        await act({ action: "add_member", crewId: crew.id, person: { personId } }, `${entry.name} is back on ${crew.name}.`);
      },
    }));
  };

  // ---- Sections ---------------------------------------------------------------
  const renderCrew = (crew: TeamBoardCrew, first: boolean) => {
    // Editors act on the full crew, not a search-filtered view of it.
    const full = crewById(crew.id) ?? crew;
    const editing = edit?.crewId === crew.id ? edit.mode : null;
    const count = full.memberCount;
    return (
      <section
        key={crew.id}
        className={`${first ? "mt-0.5" : "mt-3"} min-w-0`}
        aria-label={crew.name}
        data-team-crew={crew.id}
        data-team-drop-target="crew"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 ring-1 ring-slate-200/70" aria-hidden>
            <Building2 className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-slate-900" data-team-crew-name>
              {crew.name}
            </h3>
            <p className="text-xs text-slate-500" data-team-crew-count>
              {crewCountLabel(full)}
            </p>
          </div>
          <button
            type="button"
            className={SMALL_ACTION}
            onClick={() => setEdit({ crewId: crew.id, mode: "add" })}
            data-team-add-to-crew-open
            aria-label={`Add to ${crew.name}`}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add
          </button>
          <Menu
            label={`${crew.name} options`}
            items={[
              { label: full.lead ? "Change Crew Lead" : "Choose Crew Lead", onSelect: () => setEdit({ crewId: crew.id, mode: "lead" }) },
              { label: "Rename crew", onSelect: () => setEdit({ crewId: crew.id, mode: "rename" }) },
              { label: "Archive crew", danger: true, onSelect: () => setEdit({ crewId: crew.id, mode: "archive" }) },
            ]}
          />
        </div>

        {editing === "lead" ? (
          <LeadEditor
            crew={full}
            model={model!}
            busy={busy}
            onCancel={() => setEdit(null)}
            onSave={async (entry) => {
              const saved = await act(
                { action: "update_crew", crewId: crew.id, expectedRowVersion: full.rowVersion, lead: entry ? entryRef(entry) : null },
                entry ? `${entry.name} now leads ${crew.name}.` : `${crew.name} has no usual Lead.`
              );
              if (saved) setEdit(null);
            }}
          />
        ) : null}
        {editing === "rename" ? (
          <RenameEditor
            crew={full}
            busy={busy}
            onCancel={() => setEdit(null)}
            onSave={async (name) => {
              const saved = await act({ action: "update_crew", crewId: crew.id, expectedRowVersion: full.rowVersion, name }, `Renamed to ${name}.`);
              if (saved) setEdit(null);
            }}
          />
        ) : null}
        {editing === "archive" ? (
          <div className="mt-3 rounded-lg bg-slate-50 p-3" data-team-archive-confirm>
            <p className="text-sm text-slate-800">
              Archive {crew.name}? People stay on your team
              {count > 0 ? " and show under Not on a crew if they're on no other crew" : ""}.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="inline-flex min-h-[40px] items-center rounded-lg bg-rose-600 px-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                disabled={busy}
                onClick={async () => {
                  const saved = await act({ action: "archive_crew", crewId: crew.id, expectedRowVersion: full.rowVersion }, `${crew.name} archived.`);
                  if (saved) setEdit(null);
                }}
              >
                Archive crew
              </button>
              <button type="button" className={TEAM_SHEET_SECONDARY} onClick={() => setEdit(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {crew.members.length > 0 ? (
          <ul className="ml-4 mt-1 divide-y divide-slate-100 border-l-2 border-slate-200 pl-3" data-team-crew-roster>
            {crew.members.map((entry) => (
              <li
                key={entry.key}
                className="group flex min-h-[44px] min-w-0 items-center gap-3 py-1 transition-colors"
                data-team-crew-member
                data-team-movable
                data-team-person-key={entry.key}
              >
                <Avatar name={entry.name} size="sm" muted={entry.access === "removed"} />
                <div className="min-w-0 flex-1">
                  <PersonName
                    entry={entry}
                    onOpen={() => openPerson(entry)}
                    className={`text-[13px] font-medium ${entry.access === "removed" ? "text-slate-500" : "text-slate-800"}`}
                  />
                </div>
                <AccessState entry={entry} />
                <button
                  type="button"
                  className={REMOVE_FROM_CREW_BUTTON}
                  aria-label={`Remove ${entry.name} from ${crew.name}`}
                  disabled={busy}
                  onClick={() => void removeMember(full, entry)}
                  data-team-remove-from-crew
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {editing === "add" ? (
          <AddToCrew
            crew={full}
            candidates={crewAddCandidates(model!, full)}
            model={model!}
            busy={busy}
            onDone={() => setEdit(null)}
            onAddExisting={(entry) => act({ action: "add_member", crewId: crew.id, person: entryRef(entry) }, `${entry.name} added to ${crew.name}.`)}
            onAddNew={(name) => act({ action: "add_member", crewId: crew.id, newPerson: { name } }, `${name} added to ${crew.name}.`)}
          />
        ) : null}
      </section>
    );
  };

  const renderGroup = (group: TeamBoardGroup, index: number) => {
    const lead = group.lead;
    const tint = LEAD_TINTS[index % LEAD_TINTS.length];
    return (
      <article key={group.key} className={`${CARD} mb-4 break-inside-avoid`} data-team-lead-group={lead ? "lead" : "crew"}>
        {lead ? (
          <header className={`flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 ${tint.panel}`} data-team-lead data-team-person-key={lead.key}>
            <Avatar name={lead.name} size="lg" muted={lead.access === "removed"} tint={tint.avatar} />
            <div className="min-w-0 flex-1">
              <PersonName entry={lead} onOpen={() => openPerson(lead)} className="text-[15px] font-bold text-slate-900" />
              {subline(lead, "lead") ? <p className="text-[13px] text-slate-500">{subline(lead, "lead")}</p> : null}
            </div>
            <AccessState entry={lead} />
            <Menu
              label={`${lead.name} options`}
              items={[
                { label: "View person", onSelect: () => openPerson(lead) },
                { label: `New crew led by ${lead.name.split(/[\s@]/)[0]}`, onSelect: () => setDialog({ type: "create_crew", leadKey: lead.key }) },
              ]}
            />
          </header>
        ) : null}
        {group.crews.map((crew, i) => renderCrew(crew, !lead && i === 0))}
        {lead ? (
          <WeekWork
            leadName={lead.name}
            jobs={weekJobsFor(week, lead.access === "active" ? lead.userId : null)}
            expanded={openWeeks.has(group.key)}
            onToggle={() => toggleWeek(group.key)}
          />
        ) : null}
      </article>
    );
  };

  const personRow = (entry: TeamBoardEntry) => (
    <li key={entry.key} className="flex min-h-[52px] min-w-0 items-center gap-3 py-1.5" data-team-movable data-team-person-key={entry.key}>
      <Avatar name={entry.name} muted={entry.access === "removed"} />
      <div className="min-w-0 flex-1">
        <PersonName
          entry={entry}
          onOpen={() => openPerson(entry)}
          className={`text-[13px] font-semibold ${entry.access === "removed" ? "text-slate-500" : "text-slate-900"}`}
        />
        {subline(entry, "not_on_crew") ? <p className="text-xs text-slate-500">{subline(entry, "not_on_crew")}</p> : null}
      </div>
      <AccessState entry={entry} />
    </li>
  );

  const notOnCrewPanel =
    view && view.show.notOnCrew && (view.notOnCrew.length > 0 || !query.trim()) ? (
      <SidePanel
        key="not_on_crew"
        tone="not_on_crew"
        icon={<Users className="h-4 w-4" strokeWidth={1.75} />}
        title="Not on a crew"
        count={view.notOnCrew.length}
        menu={<Menu label="Not on a crew options" items={[{ label: "Add person", onSelect: () => setDialog({ type: "add_person" }) }]} />}
        aria-label="Not on a crew"
        data-team-not-on-crew=""
        data-team-drop-target="not-on-crew"
      >
        <p className="mt-2 px-2 text-xs text-slate-500">On your team, not on a crew.</p>
        {view.notOnCrew.length > 0 ? (
          <ul className="mt-1 divide-y divide-slate-100 px-2">{view.notOnCrew.map((entry) => personRow(entry))}</ul>
        ) : (
          <p className="px-2 py-3 text-sm text-slate-500">Everyone is on a crew.</p>
        )}
      </SidePanel>
    ) : null;

  const invitedPanel =
    view && view.show.invited && (view.invited.length > 0 || filter === "invited") ? (
      <SidePanel
        key="invited"
        tone="invited"
        icon={<Mail className="h-4 w-4" strokeWidth={1.75} />}
        title="Invited to FieldDive"
        menu={
          <Menu
            label="Invitation options"
            items={[{ label: "Invite someone to FieldDive", onSelect: () => setAccessRequest({ type: "invite", nonce: Date.now() }) }]}
          />
        }
        aria-label="FieldDive invitations"
        data-team-invited=""
      >
        {view.invitedPeople.length > 0 ? (
          <ul className="mt-1 divide-y divide-slate-100 px-2">{view.invitedPeople.map((entry) => personRow(entry))}</ul>
        ) : null}
        {view.invited.length > 0 ? (
          <ul className="mt-1 px-1">
            {view.invited.map((invite) => (
              <li key={invite.invitationId}>
                <button
                  type="button"
                  className="flex min-h-[52px] w-full min-w-0 items-center gap-3 rounded-lg px-1 py-1.5 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  onClick={() => setAccessRequest({ type: "invitation", invitationId: invite.invitationId, nonce: Date.now() })}
                  data-team-invite-row
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500" aria-hidden>
                    <Mail className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-slate-900">{invite.email}</span>
                    <span className="block text-xs text-slate-500">
                      {invite.roleLabel} · {expiryLabel(invite.expiresAt)}
                    </span>
                    {invite.emailFailed ? <span className="block text-xs text-amber-800">Email not sent</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : view.invitedPeople.length > 0 ? null : (
          <button
            type="button"
            className={`${QUIET_LINK} px-2`}
            onClick={() => setAccessRequest({ type: "invite", nonce: Date.now() })}
            data-team-invite-open
          >
            Invite someone to FieldDive
          </button>
        )}
      </SidePanel>
    ) : null;

  // ---- Dialogs ------------------------------------------------------------------
  let sheet: ReactNode = null;
  if (dialog?.type === "add_person") {
    sheet = (
      <AddPersonSheet
        busy={busy}
        onClose={() => setDialog(null)}
        onSave={async (name, phone) => {
          const saved = await act({ action: "create_person", name, phone }, `${name} added to your team.`);
          if (saved) setDialog(null);
        }}
      />
    );
  } else if (dialog?.type === "create_crew" && model) {
    sheet = (
      <CreateCrewSheet
        model={model}
        busy={busy}
        initialLeadKey={dialog.leadKey}
        onClose={() => setDialog(null)}
        onSave={async (name, lead) => {
          const saved = await act({ action: "create_crew", name, lead: lead ? entryRef(lead) : null }, `${name} created.`);
          if (saved) setDialog(null);
        }}
      />
    );
  } else if (dialog?.type === "person" && model) {
    const entry = model.entries.find((row) => row.key === dialog.key) ?? null;
    if (entry) {
      sheet = (
        <PersonSheet
          entry={entry}
          crewName={(id) => crewById(id)?.name ?? "a crew"}
          canManageAccess={canAdminMembers && entry.userId != null && entry.access !== "unknown" && entry.access !== "none"}
          canAdminAccess={canAdminMembers}
          isSelf={entry.userId != null && entry.userId === viewerUserId}
          busy={busy}
          onClose={() => setDialog(null)}
          onRemoveFromCrew={(crewId) => {
            const crew = crewById(crewId);
            if (crew) void removeMember(crew, entry);
          }}
          onManageAccess={() => {
            if (!entry.userId) return;
            setDialog(null);
            setAccessRequest({ type: "person", userId: entry.userId, personName: entry.nameKnown ? entry.name : undefined, nonce: Date.now() });
          }}
          onGiveAccess={() => {
            if (!entry.personId) return;
            setDialog(null);
            setAccessRequest({ type: "invite", person: { personId: entry.personId, name: entry.nameKnown ? entry.name : "This person" }, nonce: Date.now() });
          }}
          onOpenInvitation={() => {
            if (!entry.invitation) return;
            setDialog(null);
            setAccessRequest({
              type: "invitation",
              invitationId: entry.invitation.invitationId,
              personName: entry.nameKnown ? entry.name : undefined,
              nonce: Date.now(),
            });
          }}
          onSaveDetails={async (name, phone) => {
            if (!entry.personId || entry.rowVersion == null) return false;
            const saved = await act(
              { action: "update_person", personId: entry.personId, expectedRowVersion: entry.rowVersion, name, phone },
              "Saved."
            );
            return saved != null;
          }}
          onArchive={async () => {
            if (!entry.personId || entry.rowVersion == null) return;
            const saved = await act(
              { action: "archive_person", personId: entry.personId, expectedRowVersion: entry.rowVersion },
              `${entry.name} archived.`
            );
            if (saved) setDialog(null);
          }}
        />
      );
    }
  }

  // ---- Page ---------------------------------------------------------------------
  const loading = board.status === "loading" || (board.status === "ready" && !model);
  const filters = FILTERS.filter((item) => item.key !== "invited" || canAdminMembers);
  const people = model?.entries.length ?? 0;
  const support = [notOnCrewPanel, invitedPanel].filter(Boolean);
  return (
    <div className="mx-auto w-full max-w-[82rem] pb-12" data-team-board>
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-slate-900">Team</h1>
          <p className="mt-1 text-sm text-slate-500">Your people and crews.</p>
        </div>
        {board.status === "ready" ? (
          <div className="flex w-full gap-2 sm:w-auto" data-team-board-actions>
            <button
              type="button"
              className={`${HEADER_BUTTON} flex-1 bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 sm:flex-none`}
              onClick={() => setDialog({ type: "add_person" })}
              data-team-add-person-open
            >
              <UserPlus className="h-4 w-4" aria-hidden />
              Add person
            </button>
            <button
              type="button"
              className={`${HEADER_BUTTON} flex-1 bg-blue-600 text-white shadow-sm hover:bg-blue-700 sm:flex-none`}
              onClick={() => setDialog({ type: "create_crew" })}
              data-team-create-crew-open
            >
              <Plus className="h-4 w-4" aria-hidden />
              Create crew
            </button>
          </div>
        ) : null}
      </header>

      {model ? (
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-3" data-team-toolbar>
          <label className="relative block w-full sm:w-96">
            <span className="sr-only">Search people or crews</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people or crews..."
              className="h-10 w-full rounded-lg bg-white pl-9 pr-3 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-team-search
            />
          </label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter the team" data-team-filters>
            {filters.map((item) => {
              const active = filter === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(item.key)}
                  className={`inline-flex min-h-[34px] items-center rounded-full px-3.5 text-[13px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    active
                      ? "bg-blue-50 font-semibold text-blue-700 ring-1 ring-blue-500"
                      : "bg-white font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                  data-team-filter={item.key}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <p className="text-[13px] text-slate-500 lg:ml-auto" data-team-summary>
            {model.crewCount} {model.crewCount === 1 ? "crew" : "crews"} <span aria-hidden>•</span> {people} {people === 1 ? "person" : "people"}
          </p>
        </div>
      ) : null}

      {notice ? (
        <div
          className={`mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm ${notice.tone === "error" ? "text-rose-700" : "text-slate-700"}`}
          role="status"
          data-team-board-notice
        >
          <span>{notice.text}</span>
          {notice.undo ? (
            <button
              type="button"
              className="font-medium text-blue-700 hover:text-blue-800"
              onClick={() => {
                const undo = notice.undo!;
                setNotice(null);
                void undo();
              }}
            >
              Undo
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5">
        {loading ? (
          <BoardSkeleton />
        ) : board.status === "denied" || board.status === "failed" ? (
          <div className={`${CARD} px-6 py-8`} data-team-board-unavailable={board.status}>
            <p className="text-sm font-medium text-slate-900">{board.message}</p>
            {board.status === "failed" ? (
              <button type="button" className={QUIET_LINK} onClick={() => void loadBoard()}>
                Try again
              </button>
            ) : null}
          </div>
        ) : model && view ? (
          view.show.crews ? (
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_20.5rem]">
              <section className="min-w-0" aria-label="Crews" data-team-crews>
                {model.groups.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center" data-team-crews-empty>
                    <p className="text-[15px] font-medium text-slate-900">No crews yet</p>
                    <p className="mt-1 text-sm text-slate-500">Create a crew to show who works with whom.</p>
                    <button type="button" className={`${TEAM_SHEET_PRIMARY} mt-4 gap-2`} onClick={() => setDialog({ type: "create_crew" })}>
                      <Plus className="h-4 w-4" aria-hidden />
                      Create crew
                    </button>
                  </div>
                ) : view.groups.length === 0 ? (
                  <p className="px-1 py-6 text-sm text-slate-500" data-team-no-results>
                    No crews match.
                  </p>
                ) : (
                  <div className="min-w-0 gap-4 lg:columns-2">{view.groups.map(renderGroup)}</div>
                )}
              </section>
              {support.length > 0 ? (
                <aside className="min-w-0 space-y-4" aria-label="People not on a crew">
                  {support}
                </aside>
              ) : null}
            </div>
          ) : (
            <div className="max-w-md space-y-4">
              {support.length > 0 ? support : <p className="px-1 py-6 text-sm text-slate-500" data-team-no-results>No one matches.</p>}
            </div>
          )
        ) : null}
      </div>

      {sheet}
      {canAdminMembers ? (
        <CompanyTeamClient
          companyId={companyId}
          headless={{
            team,
            request: accessRequest,
            onClose: () => {
              setAccessRequest(null);
              void team.refresh();
              void loadInvitations();
              void loadBoard();
            },
            onNotice: (text) => setNotice({ text }),
          }}
        />
      ) : null}
    </div>
  );
}

// ---- Inline editors ---------------------------------------------------------------

function AddToCrew({
  crew,
  candidates,
  model,
  busy,
  onDone,
  onAddExisting,
  onAddNew,
}: {
  crew: TeamBoardCrew;
  candidates: TeamBoardEntry[];
  model: TeamBoardModel;
  busy: boolean;
  onDone: () => void;
  onAddExisting: (entry: TeamBoardEntry) => Promise<unknown>;
  onAddNew: (name: string) => Promise<unknown>;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => inputRef.current?.focus(), []);
  const trimmed = query.trim();
  const matches = searchTeamEntries(candidates, query).slice(0, trimmed ? 6 : 5);
  const crewNames = (entry: TeamBoardEntry) =>
    entry.crewIds
      .map((id) => model.groups.flatMap((g) => g.crews).find((c) => c.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  const hint = (entry: TeamBoardEntry) => {
    const onCrews = crewNames(entry);
    if (onCrews) return `On ${onCrews}`;
    if (entry.leadsCrewIds.length > 0) return "Leads a crew";
    return "Not on a crew";
  };
  return (
    <div className="mt-3 rounded-xl bg-white p-3 shadow-[0_4px_16px_rgba(15,23,42,0.08)] ring-1 ring-slate-200" data-team-add-to-crew>
      <label className="block">
        <span className="sr-only">Add to {crew.name}</span>
        <input
          ref={inputRef}
          className={FOCUSED_EDITOR_INPUT}
          placeholder="Name"
          value={query}
          maxLength={80}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onDone();
          }}
          data-team-add-to-crew-input
        />
      </label>
      <ul className="mt-2 max-h-72 overflow-y-auto" role="listbox" aria-label={`People to add to ${crew.name}`}>
        {matches.map((entry) => (
          <li key={entry.key}>
            <button
              type="button"
              role="option"
              aria-selected={false}
              className="flex min-h-[44px] w-full min-w-0 items-center gap-3 rounded-lg px-2 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none disabled:opacity-50"
              disabled={busy}
              onClick={async () => {
                await onAddExisting(entry);
                setQuery("");
                inputRef.current?.focus();
              }}
              data-team-add-existing
            >
              <Avatar name={entry.name} size="sm" muted={entry.access === "removed"} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-900">{entry.name}</span>
                {hint(entry) ? <span className="block truncate text-xs text-slate-500">{hint(entry)}</span> : null}
              </span>
            </button>
          </li>
        ))}
        {trimmed ? (
          <li>
            <button
              type="button"
              className="flex min-h-[44px] w-full min-w-0 items-center gap-3 rounded-lg px-2 text-left hover:bg-blue-50 focus-visible:bg-blue-50 focus-visible:outline-none disabled:opacity-50"
              disabled={busy}
              onClick={async () => {
                await onAddNew(trimmed);
                setQuery("");
                inputRef.current?.focus();
              }}
              data-team-add-new-person
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700" aria-hidden>
                <Plus className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-blue-800">Add &ldquo;{trimmed}&rdquo; as a new person</span>
                <span className="block text-xs text-slate-500">No FieldDive login needed</span>
              </span>
            </button>
          </li>
        ) : null}
        {!trimmed && matches.length === 0 ? (
          <li className="px-2 py-2 text-sm text-slate-500">Type a name to add someone new.</li>
        ) : null}
      </ul>
      <div className="mt-1 flex justify-end">
        <button type="button" className={TEAM_SHEET_SECONDARY} onClick={onDone} data-team-add-to-crew-done>
          Done
        </button>
      </div>
    </div>
  );
}

function LeadEditor({
  crew,
  model,
  busy,
  onCancel,
  onSave,
}: {
  crew: TeamBoardCrew;
  model: TeamBoardModel;
  busy: boolean;
  onCancel: () => void;
  onSave: (entry: TeamBoardEntry | null) => Promise<void>;
}) {
  const options = crewLeadCandidates(model);
  const [value, setValue] = useState(crew.lead?.key ?? "");
  const changed = value !== (crew.lead?.key ?? "");
  return (
    <div className="mt-3 rounded-xl bg-white p-3 shadow-[0_4px_16px_rgba(15,23,42,0.08)] ring-1 ring-slate-200" data-team-lead-editor>
      <label className={FOCUSED_EDITOR_LABEL}>
        Usual Crew Lead
        <select className={FOCUSED_EDITOR_INPUT} value={value} onChange={(event) => setValue(event.target.value)} data-team-lead-select>
          <option value="">No usual Lead</option>
          {options.map((entry) => (
            <option key={entry.key} value={entry.key}>
              {entry.name}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-2 text-[13px] text-slate-600">The crew stays the same when its Lead changes: same name, same people.</p>
      <p className="mt-0.5 text-xs text-slate-400">FieldDive access isn&apos;t affected.</p>
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" className={TEAM_SHEET_SECONDARY} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={TEAM_SHEET_PRIMARY}
          disabled={busy || !changed}
          onClick={() => void onSave(options.find((entry) => entry.key === value) ?? null)}
          data-team-lead-save
        >
          Save Lead
        </button>
      </div>
    </div>
  );
}

function RenameEditor({
  crew,
  busy,
  onCancel,
  onSave,
}: {
  crew: TeamBoardCrew;
  busy: boolean;
  onCancel: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(crew.name);
  const trimmed = name.trim();
  return (
    <div className="mt-3 rounded-xl bg-white p-3 shadow-[0_4px_16px_rgba(15,23,42,0.08)] ring-1 ring-slate-200">
      <label className={FOCUSED_EDITOR_LABEL}>
        Crew name
        <input className={FOCUSED_EDITOR_INPUT} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} autoFocus />
      </label>
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" className={TEAM_SHEET_SECONDARY} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={TEAM_SHEET_PRIMARY} disabled={busy || !trimmed || trimmed === crew.name} onClick={() => void onSave(trimmed)}>
          Save
        </button>
      </div>
    </div>
  );
}

// ---- Sheets -------------------------------------------------------------------------

function AddPersonSheet({ busy, onClose, onSave }: { busy: boolean; onClose: () => void; onSave: (name: string, phone: string | null) => Promise<void> }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const dirty = name.trim() !== "" || phone.trim() !== "";
  return (
    <TeamSheet
      view="team-add-person"
      title="Add person"
      subtitle="Someone who works with you. They don't need a FieldDive login."
      dirty={dirty}
      busy={busy}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={TEAM_SHEET_SECONDARY} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={TEAM_SHEET_PRIMARY}
            disabled={busy || !name.trim()}
            onClick={() => void onSave(name.trim(), phone.trim() || null)}
            data-team-add-person-save
          >
            {busy ? "Adding…" : "Add person"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className={FOCUSED_EDITOR_LABEL}>
          Name
          <input className={FOCUSED_EDITOR_INPUT} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} autoFocus data-team-add-person-name />
        </label>
        <label className={FOCUSED_EDITOR_LABEL}>
          <span>
            Phone <span className="font-normal text-slate-400">(optional)</span>
          </span>
          <input className={FOCUSED_EDITOR_INPUT} value={phone} maxLength={40} inputMode="tel" onChange={(event) => setPhone(event.target.value)} />
        </label>
      </div>
    </TeamSheet>
  );
}

function CreateCrewSheet({
  model,
  busy,
  initialLeadKey,
  onClose,
  onSave,
}: {
  model: TeamBoardModel;
  busy: boolean;
  initialLeadKey?: string;
  onClose: () => void;
  onSave: (name: string, lead: TeamBoardEntry | null) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [leadKey, setLeadKey] = useState(initialLeadKey ?? "");
  const options = crewLeadCandidates(model);
  return (
    <TeamSheet
      view="team-create-crew"
      title="Create crew"
      subtitle="A reusable group of people who work together."
      dirty={name.trim() !== "" || leadKey !== (initialLeadKey ?? "")}
      busy={busy}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={TEAM_SHEET_SECONDARY} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={TEAM_SHEET_PRIMARY}
            disabled={busy || !name.trim()}
            onClick={() => void onSave(name.trim(), options.find((entry) => entry.key === leadKey) ?? null)}
            data-team-create-crew-save
          >
            {busy ? "Creating…" : "Create crew"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className={FOCUSED_EDITOR_LABEL}>
          Crew name
          <input className={FOCUSED_EDITOR_INPUT} value={name} maxLength={80} placeholder="Mike Crew" onChange={(event) => setName(event.target.value)} autoFocus data-team-create-crew-name />
        </label>
        <label className={FOCUSED_EDITOR_LABEL}>
          <span>
            Usual Crew Lead <span className="font-normal text-slate-400">(optional)</span>
          </span>
          <select className={FOCUSED_EDITOR_INPUT} value={leadKey} onChange={(event) => setLeadKey(event.target.value)}>
            <option value="">Choose later</option>
            {options.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
        <div>
          <p className="text-[13px] text-slate-600">Add people from the crew once it&apos;s created.</p>
          <p className="mt-0.5 text-xs text-slate-400">Crews don&apos;t change FieldDive access.</p>
        </div>
      </div>
    </TeamSheet>
  );
}

const ACCESS_ACTION =
  "mt-1 inline-flex min-h-[40px] items-center text-sm font-medium text-blue-700 hover:text-blue-800";

function PersonSheet({
  entry,
  crewName,
  canManageAccess,
  canAdminAccess,
  isSelf,
  busy,
  onClose,
  onRemoveFromCrew,
  onManageAccess,
  onGiveAccess,
  onOpenInvitation,
  onSaveDetails,
  onArchive,
}: {
  entry: TeamBoardEntry;
  crewName: (id: string) => string;
  canManageAccess: boolean;
  /** Viewer may issue and manage invitations (team.manage). */
  canAdminAccess: boolean;
  isSelf: boolean;
  busy: boolean;
  onClose: () => void;
  onRemoveFromCrew: (crewId: string) => void;
  onManageAccess: () => void;
  onGiveAccess: () => void;
  onOpenInvitation: () => void;
  onSaveDetails: (name: string, phone: string | null) => Promise<boolean>;
  onArchive: () => Promise<void>;
}) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const editable = entry.personId != null && entry.rowVersion != null;
  const [editing, setEditing] = useState(false);
  const leads = entry.leadsCrewIds.map(crewName);
  const on = entry.crewIds;
  const work = workLabel(entry.work);
  const canGiveAccess = canAdminAccess && entry.personId != null && entry.userId == null;
  // A pending invitation blocks archive; it is revoked explicitly first. Unresolved access hides it too.
  const archivable =
    entry.personId != null &&
    entry.access !== "active" &&
    entry.access !== "invited" &&
    entry.access !== "checking" &&
    entry.access !== "unverified" &&
    entry.rowVersion != null;
  return (
    <TeamSheet
      view="team-person"
      title={entry.name}
      subtitle={entry.nameKnown ? null : "Name not set"}
      leading={<Avatar name={entry.name} size="lg" muted={entry.access === "removed"} />}
      busy={busy}
      onClose={onClose}
    >
      {editing ? (
        <PersonDetailsEditor
          entry={entry}
          busy={busy}
          onCancel={() => setEditing(false)}
          onSave={async (name, phone) => {
            if (await onSaveDetails(name, phone)) setEditing(false);
          }}
        />
      ) : null}
      <div className="divide-y divide-slate-100" data-team-person-detail>
        <PersonFact label="Crew" testId="crew">
          {leads.length === 0 && on.length === 0 ? (
            <p className="text-sm text-slate-600">Not on a crew</p>
          ) : (
            <div className="space-y-0.5 text-sm text-slate-900">
              {leads.map((name) => (
                <p key={`l-${name}`}>
                  Leads <span className="font-medium">{name}</span>
                </p>
              ))}
              {on.map((crewId) => (
                <div key={`o-${crewId}`} className="flex min-h-[36px] items-center justify-between gap-3">
                  <p>
                    On <span className="font-medium">{crewName(crewId)}</span>
                  </p>
                  <button
                    type="button"
                    className="inline-flex min-h-[36px] items-center rounded px-1 text-[13px] font-medium text-slate-500 hover:text-rose-700 disabled:opacity-50"
                    disabled={busy}
                    onClick={() => onRemoveFromCrew(crewId)}
                    data-team-person-remove-from-crew
                  >
                    Remove from crew
                  </button>
                </div>
              ))}
            </div>
          )}
        </PersonFact>
        {entry.work ? (
          <PersonFact label="Current work" testId="work">
            <p className="text-sm text-slate-900">{work ?? "No open jobs or tasks"}</p>
          </PersonFact>
        ) : null}
        {entry.phone ? (
          <PersonFact label="Phone" testId="phone">
            <a href={`tel:${entry.phone}`} className="text-sm font-medium text-blue-700 hover:text-blue-800">
              {entry.phone}
            </a>
          </PersonFact>
        ) : null}
        <PersonFact label="FieldDive access" testId="access">
          {entry.access === "invited" && entry.invitation ? (
            <>
              <p className="text-sm text-slate-900" data-team-person-access="invited">
                Invited<span className="text-slate-500"> · {expiryLabel(entry.invitation.expiresAt)}</span>
              </p>
              <p className="text-[13px] text-slate-500 [overflow-wrap:anywhere]">{entry.invitation.email}</p>
              {entry.invitation.emailFailed ? <p className="text-[13px] text-amber-800">Email not sent</p> : null}
            </>
          ) : entry.access === "active" ? (
            <>
              <p className="text-sm text-slate-900">
                Signs in{entry.roleLabel ? <> as <span className="font-medium">{entry.roleLabel}</span></> : null}
                {isSelf ? <span className="text-slate-500"> (you)</span> : null}
              </p>
              {entry.email ? (
                <p className="text-[13px] text-slate-500 [overflow-wrap:anywhere]" data-team-person-email>
                  {entry.email}
                </p>
              ) : null}
            </>
          ) : entry.access === "removed" ? (
            <p className="text-sm text-slate-600">Access removed. They stay on your team and crews.</p>
          ) : entry.access === "none" ? (
            <>
              <p className="text-sm text-slate-900" data-team-person-access="none">No access</p>
              <p className="text-[13px] text-slate-500">They don&apos;t need a login to be on a crew.</p>
            </>
          ) : entry.access === "checking" ? (
            <p className="text-sm text-slate-500" data-team-person-access="checking" aria-live="polite">
              Checking access…
            </p>
          ) : entry.access === "unverified" ? (
            <p className="text-sm text-amber-800" data-team-person-access="unverified">
              Couldn&apos;t check FieldDive access. Refresh to try again.
            </p>
          ) : (
            <p className="text-sm text-slate-600">An Owner or Office Manager manages FieldDive access.</p>
          )}
          {entry.access === "invited" && entry.invitation && canAdminAccess ? (
            <button type="button" className={ACCESS_ACTION} onClick={onOpenInvitation} data-team-person-invitation>
              Resend or revoke
            </button>
          ) : entry.access === "none" && canGiveAccess ? (
            <button type="button" className={ACCESS_ACTION} onClick={onGiveAccess} data-team-give-access>
              Give FieldDive access
            </button>
          ) : canManageAccess ? (
            <button type="button" className={ACCESS_ACTION} onClick={onManageAccess} data-team-manage-access>
              {entry.access === "removed" ? "Restore access" : "Manage FieldDive access"}
            </button>
          ) : null}
        </PersonFact>
      </div>
      {editable && !editing ? (
        <div className="border-t border-slate-100 pt-2">
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center text-sm font-medium text-slate-600 hover:text-slate-900"
            onClick={() => setEditing(true)}
            data-team-person-edit
          >
            {entry.nameKnown ? "Edit name and phone" : "Add name"}
          </button>
        </div>
      ) : null}
      {archivable ? (
        <div className="mt-2 border-t border-slate-100 pt-2">
          {confirmArchive ? (
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-sm text-slate-800">Archive {entry.name}? They leave every crew. Crew history is kept.</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-[40px] items-center rounded-lg bg-rose-600 px-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void onArchive()}
                >
                  Archive person
                </button>
                <button type="button" className={TEAM_SHEET_SECONDARY} onClick={() => setConfirmArchive(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="inline-flex min-h-[44px] items-center text-sm font-medium text-rose-700 hover:text-rose-800" onClick={() => setConfirmArchive(true)}>
              Archive person
            </button>
          )}
        </div>
      ) : entry.access === "invited" && canAdminAccess ? (
        <p className="mt-2 border-t border-slate-100 pt-3 text-[13px] text-slate-500" data-team-archive-blocked>
          Revoke the invitation before archiving {entry.name}.
        </p>
      ) : null}
    </TeamSheet>
  );
}

function PersonDetailsEditor({
  entry,
  busy,
  onCancel,
  onSave,
}: {
  entry: TeamBoardEntry;
  busy: boolean;
  onCancel: () => void;
  onSave: (name: string, phone: string | null) => Promise<void>;
}) {
  const [name, setName] = useState(entry.nameKnown ? entry.name : "");
  const [phone, setPhone] = useState(entry.phone ?? "");
  const trimmed = name.trim();
  const changed = trimmed !== (entry.nameKnown ? entry.name : "") || phone.trim() !== (entry.phone ?? "");
  return (
    <div className="mb-5 space-y-3 rounded-xl bg-slate-50 p-3" data-team-person-editor>
      <label className={FOCUSED_EDITOR_LABEL}>
        Name
        <input
          className={FOCUSED_EDITOR_INPUT}
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          data-team-person-name-input
        />
      </label>
      <label className={FOCUSED_EDITOR_LABEL}>
        <span>
          Phone <span className="font-normal text-slate-400">(optional)</span>
        </span>
        <input className={FOCUSED_EDITOR_INPUT} value={phone} maxLength={40} inputMode="tel" onChange={(event) => setPhone(event.target.value)} />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" className={TEAM_SHEET_SECONDARY} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={TEAM_SHEET_PRIMARY}
          disabled={busy || !trimmed || !changed}
          onClick={() => void onSave(trimmed, phone.trim() || null)}
          data-team-person-save
        >
          Save
        </button>
      </div>
    </div>
  );
}

function PersonFact({ label, testId, children }: { label: string; testId: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-4 first:pt-0 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-4" data-team-person-fact={testId}>
      <p className="text-[13px] font-medium text-slate-500">{label}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20.5rem]" aria-label="Loading team" data-team-board-loading>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((key) => (
          <div key={key} className={CARD}>
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
              <span className="h-11 w-11 animate-pulse rounded-full bg-slate-100" />
              <span className="h-3.5 w-36 animate-pulse rounded bg-slate-200" />
            </div>
            <div className="ml-4 mt-4 space-y-3 border-l-2 border-slate-100 pl-3">
              {[0, 1, 2].map((row) => (
                <span key={row} className="block h-3 w-40 animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={`${CARD} h-40 animate-pulse`} />
    </div>
  );
}
