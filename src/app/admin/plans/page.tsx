"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Plus,
  Trash2,
  Crown,
  Check,
  Sparkles,
  History,
  X,
  Save,
  Eye,
  AlertTriangle,
  RotateCcw,
  ChevronRight,
  Edit2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { Sheet } from "@/components/ui/Sheet";
import { Select } from "@/components/ui/Select";
import {
  adminListPlansAction,
  adminCreatePlanAction,
  adminUpdatePlanAction,
  adminDeletePlanAction,
  adminGetPlanVersionsAction,
} from "@/server/actions/adminActions";
import {
  formatAPN,
  formatDateTime,
  formatNaira,
  cn,
} from "@/lib/utils";
import type { PlanDoc, PlanVersionLog } from "@/types";

type EditingPlan = PlanDoc & { note?: string };

export default function AdminPlansClient() {
  const [plans, setPlans] = useState<PlanDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [, startTx] = useTransition();

  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<EditingPlan | null>(null);
  const [openDelete, setOpenDelete] = useState<PlanDoc | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"end-user" | "disabled">("end-user");

  // Plan create form state
  const [form, setForm] = useState({
    name: "",
    price: "",
    hourlyRate: "",
    features: "",
    durationDays: "",
    description: "",
    active: true,
    note: "",
  });

  // Version history drawer
  const [versionPlanId, setVersionPlanId] = useState<string | null>(null);
  const [versions, setVersions] = useState<PlanVersionLog[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  function load() {
    setLoading(true);
    startTx(async () => {
      const res = (await adminListPlansAction()) as any;
      setPlans((res.plans ?? []) as PlanDoc[]);
      setLoading(false);
    });
  }
  useEffect(load, []);

  const sorted = useMemo(
    () =>
      [...plans].sort((a, b) => (a.price ?? 0) - (b.price ?? 0)),
    [plans],
  );

  async function loadVersions(id: string) {
    setVersionPlanId(id);
    setVersionsLoading(true);
    const res = (await adminGetPlanVersionsAction({ planId: id, limit: 50 })) as any;
    if (res.ok) setVersions(res.versions ?? []);
    setVersionsLoading(false);
  }

  function openEdit(p: PlanDoc) {
    setEditing({
      ...p,
      features: (p.features ?? []).join("\n"),
      note: "",
    } as any);
  }

  function resetCreate() {
    setForm({
      name: "",
      price: "",
      hourlyRate: "",
      features: "",
      durationDays: "",
      description: "",
      active: true,
      note: "",
    });
  }

  function parseFeatures(f: string): string[] {
    return f
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  async function handleCreate() {
    if (!form.name || !form.price) return;
    setBusy("create");
    const res = (await adminCreatePlanAction({
      name: form.name,
      price: Number(form.price),
      hourlyRate: Number(form.hourlyRate || 0),
      features: parseFeatures(form.features),
      active: form.active,
      durationDays: form.durationDays ? Number(form.durationDays) : undefined,
      description: form.description || undefined,
      note: form.note || undefined,
    })) as any;
    setBusy(null);
    if (res.ok) {
      setOpenCreate(false);
      resetCreate();
      load();
    }
  }

  async function handleSaveEdit() {
    if (!editing) return;
    const features =
      typeof editing.features === "string"
        ? parseFeatures(editing.features)
        : editing.features ?? [];
    setBusy(`save-${editing.id}`);
    const res = (await adminUpdatePlanAction({
      id: editing.id,
      name: editing.name,
      price: Number(editing.price ?? 0),
      hourlyRate: Number(editing.hourlyRate ?? 0),
      features,
      active: !!editing.active,
      durationDays:
        editing.durationDays !== undefined && editing.durationDays !== null
          ? Number(editing.durationDays)
          : undefined,
      description:
        (editing.description ?? "").toString().trim() || undefined,
      note: (editing as any).note || undefined,
    })) as any;
    setBusy(null);
    if (res.ok) {
      setEditing(null);
      load();
    }
  }

  async function handleDelete() {
    if (!openDelete) return;
    setBusy(`delete-${openDelete.id}`);
    const res = (await adminDeletePlanAction({ id: openDelete.id })) as any;
    setBusy(null);
    if (res.ok) {
      setOpenDelete(null);
      load();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Subscription Plans</h1>
          <p className="mt-1 text-sm text-white/60">
            Create and manage plans. Every save creates a version snapshot.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              onClick={() => setPreviewMode("end-user")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium",
                previewMode === "end-user"
                  ? "bg-apron-gold/20 text-apron-gold border border-apron-gold/40"
                  : "text-white/70 hover:text-white hover:bg-white/5",
              )}
            >
              <Eye size={12} className="inline mr-1" /> End-user preview
            </button>
            <button
              onClick={() => setPreviewMode("disabled")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium",
                previewMode === "disabled"
                  ? "bg-apron-gold/20 text-apron-gold border border-apron-gold/40"
                  : "text-white/70 hover:text-white hover:bg-white/5",
              )}
            >
              Admin edit mode
            </button>
          </div>
          <Button
            size="sm"
            onClick={() => {
              resetCreate();
              setOpenCreate(true);
            }}
          >
            <Plus size={14} /> New plan
          </Button>
        </div>
      </div>

      {loading && sorted.length === 0 ? (
        <Card>
          <CardContent className="text-center text-white/60 py-10 text-sm">
            Loading plans…
          </CardContent>
        </Card>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10">
            <Sparkles size={24} className="mx-auto text-apron-gold mb-2" />
            <div className="text-white/80 font-medium">No plans yet</div>
            <div className="text-xs text-white/50 mt-1">
              Create your first subscription plan above.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              previewMode={previewMode}
              onEdit={() => openEdit(p)}
              onDelete={() => setOpenDelete(p)}
              onHistory={() => loadVersions(p.id)}
            />
          ))}
        </div>
      )}

      <Modal
        open={openCreate}
        onOpenChange={(o) => !o && setOpenCreate(false)}
        title="Create new subscription plan"
        description="All fields are validated. Version 1 will be created automatically."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              loading={busy === "create"}
              disabled={!form.name || !form.price}
            >
              <Save size={14} /> Create plan
            </Button>
          </>
        }
      >
        <PlanEditor
          value={form as any}
          onChange={(f) => setForm(f as any)}
        />
      </Modal>

      <Modal
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title={`Edit plan: ${editing?.name ?? ""}`}
        description="Changes will be saved as a new version snapshot."
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              loading={editing ? busy === `save-${editing.id}` : false}
            >
              <Save size={14} /> Save changes
            </Button>
          </>
        }
      >
        {editing ? (
          <PlanEditor
            value={editing as any}
            onChange={(v) => setEditing({ ...editing, ...v } as any)}
          />
        ) : null}
      </Modal>

      <Modal
        open={!!openDelete}
        onOpenChange={(o) => !o && setOpenDelete(null)}
        title={`Delete plan: ${openDelete?.name ?? ""}`}
        description="Once deleted, this plan will be removed from the shop. Users with active subscriptions may continue on this plan until expiration."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpenDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={openDelete ? busy === `delete-${openDelete.id}` : false}
            >
              <Trash2 size={14} /> Delete plan
            </Button>
          </>
        }
      >
        <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-red-200 text-xs flex items-start gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            This action cannot be undone from the UI. A historical version log
            entry will be recorded.
          </div>
        </div>
      </Modal>

      <Sheet
        open={!!versionPlanId}
        onOpenChange={(o) => !o && setVersionPlanId(null)}
        side="right"
        title="Plan version history"
        description="Every change is recorded with a diff, snapshot, and note."
      >
        {versionPlanId && versionsLoading ? (
          <div className="text-xs text-white/60 py-8 text-center">
            Loading version history…
          </div>
        ) : versions.length === 0 ? (
          <div className="text-xs text-white/60 py-8 text-center">
            No version history recorded for this plan yet.
          </div>
        ) : (
          <ol className="relative border-l border-white/10 ml-3 space-y-6">
            {versions.map((v) => (
              <li key={v.id} className="ml-4">
                <div className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-apron-gold" />
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm font-semibold text-white">
                    v{v.version}
                  </div>
                  <div className="text-[11px] text-white/60 font-mono">
                    {v.id.slice(0, 8)}
                  </div>
                  <div className="text-[11px] text-white/50 ml-auto">
                    {formatDateTime(v.changedAt)}
                  </div>
                </div>
                <div className="text-[11px] text-white/70 mt-0.5">
                  By <span className="text-white/90">{v.changedBy}</span>
                </div>
                {v.note ? (
                  <div className="mt-2 glass !p-2.5 !bg-white/[0.03] text-xs text-white/80 whitespace-pre-wrap break-words">
                    {v.note}
                  </div>
                ) : null}
                {v.diff && Object.keys(v.diff).length ? (
                  <div className="mt-2 space-y-1 text-[11px]">
                    {Object.entries(v.diff as any).map(([k, d]: any) => (
                      <div
                        key={k}
                        className="grid grid-cols-1 gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-2"
                      >
                        <div className="text-white/80 font-medium">{k}</div>
                        <div className="flex items-start gap-2 flex-wrap">
                          <div className="rounded bg-red-500/10 border border-red-400/20 px-2 py-1 text-red-200 break-all max-w-full">
                            <span className="text-[10px] uppercase mr-1 opacity-70">
                              before
                            </span>
                            {typeof d.before === "object"
                              ? JSON.stringify(d.before)
                              : String(d.before ?? "—")}
                          </div>
                          <ChevronRight size={12} className="text-white/30 self-center" />
                          <div className="rounded bg-green-500/10 border border-green-400/20 px-2 py-1 text-green-200 break-all max-w-full">
                            <span className="text-[10px] uppercase mr-1 opacity-70">
                              after
                            </span>
                            {typeof d.after === "object"
                              ? JSON.stringify(d.after)
                              : String(d.after ?? "—")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-white/50">No field diff captured.</div>
                )}
              </li>
            ))}
          </ol>
        )}
      </Sheet>
    </div>
  );
}

type PlanForm = {
  name: string;
  price: number | string;
  hourlyRate: number | string;
  features: string;
  durationDays: number | string;
  description?: string;
  active: boolean;
  note?: string;
};

function PlanEditor({
  value,
  onChange,
}: {
  value: PlanForm;
  onChange: (v: PlanForm) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[11px] uppercase tracking-wide text-white/60 mb-1 block">
            Name
          </label>
          <Input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="e.g. VIP Gold"
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-white/60 mb-1 block">
            Price (NGN)
          </label>
          <Input
            inputMode="numeric"
            value={String(value.price ?? "")}
            onChange={(e) =>
              onChange({
                ...value,
                price: Number(e.target.value.replace(/[^0-9.]/g, "") || 0),
              })
            }
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-white/60 mb-1 block">
            Hourly rate (APN)
          </label>
          <Input
            inputMode="decimal"
            value={String(value.hourlyRate ?? "")}
            onChange={(e) =>
              onChange({
                ...value,
                hourlyRate: Number(e.target.value.replace(/[^0-9.]/g, "") || 0),
              })
            }
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-white/60 mb-1 block">
            Duration (days, optional)
          </label>
          <Input
            inputMode="numeric"
            value={String(value.durationDays ?? "")}
            onChange={(e) =>
              onChange({
                ...value,
                durationDays: Number(e.target.value.replace(/[^0-9]/g, "") || 0),
              })
            }
            placeholder="30 / 90 / 365 (leave empty for lifetime)"
          />
        </div>
      </div>
      <div>
        <label className="text-[11px] uppercase tracking-wide text-white/60 mb-1 block">
          Description (optional)
        </label>
        <Textarea
          rows={2}
          value={value.description ?? ""}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
          placeholder="Short plan description displayed on the pricing page."
        />
      </div>
      <div>
        <label className="text-[11px] uppercase tracking-wide text-white/60 mb-1 block">
          Features (one per line)
        </label>
        <Textarea
          rows={6}
          value={value.features}
          onChange={(e) => onChange({ ...value, features: e.target.value })}
          placeholder={"- Feature one\n- Feature two\n- Feature three"}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="glass !p-3 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-white">Active</div>
            <div className="text-[11px] text-white/50">
              Inactive plans are hidden from the pricing page.
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...value, active: !value.active })}
            className={cn(
              "relative h-6 w-11 rounded-full border transition",
              value.active
                ? "bg-apron-gold/30 border-apron-gold/50"
                : "bg-white/5 border-white/10",
            )}
          >
            <span
              className={cn(
                "absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white transition-transform",
                value.active ? "translate-x-5" : "translate-x-0",
              )}
            />
          </button>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-white/60 mb-1 block">
            Change note (optional)
          </label>
          <Input
            value={value.note ?? ""}
            onChange={(e) => onChange({ ...value, note: e.target.value })}
            placeholder="Why is this change being made?"
          />
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  previewMode,
  onEdit,
  onDelete,
  onHistory,
}: {
  plan: PlanDoc;
  previewMode: "end-user" | "disabled";
  onEdit: () => void;
  onDelete: () => void;
  onHistory: () => void;
}) {
  const priceNgn = Number(plan.price ?? 0);
  const hourly = Number(plan.hourlyRate ?? 0);
  const features =
    typeof plan.features === "string"
      ? [plan.features]
      : (plan.features ?? []);
  return (
    <Card
      className={cn(
        "relative overflow-hidden transition",
        !plan.active ? "opacity-60" : "",
      )}
    >
      {!plan.active ? (
        <div className="absolute top-3 right-3 text-[10px] uppercase px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/70">
          Inactive
        </div>
      ) : null}
      {plan.version ? (
        <div className="absolute top-3 left-3 text-[10px] px-2 py-0.5 rounded-full bg-apron-gold/10 border border-apron-gold/30 text-apron-gold font-semibold">
          v{plan.version}
        </div>
      ) : null}
      <CardHeader className="pt-10">
        <div className="flex items-center gap-2 text-apron-gold">
          <Crown size={18} />
          <CardTitle>{plan.name}</CardTitle>
        </div>
        {plan.description ? (
          <p className="mt-1 text-xs text-white/60 line-clamp-2">{plan.description}</p>
        ) : null}
        <div className="mt-3">
          <div className="text-3xl font-bold text-white">
            {formatNaira(priceNgn)}
            <span className="text-xs text-white/50 font-normal ml-1">
              {plan.durationDays ? `/ ${plan.durationDays}d` : "/ lifetime"}
            </span>
          </div>
          <div className="text-[11px] text-white/50 mt-0.5">
            Earn {formatAPN(hourly)} / hr task rate
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {features.map((f, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2 text-xs text-white/80"
            >
              <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-apron-gold/20 border border-apron-gold/40 mt-0.5">
                <Check size={10} className="text-apron-gold" />
              </span>
              <span className="leading-relaxed break-words">{f}</span>
            </li>
          ))}
        </ul>
        {previewMode === "end-user" ? (
          <div className="mt-4 space-y-1.5">
            <button
              className="w-full h-10 rounded-xl border border-apron-gold/50 bg-apron-gold text-[#1c0b35] text-sm font-semibold hover:brightness-110 transition pointer-events-none select-none"
            >
              Subscribe now
            </button>
            <button
              className="w-full h-9 rounded-xl border border-white/10 bg-white/5 text-white/70 text-xs hover:bg-white/10 transition pointer-events-none select-none"
            >
              Learn more
            </button>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-1.5 flex-wrap">
            <Button size="xs" onClick={onEdit}>
              <Edit2 size={12} /> Edit
            </Button>
            <Button size="xs" variant="outline" onClick={onHistory}>
              <History size={12} /> History
            </Button>
            <Button
              size="xs"
              variant="danger"
              className="ml-auto"
              onClick={onDelete}
            >
              <Trash2 size={12} /> Delete
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
