/**
 * Phase 1 AI Review — rule-based intelligence for Roofing Calculator.
 * No external AI; uses current estimate values to produce warnings, tips, and next steps.
 */

export type AIReviewSnapshot = {
  zip: string;
  roofAreaSqFt: number;
  squares: number;
  adjustedSquares: number;
  bundles: number;
  materialsCost: number;
  laborCost: number;
  tearOffEnabled: boolean;
  tearOffTons: number;
  tearOffCost: number;
  marginPct: number;
  jobCostBeforeProfit: number;
  suggestedPrice: number;
};

export type AIReviewBullet = {
  type: "warning" | "tip" | "good";
  text: string;
};

export type AIReviewResult = {
  level: "low" | "medium" | "high";
  headline: string;
  bullets: AIReviewBullet[];
  nextSteps: string[];
};

/**
 * Rule engine: evaluates snapshot and returns level, headline, bullets, and next steps.
 * Contractor-realistic and beginner-friendly.
 */
export function getAIReview(snapshot: AIReviewSnapshot): AIReviewResult {
  const bullets: AIReviewBullet[] = [];
  let level: "low" | "medium" | "high" = "low";
  let warningCount = 0;

  const totalCost = Math.max(
    snapshot.materialsCost +
      snapshot.laborCost +
      (snapshot.tearOffEnabled ? snapshot.tearOffCost : 0),
    1
  );
  const laborShare = snapshot.laborCost / totalCost;
  const pricePerSquare =
    snapshot.squares > 0 && snapshot.suggestedPrice > 0
      ? snapshot.suggestedPrice / snapshot.squares
      : 0;

  // W1) Missing core values
  if (snapshot.roofAreaSqFt <= 0) {
    bullets.push({
      type: "warning",
      text: "Enter roof area to calculate squares and pricing.",
    });
    warningCount++;
  }
  if (snapshot.materialsCost <= 0) {
    bullets.push({
      type: "warning",
      text: "Materials look unset. Add bundle cost (or defaults) to estimate materials.",
    });
    warningCount++;
  }
  if (snapshot.laborCost <= 0) {
    bullets.push({
      type: "warning",
      text: "Labor is $0. Most jobs include labor. Confirm before sending a bid.",
    });
    warningCount++;
  }

  // W2) Margin sanity
  if (snapshot.marginPct < 10) {
    bullets.push({
      type: "warning",
      text: "Profit margin is under 10%. Many contractors target 15–25%.",
    });
    warningCount++;
  } else if (snapshot.marginPct >= 10 && snapshot.marginPct < 15) {
    bullets.push({
      type: "tip",
      text: "Margin is on the low side. Consider 15–25% depending on overhead.",
    });
  } else if (snapshot.marginPct >= 15 && snapshot.marginPct <= 30) {
    bullets.push({
      type: "good",
      text: "Margin is in a common target range.",
    });
  } else if (snapshot.marginPct > 35) {
    bullets.push({
      type: "tip",
      text: "High margin. If you're trying to be competitive, double-check pricing.",
    });
  }

  // W3) Labor vs materials ratio
  if (
    laborShare < 0.25 &&
    snapshot.laborCost > 0 &&
    snapshot.roofAreaSqFt > 1200
  ) {
    bullets.push({
      type: "tip",
      text: "Labor seems low vs total. Confirm crew cost or scope.",
    });
  }
  if (laborShare > 0.7 && snapshot.laborCost > 0) {
    bullets.push({
      type: "tip",
      text: "Labor dominates total. Confirm you didn't enter total job price into labor by mistake.",
    });
  }

  // W4) Tear-off sanity
  if (
    !snapshot.tearOffEnabled &&
    snapshot.roofAreaSqFt > 1800
  ) {
    bullets.push({
      type: "tip",
      text: "Tear-off is off. If this is a replacement (not overlay), enable old roof removal.",
    });
  }
  if (snapshot.tearOffEnabled && snapshot.tearOffCost <= 0) {
    bullets.push({
      type: "warning",
      text: "Tear-off is enabled but cost is $0. Check landfill rate.",
    });
    warningCount++;
  }

  // W5) Outlier checks
  if (snapshot.suggestedPrice > 0 && snapshot.squares > 0) {
    if (pricePerSquare < 150) {
      bullets.push({
        type: "warning",
        text: "Price per square looks very low. Recheck inputs.",
      });
      warningCount++;
    } else if (pricePerSquare > 1500) {
      bullets.push({
        type: "tip",
        text: "Price per square is very high. If you want competitive bids, verify labor/material inputs.",
      });
    }
  }

  // Level logic: any warning → medium; 2+ warnings or missing roof area or extreme low price → high
  if (warningCount >= 1) level = "medium";
  if (
    warningCount >= 2 ||
    (snapshot.roofAreaSqFt <= 0 && warningCount >= 1) ||
    (pricePerSquare > 0 && pricePerSquare < 150)
  ) {
    level = "high";
  }

  // Headlines
  const headline =
    level === "high"
      ? "Important: review these before you quote this job."
      : level === "medium"
        ? "A few items to confirm before sending."
        : "Looks solid. Here are a few quick checks.";

  // Next steps (always 2–4)
  const nextSteps: string[] = [
    "Double-check labor and materials are filled.",
    "Confirm tear-off matches scope (replacement vs overlay).",
    "Save as ZIP defaults if you price jobs like this often.",
    "Save estimate to history before sending.",
  ];

  return {
    level,
    headline,
    bullets,
    nextSteps,
  };
}
