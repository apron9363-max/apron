"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Video,
  FileText,
  ListChecks,
  Filter,
  Search,
  UserCheck,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  History,
  ChevronRight,
  X,
  Send,
  Flag,
  CalendarClock,
  AlertOctagon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { Sheet } from "@/components/ui/Sheet";
import {
  adminListTasksAction,
  adminUpsertTaskAction,
  adminListOpsTasksAction,
  adminCreateOpsTaskAction,
  adminUpdateOpsTaskAction,
  adminDeleteOpsTaskAction,
  adminListUsersAction,
} from "@/server/actions/adminActions";
import { cn, formatDateTime } from "@/lib/utils";
import type { AdminOpsTask, TaskDoc, UserDoc } from "@/types";

type TaskKind = "content" | "ops";

const CONTENT_TASK_TYPES = [
  { value: "quiz", label: "Quiz", icon: FileText },
  { value: "video", label: "Video", icon: Video },
  { value: "survey", label: "Survey", icon: ListChecks },
];

const OPS_CATEGORIES: Array<{
  value: AdminOpsTask["category"];
  label: string;
}> = [
  { value: "operations", label: "User support" },
  { value: "finance", label: "Finance / payouts" },
  { value: "product", label: "Content review" },
  { value: "compliance", label: "Platform ops" },
  { value: "other", label: "Other" },
];

const OPS_PRIORITIES: Array<{
  value: AdminOpsTask["priority"];
  label: string;
  color: string;
  icon: React.ComponentType<any>;
}> = [
  { value: "low", label: "Low", color: "bg-blue-500/15 border-blue-400/30 text-blue-200", icon: Flag },
  { value: "medium", label: "Medium", color: "bg-yellow-500/15 border-yellow-400/30 text-yellow-200", icon: AlertTriangle },
  { value: "high", label: "High", color: "bg-orange-500/15 border-orange-400/30 text-orange-200", icon: AlertCircle },
  { value: "critical", label: "Critical", color: "bg-red-500/15 border-red-400/30 text-red-200", icon: AlertOctagon },
];

const OPS_STATUSES: Array<{
  value: AdminOpsTask["status"];
  label: string;
  color: string;
  icon: React.ComponentType<any>;
}> = [
  { value: "pending", label: "Pending", color: "bg-white/5 border-white/10 text-white/70", icon: Clock },
  { value: "in_progress", label: "In progress", color: "bg-apron-gold/15 border-apron-gold/30 text-apron-gold", icon: Send },
  { value: "completed", label: "Completed", color: "bg-green-500/15 border-green-400/30 text-green-300", icon: CheckCircle2 },
  { value: "cancelled", label: "Cancelled", color: "bg-white/5 border-white/10 text-white/50 line-through", icon: X },
];

function toLocalDateInput(v: number) {
  const d = new Date(v);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function fromLocalDateInput(v: string, h = 12): number {
  if (!v) return 0;
  const d = new Date(v);
  d.setHours(h, 0, 0, 0);
  return d.getTime();
}
function fromLocalDateTimeToMs(dateStr: string, timeStr: string): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (timeStr) {
    const [hh, mm] = timeStr.split(":").map(Number);
    d.setHours(hh ?? 12, mm ?? 0, 0, 0);
  }
  return d.getTime();
}
function toLocalTimeInput(v: number): string {
  const d = new Date(v);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function AdminTasksClient() {
  const [tab, setTab] = useState<TaskKind>("ops");
  const [, startTx] = useTransition();
  const [users, setUsers] = useState<UserDoc[]>([]);

  useEffect(() => {
    startTx(async () => {
      const r = (await adminListUsersAction({
        limit: 200,
        sortBy: "name",
        sortDir: "asc",
        status: "all",
        role: "all",
      })) as any;
      if (r.ok) setUsers((r.users ?? []) as UserDoc[]);
    });
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin tasks</h1>
          <p className="mt-1 text-sm text-white/60">
            Manage user-facing content tasks and internal operational tasks.
          </p>
        </div>
      </div>
      <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1 w-fit">
        <button
          onClick={() => setTab("ops")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5",
            tab === "ops"
              ? "bg-apron-gold/20 text-apron-gold border border-apron-gold/40"
              : "text-white/70 hover:text-white hover:bg-white/5",
          )}
        >
          <Users size={12} /> Operational tasks
        </button>
        <button
          onClick={() => setTab("content")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5",
            tab === "content"
              ? "bg-apron-gold/20 text-apron-gold border border-apron-gold/40"
              : "text-white/70 hover:text-white hover:bg-white/5",
          )}
        >
          <Video size={12} /> Content tasks
        </button>
      </div>
      {tab === "content" ? (
        <ContentTasksTab />
      ) : (
        <OpsTasksTab users={users} />
      )}
    </div>
  );
}

/* ---------- Content tasks tab (preserved legacy quiz/video/survey CRUD) ---------- */

