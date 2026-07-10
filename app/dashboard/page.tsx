import Link from "next/link";
import { redirect } from "next/navigation";
import { getJobMatchesForUser, getProfileForUser } from "@/lib/db";
import { SAMPLE_MATCHES } from "@/lib/sample-data";
import { createClient } from "@/lib/supabase/server";

const TIER_ORDER: Record<string, number> = { "Top Match": 0, Monitoring: 1 };

function starCount(stars: string) {
  return (stars.match(/★/g) || []).length;
}

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/dashboard");

  const profile = await getProfileForUser(user.id);
  const matches = await getJobMatchesForUser(user.id);
  const rows = matches.length > 0 ? matches : SAMPLE_MATCHES;
  const isSample = matches.length === 0;

  const sorted = [...rows].sort((a, b) => {
    const tierDiff = (TIER_ORDER[a.tier] ?? 2) - (TIER_ORDER[b.tier] ?? 2);
    if (tierDiff !== 0) return tierDiff;
    return starCount(b.matchStars) - starCount(a.matchStars);
  });

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent">
          {profile ? `${profile.name}'s job scan` : "Job scan"}
        </h1>
        <div className="flex items-center gap-4">
          <Link
            href="/onboarding"
            className="text-[13px] font-medium text-violet-600 hover:text-violet-700"
          >
            {profile ? "Edit profile" : "Complete onboarding"}
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-[13px] text-slate-400 hover:text-slate-600">
              Sign out
            </button>
          </form>
        </div>
      </div>
      <p className="text-[13px] text-slate-500 mb-6">
        Signed in as {user.email}
        {profile ? ` · results are delivered to ${profile.deliveryEmail}.` : "."}
      </p>

      {!profile && (
        <div className="text-[13px] bg-violet-50 text-violet-800 rounded-2xl px-4 py-3 mb-6 border border-violet-100">
          You haven&apos;t finished onboarding yet — head to{" "}
          <Link href="/onboarding" className="underline font-medium">
            onboarding
          </Link>{" "}
          to set up your real profile.
        </div>
      )}

      {isSample && (
        <div className="text-[13px] bg-amber-50 text-amber-800 rounded-2xl px-4 py-3 mb-6 border border-amber-100">
          Showing sample data. This populates automatically with your real
          matches after the nightly scan runs for your account (once a day,
          automatically — see README if you want to trigger it manually).
        </div>
      )}

      <div className="flex flex-col gap-3">
        {sorted.map((m) => {
          const isTop = m.tier === "Top Match";
          return (
            <div
              key={m.id}
              className={
                "rounded-2xl border p-4 transition " +
                (isTop
                  ? "border-violet-200 bg-gradient-to-r from-violet-50/70 to-pink-50/50 shadow-sm shadow-violet-100"
                  : "border-slate-100 bg-white")
              }
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={
                        "text-[11px] font-semibold px-2.5 py-0.5 rounded-full " +
                        (isTop
                          ? "bg-gradient-to-r from-violet-600 to-pink-500 text-white"
                          : "bg-slate-100 text-slate-500")
                      }
                    >
                      {m.tier}
                    </span>
                    <span className="text-amber-500 text-[13px] tracking-tight">
                      {m.matchStars}
                    </span>
                    <span
                      className={
                        "text-[11px] font-medium px-2.5 py-0.5 rounded-full " +
                        (m.status === "Draft ready"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-sky-100 text-sky-700")
                      }
                    >
                      {m.status}
                    </span>
                  </div>
                  <p className="text-[15px] font-medium text-slate-900">{m.jobTitle}</p>
                  <p className="text-[13px] text-slate-500">
                    {m.company} · {m.location} · {m.compRange}
                  </p>
                  <p className="text-[13px] text-slate-500 mt-2 max-w-2xl">{m.rationale}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {m.applyLink && (
                    <a
                      href={m.applyLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] font-medium bg-gradient-to-r from-violet-600 to-pink-500 text-white px-3.5 py-1.5 rounded-full hover:opacity-90"
                    >
                      Apply link
                    </a>
                  )}
                  {m.draftFile ? (
                    <Link
                      href={`/dashboard/draft/${m.id}`}
                      className="text-[12px] font-medium bg-violet-50 text-violet-700 px-3.5 py-1.5 rounded-full hover:bg-violet-100"
                    >
                      View resume draft ↗
                    </Link>
                  ) : (
                    <span className="text-[12px] text-slate-300 px-3.5 py-1.5">No draft yet</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
