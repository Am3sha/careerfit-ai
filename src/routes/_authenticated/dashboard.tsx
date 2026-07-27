import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUpDown,
  Briefcase,
  CheckCircle2,
  Download,
  Eye,
  ExternalLink,
  Linkedin,
  Loader2,
  LogOut,
  Mail,
  Phone,
  Search,
  Trash2,
  TrendingUp,
  Trophy,
  Users,
  AlertTriangle,
  Check,
  Medal,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Operations Dashboard — iCareer" }, { name: "robots", content: "noindex" }],
  }),
  component: DashboardPage,
});

type Applicant = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  track: string;
  years_experience: string;
  why_this_track: string;
  previous_experience: string | null;
  challenges: string | null;
  linkedin_url: string | null;
  created_at: string;
  cv_path: string;
};

type CvAnalysis = {
  id: string;
  applicant_id: string;
  status: "pending" | "processing" | "done" | "failed";
  ats_score: number | null;
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
  created_at: string;
  updated_at: string;
  last_attempted_at: string | null;
};

type Placement = {
  id: string;
  applicant_id: string;
  project_id: string;
  status: string;
  assigned_at: string;
};

type Project = { id: string; name: string; status: string };

const EXPERIENCE_SCORE: Record<string, number> = {
  "Fresh graduate / No experience": 10,
  "Less than 1 year": 25,
  "1 – 2 years": 50,
  "3 – 5 years": 75,
  "5+ years": 90,
};

function computeScore(a: Applicant): {
  total: number;
  experience: number;
  profile: number;
  motivation: number;
} {
  const experience = EXPERIENCE_SCORE[a.years_experience] ?? 20;
  let profile = 0;
  if (a.linkedin_url) profile += 8;
  if (a.previous_experience && a.previous_experience.trim().length > 20) profile += 8;
  if (a.challenges && a.challenges.trim().length > 20) profile += 4;
  const why = (a.why_this_track ?? "").trim();
  const motivation = Math.min(20, Math.round(why.length / 20));
  const total = Math.min(100, Math.round(experience * 0.6 + profile + motivation));
  return { total, experience, profile, motivation };
}

type RankedApplicant = Applicant & {
  scoreParts: ReturnType<typeof computeScore>;
  placed: boolean;
  analysis?: CvAnalysis | null;
};

const CHART_COLORS = [
  "oklch(0.68 0.18 155)",
  "oklch(0.78 0.14 165)",
  "oklch(0.55 0.18 145)",
  "oklch(0.72 0.12 175)",
  "oklch(0.6 0.2 130)",
  "oklch(0.82 0.1 155)",
];

const PAGE_SIZE = 10;

