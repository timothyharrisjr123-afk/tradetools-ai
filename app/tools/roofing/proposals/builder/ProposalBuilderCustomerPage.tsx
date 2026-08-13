import type { ProposalPageType } from "@/app/lib/proposalPageTypes";

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
 * Safe, dependency-free renderer for customer-facing text pages.
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
    <div className="space-y-5 text-[15.5px] leading-[1.7] text-slate-800">
      {blocks.map((block, index) =>
        block.kind === "bullets" ? (
          <ul key={index} className="space-y-2 pl-1">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="flex gap-2.5">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden />
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

  return (
    <div
      className="mx-auto max-w-[42rem] px-5 pb-10 pt-1 sm:px-8"
      data-builder-page-read-body
      data-builder-page-type={pageType}
      aria-label={title}
    >
      {hasBody ? (
        <>
          <SafeBodyText body={body} />
          {contractorNotice ? (
            <p className="mt-6 text-[12px] leading-snug text-slate-400">{contractorNotice}</p>
          ) : null}
        </>
      ) : (
        <p className="text-[15px] leading-relaxed text-slate-500">{emptyStateText}</p>
      )}
    </div>
  );
}
