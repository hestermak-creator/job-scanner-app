import { JobMatch } from "./types";

function googleSearchLink(title: string, company: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${title} ${company} job`)}`;
}

// Shown on the dashboard until a real scan has run for the current profile.
// Apply links point to a real Google search (so the button isn't dead) —
// once the scan job is wired up, m.applyLink will be the real posting URL.
export const SAMPLE_MATCHES: JobMatch[] = [
  {
    id: "sample-1",
    userId: "sample",
    datePulled: new Date().toISOString().slice(0, 10),
    tier: "Top Match",
    jobTitle: "Senior Product Manager, Growth",
    company: "Sample Co",
    location: "Remote (US)",
    compRange: "$180k - $220k",
    matchStars: "★★★★★",
    rationale: "Strong overlap with subscription growth background and target focus areas.",
    resumeBaseline: "Subscriber Growth PM.pdf",
    draftFile: "CV drafts/Sample Co Growth PM - Draft.docx",
    applyLink: googleSearchLink("Senior Product Manager Growth", "Sample Co"),
    status: "Draft ready",
    notes: "Sample data"
  },
  {
    id: "sample-2",
    userId: "sample",
    datePulled: new Date().toISOString().slice(0, 10),
    tier: "Top Match",
    jobTitle: "Staff Product Manager, Marketplace",
    company: "Sample Marketplace Inc",
    location: "Seattle WA",
    compRange: "$210k - $250k",
    matchStars: "★★★★☆",
    rationale: "Marketplace and monetization experience line up well with this role's scope.",
    resumeBaseline: "Offerup PM.pdf",
    draftFile: "CV drafts/Sample Marketplace Staff PM - Draft.docx",
    applyLink: googleSearchLink("Staff Product Manager Marketplace", "Sample Marketplace Inc"),
    status: "Draft ready",
    notes: "Sample data"
  },
  {
    id: "sample-3",
    userId: "sample",
    datePulled: new Date().toISOString().slice(0, 10),
    tier: "Monitoring",
    jobTitle: "Principal Product Manager, Platform",
    company: "Sample Platform Co",
    location: "SF Bay Area CA",
    compRange: "Not listed",
    matchStars: "★★★☆☆",
    rationale: "Decent fit but role level skews higher than target — worth watching.",
    resumeBaseline: "Hester Mak CV 1-pager.pdf",
    draftFile: "",
    applyLink: googleSearchLink("Principal Product Manager Platform", "Sample Platform Co"),
    status: "New",
    notes: "Sample data"
  }
];
