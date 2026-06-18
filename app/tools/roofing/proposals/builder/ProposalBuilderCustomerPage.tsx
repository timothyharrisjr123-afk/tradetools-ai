import { FileText } from "lucide-react";
import {
  formatProposalPageTypeLabel,
  type ProposalPageType,
} from "@/app/lib/proposalPageTypes";
import {
  BUILDER_CANVAS_HERO_DIVIDER,
  BUILDER_CANVAS_KICKER,
} from "./proposalBuilderConstants";

type ProposalBuilderCustomerPageProps = {
  pageType: ProposalPageType;
  title: string;
  /** Display body text (raw or token-merged at render time). */
  bodyMarkdown?: string | null;
  /** Page-specific calm copy shown when no body content exists yet. */
  emptyStateText: string;
  /** Builder-only muted note when token merge suppressed or removed placeholders. */
  contractorNotice?: string | null;
};

type TextBlock =
  | { kind: "paragraph"; lines: string[] }
  | { kind: "bullets"; items: string[] };

/**
 * 3J4F — safe, dependency-free renderer for customer-facing text pages.
 *
 * Splits persisted body text into paragraphs (blank-line separated) and simple
 * bullet groups ("- " / "* " prefixed lines). Plain text only — no markdown
 * package, no raw HTML, no dangerouslySetInnerHTML.
 */
function parseTextBlocks(body: string): TextBlock[] {
  const normalized = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const chunks = normalized.split(/\n{2,}/);
  const blocks: TextBlock[] = [];

  for (const chunk of chunks) {
    const rawLines = chunk.split("\n").map((line) => line.trim());
    const lines = rawLines.filter((line) => line.length > 0);
    if (lines.length === 0) continue;

    const isBulletLine = (line: string) => /^[-*]\s+/.test(line);

    if (lines.every(isBulletLine)) {
      blocks.push({
        kind: "bullets",
        items: lines.map((line) => line.replace(/^[-*]\s+/, "")),
      });
    } else {
      blocks.push({ kind: "paragraph", lines });
    }
  }

  return blocks;
}

function SafeBodyText({ body }: { body: string }) {
  const blocks = parseTextBlocks(body);

  if (blocks.length === 0) return null;

  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-slate-700">
      {blocks.map((block, index) =>
        block.kind === "bullets" ? (
          <ul key={index} className="space-y-1.5 pl-1">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="flex gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={index} className="whitespace-pre-line">
            {block.lines.join("\n")}
          </p>
        )
      )}
    </div>
  );
}

export default function ProposalBuilderCustomerPage({
  pageType,
  title,
  bodyMarkdown,
  emptyStateText,
  contractorNotice,
}: ProposalBuilderCustomerPageProps) {
  const body = (bodyMarkdown ?? "").trim();
  const hasBody = body.length > 0;
  const typeLabel = formatProposalPageTypeLabel(pageType);

  return (
    <>
      <header className={BUILDER_CANVAS_HERO_DIVIDER}>
        <div className="space-y-1 px-7 pb-5 pt-5">
          <div className="flex items-baseline gap-2">
            <p className={BUILDER_CANVAS_KICKER}>Proposal document</p>
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Customer-facing page
            </span>
          </div>
          <h2 className="text-xl font-semibold leading-tight tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="text-[13px] text-slate-500">{typeLabel} page</p>
        </div>
      </header>

      <div className="px-7 pb-7 pt-6">
        {hasBody ? (
          <>
            <SafeBodyText body={body} />
            <p className="mt-6 border-t border-slate-100 pt-3 text-[11px] leading-snug text-slate-400">
              Read-only customer page from the saved draft. Page editing comes in a later phase.
            </p>
            {contractorNotice ? (
              <p className="mt-2 text-[11px] leading-snug text-slate-400">{contractorNotice}</p>
            ) : null}
          </>
        ) : (
          <div className="flex min-h-[16rem] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
            <FileText className="h-6 w-6 text-slate-300" aria-hidden />
            <p className="mt-3 text-sm font-medium text-slate-600">{emptyStateText}</p>
            <p className="mt-1.5 text-xs text-slate-400">
              Page content is added in a later editing phase.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
