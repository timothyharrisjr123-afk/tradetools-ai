/**
 * PDF text helpers — wrapping, markdown strip, line measurement.
 */

export type PdfFontLike = {
  widthOfTextAtSize: (text: string, size: number) => number;
};

/** Strip light markdown so PDF uses plain selectable text. */
export function stripProposalPdfMarkdown(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function wrapProposalPdfText(
  text: string,
  font: PdfFontLike,
  size: number,
  maxWidth: number
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\t/g, " ");
  if (!normalized.trim()) return [];

  const paragraphs = normalized.split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = words[0]!;
    for (let i = 1; i < words.length; i++) {
      const word = words[i]!;
      const test = `${current} ${word}`;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        current = test;
      } else {
        lines.push(current);
        current = word;
        // Hard-break extremely long tokens.
        while (font.widthOfTextAtSize(current, size) > maxWidth && current.length > 1) {
          let cut = current.length - 1;
          while (
            cut > 1 &&
            font.widthOfTextAtSize(current.slice(0, cut), size) > maxWidth
          ) {
            cut -= 1;
          }
          lines.push(current.slice(0, cut));
          current = current.slice(cut);
        }
      }
    }
    lines.push(current);
  }

  return lines;
}
