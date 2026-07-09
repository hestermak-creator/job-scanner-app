import Link from "next/link";
import { redirect } from "next/navigation";
import { getJobMatchForUser } from "@/lib/db";
import { SAMPLE_MATCHES } from "@/lib/sample-data";
import { createClient } from "@/lib/supabase/server";

export default async function DraftPreviewPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/dashboard/draft/${params.id}`);

  const real = await getJobMatchForUser(user.id, params.id);
  const match = real ?? SAMPLE_MATCHES.find((m) => m.id === params.id);

  if (!match) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="text-slate-500 text-[14px] mb-4">Couldn&apos;t find that draft.</p>
        <Link href="/dashboard" className="text-violet-600 text-[13px] font-medium">
          Back to dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <Link href="/dashboard" className="text-[13px] text-violet-600 font-medium">
        &larr; Back to dashboard
      </Link>

      <div className="mt-4 bg-white border border-violet-100 rounded-3xl p-6 shadow-xl shadow-violet-100/40">
        <p className="text-[12px] text-slate-400 mb-1">Tailored for</p>
        <h1 className="text-xl font-semibold text-violet-900 mb-1">
          {match.company} — {match.jobTitle}
        </h1>
        <p className="text-[13px] text-slate-500 mb-6">
          Baseline resume: {match.resumeBaseline || "(not set)"}
        </p>

        <div className="bg-gradient-to-r from-violet-50 to-pink-50 rounded-2xl p-4 text-[13px] text-slate-600 mb-6">
          This is a placeholder preview — no scan has generated a real draft
          yet. Once the nightly scan job is wired up (see README &gt;
          &quot;What&apos;s not built yet&quot;), this page will show the
          actual generated .docx: original bullets in black, with blue
          &quot;ALT:&quot; suggestion lines beneath the ones the scan
          recommends tailoring toward this role.
        </div>

        <p className="text-[13px] text-slate-500 mb-1">Why this match</p>
        <p className="text-[14px] text-slate-800">{match.rationale}</p>
      </div>
    </main>
  );
}
