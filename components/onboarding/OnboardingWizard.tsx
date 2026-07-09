"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_TARGET_COMPANIES,
  LOCATIONS,
  ROLE_LEVELS,
  ResumeFile,
  UserProfile
} from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

type FormState = Omit<UserProfile, "id" | "createdAt">;

const TAG_POOL = [
  "Subscription monetization",
  "Marketplace",
  "B2B AI / GTM",
  "SMB / PLG",
  "Consumer discovery",
  "Healthcare AI",
  "Growth / retention"
];

const CATEGORY_COLORS: Record<string, string> = {
  "Subscription monetization": "bg-violet-100 text-violet-700",
  "Marketplace": "bg-pink-100 text-pink-700",
  "B2B AI / GTM": "bg-sky-100 text-sky-700",
  "SMB / PLG": "bg-amber-100 text-amber-700",
  "Consumer discovery": "bg-emerald-100 text-emerald-700",
  "Healthcare AI": "bg-rose-100 text-rose-700",
  "Growth / retention": "bg-teal-100 text-teal-700"
};

function categoryColor(tag: string) {
  return CATEGORY_COLORS[tag] ?? "bg-violet-100 text-violet-700";
}

// Simple filename heuristic so a real file picker gives a plausible tag
// immediately. Swap for a real LLM read-and-tag call once resume storage
// is wired up to Supabase (see README > "Migration path").
function guessTags(filename: string): string[] {
  const lower = filename.toLowerCase();
  const rules: [string[], string][] = [
    [["subscri", "monetiz", "pricing"], "Subscription monetization"],
    [["market", "offerup", "etsy", "thumbtack"], "Marketplace"],
    [["openai", "gpt", " ai", "-ai", "gtm", "salesforce"], "B2B AI / GTM"],
    [["smb", "plg"], "SMB / PLG"],
    [["discovery", "airbnb", "travel", "expedia"], "Consumer discovery"],
    [["health", "medical", "clinical"], "Healthcare AI"],
    [["growth", "retention", "acquisition"], "Growth / retention"]
  ];
  for (const [keywords, tag] of rules) {
    if (keywords.some((k) => lower.includes(k))) return [tag];
  }
  return [TAG_POOL[Math.floor(Math.random() * TAG_POOL.length)]];
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

const STEPS = [
  "Profile",
  "Resumes",
  "LinkedIn",
  "Criteria",
  "Delivery",
  "Review"
];

const initialState: FormState = {
  name: "",
  title: "",
  yearsExperience: null,
  backgroundSummary: "",
  linkedinUrl: "",
  resumes: [],
  roleLevels: [],
  focusAreas: [],
  locations: [],
  targetCompanies: [...DEFAULT_TARGET_COMPANIES],
  exclusions: "",
  deliveryEmail: "",
  deliveryMethod: "email",
  gmailOptIn: false
};

function Chip({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "text-[13px] px-3.5 py-1.5 rounded-full border transition-all " +
        (active
          ? "border-transparent bg-gradient-to-r from-violet-600 to-pink-500 text-white shadow-sm shadow-violet-200"
          : "border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-300")
      }
    >
      {label}
    </button>
  );
}

function RemovableChip({
  label,
  onRemove,
  colorClass
}: {
  label: string;
  onRemove: () => void;
  colorClass?: string;
}) {
  return (
    <span
      className={
        "text-[13px] pl-3 pr-2 py-1.5 rounded-full inline-flex items-center gap-2 " +
        (colorClass ?? "bg-pink-50 text-pink-700")
      }
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="leading-none opacity-70 hover:opacity-100"
      >
        &times;
      </button>
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-[13px] text-slate-500 mb-1.5">{label}</p>
      {children}
    </div>
  );
}

