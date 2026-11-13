"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ClaimProfile({ token }: { token: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "invalid">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/auth/invitation?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async response => {
        if (!active) return;
        if (!response.ok) { setStatus("invalid"); return; }
        const invitation = await response.json() as { name: string };
        setName(invitation.name);
        setStatus("ready");
      }).catch(() => { if (active) setStatus("invalid"); });
    return () => { active = false; };
  }, [token]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-7 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.3em] text-indigo-400">Circle invitation</p>
        {status === "loading" ? <h1 className="mt-3 text-2xl">Opening invitation…</h1> :
        status === "invalid" ? <>
          <h1 className="mt-3 text-2xl font-semibold">Invitation unavailable</h1>
          <p className="mt-3 text-sm text-slate-400">This link may have expired or already been used. Ask the person who invited you for a new link.</p>
        </> : <>
          <h1 className="mt-3 text-2xl font-semibold">Claim your node</h1>
          <p className="mt-2 text-sm text-slate-400">Correct your name if needed, then create a username and password.</p>
          <form className="mt-6 space-y-4" onSubmit={async event => {
            event.preventDefault(); setBusy(true); setError("");
            try {
              const response = await fetch("/api/auth/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, name, username, password }) });
              const result = await response.json();
              if (!response.ok) throw new Error(result.error ?? "Could not claim this node.");
              router.push("/graph");
              router.refresh();
            } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not claim this node."); setBusy(false); }
          }}>
            <label className="block text-sm">Your name<input required maxLength={120} value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2" /></label>
            <label className="block text-sm">Username<input required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2" /></label>
            <label className="block text-sm">Password<input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2" /></label>
            <p className="text-xs text-slate-400">Use at least 12 characters. There is no automatic password reset without an email or phone number.</p>
            {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
            <button disabled={busy} className="w-full rounded-lg bg-indigo-500 px-4 py-3 font-semibold disabled:opacity-50">{busy ? "Claiming…" : "Claim my node"}</button>
          </form>
        </>}
        <Link href="/" className="mt-5 block text-center text-sm text-slate-400 hover:text-white">Sign in instead</Link>
      </div>
    </main>
  );
}
