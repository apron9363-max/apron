"use client";

import { useState, useTransition, useMemo, useCallback, useEffect, useRef } from "react";
import {
  ClipboardList,
  Coins,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Video,
  FileCheck,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { formatAPN, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { initiateTaskAction, completeProofTaskAction } from "@/server/actions/taskActions";
import { listTasksWithFiltersAction, listQuizzesAction } from "@/server/actions/userActions";
import type { EnrichedTask } from "@/server/actions/userActions";
import { useRouter } from "next/navigation";
import Link from "next/link";

type FilterType = "all" | "quiz" | "video" | "survey";
type SortType = "newest" | "reward_desc" | "reward_asc";
type StatusType = "all" | "available" | "completed";

const TYPE_LABEL: Record<FilterType, string> = {
  all: "All",
  quiz: "Quiz",
  video: "Video",
  survey: "Survey",
};

const SORT_LABEL: Record<SortType, { label: string; icon: any }> = {
  newest: { label: "Newest", icon: ArrowUpDown },
  reward_desc: { label: "Reward (high→low)", icon: ArrowDown },
  reward_asc: { label: "Reward (low→high)", icon: ArrowUp },
};

const STATUS_LABEL: Record<StatusType, string> = {
  all: "All",
  available: "Available",
  completed: "Completed",
};

function StateBadge({ state }: { state: EnrichedTask["userStatus"]["state"] }) {
  switch (state) {
    case "verified":
    case "completed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
          <CheckCircle2 size={11} /> Verified
        </span>
      );
    case "submitted":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-200">
          <Clock size={11} /> Submitted
        </span>
      );
    case "rejected":
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-200">
          <XCircle size={11} /> {state === "rejected" ? "Rejected" : "Failed"}
        </span>
      );
    case "available":
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-apron-gold/30 bg-apron-gold/10 px-2 py-0.5 text-[11px] font-medium text-apron-gold">
          <Play size={11} /> Available
        </span>
      );
  }
}

function TypeIcon({ type }: { type: "quiz" | "video" | "survey" }) {
  if (type === "quiz") return <HelpCircle size={14} />;
  if (type === "video") return <Video size={14} />;
  return <FileCheck size={14} />;
}