export default function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialState);
  const [focusInput, setFocusInput] = useState("");
  const [companyInput, setCompanyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleInArray(key: "roleLevels" | "locations", value: string) {
    setForm((f) => {
      const arr = f[key];
      const has = arr.includes(value);
      return {
        ...f,
        [key]: has ? arr.filter((v) => v !== value) : [...arr, value]
      };
    });
  }

  async function handleResumeFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    e.target.value = "";

    setUploading(true);
    setUploadError("");
    const supabase = createClient();

    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const uploaded: ResumeFile[] = [];
      for (const file of Array.from(files)) {
        const path = `${user.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
        const { error: uploadErr } = await supabase.storage
          .from("resumes")
          .upload(path, file, { upsert: false });
        if (uploadErr) throw uploadErr;

        uploaded.push({
          id: path,
          name: file.name,
          tags: guessTags(file.name),
          storagePath: path
        });
      }
      update("resumes", [...form.resumes, ...uploaded]);
    } catch (err) {
      setUploadError("Couldn't upload one or more files. Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function viewResume(r: ResumeFile) {
    if (!r.storagePath) return;
    const supabase = createClient();
    const { data, error: signErr } = await supabase.storage
      .from("resumes")
      .createSignedUrl(r.storagePath, 60);
    if (signErr || !data) return;
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  function removeResume(id: string) {
    update(
      "resumes",
      form.resumes.filter((r) => r.id !== id)
    );
  }

  function canAdvance(): boolean {
    if (step === 0) return form.name.trim().length > 0;
    if (step === 4) return form.deliveryEmail.trim().length > 0;
    return true;
  }

  async function finish() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error("Save failed");
      router.push("/dashboard");
    } catch (e) {
      setError("Couldn't save your profile. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-16">
      <div className="flex gap-1.5 mb-2">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={
              "flex-1 h-1.5 rounded-full " +
              (i <= step ? "bg-gradient-to-r from-violet-600 to-pink-500" : "bg-violet-100")
            }
          />
        ))}
      </div>
      <p className="text-[12px] text-slate-400 mb-8">
        Step {step + 1} of {STEPS.length} · {STEPS[step]}
      </p>

      <div className="bg-white border border-violet-100 rounded-3xl p-6 min-h-[360px] shadow-xl shadow-violet-100/40">
        {step === 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-violet-900">Basic profile</h2>
            <Field label="Full name">
              <input
                type="text"
                className="w-full"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Jordan Lee"
              />
            </Field>
            <div className="flex gap-3">
              <div className="flex-1">
                <Field label="Current title">
                  <input
                    type="text"
                    className="w-full"
                    value={form.title}
                    onChange={(e) => update("title", e.target.value)}
                    placeholder="Senior Product Manager"
                  />
                </Field>
              </div>
              <div className="w-32">
                <Field label="Years exp.">
                  <input
                    type="number"
                    className="w-full"
                    value={form.yearsExperience ?? ""}
                    onChange={(e) =>
                      update(
                        "yearsExperience",
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    placeholder="8"
                  />
                </Field>
              </div>
            </div>
            <Field label="Background summary">
              <textarea
                className="w-full"
                rows={3}
                value={form.backgroundSummary}
                onChange={(e) => update("backgroundSummary", e.target.value)}
                placeholder="2-3 sentences on your experience, key strengths, and notable results."
              />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold mb-2 text-violet-900">Resumes</h2>
            <p className="text-[13px] text-slate-500 mb-4">
              Upload one or more resumes — the file itself is stored (privately,
              just for you), not just the name. Each gets auto-tagged with the
              job categories it&apos;s strongest for — confirm or edit the tags
              before finishing.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={handleResumeFiles}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-[13px] font-medium bg-gradient-to-r from-violet-600 to-pink-500 text-white px-4 py-2 rounded-full shadow-sm shadow-violet-200 hover:opacity-90 disabled:opacity-40 mb-4"
            >
              {uploading ? "Uploading…" : "Add resume"}
            </button>
            {uploadError && (
              <p className="text-[13px] text-rose-600 mb-3">{uploadError}</p>
            )}
            <div className="flex flex-col gap-2">
              {form.resumes.length === 0 && !uploading && (
                <p className="text-[13px] text-slate-400">No resumes added yet.</p>
              )}
              {form.resumes.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between border border-violet-100 rounded-2xl px-3.5 py-2.5 bg-white hover:shadow-sm transition"
                >
                  <button
                    type="button"
                    onClick={() => viewResume(r)}
                    disabled={!r.storagePath}
                    className="text-[13px] truncate text-left text-violet-700 hover:underline disabled:text-slate-700 disabled:no-underline disabled:cursor-default"
                  >
                    {r.name}
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={
                        "text-[12px] font-medium px-2.5 py-1 rounded-full " +
                        categoryColor(r.tags[0])
                      }
                    >
                      {r.tags[0]}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeResume(r.id)}
                      aria-label={`Remove ${r.name}`}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-violet-900">LinkedIn profile</h2>
            <Field label="Profile URL">
              <input
                type="url"
                className="w-full"
                value={form.linkedinUrl}
                onChange={(e) => update("linkedinUrl", e.target.value)}
                placeholder="linkedin.com/in/yourname"
              />
            </Field>
            <p className="text-[13px] text-slate-400">
              Used as a reference link only — we don&apos;t scrape LinkedIn data.
            </p>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-violet-900">Target criteria</h2>
            <Field label="Role levels">
              <div className="flex flex-wrap gap-2">
                {ROLE_LEVELS.map((r) => (
                  <Chip
                    key={r}
                    label={r}
                    active={form.roleLevels.includes(r)}
                    onClick={() => toggleInArray("roleLevels", r)}
                  />
                ))}
              </div>
            </Field>
            <Field label="Focus areas">
              <div className="flex flex-wrap gap-2 mb-2">
                {form.focusAreas.map((f) => (
                  <RemovableChip
                    key={f}
                    label={f}
                    colorClass="bg-teal-50 text-teal-700"
                    onRemove={() =>
                      update(
                        "focusAreas",
                        form.focusAreas.filter((x) => x !== f)
                      )
                    }
                  />
                ))}
              </div>
              <input
                type="text"
                className="w-full"
                value={focusInput}
                onChange={(e) => setFocusInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && focusInput.trim()) {
                    e.preventDefault();
                    update("focusAreas", [...form.focusAreas, focusInput.trim()]);
                    setFocusInput("");
                  }
                }}
                placeholder="Type a focus area and press enter"
              />
            </Field>
            <Field label="Locations">
              <div className="flex flex-wrap gap-2">
                {LOCATIONS.map((l) => (
                  <Chip
                    key={l}
                    label={l}
                    active={form.locations.includes(l)}
                    onClick={() => toggleInArray("locations", l)}
                  />
                ))}
              </div>
            </Field>
            <Field label="Companies to always check">
              <div className="flex flex-wrap gap-2 mb-2">
                {form.targetCompanies.map((c) => (
                  <RemovableChip
                    key={c}
                    label={c}
                    colorClass="bg-amber-50 text-amber-700"
                    onRemove={() =>
                      update(
                        "targetCompanies",
                        form.targetCompanies.filter((x) => x !== c)
                      )
                    }
                  />
                ))}
              </div>
              <input
                type="text"
                className="w-full"
                value={companyInput}
                onChange={(e) => setCompanyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && companyInput.trim()) {
                    e.preventDefault();
                    update("targetCompanies", [...form.targetCompanies, companyInput.trim()]);
                    setCompanyInput("");
                  }
                }}
                placeholder="Add a company and press enter"
              />
            </Field>
            <Field label="Exclusions">
              <textarea
                className="w-full"
                rows={2}
                value={form.exclusions}
                onChange={(e) => update("exclusions", e.target.value)}
                placeholder="e.g. no healthcare-only roles, no 3+ days in-office"
              />
            </Field>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-violet-900">Delivery preferences</h2>
            <Field label="Email address">
              <input
                type="email"
                className="w-full"
                value={form.deliveryEmail}
                onChange={(e) => update("deliveryEmail", e.target.value)}
                placeholder="you@example.com"
              />
              <p className="text-[12px] text-slate-400 mt-1.5">
                Your daily scan results and tailored resume drafts get sent here.
              </p>
            </Field>
            <Field label="How should we send results?">
              <div className="flex gap-2">
                <Chip
                  label="Email digest"
                  active={form.deliveryMethod === "email"}
                  onClick={() => update("deliveryMethod", "email")}
                />
                <Chip
                  label="In-app only"
                  active={form.deliveryMethod === "inapp"}
                  onClick={() => update("deliveryMethod", "inapp")}
                />
              </div>
            </Field>
            <div className="bg-gradient-to-r from-violet-50 to-pink-50 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[14px] mb-0.5 text-violet-900">
                  Also scan Gmail for LinkedIn job alerts
                </p>
                <p className="text-[12px] text-slate-500">
                  Optional. Requires Google account verification and may take
                  a few weeks to enable.
                </p>
              </div>
              <button
                type="button"
                onClick={() => update("gmailOptIn", !form.gmailOptIn)}
                className={
                  "text-[13px] font-medium px-3.5 py-1.5 rounded-full shrink-0 transition " +
                  (form.gmailOptIn
                    ? "bg-emerald-500 text-white"
                    : "bg-white text-slate-500 border border-violet-200")
                }
              >
                {form.gmailOptIn ? "On" : "Off"}
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-violet-900">Review</h2>
            <dl className="text-[13px] flex flex-col gap-2.5">
              {[
                ["Name", form.name || "(not set)"],
                ["Title / experience", `${form.title || "(not set)"} · ${form.yearsExperience ?? "(not set)"} yrs`],
                ["LinkedIn", form.linkedinUrl || "(not set)"],
                ["Resumes", `${form.resumes.length} uploaded`],
                ["Role levels", form.roleLevels.join(", ") || "(none selected)"],
                ["Focus areas", form.focusAreas.join(", ") || "(none added)"],
                ["Locations", form.locations.join(", ") || "(none selected)"],
                ["Target companies", `${form.targetCompanies.length} companies`],
                ["Exclusions", form.exclusions || "(none)"],
                ["Delivery email", form.deliveryEmail || "(not set)"],
                ["Delivery method", form.deliveryMethod === "email" ? "Email digest" : "In-app only"],
                ["Gmail alerts", form.gmailOptIn ? "Enabled (advanced)" : "Off"]
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between gap-4 border-b border-violet-50 pb-2.5"
                >
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-right max-w-[60%] text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
            {error && <p className="text-[13px] text-rose-600 mt-3">{error}</p>}
          </div>
        )}
      </div>

      <div className="flex justify-between mt-6">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className={
            "text-[13px] font-medium border border-violet-200 text-violet-600 px-4 py-2 rounded-full hover:bg-violet-50 " +
            (step === 0 ? "invisible" : "")
          }
        >
          Back
        </button>
        <button
          type="button"
          disabled={!canAdvance() || saving}
          onClick={() => {
            if (step === STEPS.length - 1) {
              finish();
            } else {
              setStep((s) => Math.min(STEPS.length - 1, s + 1));
            }
          }}
          className="text-[13px] font-medium bg-gradient-to-r from-violet-600 to-pink-500 text-white px-5 py-2 rounded-full shadow-md shadow-violet-200 hover:opacity-90 disabled:opacity-40 disabled:shadow-none transition"
        >
          {step === STEPS.length - 1 ? (saving ? "Saving…" : "Finish") : "Next"}
        </button>
      </div>
    </div>
  );
}
