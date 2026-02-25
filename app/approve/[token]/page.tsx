import ApproveClient from "./ApproveClient";

export default function ApprovePage({
  params,
}: {
  params: { token: string };
}) {
  const token = params?.token || "";

  return <ApproveClient token={token} />;
}
