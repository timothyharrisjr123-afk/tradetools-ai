import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Source of the Company Settings Team surface, for contract tests. */
export const TEAM_SURFACE_FILES = [
  "app/tools/settings/team/CompanyTeamClient.tsx",
  "app/tools/settings/team/TeamSheet.tsx",
  "app/tools/settings/team/TeamPeopleList.tsx",
  "app/tools/settings/team/TeamAccessChooser.tsx",
] as const;

export function readTeamSurfaceSource(root: string = process.cwd()): string {
  return TEAM_SURFACE_FILES.map((path) => readFileSync(join(root, path), "utf8")).join("\n");
}