async function downloadCv(applicant: { full_name: string; cv_path: string }) {
  const { data, error } = await supabase.storage.from("cvs").createSignedUrl(applicant.cv_path, 60);
  if (error || !data?.signedUrl) {
    toast.error(error?.message ?? "Could not generate download link");
    return;
  }
  const a = document.createElement("a");
  a.href = data.signedUrl;
  const ext = applicant.cv_path.split(".").pop() ?? "pdf";
  const safeName = applicant.full_name.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  a.download = `${safeName}-cv.${ext}`;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function DashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState("all");
  const [placedFilter, setPlacedFilter] = useState<"all" | "placed" | "unplaced">("all");
  const [sortBy, setSortBy] = useState<"score" | "recent" | "name">("score");
  const [detailApplicant, setDetailApplicant] = useState<RankedApplicant | null>(null);
  const [deleteConfirmApplicant, setDeleteConfirmApplicant] = useState<RankedApplicant | null>(null);
  const [deletingApplicantId, setDeletingApplicantId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);

  const applicantsQ = useQuery({
    queryKey: ["applicants-all"],
    queryFn: async (): Promise<Applicant[]> => {
      const { data, error } = await supabase
        .from("applicants")
        .select(
          "id, full_name, email, phone, track, years_experience, why_this_track, previous_experience, challenges, linkedin_url, created_at, cv_path",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const placementsQ = useQuery({
    queryKey: ["placements-all"],
    queryFn: async (): Promise<Placement[]> => {
      const { data, error } = await supabase
        .from("placements")
        .select("id, applicant_id, project_id, status, assigned_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const projectsQ = useQuery({
    queryKey: ["projects-all"],
    queryFn: async (): Promise<Project[]> => {
      const { data, error } = await supabase.from("projects").select("id, name, status");
      if (error) throw error;
      return data ?? [];
    },
  });

  const applicants = useMemo(() => applicantsQ.data ?? [], [applicantsQ.data]);
  const placements = useMemo(() => placementsQ.data ?? [], [placementsQ.data]);
  const projects = projectsQ.data ?? [];

  const analysesQ = useQuery({
    queryKey: ["cv-analyses-all"],
    queryFn: async (): Promise<CvAnalysis[]> => {
      const { data, error } = await supabase
        .from("cv_analyses")
        .select(
          "id, applicant_id, status, ats_score, strengths, weaknesses, missing_skills, improvement_tips, track_fit, track_fit_reason, summary, selected_track_score, recommended_tracks, best_track, ai_agrees_with_selection, disagreement_reason, error_message, created_at, updated_at, last_attempted_at",
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const rawList = (data as unknown[]) ?? [];
      return rawList.map((raw) => {
        const item = raw as Record<string, unknown>;
        return {
          ...(item as unknown as Partial<CvAnalysis>),
          status: (item.status as CvAnalysis["status"]) ?? "pending",
          recommended_tracks: Array.isArray(item.recommended_tracks)
            ? (item.recommended_tracks as unknown[]).filter(
                (r): r is { track: string; score: number; reason: string } =>
                  typeof r === "object" &&
                  r !== null &&
                  "track" in r &&
                  "score" in r &&
                  "reason" in r,
              )
            : [],
        } as CvAnalysis;
      });
    },
  });

  const analysesByApplicant = useMemo(() => {
    const map = new Map<string, CvAnalysis>();
    (analysesQ.data ?? []).forEach((analysis) => map.set(analysis.applicant_id, analysis));
    return map;
  }, [analysesQ.data]);

  const placedIds = useMemo(() => new Set(placements.map((p) => p.applicant_id)), [placements]);

  const ranked = useMemo<RankedApplicant[]>(() => {
    return applicants.map((a) => ({
      ...a,
      scoreParts: computeScore(a),
      placed: placedIds.has(a.id),
      analysis: analysesByApplicant.get(a.id) ?? null,
    }));
  }, [applicants, placedIds, analysesByApplicant]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = ranked.filter((a) => {
      if (trackFilter !== "all" && a.track !== trackFilter) return false;
      if (placedFilter === "placed" && !a.placed) return false;
      if (placedFilter === "unplaced" && a.placed) return false;
      if (!q) return true;
      return (
        a.full_name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.track.toLowerCase().includes(q)
      );
    });
    if (sortBy === "score")
      list = [...list].sort((a, b) => b.scoreParts.total - a.scoreParts.total);
    else if (sortBy === "recent")
      list = [...list].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    else list = [...list].sort((a, b) => a.full_name.localeCompare(b.full_name));
    return list;
  }, [ranked, search, trackFilter, placedFilter, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [search, trackFilter, placedFilter, sortBy]);

  // Stats
  const totalApplicants = applicants.length;
  const totalPlacements = placements.length;
  const activeProjects = projects.filter((p) => p.status === "active").length;
  const placementRate = totalApplicants ? Math.round((placedIds.size / totalApplicants) * 100) : 0;
  const avgScore = ranked.length
    ? Math.round(ranked.reduce((s, r) => s + r.scoreParts.total, 0) / ranked.length)
    : 0;

  const trackCounts = useMemo(() => {
    const m = new Map<string, number>();
    applicants.forEach((a) => m.set(a.track, (m.get(a.track) ?? 0) + 1));
    return Array.from(m.entries())
      .map(([track, count]) => ({
        track,
        short: track.length > 22 ? track.slice(0, 20) + "…" : track,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [applicants]);

  const statusCounts = useMemo(() => {
    const m = new Map<string, number>();
    placements.forEach((p) => m.set(p.status, (m.get(p.status) ?? 0) + 1));
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  }, [placements]);

  const uniqueTracks = useMemo(
    () => Array.from(new Set(applicants.map((a) => a.track))).sort(),
    [applicants],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedApplicants = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const startIndex = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(page * PAGE_SIZE, filtered.length);

  const handleExport = () => {
    setExporting(true);
    try {
      if (!ranked.length) {
        toast.error("Nothing to export");
        return;
      }
      const headers = [
        "#",
        "Candidate",
        "Email",
        "Phone",
        "Track",
        "Experience",
        "Score",
        "AI Fit Score",
        "AI Suggested Track",
      ];
      const rows = ranked.map((a, idx) => [
        idx + 1,
        a.full_name ?? "",
        a.email ?? "",
        a.phone ?? "",
        a.track ?? "",
        a.years_experience ?? "",
        a.scoreParts.total,
        a.analysis?.ats_score != null ? a.analysis.ats_score : "—",
        a.analysis?.best_track ?? "—",
      ]);
      const csv = [headers, ...rows]
        .map((cols) =>
          cols
            .map((c) => {
              const s = String(c ?? "");
              return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
            })
            .join(","),
        )
        .join("\n");
      const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `applicants-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  const handleDeleteApplicant = async (applicant: RankedApplicant) => {
    setDeletingApplicantId(applicant.id);
    try {
      if (applicant.cv_path) {
        const { error } = await supabase.storage.from("cvs").remove([applicant.cv_path]);
        if (error) {
          console.warn("Could not remove CV file", error);
        }
      }

      const { error } = await supabase.from("applicants").delete().eq("id", applicant.id);
      if (error) {
        toast.error(error.message);
        return;
      }

      await qc.invalidateQueries({ queryKey: ["applicants-all"] });
      await qc.invalidateQueries({ queryKey: ["cv-analyses-all"] });
      await qc.invalidateQueries({ queryKey: ["placements-all"] });
      toast.success("Applicant deleted");
      setDeleteConfirmApplicant(null);
      setDetailApplicant(null);
    } catch (error) {
      console.error(error);
      toast.error("Could not delete applicant");
    } finally {
      setDeletingApplicantId(null);
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel("cv_analyses_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cv_analyses" },
        () => qc.invalidateQueries({ queryKey: ["cv-analyses-all"] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const clearFilters = () => {
    setSearch("");
    setTrackFilter("all");
    setPlacedFilter("all");
  };

  return (
    <main className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-radial-fade" />

      <div className="relative mx-auto max-w-7xl px-6 py-10">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <span className="font-display text-xl font-bold tracking-tight text-ink">
              <span className="text-accent">i</span>Career
            </span>
            <span className="hidden text-sm text-muted-foreground sm:inline">/ Ops Dashboard</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/placements">
                <ExternalLink className="mr-2 h-4 w-4" /> Placements
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </header>

        <div className="mb-10">
          <h1 className="font-display text-3xl font-semibold text-ink">Operations Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ranked candidates, placement funnel, and live pipeline metrics for the ops team.
          </p>
        </div>

        {/* Stats grid */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="Total applicants"
            value={totalApplicants}
            icon={<Users className="h-5 w-5" />}
          />
          <StatCard
            label="Placements"
            value={totalPlacements}
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <StatCard
            label="Active projects"
            value={activeProjects}
            icon={<Briefcase className="h-5 w-5" />}
          />
          <StatCard
            label="Placement rate"
            value={`${placementRate}%`}
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <StatCard label="Avg score" value={avgScore} icon={<Trophy className="h-5 w-5" />} />
        </div>

        {/* Charts */}
        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-4 font-display text-sm font-semibold text-ink">
              Applicants by track (top 8)
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trackCounts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="short"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fill: "oklch(0.68 0.18 155 / 0.08)" }}
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.track ?? ""}
                  />
                  <Bar dataKey="count" fill="oklch(0.62 0.2 155)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-4 font-display text-sm font-semibold text-ink">Placement status</h2>
            <div className="h-64">
              {statusCounts.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No placements yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusCounts}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {statusCounts.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Filters
          </div>
          <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-[1fr_220px_180px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name, email, track…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={trackFilter} onValueChange={setTrackFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Track" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tracks</SelectItem>
                {uniqueTracks.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={placedFilter}
              onValueChange={(v) => setPlacedFilter(v as typeof placedFilter)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All candidates</SelectItem>
                <SelectItem value="placed">Placed only</SelectItem>
                <SelectItem value="unplaced">Unplaced only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger>
                <ArrowUpDown className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Sort: Highest score</SelectItem>
                <SelectItem value="recent">Sort: Most recent</SelectItem>
                <SelectItem value="name">Sort: Name (A–Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Ranking table */}
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border">
                <TableHead className="w-14">#</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Track</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead className="w-64">Score</TableHead>
                <TableHead className="w-24">AI Fit Score</TableHead>
                <TableHead>AI Suggests</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applicantsQ.isLoading ? (
                Array.from({ length: 5 }).map((_, rowIdx) => (
                  <TableRow key={`skeleton-${rowIdx}`} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="py-3 font-mono text-sm text-muted-foreground">
                      <div className="h-4 w-8 animate-pulse rounded bg-muted" />
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                      <div className="mt-1 h-3 w-40 animate-pulse rounded bg-muted" />
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-32 animate-pulse rounded bg-muted" />
                        <div className="h-4 w-8 animate-pulse rounded bg-muted" />
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="h-5 w-16 animate-pulse rounded bg-muted" />
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="h-5 w-16 animate-pulse rounded bg-muted" />
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-8 w-8 animate-pulse rounded bg-muted" />
                        <div className="h-8 w-8 animate-pulse rounded bg-muted" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : pagedApplicants.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                        <Search className="h-7 w-7 text-muted-foreground/60" />
                      </div>
                      <p>No candidates match these filters.</p>
                      <Button variant="outline" size="sm" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pagedApplicants.map((a, i) => (
                  <TableRow key={a.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="py-3 font-mono text-sm text-muted-foreground">
                      {startIndex + i}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="font-medium text-ink">{a.full_name}</div>
                      <div className="text-xs text-muted-foreground">{a.email}</div>
                    </TableCell>
                    <TableCell className="py-3 text-sm">{a.track}</TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground">
                      {a.years_experience}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <Progress value={a.scoreParts.total} className="h-2 w-32" />
                        <span className="font-mono text-sm font-semibold text-ink tabular-nums">
                          {a.scoreParts.total}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      {a.analysis?.status === "done" && a.analysis.ats_score != null ? (
                        <Badge className="bg-accent/15 text-accent hover:bg-accent/15" title="How well the applicant fits the AI-recommended track (best fit)">
                          AI Fit {a.analysis.ats_score}/100
                        </Badge>
                      ) : a.analysis?.status === "processing" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pending
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      {a.analysis?.status === "done" && a.analysis.best_track ? (
                        a.analysis.ai_agrees_with_selection === false ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                            <AlertTriangle className="h-3 w-3" />
                            <span className="max-w-[140px] truncate">{a.analysis.best_track}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                            <Check className="h-3 w-3" />
                            <span className="max-w-[140px] truncate">{a.analysis.best_track}</span>
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      {a.placed ? (
                        <Badge className="bg-accent/15 text-accent hover:bg-accent/15">
                          Placed
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Available</Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="View details"
                          title="View details"
                          onClick={() => setDetailApplicant(a)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          aria-label="Delete applicant"
                          title="Delete applicant"
                          className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteConfirmApplicant(a)}
                          disabled={deletingApplicantId === a.id}
                        >
                          {deletingApplicantId === a.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination bar */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex}-{endIndex} of {filtered.length} applicants
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              ← Previous
            </Button>
            <Button variant="default" size="sm" className="rounded-full px-3 py-1" disabled>
              {page}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next →
            </Button>
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Score blends experience (60%), profile completeness (LinkedIn, prior work, challenges) and
          motivation depth.
        </p>

        <ApplicantDetailDialog
          applicant={detailApplicant}
          open={!!detailApplicant}
          onOpenChange={(open) => {
            if (!open) setDetailApplicant(null);
          }}
          onDeleteApplicant={handleDeleteApplicant}
          deletingApplicantId={deletingApplicantId}
        />

        <Dialog open={!!deleteConfirmApplicant} onOpenChange={() => setDeleteConfirmApplicant(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete applicant?</DialogTitle>
              <DialogDescription>
                This will permanently delete {deleteConfirmApplicant?.full_name}'s application and
                their uploaded CV. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteConfirmApplicant(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirmApplicant && handleDeleteApplicant(deleteConfirmApplicant)}
                disabled={deletingApplicantId === deleteConfirmApplicant?.id}
              >
                {deletingApplicantId === deleteConfirmApplicant?.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}

function ApplicantDetailDialog({
  applicant,
  open,
  onOpenChange,
  onDeleteApplicant,
  deletingApplicantId,
}: {
  applicant: RankedApplicant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteApplicant: (applicant: RankedApplicant) => void;
  deletingApplicantId: string | null;
}) {
  const [downloading, setDownloading] = useState(false);

  const analysis = applicant?.analysis;

  const handleAnalyze = async () => {
    if (!applicant) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-cv`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ applicant_id: applicant.id, force: true }),
      });

      if (!response.ok) {
        let errorMessageFromServer = "Analysis failed";
        try {
          const body = await response.json();
          if (typeof body?.error === "string" && body.error.trim().length > 0) {
            errorMessageFromServer = body.error;
          }
        } catch {
          // Use the fallback message when the error body is not valid JSON.
        }
        toast.error(errorMessageFromServer);
        return;
      }

      toast.success("Analysis started — result will appear shortly");
    } catch (error) {
      console.error("Failed to trigger analysis:", error);
      toast.error("Could not start analysis");
    }
  };

  const textSections = [
    {
      label: "Why this track?",
      value: applicant?.why_this_track,
    },
    {
      label: "Challenges faced",
      value: applicant?.challenges,
    },
    {
      label: "Previous experience",
      value: applicant?.previous_experience,
    },
  ].filter((section) => section.value && section.value.trim().length > 0);

  const handleDownload = async () => {
    if (!applicant) return;
    setDownloading(true);
    try {
      await downloadCv(applicant);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {applicant ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span>{applicant.full_name}</span>
                {analysis?.status === "done" && analysis.ats_score != null ? (
                  <Badge className="bg-accent/15 text-accent hover:bg-accent/15" title="How well the applicant fits the AI-recommended track (best fit)">
                    AI Fit {analysis.ats_score}/100
                  </Badge>
                ) : null}
              </DialogTitle>
              <DialogDescription>
                {applicant.track} · {applicant.years_experience} · Rule score {applicant.scoreParts.total}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoItem
                  icon={<Mail className="h-4 w-4" />}
                  label="Email"
                  value={
                    <a
                      href={`mailto:${applicant.email}`}
                      className="break-all text-accent underline-offset-4 hover:underline"
                    >
                      {applicant.email}
                    </a>
                  }
                />
                <InfoItem
                  icon={<Phone className="h-4 w-4" />}
                  label="Phone"
                  value={<span>{applicant.phone}</span>}
                />
                {applicant.linkedin_url ? (
                  <InfoItem
                    icon={<Linkedin className="h-4 w-4" />}
                    label="LinkedIn"
                    value={
                      <a
                        href={applicant.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 break-all text-accent underline-offset-4 hover:underline"
                      >
                        {applicant.linkedin_url}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    }
                  />
                ) : null}
                <InfoItem
                  icon={<ExternalLink className="h-4 w-4" />}
                  label="Applied on"
                  value={<span>{new Date(applicant.created_at).toLocaleString()}</span>}
                />
              </div>

              <div className="max-h-[45vh] space-y-4 overflow-y-auto pr-1">
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-ink">AI Analysis</h3>
                    <Button size="sm" variant="outline" onClick={handleAnalyze}>
                      Re-analyze
                    </Button>
                  </div>
                  {analysis?.status === "done" ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-accent/15 text-accent hover:bg-accent/15">
                          {analysis.track_fit ? "✓ Track fit" : "✗ Track fit"}
                        </Badge>
                        {analysis.track_fit_reason ? (
                          <Badge variant="secondary">{analysis.track_fit_reason}</Badge>
                        ) : null}
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">{analysis.summary}</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <h4 className="mb-2 text-sm font-semibold text-ink">Strengths</h4>
                          <ul className="space-y-1 text-sm text-muted-foreground">
                            {analysis.strengths.map((item) => (
                              <li key={item} className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-700">
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="mb-2 text-sm font-semibold text-ink">Weaknesses</h4>
                          <ul className="space-y-1 text-sm text-muted-foreground">
                            {analysis.weaknesses.map((item) => (
                              <li key={item} className="rounded-md bg-amber-500/10 px-2 py-1 text-amber-700">
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div>
                        <h4 className="mb-2 text-sm font-semibold text-ink">Suggested skills for growth</h4>
                        <div className="flex flex-wrap gap-2">
                          {analysis.missing_skills.map((item) => (
                            <Badge key={item} variant="secondary">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="mb-2 text-sm font-semibold text-ink">Improvement tips</h4>
                        <ol className="space-y-1 text-sm text-muted-foreground">
                          {analysis.improvement_tips.map((item, index) => (
                            <li key={item} className="ml-4 list-decimal">
                              {item}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  ) : analysis?.status === "processing" || analysis?.status === "pending" ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analysis is being prepared…
                    </div>
                  ) : analysis?.status === "failed" ? (
                    <div className="space-y-2">
                      <p className="text-sm text-destructive">
                        {analysis.error_message ?? "The analysis failed."}
                      </p>
                      <Button size="sm" variant="outline" onClick={handleAnalyze}>
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No AI analysis yet.</p>
                  )}
                </div>

                {analysis?.status === "done" &&
                analysis.recommended_tracks &&
                analysis.recommended_tracks.length > 0 ? (
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <h3 className="mb-3 text-sm font-semibold text-ink">AI Recommendations</h3>
                    {analysis.ai_agrees_with_selection === false && analysis.best_track ? (
                      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium">
                            AI suggests {analysis.best_track} instead of {applicant?.track}
                          </p>
                          {analysis.disagreement_reason ? (
                            <p className="mt-1 text-amber-700">{analysis.disagreement_reason}</p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    <div className="grid gap-3">
                      {analysis.recommended_tracks.map((rec, idx) => (
                        <div
                          key={rec.track}
                          className={
                            "rounded-lg border p-3 " +
                            (idx === 0
                              ? "border-emerald-300 bg-emerald-50/40"
                              : "border-border bg-surface")
                          }
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <span
                              className={
                                "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold " +
                                (idx === 0
                                  ? "bg-emerald-500 text-white"
                                  : "bg-muted text-muted-foreground")
                              }
                            >
                              {idx + 1}
                            </span>
                            {idx === 0 ? (
                              <Medal className="h-4 w-4 text-emerald-600" />
                            ) : null}
                            <span className="font-semibold text-ink">{rec.track}</span>
                          </div>
                          <div className="mb-1 flex items-center gap-2">
                            <Progress value={rec.score} className="h-2 flex-1" />
                            <span className="font-mono text-xs font-semibold text-ink tabular-nums">
                              {rec.score}/100
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{rec.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {textSections.map((section) => (
                  <div key={section.label} className="space-y-1">
                    <h3 className="text-sm font-semibold text-ink">{section.label}</h3>
                    <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
                      {section.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                variant="outline"
                className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => applicant && onDeleteApplicant(applicant)}
                disabled={deletingApplicantId === applicant?.id}
              >
                {deletingApplicantId === applicant?.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete
              </Button>
              <Button onClick={handleDownload} disabled={downloading}>
                {downloading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Download CV
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="text-accent">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-sm text-ink">{value}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
        <span className="text-accent">{icon}</span>
      </div>
      <div className="mt-3 font-display text-3xl font-semibold text-ink">{value}</div>
    </div>
  );
}
