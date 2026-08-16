"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ProposalSignatureMarkV1 } from "@/app/lib/proposalSignatureMark";
import { PROPOSAL_SIGNATURE_MARK_VERSION } from "@/app/lib/proposalSignatureMark";

type Point = { x: number; y: number; t: number };

type ProposalPacketSignaturePadProps = {
  disabled?: boolean;
  onChange: (mark: ProposalSignatureMarkV1 | null) => void;
};

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function roundCoord(value: number): number {
  return Math.round(clamp01(value) * 1000) / 1000;
}

function toMark(strokes: Point[][]): ProposalSignatureMarkV1 | null {
  const compact = strokes
    .map((stroke) =>
      stroke.map((point) => {
        const next: Point = { x: point.x, y: point.y, t: Math.max(0, Math.round(point.t)) };
        return next;
      })
    )
    .filter((stroke) => stroke.length >= 2);
  if (compact.length === 0) return null;
  return { version: PROPOSAL_SIGNATURE_MARK_VERSION, strokes: compact };
}

/**
 * Drawn signature pad. Coordinates are normalized 0..1 within the canvas.
 * No Storage upload — the mark JSON is submitted with Accept & sign.
 */
export default function ProposalPacketSignaturePad({
  disabled = false,
  onChange,
}: ProposalPacketSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Point[][]>([]);
  const currentRef = useRef<Point[] | null>(null);
  const originRef = useRef<number>(0);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = "#0b1f33";
    ctx.lineWidth = Math.max(2, width / 180);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const all = currentRef.current
      ? [...strokesRef.current, currentRef.current]
      : strokesRef.current;
    for (const stroke of all) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0]!.x * width, stroke[0]!.y * height);
      for (let i = 1; i < stroke.length; i += 1) {
        ctx.lineTo(stroke[i]!.x * width, stroke[i]!.y * height);
      }
      ctx.stroke();
    }
  }, []);

  const pointFromEvent = (event: PointerEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = roundCoord((event.clientX - rect.left) / rect.width);
    const y = roundCoord((event.clientY - rect.top) / rect.height);
    const t = originRef.current ? event.timeStamp - originRef.current : 0;
    return { x, y, t };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      redraw();
    };
    resize();
    window.addEventListener("resize", resize);

    const onPointerDown = (event: PointerEvent) => {
      if (disabled) return;
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      if (!originRef.current) originRef.current = event.timeStamp;
      const point = pointFromEvent(event);
      if (!point) return;
      currentRef.current = [point];
      redraw();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (disabled || !currentRef.current) return;
      event.preventDefault();
      const point = pointFromEvent(event);
      if (!point) return;
      const last = currentRef.current[currentRef.current.length - 1];
      if (
        last &&
        Math.abs(last.x - point.x) < 0.004 &&
        Math.abs(last.y - point.y) < 0.004
      ) {
        return;
      }
      if (currentRef.current.length < 256) currentRef.current.push(point);
      redraw();
    };
    const endStroke = () => {
      if (!currentRef.current) return;
      if (currentRef.current.length >= 2 && strokesRef.current.length < 24) {
        strokesRef.current = [...strokesRef.current, currentRef.current];
      }
      currentRef.current = null;
      onChange(toMark(strokesRef.current));
      redraw();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endStroke);
    canvas.addEventListener("pointercancel", endStroke);
    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endStroke);
      canvas.removeEventListener("pointercancel", endStroke);
    };
  }, [disabled, onChange, redraw]);

  const clear = () => {
    strokesRef.current = [];
    currentRef.current = null;
    originRef.current = 0;
    onChange(null);
    redraw();
  };

  return (
    <div data-proposal-signature-pad>
      <canvas
        ref={canvasRef}
        className="h-[132px] w-full touch-none rounded-[12px] border border-[#cbd5e1] bg-[#f8fafc]"
        aria-label="Draw your signature"
      />
      <button
        type="button"
        className="mt-1.5 text-[12px] font-medium text-[#2563eb] underline-offset-2 hover:underline disabled:text-[#94a3b8]"
        onClick={clear}
        disabled={disabled}
      >
        Clear
      </button>
    </div>
  );
}
