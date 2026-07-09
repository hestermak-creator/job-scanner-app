"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/onboarding";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${next}`
      }
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <main className="max-w-sm mx-auto px-6 py-24">
      <h1 className="text-2xl font-semibold mb-2 bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent">
        Sign in
      </h1>
      <p className="text-[13px] text-slate-500 mb-6">
        Each person gets their own private profile and job matches. We&apos;ll
        email you a one-click sign-in link — no password needed.
      </p>

      {status === "sent" ? (
        <p className="text-[14px] text-emerald-700 bg-emerald-50 rounded-2xl p-4">
          Check your inbox for a sign-in link.
        </p>
      ) : (
        <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            className="w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="text-[13px] font-medium bg-gradient-to-r from-violet-600 to-pink-500 text-white px-5 py-2.5 rounded-full shadow-md shadow-violet-200 hover:opacity-90 disabled:opacity-40"
          >
            {status === "sending" ? "Sending…" : "Send magic link"}
          </button>
          {status === "error" && (
            <p className="text-[13px] text-rose-600">
              Couldn&apos;t send the link. Try again.
            </p>
          )}
        </form>
      )}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
