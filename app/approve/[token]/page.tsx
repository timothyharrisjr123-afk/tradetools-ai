import ApproveClient from "./ApproveClient";

type ApprovePageProps = {
  params: Promise<{ token: string }>;
};

export default async function Page({ params }: ApprovePageProps) {
  const { token } = await params;
  return <ApproveClient token={token} />;
}
