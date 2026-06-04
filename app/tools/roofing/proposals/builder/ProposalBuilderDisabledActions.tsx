import { BUILDER_DISABLED_ACTION } from "./proposalBuilderConstants";

const ACTIONS = [
  { id: "preview", label: "Preview" },
  { id: "send", label: "Send" },
  { id: "sign", label: "Sign" },
  { id: "payment", label: "Payment" },
] as const;

export default function ProposalBuilderDisabledActions() {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Proposal actions (disabled)">
      {ACTIONS.map((action) => (
        <button
          key={action.id}
          type="button"
          disabled
          className={BUILDER_DISABLED_ACTION}
          title={`${action.label} — available in a later stage`}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
