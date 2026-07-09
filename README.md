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
- `lib/scan-prompt.ts` — takes a saved `UserProfile` and builds the same
  kind of prompt the original hand-written scanner used, just filled in
  from the database instead of typed by hand. This is the piece that
  still needs to be wired to an actual scheduled job (see below).

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

## What's not built yet (on purpose)

- **No real scan job.** `lib/scan-prompt.ts` builds the prompt; nothing
  calls it yet. Wiring this up means: pick a scheduler (Trigger.dev or
  Inngest), write a nightly function that loops over saved profiles, calls
  `buildScanPrompt(profile)`, runs it through the Claude Agent SDK with
  web-search (and Gmail read, only for opted-in users) tools, and writes
  results back via `appendJobMatches(userId, matches)`.
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
