# Job scanner app

An onboarding flow + dashboard for turning the personal daily job scanner
into something you can share with family and friends. Auth and the database
are real (Supabase) — each person who signs in gets their own private
profile and job matches, enforced by row-level security in Postgres, not
just app logic.

## What's here

- `app/login` + `app/auth/callback` — email magic-link sign-in via Supabase
  Auth. No passwords to manage.
- `middleware.ts` — protects `/onboarding` and `/dashboard`, redirecting
  signed-out visitors to `/login`.
- `app/onboarding` — the 6-step onboarding wizard (profile, resumes,
  LinkedIn, target criteria, delivery/email, review). Posts to
  `app/api/profile/route.ts`, which saves against the signed-in user.
- `app/dashboard` — shows the signed-in user's job matches. Shows sample
  rows until a real scan has run for that account.
- `lib/db.ts` — the data layer, backed by Supabase Postgres. The
  `profiles`, `resumes`, `search_criteria`, and `job_matches` tables all
  have row-level security policies scoping every row to `auth.uid()`, so
  the database itself refuses cross-user reads, not just the app code.
- A private `resumes` Storage bucket holds the actual uploaded files, one
  folder per user ID (`${userId}/...`), with storage-level RLS policies
  matching the same "only your own" rule.
- `lib/scan-prompt.ts` — `buildMatchingPrompt()` builds the search/rank
  prompt actually used by the scan (see below); `buildScanPrompt()` is the
  fuller aspirational version including resume-draft generation, kept as a
  reference for later.
- `app/api/cron/scan/route.ts` — the nightly scan. Loops over every saved
  profile, calls Claude (with the web search tool) to find and rank
  matching roles, and inserts new rows into `job_matches`. Runs once a day
  via Vercel Cron (`vercel.json`), and is bearer-token protected with
  `CRON_SECRET` so nobody else can trigger it.
- `lib/supabase/admin.ts` — a service-role Supabase client, used only by
  the cron route. It's the one place in the app that legitimately bypasses
  row-level security, since the nightly job has to read and write every
  user's rows in one run rather than acting as a single signed-in user.

## Running it

```bash
cd job-scanner-app
npm install
npm run dev
```

`.env.local` is already filled in with the Supabase project's URL and
public anon key (safe to ship — RLS is what actually protects the data,
not keeping this key secret). Visit `/onboarding`, sign in with your email
via the magic link, fill out your profile, then check `/dashboard`.

## Running the nightly scan

Three env vars are required beyond the two already in `.env.local` — see
`.env.example` for where each comes from: `ANTHROPIC_API_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, and `CRON_SECRET`. Add all three to Vercel's
project settings (Environment Variables) for it to run in production; add
them to `.env.local` too if you want to trigger it locally.

To test it manually rather than waiting for the schedule:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-app.vercel.app/api/cron/scan
```

It responds with a per-user summary (`{ inserted, found }` or `{ error }`
for each user ID) so you can see what happened without digging through
logs. `vercel.json` schedules it for `0 13 * * *` (once daily, sometime in
that UTC hour — Vercel Hobby doesn't guarantee the exact minute). Change
the cron expression there if you want a different time.

Cost note: each user scanned costs one Claude API call with up to 15 web
searches (~$0.15/scan in search fees alone, per Anthropic's $10/1,000
searches pricing, plus token costs) — trivial at family-and-friends scale,
but worth knowing since it's metered.

Scale note: it loops over users sequentially in a single function
invocation, capped at Vercel's 300s Hobby/Fluid limit. Fine for a handful
of users; past roughly 8-10, split into one invocation per user (e.g. a
dynamic route per user ID, each with its own cron entry) instead.

## What's not built yet (on purpose)

- **No tailored resume drafts.** The scan finds and ranks matches, but
  doesn't generate the "ALT: suggestion" tailored `.docx` per match yet —
  that's `buildScanPrompt()`'s Step 5, intentionally not wired into the
  cron job in this pass. It's a meaningfully separate piece: reading the
  uploaded resume from Storage, generating a formatted document, and
  storing it back. `draft_file` stays empty on every row until that's built.
- **Resume tagging is still a filename guess.** The file itself now
  uploads for real to a private Supabase Storage bucket (`resumes`, RLS'd
  to `${userId}/...` paths — see `handleResumeFiles` in the wizard), and
  clicking a resume's name in the wizard opens it via a signed URL. What's
  still a placeholder is the *tag*: it's guessed from the filename
  (`guessTags`), not from actually reading the PDF. Swap that for a real
  "read the file and tag it" LLM call once the scan job exists to do the
  reading.
- **Removing a resume in the wizard doesn't delete the uploaded file** —
  it just drops it from that profile's list; the object stays in storage.
  Fine for now, but add a `supabase.storage.from('resumes').remove(...)`
  call alongside `removeResume` before this matters at any real scale.
- **No email sending.** The delivery email is captured and saved, but
  nothing sends to it yet — add Resend or Postmark for the digest.
- **No Gmail integration wiring**, even though the opt-in toggle exists.
  Google's `gmail.readonly` scope needs manual app verification
  (4-6 weeks) before it can be offered to more than 100 external users —
  see the architecture doc. Treat this as a v2 feature.
- **No onboarding prefill.** Revisiting `/onboarding` after you've already
  saved a profile starts the wizard blank instead of loading your existing
  answers — fine for now since "Finish" upserts over your own row, but
  worth fixing before this feels polished.

## Deploying it for real

This no longer has the "serverless can't persist data" problem the JSON
file store had — Supabase is a real hosted Postgres instance, reachable
from anywhere. Push this to GitHub, import it into Vercel, add the two
`NEXT_PUBLIC_SUPABASE_*` env vars from `.env.local` in Vercel's project
settings, and the deployed link will work correctly for multiple real
people signing in with their own accounts.

See the full architecture write-up for the reasoning behind these choices,
including the Gmail OAuth constraint and cost estimates.
