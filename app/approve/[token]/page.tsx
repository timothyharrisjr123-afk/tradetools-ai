import ApproveClient from "./ApproveClient";

export default function ApprovePage({
  params,
}: {
  params: { token: string };
}) {
  return <ApproveClient token={params.token} />;
}
