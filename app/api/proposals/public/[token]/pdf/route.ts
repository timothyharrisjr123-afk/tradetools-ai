/**
 * GET /api/proposals/public/[token]/pdf
 * Customer download of the exact token-bound frozen proposal PDF.
 * Raw token is the only authority — never trust version/proposal from client.
 */

import { NextResponse } from "next/server";

import {
  publicProposalPdfHttpStatus,
  publicProposalPdfResponseHeaders,
} from "@/app/lib/proposalPdfPublicDownload";
import { generatePublicProposalPdfForToken } from "@/app/lib/proposalPdfPublicDownload.server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const result = await generatePublicProposalPdfForToken(token);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false },
        { status: publicProposalPdfHttpStatus(result.code) }
      );
    }

    return new NextResponse(Buffer.from(result.bytes), {
      status: 200,
      headers: publicProposalPdfResponseHeaders(result.filename),
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
