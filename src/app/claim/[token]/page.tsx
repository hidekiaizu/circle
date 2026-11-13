import ClaimProfile from "./ClaimProfile";
import type { Metadata } from "next";

export const metadata: Metadata = { referrer: "no-referrer" };

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ClaimProfile token={token} />;
}
