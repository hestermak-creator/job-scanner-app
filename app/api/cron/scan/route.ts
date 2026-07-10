import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildMatchingPrompt } from "@/lib/scan-prompt";
import { UserProfile } from "@/lib/types";

// Vercel Hobby's Fluid compute allows up to 300s; this loops over every
// user's profile sequentially (one Claude call with web search each), which
// can take a while. If you outgrow this at maybe 8-10 users, split into one
// invocation per user instead of one invocation for everyone — see README.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-5";

interface ParsedMatch {
  tier?: string;
  jobTitle?: string;
  company?: string;
  location?: string;
  compRange?: string;
  matchStars?: string;
  rationale?: string;
  resumeBaseline?: string;
  applyLink?: string;
}

function extractJsonArray(text: string): ParsedMatch[] | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text.match(/(\[[\s\S]*\])/)?.[1];
  if (!candidate) return null;
  try {
    const parsed = JSON.parse(candidate);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const supabase = createAdminClient();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const { data: profileRows, error: profilesError } = await supabase.from("profiles").select("*");
  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const results: Record<string, unknown> = {};

  for (const profileRow of profileRows ?? []) {
    const userId = profileRow.id as string;
    try {
      const [{ data: criteria }, { data: resumeRows }, { data: existingRows }] = await Promise.all([
        supabase.from("search_criteria").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("resumes").select("*").eq("user_id", userId),
        supabase.from("job_matches").select("company, job_title").eq("user_id", userId)
      ]);

      const profile: UserProfile = {
        id: profileRow.id,
        createdAt: profileRow.created_at,
        name: profileRow.name,
        title: profileRow.title,
        yearsExperience: profileRow.years_experience,
        backgroundSummary: profileRow.background_summary,
        linkedinUrl: profileRow.linkedin_url,
        resumes: (resumeRows ?? []).map((r) => ({
          id: r.id,
          name: r.file_name,
          tags: r.tags ?? []
        })),
        roleLevels: criteria?.role_levels ?? [],
        focusAreas: criteria?.focus_areas ?? [],
        locations: criteria?.locations ?? [],
        targetCompanies: criteria?.target_companies ?? [],
        exclusions: criteria?.exclusions ?? "",
        deliveryEmail: profileRow.delivery_email,
        deliveryMethod: profileRow.delivery_method,
        gmailOptIn: profileRow.gmail_opt_in
      };

      if (profile.roleLevels.length === 0 && profile.focusAreas.length === 0) {
        results[userId] = { skipped: "onboarding incomplete (no criteria set)" };
        continue;
      }

      const existing = (existingRows ?? []).map((m) => ({
        company: m.company as string,
        jobTitle: m.job_title as string
      }));

      const prompt = buildMatchingPrompt(profile, existing);

      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            name: "web_search",
            description:
              "Search the web for job postings, company details, and LinkedIn signal relevant to this user's role and experience.",
            input_schema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "The search query for the web search tool."
                }
              },
              required: ["query"]
            }
          }
        ]
      });

      const fullText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      const parsed = extractJsonArray(fullText);
      if (!parsed) {
        results[userId] = { error: "Could not parse a JSON match list from the response" };
        continue;
      }

      const existingKeys = new Set(
        existing.map((e) => `${e.company.toLowerCase()}|${e.jobTitle.toLowerCase()}`)
      );
      const today = new Date().toISOString().slice(0, 10);

      const rows = parsed
        .filter((m) => m && m.company && m.jobTitle)
        .filter(
          (m) =>
            !existingKeys.has(`${String(m.company).toLowerCase()}|${String(m.jobTitle).toLowerCase()}`)
        )
        .map((m) => ({
          user_id: userId,
          date_pulled: today,
          tier: m.tier === "Top Match" ? "Top Match" : "Monitoring",
          job_title: m.jobTitle,
          company: m.company,
          location: m.location ?? "",
          comp_range: m.compRange ?? "",
          match_stars: m.matchStars ?? "",
          rationale: m.rationale ?? "",
          resume_baseline: m.resumeBaseline ?? "",
          draft_file: "",
          apply_link: m.applyLink ?? "",
          status: "New",
          notes: ""
        }));

      if (rows.length > 0) {
        const { error: insertError } = await supabase.from("job_matches").insert(rows);
        if (insertError) throw insertError;
      }

      results[userId] = { inserted: rows.length, found: parsed.length };
    } catch (err) {
      results[userId] = { error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), results });
}
