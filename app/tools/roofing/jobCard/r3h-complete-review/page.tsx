import JobCardR3hCompleteReviewHarness from "../JobCardR3hCompleteReviewHarness";

export default function R3hCompleteReviewPage() {
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  return <JobCardR3hCompleteReviewHarness />;
}
