export interface ResumeFile {
  id: string;
  name: string;
  tags: string[];
  // Path inside the private "resumes" Supabase Storage bucket, scoped to
  // `${userId}/...` by storage RLS. Undefined only for resumes added before
  // real upload was wired up.
  storagePath?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  title: string;
  yearsExperience: number | null;
  backgroundSummary: string;
  linkedinUrl: string;
  resumes: ResumeFile[];
  roleLevels: string[];
  focusAreas: string[];
  locations: string[];
  targetCompanies: string[];
  exclusions: string;
  deliveryEmail: string;
  deliveryMethod: "email" | "inapp";
  gmailOptIn: boolean;
  createdAt: string;
}

export const DEFAULT_TARGET_COMPANIES = [
  "Google",
  "Meta",
  "Amazon",
  "Apple",
  "Microsoft",
  "Netflix",
  "OpenAI",
  "Anthropic",
  "Salesforce",
  "Adobe"
];

export const ROLE_LEVELS = ["Senior PM", "Staff PM", "Principal PM"];

export const LOCATIONS = [
  "Remote (US)",
  "Seattle WA",
  "Bellevue WA",
  "SF Bay Area CA",
  "Los Angeles CA"
];

export interface JobMatch {
  id: string;
  userId: string;
  datePulled: string;
  tier: "Top Match" | "Monitoring";
  jobTitle: string;
  company: string;
  location: string;
  compRange: string;
  matchStars: string;
  rationale: string;
  resumeBaseline: string;
  draftFile: string;
  applyLink: string;
  status: "New" | "Draft ready";
  notes: string;
}
