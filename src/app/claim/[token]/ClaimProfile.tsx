"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useGraphStore } from "@/lib/GraphStore";

export default function ClaimProfile({ token }: { token: string }) {
  const router = useRouter();
  const {
    data,
    loading,
    error,
    claimedPersonId,
    claimPerson,
    restoreClaimedPerson,
  } = useGraphStore();
  const [submitting, setSubmitting] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const person = useMemo(
    () => data.people.find((candidate) => candidate.claimToken === token),
    [data.people, token],
  );

  if (loading) {
    return <ClaimShell title="Opening your invitation…" detail="Loading the shared Circle network." />;
  }
  if (error) {
    return <ClaimShell title="Circle is unavailable" detail={error} />;
  }
  if (!person) {
    return <ClaimShell title="This invite link is invalid" detail="Ask the person who invited you for a fresh link." />;
  }
  if (person.claimed) {
    const isCurrentProfile = claimedPersonId === person.id;
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 text-center shadow-2xl sm:p-7">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-indigo-400">
            Circle profile
          </p>
          <h1 className="mt-3 text-2xl font-semibold">
            {isCurrentProfile
              ? `You are using ${person.name}`
              : `${person.name} is already claimed`}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            {isCurrentProfile
              ? "This browser is connected to your profile."
              : "If you opened your original claim link on a new browser or device, you can restore access here."}
          </p>
          <button
            onClick={() => {
              if (!isCurrentProfile && !restoreClaimedPerson(person.id, token)) {
                setClaimError("This profile could not be restored from this link.");
                return;
              }
              router.push(
                `/graph?person=${encodeURIComponent(person.id)}`,
              );
            }}
            className="mt-6 w-full rounded-lg bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
          >
            {isCurrentProfile ? "Open my graph" : "Use this profile on this device"}
          </button>
          {claimError && (
            <p className="mt-4 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">
              {claimError}
            </p>
          )}
          <Link href="/graph" className="mt-3 block text-sm text-slate-400 hover:text-white">
            Explore without editing
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl sm:p-7">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-indigo-400">Circle invitation</p>
        <h1 className="mt-3 text-3xl font-semibold">Are you {person.name}?</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          Claim this profile to edit your information, propose connections, and confirm connections other people send you.
        </p>
        {claimError && <p className="mt-4 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">{claimError}</p>}
        <button
          disabled={submitting}
          onClick={async () => {
            setSubmitting(true);
            const claimed = await claimPerson(person.id, token);
            if (claimed) router.push(`/graph?person=${encodeURIComponent(person.id)}&onboarding=1`);
            else {
              setClaimError("This profile could not be claimed. The link may have been used in another browser.");
              setSubmitting(false);
            }
          }}
          className="mt-6 w-full rounded-lg bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-60"
        >
          {submitting ? "Claiming…" : "This is me — claim it"}
        </button>
        <Link href="/graph" className="mt-3 block text-center text-sm text-slate-400 hover:text-white">
          Not me — explore Circle
        </Link>
      </div>
    </main>
  );
}

function ClaimShell({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-indigo-400">Circle</p>
        <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm text-slate-400">{detail}</p>
        <Link href="/graph" className="mt-6 inline-block rounded-full bg-white/10 px-5 py-2 text-sm font-medium hover:bg-white/20">
          Open the graph
        </Link>
      </div>
    </main>
  );
}
