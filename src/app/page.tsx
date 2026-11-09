import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="max-w-2xl">
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.3em] text-indigo-400">
          Circle
        </p>
        <h1 className="text-balance text-4xl font-semibold leading-tight sm:text-6xl">
          CMU&rsquo;s shared social map.
        </h1>
        <p className="mt-6 text-pretty text-lg leading-relaxed text-slate-300">
          Claim your profile, describe the communities you&rsquo;re part of, and
          build mutually confirmed connections. Circle turns the shared network
          into an explorable map of clusters, mutual friends, and bridges.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/graph"
            className="rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
          >
            Explore the graph
          </Link>
        </div>
      </div>
    </main>
  );
}
