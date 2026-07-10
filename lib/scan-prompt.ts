// Builds the personalized daily-scan prompt for one user, the same way
// Hester's original hand-written scanner prompt worked — except every
// "Hester-specific" value below is now pulled from that user's onboarding
// profile instead of being typed in by hand.
//
// The nightly job (see README > "Wiring up the real scan") should call
// buildScanPrompt(profile) and hand the result to the Claude Agent SDK
// with web-search, and — only if gmailOptIn is true — Gmail read tools.

import { UserProfile } from "./types";

export function buildScanPrompt(profile: UserProfile): string {
  const resumeGuide = profile.resumes.length
    ? profile.resumes
        .map((r) => `- ${r.tags.join(", ") || "General"} → \`${r.name}\``)
        .join("\n")
    : "- No resumes uploaded yet — skip tailored draft generation and note this in the digest.";

  const gmailStep = profile.gmailOptIn
    ? `## Step 1 — Read LinkedIn job alert emails from Gmail

Search the user's Gmail for new LinkedIn job alert emails received since yesterday
(\`from:jobalerts-noreply@linkedin.com newer_than:1d\`, also try
\`from:jobs-noreply@linkedin.com newer_than:1d\`). Extract job titles, companies,
and apply links from each thread.`
    : `## Step 1 — Gmail scanning is off for this user

This user has not opted into Gmail alert scanning. Skip straight to web search.`;

  return `You are running a daily job scan for ${profile.name || "this user"}${
    profile.title ? `, a ${profile.title}` : ""
  }${profile.yearsExperience ? ` with ${profile.yearsExperience}+ years of experience` : ""}.

## Background summary
${profile.backgroundSummary || "(not provided)"}

${profile.linkedinUrl ? `## LinkedIn profile
If available, scrape the user's LinkedIn profile to confirm current role, experience, skills, and key accomplishments. Use that data to enrich job matching and tailor resume suggestions.
- LinkedIn URL: ${profile.linkedinUrl}

` : ""}## Search criteria
- **Role levels:** ${profile.roleLevels.join(", ") || "(not specified)"}
- **Focus areas:** ${profile.focusAreas.join(", ") || "(not specified)"}
- **Locations:** ${profile.locations.join(", ") || "(not specified)"}
- **Exclude:** ${profile.exclusions || "(none specified)"}
- **Target companies:** Always explicitly check these companies' career pages/job
  boards in addition to general web search — ${profile.targetCompanies.join(", ")}.
  Also surface strong matches at other companies found via general search.

${gmailStep}

## Step 2 — Web search for additional openings

Search LinkedIn, Google Jobs, and company career pages/Greenhouse for postings
matching the criteria above. If the user's LinkedIn profile is available, also
compare postings against their current LinkedIn experience and skills. Run
targeted `site:` queries for each target company's career page. For each
promising result, fetch the job description URL to confirm it's real and active.

## Step 3 — Filter and rank

Combine results, dedupe against this user's existing job-match records, and
keep the top 3-5 best fits plus 2-3 honorable mentions to monitor.

## Step 4 — For each match, provide

Job title, company, location, comp range (if listed), apply link, a match
strength rating (1-5 stars) with a short rationale, which resume file to use
as baseline, and 3-5 specific tailoring suggestions.

## Resume selection guide

${resumeGuide}

## Step 5 — Generate tailored resume drafts for the top matches

For each top match, produce a tailored draft using the "show alternatives"
format: reproduce the baseline resume faithfully, and add indented "ALT:"
suggestion lines under bullets that should change. Never invent facts,
metrics, employers, or dates.

## Step 6 — Record results

Append every new match to this user's job-match table (top matches and
monitoring entries), and send/save a digest to: ${
    profile.deliveryEmail || "(no delivery email on file)"
  } via ${profile.deliveryMethod === "email" ? "email" : "in-app notification only"}.
`;
}
