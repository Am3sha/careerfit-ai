import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast, Toaster } from "sonner";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  FileText,
  Sparkles,
  Upload,
  Loader2,
  ShieldCheck,
  Lock,
  AlertCircle,
  Lightbulb,
  TrendingUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const STAFF_EMAIL = "admin@icareer.local";

import logoIcon from "../assets/icareeregy_logo.jpg";
import { supabase } from "@/integrations/supabase/client";
import { TRACKS, EXPERIENCE_LEVELS } from "@/lib/tracks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Apply — AI Matching Platform" },
      {
        name: "description",
        content:
          "Submit your application and let our AI match you with the role that fits your skills best. Skip the calls — get matched faster.",
      },
      { property: "og:title", content: "Apply — AI Matching Platform" },
      {
        property: "og:description",
        content:
          "Submit your application and let our AI match you with the role that fits your skills best.",
      },
    ],
  }),
  component: ApplyPage,
});

const MAX_FILE_MB = 5;
const ACCEPTED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function createSafeStoragePath(fullName: string, file: File) {
  const ext = file.name.split(".").pop() ?? "pdf";
  const safeName = fullName.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  const randomId =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${randomId}-${safeName}.${ext}`;
}

const schema = z.object({
  full_name: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(20, "Phone number is too long"),
  track: z.string().min(1, "Choose a track"),
  years_experience: z.string().min(1, "Select your experience level"),
  why_this_track: z.string().trim().min(20, "Tell us at least a sentence or two").max(1000),
  challenges: z.string().trim().min(20, "Tell us at least a sentence or two").max(1000),
  previous_experience: z.string().trim().min(20, "Tell us at least a sentence or two").max(1000),
  linkedin_url: z.string().trim().url("Enter a valid URL").max(255).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

function ApplyPage() {
  const navigate = useNavigate();
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedApplicantId, setSubmittedApplicantId] = useState<string | null>(null);
  const [staffOpen, setStaffOpen] = useState(false);
  const [staffPwd, setStaffPwd] = useState("");
  const [staffErr, setStaffErr] = useState<string | null>(null);
  const [staffLoading, setStaffLoading] = useState(false);

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffLoading(true);
    setStaffErr(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: STAFF_EMAIL,
        password: staffPwd,
      });
      if (error) {
        setStaffErr("Incorrect password.");
        return;
      }
      setStaffOpen(false);
      setStaffPwd("");
      navigate({ to: "/dashboard" });
    } catch {
      setStaffErr("Something went wrong. Try again.");
    } finally {
      setStaffLoading(false);
    }
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      track: "",
      years_experience: "",
      why_this_track: "",
      challenges: "",
      previous_experience: "",
      linkedin_url: "",
    },
  });

  const handleFile = (file: File | null) => {
    setCvError(null);
    if (!file) {
      setCvFile(null);
      return;
    }
    if (!ACCEPTED_MIME.includes(file.type) && !/\.(pdf|docx?|DOCX?|PDF)$/.test(file.name)) {
      setCvError("Only PDF or Word documents are accepted.");
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setCvError(`File is too large. Max ${MAX_FILE_MB}MB.`);
      return;
    }
    setCvFile(file);
  };

  const onSubmit = async (values: FormValues) => {
    if (!cvFile) {
      setCvError("Please upload your CV.");
      return;
    }
    setSubmitting(true);
    try {
      const path = createSafeStoragePath(values.full_name, cvFile);

      const { error: uploadError } = await supabase.storage.from("cvs").upload(path, cvFile, {
        contentType: cvFile.type || "application/octet-stream",
        upsert: false,
      });

      if (uploadError) throw uploadError;

      const { data: applicantData, error: insertError } = await supabase.from("applicants").insert({
        full_name: values.full_name,
        email: values.email,
        phone: values.phone,
        track: values.track,
        years_experience: values.years_experience,
        why_this_track: values.why_this_track,
        challenges: values.challenges,
        previous_experience: values.previous_experience,
        linkedin_url: values.linkedin_url || null,
        cv_path: path,
      }).select("id").single();

      if (insertError) {
        try {
          await supabase.storage.from("cvs").remove([path]);
        } catch (cleanupError) {
          console.error("Failed to clean up uploaded CV after insert error", cleanupError);
        }
        throw insertError;
      }

      if (applicantData?.id) {
        setSubmittedApplicantId(applicantData.id);
        void fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-cv`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ applicant_id: applicantData.id, force: false }),
        }).catch((analysisError) => {
          console.error("Failed to trigger CV analysis", analysisError);
        });
      }

      setSubmitted(true);
      toast.success("Application submitted!");
      form.reset();
      setCvFile(null);
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <SuccessScreen
        onReset={() => {
          setSubmitted(false);
          setSubmittedApplicantId(null);
        }}
        applicantId={submittedApplicantId}
      />
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <Toaster richColors position="top-center" />

      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-radial-fade" />

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between border-b border-border/40 pb-5">
          <div className="flex items-center gap-3.5">
            <img src={logoIcon} alt="iCareer Logo" className="h-14 w-auto max-h-16 object-contain" />
            <span className="font-display text-2xl font-bold tracking-tight text-ink">
              <span className="text-accent">i</span>Career
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-1.5 rounded-full border border-border/70 bg-surface/50 px-3 py-1.5 text-xs text-muted-foreground md:flex backdrop-blur-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" />
              Your data is encrypted and private
            </div>
            <button
              type="button"
              onClick={() => {
                setStaffErr(null);
                setStaffPwd("");
                setStaffOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-surface/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-accent/30 hover:text-ink cursor-pointer hover:bg-surface duration-200"
            >
              <Lock className="h-3.5 w-3.5" />
              Staff
            </button>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr] lg:gap-12 items-start">
          {/* Left: hero */}
          <section className="lg:sticky lg:top-16 lg:pt-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/5 px-2.5 py-1 text-[11px] font-semibold text-accent backdrop-blur-sm">
              <Sparkles className="h-3 w-3 animate-pulse" />
              AI-powered matching
            </div>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink md:text-4xl leading-tight lg:leading-[1.15]">
              Skip the calls.
              <br />
              <span className="text-accent">Get matched</span> to the right job.
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Fill in your details once and upload your CV. Our AI reads your experience, scores
              your profile, and routes you to the role that actually fits — no back-and-forth phone
              interviews.
            </p>

            <div className="mt-6 grid gap-3 grid-cols-1">
              {[
                {
                  icon: FileText,
                  title: "One short form",
                  body: "Takes about 4 minutes — no repeated phone calls.",
                },
                {
                  icon: BrainCircuit,
                  title: "AI reads your CV",
                  body: "Your skills are matched to live openings automatically.",
                },
                {
                  icon: CheckCircle2,
                  title: "Faster placements",
                  body: "Top candidates reach the BD team the same day.",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="group flex gap-3.5 rounded-xl border border-border/40 bg-surface/40 p-3.5 transition-all duration-200 hover:border-accent/20 hover:bg-surface hover:shadow-card"
                >
                  <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-lg bg-accent/[0.06] text-accent transition-all duration-200 group-hover:scale-105 group-hover:bg-accent/[0.1]">
                    <f.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-ink group-hover:text-accent transition-colors duration-200">
                      {f.title}
                    </h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {f.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Right: form card */}
          <section>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="rounded-2xl border border-border/80 bg-surface/95 backdrop-blur-[2px] p-5 shadow-[0_4px_24px_rgb(0,0,0,0.04)] sm:p-7"
            >
              <div className="mb-6 select-none">
                <h2 className="font-display text-xl font-bold tracking-tight text-ink md:text-2xl">
                  Application form
                </h2>
                <p className="mt-1 text-xs text-muted-foreground/95">
                  Ready to match? Fill out your details. Required fields are marked with{" "}
                  <span className="text-accent font-semibold">*</span>
                </p>
              </div>

              {/* Personal */}
              <SectionTitle index="01" label="Personal info" />
              <div className="mb-5 grid gap-3.5 sm:grid-cols-2">
                <Field label="Full name *" error={form.formState.errors.full_name?.message}>
                  <Input
                    placeholder="Ahmed Mohamed"
                    className="h-9 bg-surface/50 border-border/70 hover:border-accent/30 hover:bg-surface focus-visible:ring-[3px] focus-visible:ring-accent/10 focus-visible:border-accent transition-all duration-200 text-xs"
                    {...form.register("full_name")}
                  />
                </Field>
                <Field label="Email *" error={form.formState.errors.email?.message}>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    className="h-9 bg-surface/50 border-border/70 hover:border-accent/30 hover:bg-surface focus-visible:ring-[3px] focus-visible:ring-accent/10 focus-visible:border-accent transition-all duration-200 text-xs"
                    {...form.register("email")}
                  />
                </Field>
                <Field label="Phone *" error={form.formState.errors.phone?.message}>
                  <Input
                    placeholder="+20 1XX XXX XXXX"
                    className="h-9 bg-surface/50 border-border/70 hover:border-accent/30 hover:bg-surface focus-visible:ring-[3px] focus-visible:ring-accent/10 focus-visible:border-accent transition-all duration-200 text-xs"
                    {...form.register("phone")}
                  />
                </Field>
                <Field
                  label="LinkedIn (optional)"
                  error={form.formState.errors.linkedin_url?.message}
                >
                  <Input
                    placeholder="https://linkedin.com/in/..."
                    className="h-9 bg-surface/50 border-border/70 hover:border-accent/30 hover:bg-surface focus-visible:ring-[3px] focus-visible:ring-accent/10 focus-visible:border-accent transition-all duration-200 text-xs"
                    {...form.register("linkedin_url")}
                  />
                </Field>
              </div>

              {/* Track */}
              <SectionTitle index="02" label="Preferred track" />
              <div className="mb-5 grid gap-3.5 sm:grid-cols-2">
                <Field label="Track *" error={form.formState.errors.track?.message}>
                  <Select
                    value={form.watch("track")}
                    onValueChange={(v) => form.setValue("track", v, { shouldValidate: true })}
                  >
                    <SelectTrigger className="h-9 bg-surface/50 border-border/70 hover:border-accent/30 hover:bg-surface focus:ring-[3px] focus:ring-accent/10 focus:border-accent transition-all duration-200 text-xs">
                      <SelectValue placeholder="Choose a track" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRACKS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label="Years of experience *"
                  error={form.formState.errors.years_experience?.message}
                >
                  <Select
                    value={form.watch("years_experience")}
                    onValueChange={(v) =>
                      form.setValue("years_experience", v, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger className="h-9 bg-surface/50 border-border/70 hover:border-accent/30 hover:bg-surface focus:ring-[3px] focus:ring-accent/10 focus:border-accent transition-all duration-200 text-xs">
                      <SelectValue placeholder="Select experience" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPERIENCE_LEVELS.map((e) => (
                        <SelectItem key={e} value={e}>
                          {e}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              {/* Behavioural */}
              <SectionTitle index="03" label="Tell us about you" />
              <div className="mb-5 space-y-3.5">
                <Field
                  label="Why did you choose this track? *"
                  error={form.formState.errors.why_this_track?.message}
                >
                  <Textarea
                    rows={2}
                    placeholder="What draws you to this field?"
                    className="bg-surface/50 border-border/70 hover:border-accent/30 hover:bg-surface focus-visible:ring-[3px] focus-visible:ring-accent/10 focus-visible:border-accent transition-all duration-200 resize-none min-h-[58px] text-xs py-2"
                    {...form.register("why_this_track")}
                  />
                </Field>
                <Field
                  label="Biggest challenges you've faced *"
                  error={form.formState.errors.challenges?.message}
                >
                  <Textarea
                    rows={2}
                    placeholder="A real example helps us understand how you work."
                    className="bg-surface/50 border-border/70 hover:border-accent/30 hover:bg-surface focus-visible:ring-[3px] focus-visible:ring-accent/10 focus-visible:border-accent transition-all duration-200 resize-none min-h-[58px] text-xs py-2"
                    {...form.register("challenges")}
                  />
                </Field>
                <Field
                  label="Previous experience or projects *"
                  error={form.formState.errors.previous_experience?.message}
                >
                  <Textarea
                    rows={2}
                    placeholder="Companies, internships, freelance work, or notable projects."
                    className="bg-surface/50 border-border/70 hover:border-accent/30 hover:bg-surface focus-visible:ring-[3px] focus-visible:ring-accent/10 focus-visible:border-accent transition-all duration-200 resize-none min-h-[58px] text-xs py-2"
                    {...form.register("previous_experience")}
                  />
                </Field>
              </div>

              {/* CV upload */}
              <SectionTitle index="04" label="Upload your CV" />
              <div className="mb-5">
                <CvDropzone file={cvFile} onFile={handleFile} error={cvError} />
              </div>

              <div className="mt-6 space-y-2.5 border-t border-border/45 pt-4 text-center">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-9.5 bg-accent text-accent-foreground hover:bg-accent/95 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98] transition-all font-medium text-xs"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    <>
                      Submit Application
                      <ArrowRight className="ml-2 h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
                <p className="text-[11px] leading-normal text-muted-foreground/80 mx-auto max-w-[280px]">
                  By submitting, you agree to let our team securely review your application.
                </p>
              </div>
            </form>
          </section>
        </div>
      </div>

      <Dialog open={staffOpen} onOpenChange={setStaffOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Staff access</DialogTitle>
            <DialogDescription>Enter the staff access password to continue.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleStaffSubmit} className="space-y-3">
            <Input
              type="password"
              autoFocus
              placeholder="Access password"
              value={staffPwd}
              onChange={(e) => {
                setStaffPwd(e.target.value);
                setStaffErr(null);
              }}
              disabled={staffLoading}
            />
            {staffErr && <p className="text-xs text-destructive">{staffErr}</p>}
            <DialogFooter>
              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={staffLoading || !staffPwd}
              >
                {staffLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function SectionTitle({
  index,
  label,
  className = "",
}: {
  index: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={`mb-5 flex items-center gap-3 ${className}`}>
      <span className="flex h-5 items-center justify-center rounded-full bg-accent/[0.08] px-2 font-display text-[10px] font-bold text-accent">
        {index}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/85">
        {label}
      </span>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-ink">{label}</Label>
      {children}
      {error && (
        <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1">
          <AlertCircle className="h-3 w-3 inline" /> {error}
        </p>
      )}
    </div>
  );
}

function CvDropzone({
  file,
  onFile,
  error,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  error: string | null;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-surface-elevated/40 px-6 py-8 text-center transition-all duration-200 ${dragging
          ? "border-accent bg-accent/5 scale-[0.99]"
          : file
            ? "border-accent/40 bg-accent/[0.02]"
            : "border-border/80 hover:border-accent/30 hover:bg-accent/[0.015]"
          }`}
      >
        <input
          type="file"
          className="sr-only"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/[0.08] text-accent">
              <FileText className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-semibold text-ink">{file.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(2)} MB · Click to replace
            </p>
          </>
        ) : (
          <>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/65 text-muted-foreground/80">
              <Upload className="h-4.5 w-4.5" />
            </div>
            <p className="mt-3 text-sm font-semibold text-ink">
              Drop your CV here or click to upload
            </p>
            <p className="mt-1 text-xs text-muted-foreground/80">
              PDF or Word · Up to {MAX_FILE_MB}MB
            </p>
          </>
        )}
      </label>
      {error && (
        <p className="mt-2 text-[11px] font-medium text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3 inline" /> {error}
        </p>
      )}
    </div>
  );
}

function SuccessScreen({ onReset, applicantId }: { onReset: () => void; applicantId: string | null }) {
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-radial-fade" />

      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-surface p-10 text-center shadow-card">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold text-ink">Application received</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Thanks for applying. Our AI is analyzing your CV and matching it to open roles. The
          Operations team will reach out if you're a strong fit — usually within a few days.
        </p>
        <Button variant="outline" className="mt-6" onClick={onReset}>
          Submit another application
        </Button>

        {applicantId && !showFeedback && (
          <>
            <div className="my-6 h-px bg-border" />
            <p className="text-sm text-muted-foreground">Curious what our AI thought of your CV?</p>
            <Button
              className="mt-3 bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => setShowFeedback(true)}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              See your CV feedback
            </Button>
          </>
        )}

        {showFeedback && applicantId && <CvFeedbackView applicantId={applicantId} />}
      </div>
    </main>
  );
}

type AnalysisData = {
  status: string;
  fit_score: number | null;
  strengths: string[];
  weaknesses: string[];
  missing_skills: string[];
  improvement_tips: string[];
  track_fit: boolean | null;
  track_fit_reason: string | null;
  summary: string | null;
  selected_track_score: number | null;
  recommended_tracks: { track: string; score: number; reason: string }[];
  best_track: string | null;
  ai_agrees_with_selection: boolean | null;
  disagreement_reason: string | null;
  error_message: string | null;
};

function CvFeedbackView({ applicantId }: { applicantId: string }) {
  const [status, setStatus] = useState<"loading" | "done" | "failed" | "timeout">("loading");
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [applicantTrack, setApplicantTrack] = useState<string | null>(null);
  const statusRef = useRef<"loading" | "done" | "failed" | "timeout">("loading");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const pollAnalysis = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-cv`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ applicant_id: applicantId, force: false }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch analysis");
      }

      const data = await response.json();
      if (data.ok && data.analysis) {
        const raw = data.analysis;
        const normalizedRecs = Array.isArray(raw.recommended_tracks)
          ? raw.recommended_tracks.filter(
            (r: unknown): r is { track: string; score: number; reason: string } =>
              typeof r === "object" &&
              r !== null &&
              "track" in r &&
              "score" in r &&
              "reason" in r,
          )
          : [];
        const normalized: AnalysisData = {
          status: raw.status,
          fit_score: typeof raw.fit_score === "number" ? raw.fit_score : (typeof raw.ats_score === "number" ? raw.ats_score : null),
          strengths: Array.isArray(raw.strengths) ? raw.strengths : [],
          weaknesses: Array.isArray(raw.weaknesses) ? raw.weaknesses : [],
          missing_skills: Array.isArray(raw.missing_skills) ? raw.missing_skills : [],
          improvement_tips: Array.isArray(raw.improvement_tips) ? raw.improvement_tips : [],
          track_fit: typeof raw.track_fit === "boolean" ? raw.track_fit : null,
          track_fit_reason: typeof raw.track_fit_reason === "string" ? raw.track_fit_reason : null,
          summary: typeof raw.summary === "string" ? raw.summary : null,
          selected_track_score:
            typeof raw.selected_track_score === "number" ? raw.selected_track_score : null,
          recommended_tracks: normalizedRecs,
          best_track: typeof raw.best_track === "string" ? raw.best_track : null,
          ai_agrees_with_selection:
            typeof raw.ai_agrees_with_selection === "boolean" ? raw.ai_agrees_with_selection : null,
          disagreement_reason:
            typeof raw.disagreement_reason === "string" ? raw.disagreement_reason : null,
          error_message: typeof raw.error_message === "string" ? raw.error_message : null,
        };
        setAnalysis(normalized);
        if (data.analysis.status === "done") {
          setStatus("done");
          return true;
        } else if (data.analysis.status === "failed") {
          setStatus("failed");
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error("Polling error:", error);
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;
    setStatus("loading");
    statusRef.current = "loading";
    setAnalysis(null);
    setApplicantTrack(null);

    (async () => {
      try {
        const { data } = await supabase
          .from("applicants")
          .select("track")
          .eq("id", applicantId)
          .maybeSingle();
        if (mounted && data?.track) setApplicantTrack(data.track);
      } catch {
        // ignore
      }
    })();

    const startPolling = async () => {
      const initialDone = await pollAnalysis();
      if (initialDone || !mounted) return;

      intervalRef.current = setInterval(async () => {
        if (!mounted) return;
        const done = await pollAnalysis();
        if (done && mounted) {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      }, 3000);
    };

    startPolling();

    timeoutRef.current = setTimeout(() => {
      if (mounted && statusRef.current === "loading") {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setStatus("timeout");
        statusRef.current = "timeout";
      }
    }, 60000);

    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [applicantId]);

  const handleRetry = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setStatus("loading");
    statusRef.current = "loading";
    setAnalysis(null);

    const startPolling = async () => {
      const initialDone = await pollAnalysis();
      if (initialDone) return;

      intervalRef.current = setInterval(async () => {
        const done = await pollAnalysis();
        if (done && intervalRef.current) clearInterval(intervalRef.current);
      }, 3000);
    };

    startPolling();

    timeoutRef.current = setTimeout(() => {
      if (statusRef.current === "loading") {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setStatus("timeout");
        statusRef.current = "timeout";
      }
    }, 60000);
  };

  if (status === "loading") {
    return (
      <div className="mt-8 rounded-xl border border-border bg-surface-elevated p-6 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-accent" />
        <p className="mt-3 text-sm text-muted-foreground">
          Our AI is reading your CV... this usually takes 10-30 seconds.
        </p>
      </div>
    );
  }

  if (status === "timeout") {
    return (
      <div className="mt-8 rounded-xl border border-border bg-surface-elevated p-6 text-center">
        <AlertCircle className="mx-auto h-6 w-6 text-amber-500" />
        <p className="mt-3 text-sm text-muted-foreground">
          The analysis is taking longer than expected. Try again in a moment.
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={handleRetry}>
          Retry
        </Button>
      </div>
    );
  }

  if (status === "failed" || !analysis) {
    return (
      <div className="mt-8 rounded-xl border border-border bg-surface-elevated p-6 text-center">
        <AlertCircle className="mx-auto h-6 w-6 text-amber-500" />
        <p className="mt-3 text-sm text-muted-foreground">
          We couldn't analyze your CV automatically. Our team will still review your application
          manually.
        </p>
      </div>
    );
  }

  const isGoodFit = analysis.track_fit === true;
  const applicantFitScore = analysis.selected_track_score ?? analysis.fit_score ?? 0;

  return (
    <div className="mt-8 rounded-xl border border-border bg-surface-elevated p-6 text-left">
      {isGoodFit ? (
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-ink">Great match! 🎯</h2>
          <div className="flex items-center rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
            {applicantFitScore}/100
          </div>
        </div>
      ) : (
        <h2 className="mb-6 font-display text-xl font-semibold text-ink">Here's some honest feedback</h2>
      )}

      {analysis.summary && (
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">{analysis.summary}</p>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            Strengths
          </h3>
          <ul className="space-y-2">
            {analysis.strengths.map((strength, i) => (
              <li key={i} className="flex gap-2 text-sm text-ink">
                <span className="text-emerald-500">•</span>
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-600">
            <AlertCircle className="h-4 w-4" />
            Areas to improve
          </h3>
          <ul className="space-y-2">
            {analysis.weaknesses.map((weakness, i) => (
              <li key={i} className="flex gap-2 text-sm text-ink">
                <span className="text-amber-500">•</span>
                <span>{weakness}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {analysis.missing_skills && analysis.missing_skills.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <TrendingUp className="h-4 w-4 text-accent" />
            Skills to build
          </h3>
          <div className="flex flex-wrap gap-2">
            {analysis.missing_skills.map((skill, i) => (
              <span
                key={i}
                className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-ink"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {analysis.improvement_tips && analysis.improvement_tips.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <Lightbulb className="h-4 w-4 text-accent" />
            Next steps
          </h3>
          <ol className="ml-4 list-decimal space-y-2 text-sm text-ink">
            {analysis.improvement_tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ol>
        </div>
      )}

      {analysis.ai_agrees_with_selection === true ? (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm font-medium text-emerald-700">
          ✓ Your track selection matches your CV strongly.
        </div>
      ) : null}

      {analysis.ai_agrees_with_selection === false &&
        analysis.recommended_tracks &&
        analysis.recommended_tracks.length > 0 ? (
        <div className="mt-6 rounded-xl border border-accent/30 bg-accent/5 p-5">
          <div className="mb-2 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-accent" />
            <h3 className="font-display text-lg font-semibold text-ink">
              💡 Consider these alternatives
            </h3>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Based on your CV, we think you might also excel in:
          </p>
          <ul className="space-y-2 text-sm text-ink">
            {analysis.recommended_tracks.map((rec) => (
              <li key={rec.track} className="flex gap-2">
                <span className="text-accent">•</span>
                <span>
                  <span className="font-semibold">{rec.track}</span> — {rec.score}% match —{" "}
                  {rec.reason}
                </span>
              </li>
            ))}
          </ul>
          {applicantTrack ? (
            <p className="mt-4 text-xs text-muted-foreground">
              You applied for {applicantTrack}. These suggestions are based on your CV content,
              not a rejection of your choice.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
