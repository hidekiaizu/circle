import ClaimProfile from "./ClaimProfile";
import { GraphStoreProvider } from "@/lib/GraphStore";

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <GraphStoreProvider>
      <ClaimProfile token={token} />
    </GraphStoreProvider>
  );
}
