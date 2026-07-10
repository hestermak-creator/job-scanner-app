// Two prompt builders here, serving different purposes:
//
// - buildScanPrompt(): the full aspirational pipeline (Gmail alerts, web
//   search, ranking, AND tailored "ALT:" resume draft generation) — written
//   for a fully agentic runner with file-write tools, like the original
//   hand-written scanner this app is based on. Not called by the actual
//   cron job (see below); kept as a reference for when draft generation
//   gets built.
// - buildMatchingPrompt(): what app/api/cron/scan/route.ts actually calls.
//   Trimmed to search + rank only, and asks Claude to end with a fenced
//   JSON array so the route can parse and insert rows programmatically —
//   a single Messages API call, no agentic file tools involved.
//
// Both pull every "Hester-specific" value from the user's onboarding
// profile instead of having it typed in by hand.

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

## Search criteria
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
matching the criteria above. Run targeted \`site:\` queries for each target
company's career page. For each promising result, fetch the job description
URL to confirm it's real and active.

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

export interface ExistingMatchKey {
  company: string;
  jobTitle: string;
}

// What the cron job actually sends to the Messages API, paired with the
// web_search tool. Ends with an explicit instruction to close out with a
// fenced JSON array — the route parses that block back out of the response
// text and inserts rows from it.
export function buildMatchingPrompt(
  profile: UserProfile,
  existingMatches: ExistingMatchKey[]
): string {
  const resumeGuide = profile.resumes.length
    ? profile.resumes
        .map((r) => `- ${r.tags.join(", ") || "General"} → "${r.name}"`)
        .join("\n")
    : "- No resumes on file — leave resumeBaseline as an empty string for every match.";

  const existingList = existingMatches.length
    ? existingMatches.map((m) => `- ${m.company} — ${m.jobTitle}`).join("\n")
    : "(none yet — this is the first scan for this user)";

  return `You are running a daily job scan for ${profile.name || "this user"}${
    profile.title ? `, a ${profile.title}` : ""
  }${profile.yearsExperience ? ` with ${profile.yearsExperience}+ years of experience` : ""}.

## Background
${profile.backgroundSummary || "(not provided)"}

## Search criteria
- Role levels: ${profile.roleLevels.join(", ") || "(not specified)"}
- Focus areas: ${profile.focusAreas.join(", ") || "(not specified)"}
- Locations: ${profile.locations.join(", ") || "(not specified)"}
- Exclude: ${profile.exclusions || "(none specified)"}
- Target companies: always explicitly check these via site: queries on their
  career pages, in addition to general web search — ${profile.targetCompanies.join(", ") || "(none specified)"}.
  Also surface strong matches at other companies found via general search.

## Resume options (for picking resumeBaseline below)
${resumeGuide}

## Already tracked for this user — do not repeat these
${existingList}

## Task
Search the web (company career pages, Greenhouse, LinkedIn, Google Jobs) for
roles matching the criteria above. Where possible, open promising results to
confirm the posting looks real and currently active. Identify the top 3-5
best-fit matches ("Top Match" tier) plus 2-3 honorable mentions worth
monitoring ("Monitoring" tier). Skip anything already in the tracked list
above, even if the wording differs slightly.

## Output format

After finishing your research, end your entire response with a single fenced
json code block containing ONLY a JSON array — no other text inside the
fence — of objects with exactly these fields:

\`\`\`json
[
  {
    "tier": "Top Match",
    "jobTitle": "string",
    "company": "string",
    "location": "string",
    "compRange": "string, use \\"Not listed\\" if unknown",
    "matchStars": "1-5 star characters, e.g. \\"★★★★☆\\"",
    "rationale": "1-2 sentence explanation of the fit",
    "resumeBaseline": "the best filename from the resume options above, or empty string if none",
    "applyLink": "the actual posting URL"
  }
]
\`\`\`

If you find no good matches, output an empty array: \`[]\`.`;
}
