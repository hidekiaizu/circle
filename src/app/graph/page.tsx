import { Suspense } from "react";
import GraphExplorer from "@/components/GraphExplorer";
import { GraphStoreProvider } from "@/lib/GraphStore";

export default function GraphPage() {
  return (
    <GraphStoreProvider>
      {/* GraphExplorer reads the `person` query param via useSearchParams,
          which requires a Suspense boundary in the App Router so the static
          shell can prerender while the param-dependent UI renders on the
          client. */}
      <Suspense fallback={null}>
        <GraphExplorer />
      </Suspense>
    </GraphStoreProvider>
  );
}