export default function TasksListClient({ initialTasks }: { initialTasks: EnrichedTask[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<EnrichedTask[]>(initialTasks);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("newest");
  const [status, setStatus] = useState<StatusType>("all");
  const [, startTx] = useTransition();
  const [pending, setPending] = useState(false);

  const stats = useMemo(() => {
    const available = tasks.filter((t) => t.userStatus.state === "available");
    const completed = tasks.filter((t) =>
      t.userStatus.state === "verified" || t.userStatus.state === "completed"
    );
    const rewardPool = tasks.reduce((s, t) => s + t.reward, 0);
    return {
      total: tasks.length,
      available: available.length,
      completed: completed.length,
      rewardPool,
    };
  }, [tasks]);

  const displayed = useMemo(() => {
    let list = tasks.slice();
    if (filterType !== "all") list = list.filter((t) => t.type === filterType);
    if (status === "available") list = list.filter((t) => t.userStatus.state === "available");
    else if (status === "completed") list = list.filter((t) =>
      t.userStatus.state === "verified" || t.userStatus.state === "completed"
    );
    switch (sort) {
      case "reward_desc":
        list.sort((a, b) => b.reward - a.reward);
        break;
      case "reward_asc":
        list.sort((a, b) => a.reward - b.reward);
        break;
      case "newest":
      default:
        list.sort((a, b) => b.createdAt - a.createdAt);
    }
    return list;
  }, [tasks, filterType, sort, status]);

  const apply = useCallback((f: FilterType, s: SortType, st: StatusType) => {
    setPending(true);
    startTx(async () => {
      const res = await listTasksWithFiltersAction({ type: f, sort: s, status: st });
      if (res.ok) setTasks(res.tasks);
      setPending(false);
    });
  }, []);

  function onChangeType(f: FilterType) {
    setFilterType(f);
    apply(f, sort, status);
  }
  function onChangeSort(s: SortType) {
    setSort(s);
    apply(filterType, s, status);
  }
  function onChangeStatus(s: StatusType) {
    setStatus(s);
    apply(filterType, sort, s);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <ClipboardList size={22} className="text-apron-gold" /> Tasks
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Complete tasks to earn APN coins instantly.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={stats.total} icon={ClipboardList} />
        <StatCard label="Available" value={stats.available} icon={Play} iconColor="text-apron-gold" />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} iconColor="text-emerald-300" />
        <StatCard
          label="Reward pool"
          value={formatAPN(stats.rewardPool)}
          icon={Coins}
          iconColor="text-apron-pink"
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-xs text-white/60">Type</label>
            <Select
              value={filterType}
              onChange={(v) => onChangeType(v as FilterType)}
              options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-xs text-white/60">Status</label>
            <Select
              value={status}
              onChange={(v) => onChangeStatus(v as StatusType)}
              options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs text-white/60">Sort</label>
            <Select
              value={sort}
              onChange={(v) => onChangeSort(v as SortType)}
              options={Object.entries(SORT_LABEL).map(([value, { label }]) => ({ value, label }))}
            />
          </div>
          <Button
            variant="ghost"
            onClick={() => apply("all", "newest", "all")}
            className="sm:self-end"
            loading={pending}
            aria-label="Reset filters"
          >
            Reset
          </Button>
        </CardContent>
      </Card>

      {displayed.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-white/70">
            {pending ? "Loading tasks…" : "No tasks match the current filter."}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {displayed.map((task) => (
            <TaskCardRow key={task.id} task={task} onDone={() => apply(filterType, sort, status)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCardRow({ task, onDone }: { task: EnrichedTask; onDone: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/15 px-2 py-0.5 text-[11px] uppercase tracking-wide text-white/70">
              <TypeIcon type={task.type} />
              {task.type}
            </span>
            <StateBadge state={task.userStatus.state} />
          </div>
          <CardTitle className="mt-2 text-base">{task.title}</CardTitle>
          {task.description ? (
            <p className="mt-1 text-sm text-white/60">{task.description}</p>
          ) : null}
          {task.userStatus.lastSubmissionAt && task.userStatus.cooldownUntil ? (
            <p className="mt-2 text-[11px] text-white/50">
              Cooldown until {formatDateTime(task.userStatus.cooldownUntil)}
            </p>
          ) : null}
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-white/60">Reward</div>
          <div className="text-lg font-semibold text-gradient-gold">
            +{formatAPN(task.reward)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {task.type === "quiz" ? (
          <div className="flex gap-2">
            <Link href="/quiz" className="flex-1">
              <Button className="w-full">
                <HelpCircle size={16} /> Open Quiz Center
              </Button>
            </Link>
          </div>
        ) : (
          <TaskFlowButton
            task={task}
            open={open}
            setOpen={setOpen}
            running={running}
            setRunning={setRunning}
            close={close}
            onDone={onDone}
          />
        )}
      </CardContent>
    </Card>
  );
}

function TaskFlowButton({
  task,
  open,
  setOpen,
  running,
  setRunning,
  close,
  onDone,
}: {
  task: EnrichedTask;
  open: boolean;
  setOpen: (v: boolean) => void;
  running: boolean;
  setRunning: (v: boolean) => void;
  close: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const disabled = task.userStatus.state !== "available";
  return (
    <div className="flex flex-col gap-2">
      <Button
        className="w-full"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-label={`Start ${task.type} task`}
      >
        {task.type === "video" ? <Video size={16} /> : <FileCheck size={16} />}
        {disabled ? "On cooldown" : `Start & complete`}
      </Button>
      {open && (
        <TaskFlowDialog
          task={task}
          onClose={close}
          running={running}
          setRunning={setRunning}
          onDone={() => {
            close();
            onDone();
          }}
        />
      )}
    </div>
  );
}

function TaskFlowDialog({
  task,
  onClose,
  running,
  setRunning,
  onDone,
}: {
  task: EnrichedTask;
  onClose: () => void;
  running: boolean;
  setRunning: (v: boolean) => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [proof, setProof] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const minDuration = task.type === "video" ? (task.minDurationSec ?? 30) : 0;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function begin() {
    setErr(null);
    setRunning(true);
    initiateTaskAction({ taskId: task.id }).then((res: any) => {
      if (!res.ok) {
        setRunning(false);
        setErr(res.error ?? "Failed to start");
        toast({ title: res.error ?? "Failed to start", variant: "error" });
        return;
      }
      setToken(res.taskSessionToken);
      startedAtRef.current = Date.now();
      setDurationSec(0);
      if (task.type === "video") {
        timerRef.current = setInterval(() => {
          if (startedAtRef.current) {
            const s = Math.floor((Date.now() - startedAtRef.current) / 1000);
            setDurationSec(s);
          }
        }, 500);
      }
    });
  }

  function submit() {
    if (!token) return;
    if (task.type === "video" && durationSec < minDuration) {
      toast({ title: `Watch for at least ${minDuration}s`, variant: "error" });
      return;
    }
    if (task.type === "survey" && proof.trim().length === 0) {
      toast({ title: "Proof key required", variant: "error" });
      return;
    }
    setSubmitting(true);
    completeProofTaskAction({
      taskSessionToken: token,
      proof: task.type === "video" ? task.externalUrl ?? "watched" : proof.trim(),
      durationSec: Math.max(0, Math.floor(durationSec)),
    } as any).then((res: any) => {
      setSubmitting(false);
      if (res.ok) {
        toast({
          title: res.reward > 0 ? `Earned +${formatAPN(res.reward)} APN!` : "Task completed!",
          variant: "success",
        });
        onDone();
      } else {
        setErr(res.rejectReason ?? res.error ?? "Task failed");
        toast({
          title: res.rejectReason ?? res.error ?? "Task failed",
          variant: "error",
        });
      }
    }).finally(() => {
      if (timerRef.current) clearInterval(timerRef.current);
      setRunning(false);
    });
  }

  return (
    <div className="mt-3 rounded-xl border border-white/15 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-white">
          {task.type === "video" ? "Watch Video" : "Survey Proof"}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cancel task">
          Cancel
        </Button>
      </div>

      {!token && !running && (
        <div className="space-y-3">
          {task.externalUrl ? (
            <a
              href={task.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 p-2 text-sm text-apron-gold hover:bg-white/10"
            >
              <ExternalLink size={14} /> Open content link
            </a>
          ) : null}
          <Button className="w-full" onClick={begin}>
            <Play size={16} /> Begin
          </Button>
        </div>
      )}

      {token && task.type === "video" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 p-3">
            <span className="text-xs text-white/60">Elapsed</span>
            <span className="font-mono text-sm text-white">
              {durationSec}s {minDuration ? `/ ${minDuration}s` : ""}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={cn(
                "h-full transition-all duration-500",
                durationSec >= minDuration ? "bg-emerald-400" : "bg-apron-gold"
              )}
              style={{ width: `${minDuration ? Math.min(100, (durationSec / minDuration) * 100) : 100}%` }}
            />
          </div>
          <Button
            className="w-full"
            onClick={submit}
            loading={submitting}
            disabled={durationSec < minDuration}
          >
            <CheckCircle2 size={16} /> Mark watched & claim
          </Button>
        </div>
      )}

      {token && task.type === "survey" && (
        <div className="space-y-3">
          <label className="block text-xs text-white/60">
            Enter survey proof key / completion code
          </label>
          <Input
            value={proof}
            onChange={(e) => setProof(e.target.value)}
            placeholder="Paste proof key…"
            aria-label="Survey proof key"
          />
          <Button className="w-full" onClick={submit} loading={submitting}>
            <CheckCircle2 size={16} /> Submit & claim
          </Button>
        </div>
      )}

      {err ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-500/10 p-2 text-xs text-red-200">
          <AlertCircle size={12} /> {err}
        </div>
      ) : null}
    </div>
  );
}
