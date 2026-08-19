import JobCardR3gProductionReviewHarness from "../JobCardR3gProductionReviewHarness";

export default function R3gProductionReviewPage() {
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  return <JobCardR3gProductionReviewHarness />;
}

