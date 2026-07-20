"use client";

import {
  PACKET_CONTENT_BODY,
  PACKET_CONTENT_LABEL,
  PACKET_DIVIDER,
  PACKET_SECTION_PAD,
} from "./proposalCustomerPacketStyles";

type ProposalCustomerPreviewPacketSectionProps = {
  title: string;
  body: string;
};

type TextBlock = { kind: "paragraph"; lines: string[] } | { kind: "bullets"; items: string[] };

/**
 * Safe, dependency-free text splitter for packet content sections.
 * Plain text only — no markdown package, no raw HTML.
 */
function parsePacketTextBlocks(body: string): TextBlock[] {
  const normalized = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const chunks = normalized.split(/\n{2,}/);
  const blocks: TextBlock[] = [];

  for (const chunk of chunks) {
    const lines = chunk
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length === 0) continue;

    if (lines.every((line) => /^[-*]\s+/.test(line))) {
      blocks.push({ kind: "bullets", items: lines.map((line) => line.replace(/^[-*]\s+/, "")) });
    } else {
      blocks.push({ kind: "paragraph", lines });
    }
  }

  return blocks;
}

/**
 * Block 5C — meaningful content section (Project overview / Warranty / Terms /
 * Scope notes). Only rendered by the caller when content is real; placeholder
 * / stub filtering happens upstream in the view model.
 */
export default function ProposalCustomerPreviewPacketSection({
  title,
  body,
}: ProposalCustomerPreviewPacketSectionProps) {
  const blocks = parsePacketTextBlocks(body);
  if (blocks.length === 0) {
    return null;
  }

  return (
    <div data-preview-packet-content-section>
      <div className={PACKET_DIVIDER} />
      <div className={`${PACKET_SECTION_PAD} space-y-4 pb-8 pt-8`}>
        <p className={PACKET_CONTENT_LABEL}>{title}</p>
        <div className={`space-y-4 ${PACKET_CONTENT_BODY}`}>
          {blocks.map((block, index) =>
            block.kind === "bullets" ? (
              <ul key={index} className="space-y-1.5 pl-1">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex gap-2.5">
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300"
                      aria-hidden
                    />
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
      </div>
    </div>
  );
}
