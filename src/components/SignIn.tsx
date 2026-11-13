"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignIn() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <main className="flex min-h-dvh items-center justify-center px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-7 shadow-2xl">
      <p className="text-xs uppercase tracking-[0.3em] text-indigo-400">Circle</p>
      <h1 className="mt-3 text-3xl font-semibold">Sign in to your circle</h1>
      <p className="mt-2 text-sm text-slate-400">Circle is private to invited members. Have an invitation? Open the link you received to claim your node.</p>
      <form className="mt-6 space-y-4" onSubmit={async event => {
        event.preventDefault(); setBusy(true); setError("");
        try {
          const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "Could not sign in.");
          router.push("/graph");
          router.refresh();
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not sign in."); setBusy(false); }
      }}>
        <label className="block text-sm">Username<input required autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2" /></label>
        <label className="block text-sm">Password<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2" /></label>
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-indigo-500 px-4 py-3 font-semibold disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  </main>;
}
