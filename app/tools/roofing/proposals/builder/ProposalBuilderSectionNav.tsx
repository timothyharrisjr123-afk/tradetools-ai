import { BUILDER_SECTION_NAV_ITEM, BUILDER_SECTIONS } from "./proposalBuilderConstants";

type ProposalBuilderSectionNavProps = {
  activeSectionId?: string;
};

export default function ProposalBuilderSectionNav({
  activeSectionId = "overview",
}: ProposalBuilderSectionNavProps) {
  return (
    <ul className="space-y-1">
      {BUILDER_SECTIONS.map((section) => {
        const active = section.id === activeSectionId;
        return (
          <li key={section.id}>
            <button
              type="button"
              disabled
              title={
                section.id === "quantities"
                  ? `${section.description} — not interactive in 3H-3`
                  : `${section.description} — preview in main canvas`
              }
              className={`${BUILDER_SECTION_NAV_ITEM} ${
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:bg-slate-50"
              } cursor-not-allowed opacity-90`}
              aria-current={active ? "page" : undefined}
            >
              {section.label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
