import Link from "next/link";

export default function Home() {
  return (
    <main className="max-w-xl mx-auto px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold mb-3 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">
        Job scanner
      </h1>
      <p className="text-[15px] text-slate-500 mb-8">
        Set up your profile once, get a daily scan of matching roles and
        tailored resume drafts.
      </p>
      <Link
        href="/onboarding"
        className="inline-block bg-gradient-to-r from-violet-600 to-pink-500 text-white text-sm font-medium px-6 py-3 rounded-full shadow-lg shadow-violet-200 hover:opacity-90 transition"
      >
        Get started
      </Link>
    </main>
  );
}
