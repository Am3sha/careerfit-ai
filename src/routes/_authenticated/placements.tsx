import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast, Toaster } from "sonner";
import {
  Archive,
  Download,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/placements")({
  head: () => ({
    meta: [{ title: "Placements Database — iCareer" }, { name: "robots", content: "noindex" }],
  }),
  component: PlacementsPage,
});

const PLACEMENT_STATUSES = [
  "assigned",
  "shortlisted",
  "interviewing",
  "hired",
  "rejected",
] as const;

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
};

type Applicant = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  track: string;
  years_experience: string;
};

type PlacementRow = {
  id: string;
  assigned_at: string;
  status: string;
  notes: string | null;
  project: Project;
  applicant: Applicant;
};

function PlacementsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [confirmDeletePlacementId, setConfirmDeletePlacementId] = useState<string | null>(null);

  const projectsQ = useQuery({
    queryKey: ["projects"],
    queryFn: async (): Promise<Project[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, description, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const placementsQ = useQuery({
    queryKey: ["placements"],
    queryFn: async (): Promise<PlacementRow[]> => {
      const { data, error } = await supabase
        .from("placements")
        .select(
          "id, assigned_at, status, notes, project:projects(id, name, description, status), applicant:applicants(id, full_name, email, phone, track, years_experience)",
        )
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PlacementRow[];
    },
  });

  const filtered = useMemo(() => {
    const list = placementsQ.data ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((r) => {
      if (projectFilter !== "all" && r.project?.id !== projectFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.applicant?.full_name.toLowerCase().includes(q) ||
        r.applicant?.email.toLowerCase().includes(q) ||
        r.applicant?.track.toLowerCase().includes(q) ||
        r.project?.name.toLowerCase().includes(q)
      );
    });
  }, [placementsQ.data, search, projectFilter, statusFilter]);

  const handleExport = () => {
    if (!filtered.length) {
      toast.error("Nothing to export");
      return;
    }
    const headers = [
      "Full name",
      "Email",
      "Phone",
      "Track",
      "Experience",
      "Project",
      "Status",
      "Assigned at",
      "Notes",
    ];
    const rows = filtered.map((r) => [
      r.applicant?.full_name ?? "",
      r.applicant?.email ?? "",
      r.applicant?.phone ?? "",
      r.applicant?.track ?? "",
      r.applicant?.years_experience ?? "",
      r.project?.name ?? "",
      r.status,
      new Date(r.assigned_at).toISOString(),
      (r.notes ?? "").replace(/\s+/g, " "),
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
    a.download = `placements-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("placements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Placement removed");
      qc.invalidateQueries({ queryKey: ["placements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatusMut = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: (typeof PLACEMENT_STATUSES)[number];
    }) => {
      const { error } = await supabase.from("placements").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated.");
      qc.invalidateQueries({ queryKey: ["placements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  const uniqueStatuses = useMemo(() => {
    const s = new Set<string>();
    (placementsQ.data ?? []).forEach((r) => s.add(r.status));
    return Array.from(s);
  }, [placementsQ.data]);

  return (
    <main className="relative min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-radial-fade" />

      <div className="relative mx-auto max-w-7xl px-6 py-10">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <span className="font-display text-xl font-bold tracking-tight text-ink">
              <span className="text-accent">i</span>Career
            </span>
            <span className="hidden text-sm text-muted-foreground sm:inline">/ Placements DB</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard">Ops Dashboard</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </header>

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold text-ink">Placements Database</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              All applicants assigned to projects. Filter, search, and export in one click.
            </p>
          </div>
          <div className="flex gap-2">
            <NewProjectDialog onCreated={() => qc.invalidateQueries({ queryKey: ["projects"] })} />
            <ManageProjectsDialog
              projects={projectsQ.data ?? []}
              onChanged={() => {
                qc.invalidateQueries({ queryKey: ["projects"] });
                qc.invalidateQueries({ queryKey: ["placements"] });
              }}
            />
            <AssignDialog
              projects={projectsQ.data ?? []}
              onAssigned={() => qc.invalidateQueries({ queryKey: ["placements"] })}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-[1fr_220px_180px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, email, track, project…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {(projectsQ.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.status === "archived" ? `${p.name} (archived)` : p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {uniqueStatuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Track</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {placementsQ.isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    No placements yet. Assign an applicant to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow
                    key={r.id}
                    className={
                      updateStatusMut.isPending && updateStatusMut.variables?.id === r.id
                        ? "opacity-70"
                        : ""
                    }
                  >
                    <TableCell className="font-medium text-ink">{r.applicant?.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.applicant?.email}</TableCell>
                    <TableCell>{r.applicant?.track}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.applicant?.years_experience}
                    </TableCell>
                    <TableCell>
                      <div className={r.project?.status === "archived" ? "opacity-60" : ""}>
                        <div>{r.project?.name}</div>
                        {r.project?.status === "archived" ? (
                          <Badge variant="secondary" className="mt-1">
                            Archived
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <PlacementStatusSelect
                        placementId={r.id}
                        status={r.status}
                        disabled={deleteMut.isPending}
                        onChange={(status) => updateStatusMut.mutateAsync({ id: r.id, status })}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(r.assigned_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setConfirmDeletePlacementId(r.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Showing {filtered.length} of {placementsQ.data?.length ?? 0} placements.
        </p>

        <Dialog open={!!confirmDeletePlacementId} onOpenChange={() => setConfirmDeletePlacementId(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Remove placement?</DialogTitle>
              <DialogDescription>
                This will remove the applicant from the project. The placement history will be deleted.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmDeletePlacementId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirmDeletePlacementId) {
                    deleteMut.mutate(confirmDeletePlacementId);
                    setConfirmDeletePlacementId(null);
                  }
                }}
                disabled={deleteMut.isPending}
              >
                {deleteMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Remove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}

function NewProjectDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("projects").insert({
      name: name.trim(),
      description: description.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Project created");
    setName("");
    setDescription("");
    setOpen(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" /> New project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Add a project so you can assign applicants to it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Project name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageProjectsDialog({
  projects,
  onChanged,
}: {
  projects: Project[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [confirmDeleteProjectId, setConfirmDeleteProjectId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const confirmDeleteProjectPlacementsQ = useQuery({
    queryKey: ["project-placement-count", confirmDeleteProjectId],
    enabled: !!confirmDeleteProjectId,
    queryFn: async () => {
      if (!confirmDeleteProjectId) return 0;
      const { count, error } = await supabase
        .from("placements")
        .select("id", { count: "exact", head: true })
        .eq("project_id", confirmDeleteProjectId);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const confirmDeleteProjectPlacementCount = confirmDeleteProjectPlacementsQ.data ?? 0;
  const confirmDeleteProjectHasPlacements =
    !!confirmDeleteProjectId &&
    !confirmDeleteProjectPlacementsQ.isLoading &&
    confirmDeleteProjectPlacementCount > 0;

  const updateProjectMut = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Pick<Project, "name" | "description" | "status">>;
    }) => {
      const { error } = await supabase.from("projects").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project updated.");
      setEditingProjectId(null);
      setName("");
      setDescription("");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEditing = (project: Project) => {
    setEditingProjectId(project.id);
    setName(project.name);
    setDescription(project.description ?? "");
  };

  const handleDeleteProject = async (project: Project) => {
    setDeletingProjectId(project.id);
    try {
      const { error } = await supabase.from("projects").delete().eq("id", project.id);
      if (error) {
        const message = error.message?.toLowerCase() ?? "";
        const isForeignKey = message.includes("foreign key") || error.code === "23503";
        toast.error(
          isForeignKey
            ? "Cannot delete: this project has active placements. Archive it instead."
            : error.message,
        );
        return;
      }

      toast.success("Project deleted");
      setConfirmDeleteProjectId(null);
      onChanged();
    } catch (error) {
      console.error(error);
      toast.error("Could not delete project");
    } finally {
      setDeletingProjectId(null);
    }
  };

  const cancelEditing = () => {
    setEditingProjectId(null);
    setName("");
    setDescription("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Manage projects</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage projects</DialogTitle>
          <DialogDescription>
            Rename projects or archive them without losing placement history.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {projects.length === 0 ? (
            <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
              No projects yet.
            </div>
          ) : (
            projects.map((project) => {
              const isEditing = editingProjectId === project.id;
              const isPending =
                updateProjectMut.isPending && updateProjectMut.variables?.id === project.id;

              return (
                <div
                  key={project.id}
                  className={`rounded-xl border border-border p-4 ${project.status === "archived" ? "opacity-70" : ""} ${isPending ? "opacity-70" : ""}`}
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Project name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Description</Label>
                        <Textarea
                          rows={3}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={cancelEditing} disabled={isPending}>
                          <X className="mr-2 h-4 w-4" /> Cancel
                        </Button>
                        <Button
                          onClick={() =>
                            updateProjectMut.mutate({
                              id: project.id,
                              updates: {
                                name: name.trim(),
                                description: description.trim() || null,
                              },
                            })
                          }
                          disabled={isPending || !name.trim()}
                        >
                          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-ink">{project.name}</h3>
                          <Badge variant="secondary">{project.status}</Badge>
                        </div>
                        {project.description ? (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {project.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => startEditing(project)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateProjectMut.mutate({
                              id: project.id,
                              updates: {
                                status: project.status === "archived" ? "active" : "archived",
                              },
                            })
                          }
                          disabled={isPending}
                        >
                          {isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : project.status === "archived" ? (
                            <RotateCcw className="mr-2 h-4 w-4" />
                          ) : (
                            <Archive className="mr-2 h-4 w-4" />
                          )}
                          {project.status === "archived" ? "Reactivate" : "Archive"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setConfirmDeleteProjectId(project.id)}
                          disabled={isPending || deletingProjectId === project.id}
                        >
                          {deletingProjectId === project.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="mr-2 h-4 w-4" />
                          )}
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <Dialog open={!!confirmDeleteProjectId} onOpenChange={() => setConfirmDeleteProjectId(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete project?</DialogTitle>
              <DialogDescription>
                {confirmDeleteProjectPlacementsQ.isLoading ? (
                  "Checking placement history..."
                ) : confirmDeleteProjectHasPlacements ? (
                  <>
                    This project has {confirmDeleteProjectPlacementCount} placement
                    {confirmDeleteProjectPlacementCount === 1 ? "" : "s"}. Deleting will fail -
                    archive it instead to preserve the placement history.
                  </>
                ) : (
                  <>
                    This will permanently delete the project '
                    {projects.find((p) => p.id === confirmDeleteProjectId)?.name ??
                      "this project"}
                    '. If any applicants are currently placed on this project, the deletion will
                    fail and you should archive it instead.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmDeleteProjectId(null)}>
                Cancel
              </Button>
              {!confirmDeleteProjectHasPlacements ? (
                <Button
                  variant="destructive"
                  onClick={() => {
                    const project = projects.find((p) => p.id === confirmDeleteProjectId);
                    if (project) handleDeleteProject(project);
                  }}
                  disabled={deletingProjectId === confirmDeleteProjectId}
                >
                  {deletingProjectId === confirmDeleteProjectId ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Delete
                </Button>
              ) : null}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

function PlacementStatusSelect({
  placementId,
  status,
  disabled,
  onChange,
}: {
  placementId: string;
  status: string;
  disabled: boolean;
  onChange: (status: (typeof PLACEMENT_STATUSES)[number]) => Promise<unknown>;
}) {
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(status);
  }, [status, placementId]);

  const handleChange = async (nextValue: string) => {
    const previousValue = value;
    setValue(nextValue);
    setSaving(true);
    try {
      await onChange(nextValue as (typeof PLACEMENT_STATUSES)[number]);
    } catch (error) {
      console.error("Failed to update status", error);
      toast.error("Could not update status. Please try again.");
      setValue(previousValue);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Select value={value} onValueChange={handleChange} disabled={disabled || saving}>
      <SelectTrigger className="h-9 w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PLACEMENT_STATUSES.map((placementStatus) => (
          <SelectItem key={placementStatus} value={placementStatus}>
            {placementStatus}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AssignDialog({ projects, onAssigned }: { projects: Project[]; onAssigned: () => void }) {
  const [open, setOpen] = useState(false);
  const [applicantId, setApplicantId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [status, setStatus] = useState<string>("assigned");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const applicantsQ = useQuery({
    queryKey: ["applicants-for-assign"],
    enabled: open,
    queryFn: async (): Promise<Applicant[]> => {
      const { data, error } = await supabase
        .from("applicants")
        .select("id, full_name, email, phone, track, years_experience")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filteredApplicants = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = applicantsQ.data ?? [];
    if (!q) return list.slice(0, 50);
    return list
      .filter(
        (a) =>
          a.full_name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.track.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [applicantsQ.data, search]);

  const submit = async () => {
    if (!applicantId || !projectId) return;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("placements").insert({
      applicant_id: applicantId,
      project_id: projectId,
      status,
      notes: notes.trim() || null,
      assigned_by: userData.user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast.error(
        error.code === "23505"
          ? "This applicant is already assigned to this project."
          : error.message,
      );
      return;
    }
    toast.success("Applicant assigned");
    setApplicantId("");
    setProjectId("");
    setNotes("");
    setOpen(false);
    onAssigned();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
          <UserPlus className="mr-2 h-4 w-4" /> Assign applicant
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign applicant to project</DialogTitle>
          <DialogDescription>
            Pick an applicant and the project they're being placed on.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Search applicant</Label>
            <Input
              placeholder="Name, email, or track"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Applicant</Label>
            <Select value={applicantId} onValueChange={setApplicantId}>
              <SelectTrigger>
                <SelectValue placeholder="Select applicant" />
              </SelectTrigger>
              <SelectContent>
                {filteredApplicants.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No matches</div>
                ) : (
                  filteredApplicants.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name} — {a.track}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No projects yet — create one first
                  </div>
                ) : (
                  projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLACEMENT_STATUSES.map((placementStatus) => (
                  <SelectItem key={placementStatus} value={placementStatus}>
                    {placementStatus}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={saving || !applicantId || !projectId}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
