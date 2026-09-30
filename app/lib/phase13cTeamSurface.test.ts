/**
 * Phase 13C Slice 1 — Team experience redesign.
 * Team is an Operations workspace; one person opens in a secondary sheet that
 * shows current truth before editing. Presentation only; authority is unchanged.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  TEAM_ACCESS_PRESETS,
  TEAM_OWNER_DETAIL,
  TEAM_OWNER_SUMMARY,
  teamAccessPreset,
} from "./access/teamAccessPresentation";
import { COMPANY_MEMBERSHIP_ROLE_LABELS } from "./companyMembershipRoles";
import { readTeamSurfaceSource } from "./teamSurfaceSource.testSupport";
import { getNavSectionItems } from "@/app/tools/roofing/fieldDiveNavConfig";
import { navItemAllowed } from "@/app/tools/roofing/useViewerNavAccess";
import { NO_VIEWER_ACCESS, mapViewerAccess } from "./access/viewerAccess";
import { ACCESS_PACKAGES, getRoleProfile } from "./access/registry";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TeamPersonRow, type TeamRowModel } from "@/app/tools/settings/team/TeamPeopleList";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const client = read("app/tools/settings/team/CompanyTeamClient.tsx");
const chooser = read("app/tools/settings/team/TeamAccessChooser.tsx");
const sheet = read("app/tools/settings/team/TeamSheet.tsx");
const list = read("app/tools/settings/team/TeamPeopleList.tsx");
const surface = readTeamSurfaceSource(root);

describe("operational Team workspace boundaries", () => {
  const person: TeamRowModel = {
    key: "test", kind: "member", name: "Test person", email: null,
    accessLabel: "Owner", accessSummary: null, state: "Active",
    stateNote: null, attention: null,
  };

  test("rendering does not invent relationships or zero-work claims", () => {
    const html = renderToStaticMarkup(createElement(TeamPersonRow, { row: person, selected: false }));
    assert.doesNotMatch(html, /data-team-person-relationships|No crew|0 open|No work/);
    assert.match(html, /Test person/);
    assert.match(html, /FieldDive/);
  });

  test("verified counts render as Coordinator and task facts, never Crew leadership", () => {
    const html = renderToStaticMarkup(createElement(TeamPersonRow, {
      row: { ...person, work: { coordinatorJobs: 2, assignedTasks: 1 } }, selected: true,
    }));
    assert.match(html, /data-team-person-relationships/);
    assert.match(html, /Coordinator for/);
    assert.match(html, /2 open jobs/);
    assert.match(html, /1 open task/);
    assert.doesNotMatch(html, /Crew|Production lead/);
  });

  test("one canonical Team destination in Operations and no duplicate Settings row", () => {
    assert.deepEqual(getNavSectionItems("operations").map((item) => item.label), ["Jobs", "New job", "Calendar", "Team"]);
    assert.equal(getNavSectionItems("operations").find((item) => item.key === "team")?.href, "/tools/team");
    assert.ok(!getNavSectionItems("setup").some((item) => item.key === "team"));
    assert.match(read("app/tools/settings/team/page.tsx"), /redirect\("\/tools\/team"\)/);
    assert.match(read("app/tools/team/page.tsx"), /requireActiveCompanyPage/);
    assert.doesNotMatch(read("app/tools/settings/CompanySettingsClient.tsx"), /testId="team"/);
  });

  test("unknown and job-scoped access do not advertise a company Team destination", () => {
    assert.equal(navItemAllowed("team", null), false);
    assert.equal(navItemAllowed("team", NO_VIEWER_ACCESS), false);
    assert.equal(navItemAllowed("team", { ...NO_VIEWER_ACCESS, canAssignTasks: true }), false);
    for (const key of ["canAdminMembers", "canAssignJobs"] as const) {
      assert.equal(navItemAllowed("team", { ...NO_VIEWER_ACCESS, [key]: true }), true);
    }
  });

  test("Team nav follows each profile's company-scope capabilities", () => {
    const flags = (caps: string[]) =>
      mapViewerAccess({ ok: true, company_capabilities: caps, job_capabilities: null });
    const companyCaps = (role: string) =>
      (getRoleProfile(role as never)?.entries ?? []).filter((e) => e.scope === "company").map((e) => e.capability);
    const withPackage = (role: string, pkg: string) => [
      ...companyCaps(role),
      ...(ACCESS_PACKAGES.find((p) => p.key === pkg)?.scope === "company"
        ? ACCESS_PACKAGES.find((p) => p.key === pkg)!.capabilities
        : []),
    ];
    assert.equal(navItemAllowed("team", flags(companyCaps("owner"))), true, "Owner");
    assert.equal(navItemAllowed("team", flags(companyCaps("admin"))), true, "Office Manager");
    assert.equal(navItemAllowed("team", flags(companyCaps("production_lead"))), true, "Production Coordinator");
    assert.equal(navItemAllowed("team", flags(companyCaps("office_sales"))), false, "Sales");
    assert.equal(navItemAllowed("team", flags(withPackage("office_sales", "coordinate_production"))), true, "Sales coordinating production");
    assert.equal(navItemAllowed("team", flags(companyCaps("field_user"))), false, "Field");
    assert.equal(navItemAllowed("team", flags(withPackage("field_user", "lead_assigned_work"))), false, "Lead");
  });

  test("real work precedes access; directory zero placeholders are never work facts", () => {
    assert.match(client, /work: activeAccess \?/);
    assert.match(client, /coordinatorJobs: member\.openJobLeadCount/);
    assert.match(client, /assignedTasks: member\.openTaskAssigneeCount/);
    assert.match(list, /work\.coordinatorJobs > 0/);
    assert.match(list, /work\.assignedTasks > 0/);
    assert.ok(client.indexOf('aria-label="Current work"') < client.indexOf('label="FieldDive access"'));
    assert.doesNotMatch(surface, /crew_label|assigned_to|Crew member count|No crew assigned/);
  });

  test("invitations are not mixed into active people; relationship region is not a button", () => {
    assert.match(client, /const rows = activePeople\.map\(memberRow\)/);
    assert.match(client, /aria-label="Invited people"/);
    assert.match(list, /<div[^>]+data-team-person-relationships>/);
    assert.match(list, /children\?: ReactNode/);
    assert.doesNotMatch(list, /<table|grid-cols-3|shadow-\[/);
  });
});

function between(source: string, start: string, end: string) {
  const from = source.indexOf(start);
  assert.ok(from >= 0, start);
  const to = source.indexOf(end, from + start.length);
  return source.slice(from, to < 0 ? undefined : to);
}

describe("access copy is short contractor language", () => {
  test("each profile has one short phrase, not a paragraph", () => {
    const expected: Record<string, string> = {
      office_manager: "Office operations and coordination",
      lead: "Assigned jobs and onsite work",
      production_lead: "Company-wide production coordination",
      office_sales: "Customers and proposals",
      field_user: "Assigned field work",
    };
    for (const preset of TEAM_ACCESS_PRESETS) {
      assert.equal(preset.summary, expected[preset.key], preset.key);
      assert.ok(preset.summary.length <= 40, preset.key);
      assert.doesNotMatch(preset.summary, /[.,;]/, preset.key);
    }
  });

  test("owner reads as account owner and never claims everything", () => {
    assert.equal(TEAM_OWNER_SUMMARY, "Account owner");
    assert.doesNotMatch(`${TEAM_OWNER_SUMMARY} ${TEAM_OWNER_DETAIL}`, /everything|full access/i);
  });

  test("boundary detail is shown only on request", () => {
    assert.match(client, /What&apos;s included/);
    assert.match(client, /aria-expanded=\{open\}/);
    assert.doesNotMatch(chooser, /preset\.detail/);
    assert.match(teamAccessPreset("office_manager").detail, /stay with the Owner/);
  });
});

describe("Team is a first-class page; the person sheet is secondary", () => {
  test("the list renders on the page, not inside a drawer", () => {
    assert.doesNotMatch(surface, /<FocusedEditor/);
    assert.match(client, /data-company-team-page/);
    const page = between(client, "data-company-team-page>", "{sheet}");
    assert.match(page, /<TeamPeopleList/);
    assert.match(page, /Invite person/);
  });

  test("the sheet is full height on desktop and full screen on mobile, with a real footer", () => {
    assert.match(sheet, /absolute inset-0 flex h-\[100dvh\] flex-col/);
    assert.match(sheet, /sm:inset-y-0 sm:left-auto sm:right-0 sm:w-\[30rem\]/);
    assert.match(sheet, /overflow-y-auto overscroll-contain/);
    assert.match(sheet, /env\(safe-area-inset-bottom\)/);
    assert.match(sheet, /FOCUSED_EDITOR_DIRTY_PROMPT/);
    assert.match(sheet, /data-team-sheet-back/);
  });

  test("a person opens in read mode; access choices appear only after Change access", () => {
    assert.match(client, /openPerson = \(member: CompanyMemberClientItem, mode: PersonMode = "read"\)/);
    const read = between(client, 'view="person"', "} else if (view.type === \"invite\")");
    assert.doesNotMatch(read, /<TeamAccessChooser/);
    assert.match(read, /Change access/);
    assert.match(read, /label="Job access"/);
    assert.match(read, /label="Status"/);
    const change = between(client, "if (view.mode !== \"read\" && editable)", "} else {");
    assert.match(change, /<TeamAccessChooser/);
    assert.match(change, /Save access/);
  });

  test("owner is never an ordinary access choice", () => {
    for (const preset of TEAM_ACCESS_PRESETS) assert.notEqual(preset.role, "owner");
    assert.match(client, /member\.role !== "owner"/);
  });
});

describe("invite is a short task", () => {
  const invite = between(client, 'view="invite"', "} else if (view.type === \"invitation\"");

  test("email, access, then send — no job access or status sections", () => {
    assert.ok(invite.indexOf("Email") < invite.indexOf("<TeamAccessChooser"));
    assert.doesNotMatch(invite, /Job access|label="Status"|Job reach/);
    assert.match(invite, /Send invitation/);
  });

  test("Lead shows its job scope only when chosen", () => {
    assert.match(chooser, /checked && scoped \?/);
    assert.match(chooser, /teamJobReach\(preset\.role\)/);
  });

  test("additional access stays closed until someone opens it", () => {
    assert.match(chooser, /useState\(startOpen \|\| selected\.length > 0\)/);
    assert.match(chooser, /Add access/);
    assert.match(invite, /selectedPreset \?/);
  });

  test("specialist access waits behind Other access", () => {
    assert.match(chooser, /Other access/);
    assert.deepEqual(
      TEAM_ACCESS_PRESETS.filter((preset) => preset.primary).map((preset) => preset.label),
      ["Office Manager", "Lead"]
    );
  });
});

describe("rows put the person first and state last", () => {
  test("person anchors own a separate in-place relationship area, not access columns", () => {
    assert.match(list, /data-team-person-anchor/);
    assert.match(list, /data-team-person-relationships/);
    assert.match(list, /hasWork \|\| children/);
    assert.doesNotMatch(list, /sm:grid-cols-/);
    assert.match(list, /text-\[15px\] font-semibold/);
  });

  test("state words are explicit and invitation is not active", () => {
    assert.match(list, /"Active" \| "Invited" \| "Access removed"/);
    assert.match(list, /state === "Invited" \? "text-amber-700"/);
    assert.match(list, /state === "Active" \? <span className="h-1\.5 w-1\.5 rounded-full bg-emerald-500"/);
  });

  test("removed people are collapsed below the team unless work needs attention", () => {
    assert.match(client, /Access removed · \{removedRows\.length\}/);
    assert.match(client, /showRemoved = removedOpen \|\| removedNeedsAttention/);
  });

  test("an unreadable team is not an empty team", () => {
    const failed = client.indexOf("data-company-settings-team-unavailable");
    const empty = client.indexOf("data-company-settings-team-empty");
    assert.ok(failed > 0 && empty > failed);
  });
});

describe("Coordinator names jobs.assigned_to; Production Coordinator stays company access", () => {
  test("job surfaces say Coordinator", () => {
    for (const path of [
      "app/tools/roofing/saved/components/JobsBoardCard.tsx",
      "app/tools/roofing/saved/components/JobsBoardListView.tsx",
      "app/tools/roofing/jobCard/JobCardFieldBrief.tsx",
      "app/tools/roofing/jobCard/JobCardProductionLeadControl.tsx",
      "app/lib/jobCardOverviewComposition.ts",
      "app/lib/jobActivityChronology.ts",
    ]) {
      const source = read(path);
      assert.match(source, /Coordinator/, path);
      assert.doesNotMatch(source, /"Production lead|>Production lead<|Production lead ·|Production lead\s*<\/p>/, path);
    }
  });

  test("internal fields, routes, and event types are unchanged", () => {
    assert.match(read("app/tools/roofing/jobCard/JobCardProductionLeadControl.tsx"), /\/production-lead`/);
    assert.match(read("app/lib/jobActivityChronology.ts"), /production_lead_assigned/);
    assert.equal(COMPANY_MEMBERSHIP_ROLE_LABELS.production_lead, "Production Coordinator");
  });
});
