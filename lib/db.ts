// Real data layer, backed by Supabase Postgres. Every query below runs
// through the signed-in user's session, and row-level security (see the
// migration applied to the project) means Postgres itself refuses to
// return or write another user's rows — this isn't just an app-level
// convention, it's enforced by the database.

import { createClient } from "./supabase/server";
import { JobMatch, ResumeFile, UserProfile } from "./types";

type ProfileInput = Omit<UserProfile, "id" | "createdAt">;

export async function saveProfile(userId: string, data: ProfileInput): Promise<void> {
  const supabase = createClient();

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    name: data.name,
    title: data.title,
    years_experience: data.yearsExperience,
    background_summary: data.backgroundSummary,
    linkedin_url: data.linkedinUrl,
    delivery_email: data.deliveryEmail,
    delivery_method: data.deliveryMethod,
    gmail_opt_in: data.gmailOptIn
  });
  if (profileError) throw profileError;

  const { error: criteriaError } = await supabase.from("search_criteria").upsert({
    user_id: userId,
    role_levels: data.roleLevels,
    focus_areas: data.focusAreas,
    locations: data.locations,
    target_companies: data.targetCompanies,
    exclusions: data.exclusions
  });
  if (criteriaError) throw criteriaError;

  const { error: deleteError } = await supabase.from("resumes").delete().eq("user_id", userId);
  if (deleteError) throw deleteError;

  if (data.resumes.length > 0) {
    const { error: resumeError } = await supabase.from("resumes").insert(
      data.resumes.map((r) => ({
        user_id: userId,
        file_name: r.name,
        tags: r.tags,
        storage_path: r.storagePath ?? null
      }))
    );
    if (resumeError) throw resumeError;
  }
}

export async function getProfileForUser(userId: string): Promise<UserProfile | undefined> {
  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return undefined;

  const { data: criteria } = await supabase
    .from("search_criteria")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: resumeRows } = await supabase.from("resumes").select("*").eq("user_id", userId);

  const resumes: ResumeFile[] = (resumeRows ?? []).map((r) => ({
    id: r.id,
    name: r.file_name,
    tags: r.tags ?? [],
    storagePath: r.storage_path ?? undefined
  }));

  return {
    id: profile.id,
    createdAt: profile.created_at,
    name: profile.name,
    title: profile.title,
    yearsExperience: profile.years_experience,
    backgroundSummary: profile.background_summary,
    linkedinUrl: profile.linkedin_url,
    resumes,
    roleLevels: criteria?.role_levels ?? [],
    focusAreas: criteria?.focus_areas ?? [],
    locations: criteria?.locations ?? [],
    targetCompanies: criteria?.target_companies ?? [],
    exclusions: criteria?.exclusions ?? "",
    deliveryEmail: profile.delivery_email,
    deliveryMethod: profile.delivery_method,
    gmailOptIn: profile.gmail_opt_in
  };
}

export async function getJobMatchesForUser(userId: string): Promise<JobMatch[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("job_matches")
    .select("*")
    .eq("user_id", userId)
    .order("date_pulled", { ascending: false });

  return (data ?? []).map(rowToJobMatch);
}

export async function getJobMatchForUser(userId: string, id: string): Promise<JobMatch | undefined> {
  const supabase = createClient();
  const { data } = await supabase
    .from("job_matches")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  return data ? rowToJobMatch(data) : undefined;
}

export async function appendJobMatches(
  userId: string,
  matches: Omit<JobMatch, "id" | "userId">[]
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("job_matches").insert(
    matches.map((m) => ({
      user_id: userId,
      date_pulled: m.datePulled,
      tier: m.tier,
      job_title: m.jobTitle,
      company: m.company,
      location: m.location,
      comp_range: m.compRange,
      match_stars: m.matchStars,
      rationale: m.rationale,
      resume_baseline: m.resumeBaseline,
      draft_file: m.draftFile,
      apply_link: m.applyLink,
      status: m.status,
      notes: m.notes
    }))
  );
  if (error) throw error;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToJobMatch(row: any): JobMatch {
  return {
    id: row.id,
    userId: row.user_id,
    datePulled: row.date_pulled,
    tier: row.tier,
    jobTitle: row.job_title,
    company: row.company,
    location: row.location,
    compRange: row.comp_range,
    matchStars: row.match_stars,
    rationale: row.rationale,
    resumeBaseline: row.resume_baseline,
    draftFile: row.draft_file,
    applyLink: row.apply_link,
    status: row.status,
    notes: row.notes
  };
}