function ContentTasksTab() {
  const [tasks, setTasks] = useState<TaskDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [, startTx] = useTransition();

  const [taskForm, setTaskForm] = useState<{
    id?: string;
    type: TaskDoc["type"];
    title: string;
    description: string;
    reward: string;
    url: string;
    plan: TaskDoc["plan"];
    active: boolean;
    metadata: string;
  }>({
    type: "quiz",
    title: "",
    description: "",
    reward: "",
    url: "",
    plan: "basic",
    active: true,
    metadata: "",
  });
  const [upsertOpen, setUpsertOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    setLoading(true);
    startTx(async () => {
      const res = (await adminListTasksAction()) as any;
      setTasks((res ?? []) as TaskDoc[]);
      setLoading(false);
    });
  }
  useEffect(load, []);

  function openCreate() {
    setTaskForm({
      type: "quiz",
      title: "",
      description: "",
      reward: "",
      url: "",
      plan: "basic",
      active: true,
      metadata: "",
    });
    setUpsertOpen(true);
  }
  function openEdit(t: TaskDoc) {
    setTaskForm({
      id: t.id,
      type: t.type,
      title: t.title,
      description: t.description ?? "",
      reward: String(t.reward ?? 0),
      url: t.url ?? "",
      plan: t.plan,
      active: t.active,
      metadata: t.metadata ? JSON.stringify(t.metadata, null, 2) : "",
    });
    setUpsertOpen(true);
  }

  async function handleSave() {
    if (!taskForm.title) return;
    setBusy(taskForm.id ? `upsert-${taskForm.id}` : "upsert-new");
    let parsedMeta: Record<string, unknown> | undefined = undefined;
    if (taskForm.metadata.trim()) {
      try {
        parsedMeta = JSON.parse(taskForm.metadata);
      } catch {
        parsedMeta = undefined;
      }
    }
    const payload = {
      id: taskForm.id,
      type: taskForm.type,
      title: taskForm.title,
      description: taskForm.description || undefined,
      reward: Number(taskForm.reward || 0),
      url: taskForm.url || undefined,
      plan: taskForm.plan,
      active: taskForm.active,
      metadata: parsedMeta,
    };
    const res = await adminUpsertTaskAction(payload as any);
    setBusy(null);
    if ((res as any).ok) {
      setUpsertOpen(false);
      load();
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter(
        (t) =>
          !q ||
          t.title.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q),
      )
      .filter((t) => typeFilter === "all" || t.type === typeFilter)
      .filter((t) => planFilter === "all" || t.plan === planFilter)
      .filter(
        (t) =>
          statusFilter === "all" ||
          (statusFilter === "active" ? t.active : !t.active),
      );
  }, [tasks, query, typeFilter, planFilter, statusFilter]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search content tasks…"
                className="pl-8 h-8 text-xs min-w-[200px]"
              />
            </div>
            <Select
              className="h-8 text-xs w-[120px]"
              value={typeFilter}
              options={[
                { value: "all", label: "All types" },
                ...CONTENT_TASK_TYPES.map((t) => ({ value: t.value, label: t.label })),
              ]}
              onChange={(v) => setTypeFilter(v)}
            />
            <Select
              className="h-8 text-xs w-[120px]"
              value={planFilter}
              options={[
                { value: "all", label: "All plans" },
                { value: "basic", label: "Basic" },
                { value: "vip", label: "VIP" },
                { value: "elite", label: "Elite" },
              ]}
              onChange={(v) => setPlanFilter(v)}
            />
            <Select
              className="h-8 text-xs w-[120px]"
              value={statusFilter}
              options={[
                { value: "all", label: "All status" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
              onChange={(v) => setStatusFilter(v)}
            />
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} /> New content task
          </Button>
        </CardHeader>
        <CardContent>
          {loading && filtered.length === 0 ? (
            <div className="py-8 text-center text-white/60 text-sm">
              Loading content tasks…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-white/60 text-sm">
              No content tasks match your filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((t) => {
                const iconDef = CONTENT_TASK_TYPES.find((x) => x.value === t.type) ?? CONTENT_TASK_TYPES[0];
                const Icon = iconDef.icon;
                return (
                  <Card key={t.id} className="relative overflow-hidden">
                    {!t.active ? (
                      <span className="absolute top-3 right-3 text-[10px] uppercase px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60">
                        Inactive
                      </span>
                    ) : null}
                    <CardHeader className="flex-row items-start gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-apron-gold shrink-0">
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base">{t.title}</CardTitle>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-white/50">
                          <span className="uppercase tracking-wide">{iconDef.label}</span>
                          <span>·</span>
                          <span>plan: {t.plan}</span>
                          <span>·</span>
                          <span className="text-apron-gold">+{t.reward ?? 0} APN</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {t.description ? (
                        <p className="text-xs text-white/70 line-clamp-2 mb-3 whitespace-pre-wrap">
                          {t.description}
                        </p>
                      ) : null}
                      {t.url ? (
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-[11px] text-apron-gold hover:underline truncate block mb-3"
                        >
                          {t.url}
                        </a>
                      ) : null}
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="xs" variant="outline" onClick={() => openEdit(t)}>
                          <Edit2 size={12} /> Edit
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={upsertOpen}
        onOpenChange={(o) => !o && setUpsertOpen(false)}
        title={taskForm.id ? "Edit content task" : "Create content task"}
        description="These tasks are shown to users on their dashboard according to plan eligibility."
        footer={
          <>
            <Button variant="outline" onClick={() => setUpsertOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              loading={busy === (taskForm.id ? `upsert-${taskForm.id}` : "upsert-new")}
              disabled={!taskForm.title}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              value={taskForm.type}
              options={CONTENT_TASK_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              onChange={(v) => setTaskForm({ ...taskForm, type: v as TaskDoc["type"] })}
            />
            <Select
              value={taskForm.plan}
              options={[
                { value: "basic", label: "Basic" },
                { value: "vip", label: "VIP" },
                { value: "elite", label: "Elite" },
              ]}
              onChange={(v) => setTaskForm({ ...taskForm, plan: v as TaskDoc["plan"] })}
            />
          </div>
          <Input
            value={taskForm.title}
            onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
            placeholder="Task title (required)"
          />
          <Textarea
            rows={3}
            value={taskForm.description}
            onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
            placeholder="Task description / instructions…"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              inputMode="decimal"
              value={taskForm.reward}
              onChange={(e) =>
                setTaskForm({
                  ...taskForm,
                  reward: e.target.value.replace(/[^0-9.]/g, ""),
                })
              }
              placeholder="Reward (APN)"
            />
            <Input
              value={taskForm.url}
              onChange={(e) => setTaskForm({ ...taskForm, url: e.target.value })}
              placeholder="External URL (optional)"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wide text-white/60 mb-1 block">
              Metadata JSON (optional)
            </label>
            <Textarea
              rows={4}
              value={taskForm.metadata}
              onChange={(e) => setTaskForm({ ...taskForm, metadata: e.target.value })}
              placeholder='{ "durationMinutes": 10 }'
            />
          </div>
          <div className="glass !p-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-white">Active</div>
              <div className="text-[11px] text-white/50">
                Inactive tasks are hidden from all users.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTaskForm({ ...taskForm, active: !taskForm.active })}
              className={cn(
                "relative h-6 w-11 rounded-full border transition",
                taskForm.active
                  ? "bg-apron-gold/30 border-apron-gold/50"
                  : "bg-white/5 border-white/10",
              )}
            >
              <span
                className={cn(
                  "absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white transition-transform",
                  taskForm.active ? "translate-x-5" : "translate-x-0",
                )}
              />
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ---------- Operational tasks tab (AdminOpsTask CRUD) ---------- */

function OpsTasksTab({ users }: { users: UserDoc[] }) {
  const [tasks, setTasks] = useState<AdminOpsTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [, startTx] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    title: "",
    description: "",
    category: "other" as AdminOpsTask["category"],
    priority: "medium" as AdminOpsTask["priority"],
    status: "pending" as AdminOpsTask["status"],
    assigneeUid: "",
    deadlineDate: "",
    deadlineTime: "",
    reminderDate: "",
    reminderTime: "",
    comment: "",
  });

  const [editOpenId, setEditOpenId] = useState<string | null>(null);
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  const [deleteOpenId, setDeleteOpenId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    startTx(async () => {
      const res = (await adminListOpsTasksAction({
        category: categoryFilter === "all" ? undefined : (categoryFilter as any),
        priority: priorityFilter === "all" ? undefined : (priorityFilter as any),
        status: statusFilter === "all" ? undefined : (statusFilter as any),
        assigneeUid: assigneeFilter === "all" ? undefined : assigneeFilter,
        limit: 200,
      })) as any;
      if (res.ok) setTasks((res.tasks ?? []) as AdminOpsTask[]);
      setLoading(false);
    });
  }

  useEffect(load, [categoryFilter, priorityFilter, statusFilter, assigneeFilter]);

  async function handleCreate() {
    if (!newForm.title) return;
    setBusy("ops-create");
    const deadlineAt = newForm.deadlineDate
      ? fromLocalDateTimeToMs(newForm.deadlineDate, newForm.deadlineTime)
      : undefined;
    const reminderAt = newForm.reminderDate
      ? fromLocalDateTimeToMs(newForm.reminderDate, newForm.reminderTime)
      : undefined;
    const payload = {
      title: newForm.title,
      description: newForm.description || undefined,
      category: newForm.category,
      priority: newForm.priority,
      status: newForm.status,
      assigneeUid: newForm.assigneeUid || undefined,
      deadlineAt,
      reminderAt,
      comment: newForm.comment || undefined,
    };
    const res = await adminCreateOpsTaskAction(payload);
    setBusy(null);
    if ((res as any).ok) {
      setCreateOpen(false);
      resetNewForm();
      load();
    }
  }

  function resetNewForm() {
    setNewForm({
      title: "",
      description: "",
      category: "other",
      priority: "medium",
      status: "pending",
      assigneeUid: "",
      deadlineDate: "",
      deadlineTime: "",
      reminderDate: "",
      reminderTime: "",
      comment: "",
    });
  }

  async function handleUpdate(
    t: AdminOpsTask,
    patch: Partial<AdminOpsTask> & { comment?: string },
  ) {
    setBusy(`ops-update-${t.id}`);
    const { comment, ...fields } = patch;
    const res = await adminUpdateOpsTaskAction({
      id: t.id,
      ...fields,
      comment: comment || undefined,
    });
    setBusy(null);
    if ((res as any).ok) {
      setEditOpenId(null);
      load();
    }
  }

  async function handleDelete(id: string) {
    setBusy(`ops-delete-${id}`);
    const res = await adminDeleteOpsTaskAction({ id });
    setBusy(null);
    if ((res as any).ok) {
      setDeleteOpenId(null);
      load();
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter(
        (t) =>
          !q ||
          t.title.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => {
        const statusOrder: Record<AdminOpsTask["status"], number> = {
          pending: 0,
          in_progress: 1,
          completed: 2,
          cancelled: 3,
        };
        if (statusOrder[a.status] !== statusOrder[b.status])
          return statusOrder[a.status] - statusOrder[b.status];
        const priorityOrder: Record<AdminOpsTask["priority"], number> = {
          critical: 0,
          high: 1,
          medium: 2,
          low: 3,
        };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority])
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        if (a.deadlineAt && b.deadlineAt) return a.deadlineAt - b.deadlineAt;
        return b.createdAt - a.createdAt;
      });
  }, [tasks, query]);

  const editing = editOpenId ? tasks.find((t) => t.id === editOpenId) ?? null : null;
  const historyTask = historyOpenId ? tasks.find((t) => t.id === historyOpenId) ?? null : null;
  const deletingTask = deleteOpenId ? tasks.find((t) => t.id === deleteOpenId) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search operational tasks…"
                className="pl-8 h-8 text-xs min-w-[200px]"
              />
            </div>
            <Select
              className="h-8 text-xs w-[140px]"
              value={categoryFilter}
              options={[
                { value: "all", label: "All categories" },
                ...OPS_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
              ]}
              onChange={(v) => setCategoryFilter(v)}
            />
            <Select
              className="h-8 text-xs w-[110px]"
              value={priorityFilter}
              options={[
                { value: "all", label: "All priority" },
                ...OPS_PRIORITIES.map((p) => ({ value: p.value, label: p.label })),
              ]}
              onChange={(v) => setPriorityFilter(v)}
            />
            <Select
              className="h-8 text-xs w-[130px]"
              value={statusFilter}
              options={[
                { value: "all", label: "All status" },
                ...OPS_STATUSES.map((s) => ({ value: s.value, label: s.label })),
              ]}
              onChange={(v) => setStatusFilter(v)}
            />
            <Select
              className="h-8 text-xs max-w-[220px]"
              value={assigneeFilter}
              options={[
                { value: "all", label: "All assignees" },
                ...users.map((u) => ({
                  value: u.uid,
                  label: `${u.name} · ${u.email}`,
                })),
              ]}
              onChange={(v) => setAssigneeFilter(v)}
            />
          </div>
          <Button size="sm" onClick={() => {
            resetNewForm();
            setCreateOpen(true);
          }}>
            <Plus size={14} /> New task
          </Button>
        </CardHeader>
        <CardContent>
          {loading && filtered.length === 0 ? (
            <div className="text-center text-white/60 text-sm py-8">
              Loading operational tasks…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-white/60 text-sm py-8">
              No operational tasks match your filters.
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((t) => (
                <OpsTaskRow
                  key={t.id}
                  task={t}
                  users={users}
                  onEdit={() => setEditOpenId(t.id)}
                  onHistory={() => setHistoryOpenId(t.id)}
                  onDelete={() => setDeleteOpenId(t.id)}
                  onStatus={(st, comment) => handleUpdate(t, { status: st, comment })}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={createOpen}
        onOpenChange={(o) => !o && setCreateOpen(false)}
        title="Create operational task"
        description="Internal tasks for the admin team. Assigns a priority and tracks history."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={busy === "ops-create"} disabled={!newForm.title}>
              Create task
            </Button>
          </>
        }
      >
        <OpsTaskEditor
          users={users}
          title={newForm.title}
          setTitle={(v) => setNewForm({ ...newForm, title: v })}
          description={newForm.description}
          setDescription={(v) => setNewForm({ ...newForm, description: v })}
          category={newForm.category}
          setCategory={(v) => setNewForm({ ...newForm, category: v })}
          priority={newForm.priority}
          setPriority={(v) => setNewForm({ ...newForm, priority: v })}
          status={newForm.status}
          setStatus={(v) => setNewForm({ ...newForm, status: v })}
          assigneeUid={newForm.assigneeUid}
          setAssigneeUid={(v) => setNewForm({ ...newForm, assigneeUid: v })}
          deadlineDate={newForm.deadlineDate}
          setDeadlineDate={(v) => setNewForm({ ...newForm, deadlineDate: v })}
          deadlineTime={newForm.deadlineTime}
          setDeadlineTime={(v) => setNewForm({ ...newForm, deadlineTime: v })}
          reminderDate={newForm.reminderDate}
          setReminderDate={(v) => setNewForm({ ...newForm, reminderDate: v })}
          reminderTime={newForm.reminderTime}
          setReminderTime={(v) => setNewForm({ ...newForm, reminderTime: v })}
          comment={newForm.comment}
          setComment={(v) => setNewForm({ ...newForm, comment: v })}
          commentLabel="Initial comment (optional, saved as history entry)"
        />
      </Modal>

      <Modal
        open={!!editing}
        onOpenChange={(o) => !o && setEditOpenId(null)}
        title={`Edit task: ${editing?.title ?? ""}`}
        description="Any field change creates a history entry."
        footer={
          <>
            <Button variant="outline" onClick={() => setEditOpenId(null)}>Cancel</Button>
            <Button
              loading={editing ? busy === `ops-update-${editing.id}` : false}
              disabled={!editing}
              onClick={async () => {
                if (!editing) return;
                const data = editDataRef.current;
                const assigneeUid = data.assigneeUid || undefined;
                const deadlineAt = data.deadlineDate
                  ? fromLocalDateTimeToMs(data.deadlineDate, data.deadlineTime)
                  : editing.deadlineAt;
                const reminderAt = data.reminderDate
                  ? fromLocalDateTimeToMs(data.reminderDate, data.reminderTime)
                  : editing.reminderAt;
                const patch: Partial<AdminOpsTask> & { comment?: string } = {};
                if (data.title !== editing.title) patch.title = data.title;
                if (data.description !== (editing.description ?? ""))
                  patch.description = data.description || undefined;
                if (data.category !== editing.category) patch.category = data.category;
                if (data.priority !== editing.priority) patch.priority = data.priority;
                if (data.status !== editing.status) patch.status = data.status;
                if (assigneeUid !== (editing.assigneeUid)) patch.assigneeUid = assigneeUid;
                if (deadlineAt !== editing.deadlineAt) patch.deadlineAt = deadlineAt;
                if (reminderAt !== editing.reminderAt) patch.reminderAt = reminderAt;
                if (patch.status === "completed" && !editing.completedAt)
                  patch.completedAt = Date.now();
                if (patch.status && patch.status !== "completed" && editing.completedAt)
                  patch.completedAt = undefined;
                if (data.comment) (patch as any).comment = data.comment;
                if (Object.keys(patch).length === 0) {
                  setEditOpenId(null);
                  return;
                }
                await handleUpdate(editing, patch as any);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        {editing ? (
          <EditFormProxy task={editing} users={users} />
        ) : null}
      </Modal>

      <Modal
        open={!!deletingTask}
        onOpenChange={(o) => !o && setDeleteOpenId(null)}
        title={`Delete task: ${deletingTask?.title ?? ""}`}
        description="Deleting a task is permanent. Consider setting status to cancelled instead to preserve history."
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpenId(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={deletingTask ? busy === `ops-delete-${deletingTask.id}` : false}
              onClick={() => deletingTask && handleDelete(deletingTask.id)}
            >
              Delete task
            </Button>
          </>
        }
      >
        <div className="rounded-xl border border-yellow-400/20 bg-yellow-500/10 p-3 text-yellow-200 text-xs flex items-start gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            Task history will be lost. Audit log record will still be created.
          </div>
        </div>
      </Modal>

      <Sheet
        open={!!historyTask}
        onOpenChange={(o) => !o && setHistoryOpenId(null)}
        side="right"
        title="Task history"
        description="Every change is captured with the actor, time, and comment."
      >
        {historyTask ? (
          <div className="space-y-4">
            <div className="glass !p-3">
              <div className="text-[11px] uppercase tracking-wide text-white/50 mb-1">
                Task
              </div>
              <div className="font-semibold text-white">{historyTask.title}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                <PriorityBadge priority={historyTask.priority} />
                <StatusBadge status={historyTask.status} />
              </div>
              {historyTask.description ? (
                <div className="mt-2 text-xs text-white/70 whitespace-pre-wrap">
                  {historyTask.description}
                </div>
              ) : null}
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-white/70">
                <div>
                  <span className="text-white/40">Created by:</span>{" "}
                  {historyTask.createdByName ?? historyTask.createdBy}
                </div>
                <div>
                  <span className="text-white/40">Assigned:</span>{" "}
                  {historyTask.assigneeName ??
                    (historyTask.assigneeUid
                      ? users.find((u) => u.uid === historyTask.assigneeUid)?.name ??
                        "Unresolved"
                      : "Unassigned")}
                </div>
                <div>
                  <span className="text-white/40">Deadline:</span>{" "}
                  {historyTask.deadlineAt ? formatDateTime(historyTask.deadlineAt) : "—"}
                </div>
                <div>
                  <span className="text-white/40">Reminder:</span>{" "}
                  {historyTask.reminderAt ? formatDateTime(historyTask.reminderAt) : "—"}
                </div>
              </div>
            </div>
            {historyTask.history && historyTask.history.length > 0 ? (
              <ol className="relative border-l border-white/10 ml-3 space-y-5">
                {historyTask.history
                  .slice()
                  .sort((a, b) => (b.timestamp ?? b.at ?? 0) - (a.timestamp ?? a.at ?? 0))
                  .map((h, idx) => (
                    <li key={idx} className="ml-4">
                      <div className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-apron-gold" />
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm font-semibold text-white">{h.action ?? h.comment ?? "Update"}</div>
                        <div className="text-[11px] text-white/50">
                          {formatDateTime(h.timestamp ?? h.at ?? 0)}
                        </div>
                      </div>
                      <div className="text-[11px] text-white/60">
                        By{" "}
                        <span className="text-white/90">
                          {h.actorName ?? h.actorUid ?? h.byName ?? h.by}
                        </span>
                      </div>
                      {(h.changes ?? h.change) && Object.keys(h.changes ?? h.change ?? {}).length > 0 ? (
                        <div className="mt-2 space-y-1.5">
                          {Object.entries((h.changes ?? h.change) as any).map(([key, v]: any) => (
                            <div
                              key={key}
                              className="rounded-lg border border-white/10 bg-white/[0.02] p-2"
                            >
                              <div className="text-xs font-medium text-white/85">
                                {key}
                              </div>
                              <div className="mt-1 flex items-start gap-2 flex-wrap text-[11px]">
                                <div className="rounded bg-red-500/10 border border-red-400/20 px-2 py-1 text-red-200 break-all max-w-full">
                                  <span className="text-[10px] uppercase mr-1 opacity-70">
                                    before
                                  </span>
                                  {typeof v.before === "object"
                                    ? JSON.stringify(v.before)
                                    : String(v.before ?? "—")}
                                </div>
                                <ChevronRight size={12} className="text-white/30 self-center" />
                                <div className="rounded bg-green-500/10 border border-green-400/20 px-2 py-1 text-green-200 break-all max-w-full">
                                  <span className="text-[10px] uppercase mr-1 opacity-70">
                                    after
                                  </span>
                                  {typeof v.after === "object"
                                    ? JSON.stringify(v.after)
                                    : String(v.after ?? "—")}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {h.comment ? (
                        <div className="mt-2 glass !p-2 !bg-white/[0.03] text-xs text-white/85 whitespace-pre-wrap break-words">
                          {h.comment}
                        </div>
                      ) : null}
                    </li>
                  ))}
              </ol>
            ) : (
              <div className="text-xs text-white/60 text-center py-6">
                No history entries yet.
              </div>
            )}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

// A small proxy just to persist edit state within the modal
const editDataRef = { current: {
  title: "",
  description: "",
  category: "other" as AdminOpsTask["category"],
  priority: "medium" as AdminOpsTask["priority"],
  status: "pending" as AdminOpsTask["status"],
  assigneeUid: "",
  deadlineDate: "",
  deadlineTime: "",
  reminderDate: "",
  reminderTime: "",
  comment: "",
} };

function EditFormProxy({ task, users }: { task: AdminOpsTask; users: UserDoc[] }) {
  useEffect(() => {
    editDataRef.current = {
      title: task.title,
      description: task.description ?? "",
      category: task.category,
      priority: task.priority,
      status: task.status,
      assigneeUid: task.assigneeUid ?? "",
      deadlineDate: task.deadlineAt ? toLocalDateInput(task.deadlineAt) : "",
      deadlineTime: task.deadlineAt ? toLocalTimeInput(task.deadlineAt) : "",
      reminderDate: task.reminderAt ? toLocalDateInput(task.reminderAt) : "",
      reminderTime: task.reminderAt ? toLocalTimeInput(task.reminderAt) : "",
      comment: "",
    };
    const root = document.getElementById("ops-edit-holder");
    if (root) root.dispatchEvent(new Event("reset", { bubbles: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);
  return (
    <div id="ops-edit-holder">
      <OpsTaskEditor
        users={users}
        title={editDataRef.current.title}
        setTitle={(v) => (editDataRef.current.title = v)}
        description={editDataRef.current.description}
        setDescription={(v) => (editDataRef.current.description = v)}
        category={editDataRef.current.category}
        setCategory={(v) => (editDataRef.current.category = v)}
        priority={editDataRef.current.priority}
        setPriority={(v) => (editDataRef.current.priority = v)}
        status={editDataRef.current.status}
        setStatus={(v) => (editDataRef.current.status = v)}
        assigneeUid={editDataRef.current.assigneeUid}
        setAssigneeUid={(v) => (editDataRef.current.assigneeUid = v)}
        deadlineDate={editDataRef.current.deadlineDate}
        setDeadlineDate={(v) => (editDataRef.current.deadlineDate = v)}
        deadlineTime={editDataRef.current.deadlineTime}
        setDeadlineTime={(v) => (editDataRef.current.deadlineTime = v)}
        reminderDate={editDataRef.current.reminderDate}
        setReminderDate={(v) => (editDataRef.current.reminderDate = v)}
        reminderTime={editDataRef.current.reminderTime}
        setReminderTime={(v) => (editDataRef.current.reminderTime = v)}
        comment={editDataRef.current.comment}
        setComment={(v) => (editDataRef.current.comment = v)}
        commentLabel="Comment / change note (optional)"
      />
    </div>
  );
}

function OpsTaskEditor({
  users,
  title,
  setTitle,
  description,
  setDescription,
  category,
  setCategory,
  priority,
  setPriority,
  status,
  setStatus,
  assigneeUid,
  setAssigneeUid,
  deadlineDate,
  setDeadlineDate,
  deadlineTime,
  setDeadlineTime,
  reminderDate,
  setReminderDate,
  reminderTime,
  setReminderTime,
  comment,
  setComment,
  commentLabel,
}: {
  users: UserDoc[];
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  category: AdminOpsTask["category"];
  setCategory: (v: AdminOpsTask["category"]) => void;
  priority: AdminOpsTask["priority"];
  setPriority: (v: AdminOpsTask["priority"]) => void;
  status: AdminOpsTask["status"];
  setStatus: (v: AdminOpsTask["status"]) => void;
  assigneeUid: string;
  setAssigneeUid: (v: string) => void;
  deadlineDate: string;
  setDeadlineDate: (v: string) => void;
  deadlineTime: string;
  setDeadlineTime: (v: string) => void;
  reminderDate: string;
  setReminderDate: (v: string) => void;
  reminderTime: string;
  setReminderTime: (v: string) => void;
  comment: string;
  setComment: (v: string) => void;
  commentLabel: string;
}) {
  return (
    <div className="space-y-3">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title (required)"
      />
      <Textarea
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Task description / notes…"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          value={category}
          options={OPS_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          onChange={(v) => setCategory(v as AdminOpsTask["category"])}
        />
        <Select
          value={priority}
          options={OPS_PRIORITIES.map((p) => ({ value: p.value, label: p.label }))}
          onChange={(v) => setPriority(v as AdminOpsTask["priority"])}
        />
        <Select
          value={status}
          options={OPS_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
          onChange={(v) => setStatus(v as AdminOpsTask["status"])}
        />
      </div>
      <div>
        <label className="text-[11px] uppercase tracking-wide text-white/60 mb-1 block">
          Assignee
        </label>
        <Select
          value={assigneeUid}
          options={[
            { value: "", label: "— Unassigned —" },
            ...users.map((u) => ({
              value: u.uid,
              label: `${u.name} · ${u.email}`,
            })),
          ]}
          onChange={(v) => setAssigneeUid(v)}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[11px] uppercase tracking-wide text-white/60 mb-1 block flex items-center gap-1">
            <CalendarClock size={11} /> Deadline
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            <Input
              type="date"
              value={deadlineDate}
              onChange={(e) => setDeadlineDate(e.target.value)}
              className="h-9 text-xs col-span-2"
            />
            <Input
              type="time"
              value={deadlineTime}
              onChange={(e) => setDeadlineTime(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-white/60 mb-1 block flex items-center gap-1">
            <Clock size={11} /> Reminder
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            <Input
              type="date"
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
              className="h-9 text-xs col-span-2"
            />
            <Input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
        </div>
      </div>
      <div>
        <label className="text-[11px] uppercase tracking-wide text-white/60 mb-1 block">
          {commentLabel}
        </label>
        <Textarea
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a note visible in history…"
        />
      </div>
    </div>
  );
}

function OpsTaskRow({
  task,
  users,
  onEdit,
  onHistory,
  onDelete,
  onStatus,
}: {
  task: AdminOpsTask;
  users: UserDoc[];
  onEdit: () => void;
  onHistory: () => void;
  onDelete: () => void;
  onStatus: (status: AdminOpsTask["status"], comment?: string) => void;
}) {
  const overdue =
    task.deadlineAt &&
    task.status !== "completed" &&
    task.status !== "cancelled" &&
    Date.now() > task.deadlineAt;
  const assigneeName =
    task.assigneeName ??
    (task.assigneeUid
      ? users.find((u) => u.uid === task.assigneeUid)?.name ?? null
      : null);
  const [openComment, setOpenComment] = useState<AdminOpsTask["status"] | null>(null);
  const [commentValue, setCommentValue] = useState("");
  return (
    <Card className={cn("relative", overdue ? "ring-1 ring-red-400/30" : "")}>
      <CardContent className="!py-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-base font-semibold text-white truncate">{task.title}</div>
              <PriorityBadge priority={task.priority} />
              <StatusBadge status={task.status} />
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/70">
                {OPS_CATEGORIES.find((c) => c.value === task.category)?.label ?? task.category}
              </span>
              {overdue ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-400/30 bg-red-500/10 px-2 py-0.5 text-[10px] uppercase text-red-200">
                  <AlertOctagon size={10} /> Overdue
                </span>
              ) : null}
            </div>
            {task.description ? (
              <div className="text-xs text-white/75 whitespace-pre-wrap line-clamp-3">
                {task.description}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/60">
              <span>
                Created <b className="text-white/85">{task.createdByName ?? task.createdBy}</b>{" "}
                · {formatDateTime(task.createdAt)}
              </span>
              {assigneeName ? (
                <span className="inline-flex items-center gap-1">
                  <UserCheck size={10} /> Assigned:{" "}
                  <b className="text-white/85">{assigneeName}</b>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-white/45">
                  <Users size={10} /> Unassigned
                </span>
              )}
              {task.deadlineAt ? (
                <span className="inline-flex items-center gap-1">
                  <CalendarClock size={10} /> Due: {formatDateTime(task.deadlineAt)}
                </span>
              ) : null}
              {task.reminderAt ? (
                <span className="inline-flex items-center gap-1">
                  <Clock size={10} /> Reminder: {formatDateTime(task.reminderAt)}
                </span>
              ) : null}
              {task.completedAt ? (
                <span className="inline-flex items-center gap-1 text-green-300">
                  <CheckCircle2 size={10} /> Completed {formatDateTime(task.completedAt)}
                </span>
              ) : null}
              {task.history ? (
                <button
                  onClick={onHistory}
                  className="inline-flex items-center gap-1 hover:text-apron-gold text-white/60"
                >
                  <History size={10} /> {task.history.length} history
                </button>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
            {task.status === "pending" ? (
              <Button
                size="xs"
                onClick={() => {
                  setOpenComment("in_progress");
                  setCommentValue("");
                }}
              >
                <Send size={12} /> Start
              </Button>
            ) : null}
            {task.status === "in_progress" ? (
              <Button
                size="xs"
                onClick={() => {
                  setOpenComment("completed");
                  setCommentValue("");
                }}
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                <CheckCircle2 size={12} /> Complete
              </Button>
            ) : null}
            {task.status !== "cancelled" && task.status !== "completed" ? (
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  setOpenComment("cancelled");
                  setCommentValue("");
                }}
              >
                <X size={12} /> Cancel
              </Button>
            ) : task.status === "cancelled" || task.status === "completed" ? (
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  setOpenComment("pending");
                  setCommentValue("Re-opened");
                }}
              >
                <AlertCircle size={12} /> Re-open
              </Button>
            ) : null}
            <Button size="xs" variant="outline" onClick={onEdit}>
              <Edit2 size={12} /> Edit
            </Button>
            <Button size="xs" variant="outline" onClick={onHistory}>
              <History size={12} />
            </Button>
            <Button size="xs" variant="danger" onClick={onDelete}>
              <Trash2 size={12} />
            </Button>
          </div>
        </div>
      </CardContent>

      <Modal
        open={!!openComment}
        onOpenChange={(o) => !o && setOpenComment(null)}
        title={
          openComment === "in_progress"
            ? "Mark task in progress"
            : openComment === "completed"
            ? "Mark task completed"
            : openComment === "cancelled"
            ? "Cancel task"
            : "Re-open task"
        }
        description="Add an optional note that will be saved to the task history."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpenComment(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (openComment) onStatus(openComment, commentValue.trim() || undefined);
                setOpenComment(null);
              }}
            >
              Confirm
            </Button>
          </>
        }
      >
        <Textarea
          rows={4}
          value={commentValue}
          onChange={(e) => setCommentValue(e.target.value)}
          placeholder="Optional note (saved to history)…"
        />
      </Modal>
    </Card>
  );
}

function PriorityBadge({ priority }: { priority: AdminOpsTask["priority"] }) {
  const def = OPS_PRIORITIES.find((p) => p.value === priority) ?? OPS_PRIORITIES[1];
  const Icon = def.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase",
        def.color,
      )}
    >
      <Icon size={10} />
      {def.label}
    </span>
  );
}

function StatusBadge({ status }: { status: AdminOpsTask["status"] }) {
  const def = OPS_STATUSES.find((s) => s.value === status) ?? OPS_STATUSES[0];
  const Icon = def.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase",
        def.color,
      )}
    >
      <Icon size={10} />
      {def.label}
    </span>
  );
}
