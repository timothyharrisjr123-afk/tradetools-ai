"use client";

import {
  PACKET_CONTENT_BODY,
  PACKET_CONTENT_LABEL,
  PACKET_CONTENT_PANEL,
  PACKET_CONTENT_TITLE,
  PACKET_DIVIDER,
} from "./proposalCustomerPacketStyles";

type ProposalCustomerPreviewPacketSectionProps = {
  title: string;
  body: string;
};

type TextBlock = { kind: "paragraph"; lines: string[] } | { kind: "bullets"; items: string[] };

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
 * Premium content section (Project overview / Warranty / Terms / Scope notes).
 * Only rendered when content is real; placeholder filtering is upstream.
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
      <div className={PACKET_CONTENT_PANEL}>
        <p className={PACKET_CONTENT_LABEL}>Proposal details</p>
        <h2 className={PACKET_CONTENT_TITLE}>{title}</h2>
        <div className={`space-y-4 ${PACKET_CONTENT_BODY}`}>
          {blocks.map((block, index) =>
            block.kind === "bullets" ? (
              <ul key={index} className="space-y-2 pl-0.5">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex gap-2.5">
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500/70"
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
