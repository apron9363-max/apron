"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  FileText,
  Banknote,
  Shield,
  Settings as SettingsIcon,
  Crown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  adminGetReferralBonusAction,
  adminUpdateSettingsAction,
} from "@/server/actions/adminActions";
import { formatDateTime, cn } from "@/lib/utils";
import type { SettingsDoc } from "@/types";

type FormState = {
  referralBonus: string;
  withdrawalFeePct: string;
  withdrawalProcessingFeePct: string;
  minWithdrawal: string;
  maxWithdrawal: string;
  duplicateWithdrawalWindowMs: string;
  maxBankAccounts: string;
  note: string;
};

const DEFAULTS: FormState = {
  referralBonus: "500",
  withdrawalFeePct: "0.05",
  withdrawalProcessingFeePct: "0.01",
  minWithdrawal: "1000",
  maxWithdrawal: "500000",
  duplicateWithdrawalWindowMs: "60000",
  maxBankAccounts: "5",
  note: "",
};

export default function AdminSettingsClient() {
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [initial, setInitial] = useState<FormState>(DEFAULTS);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [, startTx] = useTransition();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  function load() {
    setLoading(true);
    startTx(async () => {
      const res = (await adminGetReferralBonusAction()) as any;
      if (res.ok) {
        const s = (res.settings ?? {}) as SettingsDoc;
        const next: FormState = {
          referralBonus: String(s.referralBonus ?? DEFAULTS.referralBonus),
          withdrawalFeePct: String(s.withdrawalFeePct ?? DEFAULTS.withdrawalFeePct),
          withdrawalProcessingFeePct: String(
            s.withdrawalProcessingFeePct ?? DEFAULTS.withdrawalProcessingFeePct,
          ),
          minWithdrawal: String(s.minWithdrawal ?? DEFAULTS.minWithdrawal),
          maxWithdrawal: String(s.maxWithdrawal ?? DEFAULTS.maxWithdrawal),
          duplicateWithdrawalWindowMs: String(
            s.duplicateWithdrawalWindowMs ?? DEFAULTS.duplicateWithdrawalWindowMs,
          ),
          maxBankAccounts: String(s.maxBankAccounts ?? DEFAULTS.maxBankAccounts),
          note: "",
        };
        setForm(next);
        setInitial(next);
        setUpdatedAt(s.updatedAt ?? null);
        setUpdatedBy(s.updatedBy ?? null);
      }
      setLoading(false);
    });
  }
  useEffect(load, []);

  const dirty =
    form.referralBonus !== initial.referralBonus ||
    form.withdrawalFeePct !== initial.withdrawalFeePct ||
    form.withdrawalProcessingFeePct !== initial.withdrawalProcessingFeePct ||
    form.minWithdrawal !== initial.minWithdrawal ||
    form.maxWithdrawal !== initial.maxWithdrawal ||
    form.duplicateWithdrawalWindowMs !== initial.duplicateWithdrawalWindowMs ||
    form.maxBankAccounts !== initial.maxBankAccounts;

  const validation = validate(form);

  async function handleSave() {
    if (!validation.ok) {
      setToast({ ok: false, message: validation.errors.join(" · ") });
      return;
    }
    setSaving(true);
    const payload: any = {};
    (["referralBonus", "withdrawalFeePct", "withdrawalProcessingFeePct",
      "minWithdrawal", "maxWithdrawal", "duplicateWithdrawalWindowMs", "maxBankAccounts"] as const).forEach(
      (k) => {
        if (form[k] !== initial[k]) payload[k] = Number(form[k]);
      },
    );
    if (form.note.trim()) payload.note = form.note.trim();
    const res = (await adminUpdateSettingsAction(payload)) as any;
    setSaving(false);
    if (res.ok) {
      setToast({ ok: true, message: "Settings saved. Audit log entry created." });
      load();
    } else {
      setToast({ ok: false, message: res.error ?? "Failed to save settings." });
    }
    setTimeout(() => setToast(null), 4500);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <SettingsIcon size={20} className="text-apron-gold" />
            Platform settings
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Adjust platform-wide constants. Every save writes an admin audit log entry.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {updatedAt ? (
            <div className="text-[11px] text-white/50">
              Last saved {formatDateTime(updatedAt)}
              {updatedBy ? <> by <span className="font-mono text-white/70">{updatedBy.slice(0, 8)}…</span></> : null}
            </div>
          ) : null}
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw size={12} /> Reload
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            loading={saving || loading}
            disabled={!dirty || !validation.ok}
          >
            <Save size={14} /> Save changes
          </Button>
        </div>
      </div>

      {toast ? (
        <div
          className={cn(
            "rounded-xl border p-3 text-xs flex items-start gap-2",
            toast.ok
              ? "bg-green-500/10 border-green-400/30 text-green-200"
              : "bg-red-500/10 border-red-400/30 text-red-200",
          )}
        >
          {toast.ok ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <AlertCircle size={14} className="shrink-0 mt-0.5" />}
          <div className="flex-1">{toast.message}</div>
          <button onClick={() => setToast(null)} className="text-white/50 hover:text-white">
            <X size={14} />
          </button>
        </div>
      ) : null}

      {!validation.ok && validation.errors.length > 0 ? (
        <div className="rounded-xl border border-yellow-400/20 bg-yellow-500/10 p-3 text-xs text-yellow-200 flex items-start gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <ul className="list-disc list-inside space-y-0.5">
            {validation.errors.map((e, idx) => (
              <li key={idx}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-apron-gold/10 border border-apron-gold/30 text-apron-gold">
              <Sparkles size={16} />
            </span>
            <div>
              <CardTitle>Referral & bonuses</CardTitle>
              <p className="mt-0.5 text-xs text-white/60">
                Earned when a referred user first subscribes.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <NumField
              label="Referral bonus (APN)"
              sub="Credited to referrer on referee's first purchase."
              value={form.referralBonus}
              onChange={(v) => setForm({ ...form, referralBonus: v })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-apron-pink">
              <Banknote size={16} />
            </span>
            <div>
              <CardTitle>Withdrawal limits & fees</CardTitle>
              <p className="mt-0.5 text-xs text-white/60">
                Platform and processing fees apply to every payout.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <NumField
                label="Platform fee %"
                sub="e.g. 0.05 = 5% of the requested amount."
                decimals
                value={form.withdrawalFeePct}
                onChange={(v) => setForm({ ...form, withdrawalFeePct: v })}
                suffix="%"
              />
              <NumField
                label="Processing fee %"
                sub="Paid to the underlying bank processor."
                decimals
                value={form.withdrawalProcessingFeePct}
                onChange={(v) => setForm({ ...form, withdrawalProcessingFeePct: v })}
                suffix="%"
              />
              <NumField
                label="Minimum withdrawal (NGN)"
                sub="Requests below this amount are rejected."
                value={form.minWithdrawal}
                onChange={(v) => setForm({ ...form, minWithdrawal: v })}
                suffix="₦"
              />
              <NumField
                label="Maximum withdrawal (NGN)"
                sub="Single-request ceiling."
                value={form.maxWithdrawal}
                onChange={(v) => setForm({ ...form, maxWithdrawal: v })}
                suffix="₦"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <NumField
                label="Duplicate window (ms)"
                sub="Prevent identical (user, amount, bank) requests within this window."
                value={form.duplicateWithdrawalWindowMs}
                onChange={(v) => setForm({ ...form, duplicateWithdrawalWindowMs: v })}
              />
              <NumField
                label="Max bank accounts / user"
                sub="Users can add and remove accounts up to this cap."
                value={form.maxBankAccounts}
                onChange={(v) => setForm({ ...form, maxBankAccounts: v })}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-apron-gold/10 border border-apron-gold/30 text-apron-gold">
              <Shield size={16} />
            </span>
            <div>
              <CardTitle>Change note</CardTitle>
              <p className="mt-0.5 text-xs text-white/60">
                Saved to the admin audit log along with the field-level diff.
              </p>
            </div>
            <div className="ml-auto">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase",
                  dirty
                    ? "border-apron-gold/40 bg-apron-gold/10 text-apron-gold"
                    : "border-white/10 bg-white/5 text-white/50",
                )}
              >
                <FileText size={10} /> {dirty ? "Unsaved changes" : "In sync"}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={3}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Optional note explaining why these settings are being changed (recommended for audit trail)…"
            />
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3 text-[11px] text-white/60">
              <InfoTile
                icon={Crown}
                label="Estimated total fee"
                value={`${((Number(form.withdrawalFeePct ?? 0) + Number(form.withdrawalProcessingFeePct ?? 0)) * 100).toFixed(2)}%`}
                accent="text-apron-gold"
              />
              <InfoTile
                icon={Banknote}
                label="Allowed per request"
                value={`₦${Number(form.minWithdrawal ?? 0).toLocaleString()} – ₦${Number(form.maxWithdrawal ?? 0).toLocaleString()}`}
                accent="text-white/90"
              />
              <InfoTile
                icon={Shield}
                label="Duplicate prevention"
                value={`${Math.round(Number(form.duplicateWithdrawalWindowMs ?? 0) / 1000)} seconds`}
                accent="text-apron-pink"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function validate(form: FormState): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const num = (s: string) => Number(s);
  if (!isFinite(num(form.referralBonus)) || num(form.referralBonus) < 0)
    errors.push("Referral bonus must be a number >= 0.");
  const fee = num(form.withdrawalFeePct);
  const pfee = num(form.withdrawalProcessingFeePct);
  if (!isFinite(fee) || fee < 0 || fee >= 1) errors.push("Platform fee must be between 0 and 1 (e.g. 0.05 for 5%).");
  if (!isFinite(pfee) || pfee < 0 || pfee >= 1) errors.push("Processing fee must be between 0 and 1.");
  if (fee + pfee >= 1) errors.push("Combined platform + processing fees must be under 100%.");
  const minW = num(form.minWithdrawal);
  const maxW = num(form.maxWithdrawal);
  if (!isFinite(minW) || minW <= 0) errors.push("Minimum withdrawal must be greater than 0.");
  if (!isFinite(maxW) || maxW <= minW) errors.push("Maximum withdrawal must be greater than minimum.");
  const dup = num(form.duplicateWithdrawalWindowMs);
  if (!isFinite(dup) || dup < 0 || dup > 24 * 3600 * 1000) errors.push("Duplicate window must be a reasonable ms value (0–86,400,000).");
  const mb = num(form.maxBankAccounts);
  if (!isFinite(mb) || mb < 1 || mb > 20) errors.push("Max bank accounts must be between 1 and 20.");
  return { ok: errors.length === 0, errors };
}

function NumField({
  label,
  sub,
  value,
  onChange,
  suffix,
  decimals,
}: {
  label: string;
  sub?: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  decimals?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wide text-white/60 mb-1 block flex items-center justify-between gap-2">
        <span>{label}</span>
        {suffix ? <span className="text-white/50">{suffix}</span> : null}
      </label>
      <Input
        inputMode={decimals ? "decimal" : "numeric"}
        value={value}
        onChange={(e) => onChange(decimals ? e.target.value.replace(/[^0-9.]/g, "") : e.target.value.replace(/[^0-9]/g, ""))}
      />
      {sub ? <div className="mt-1 text-[10px] text-white/50">{sub}</div> : null}
    </div>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<any>;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="glass !p-3 flex items-center gap-2">
      <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/10", accent)}>
        <Icon size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-white/50">{label}</div>
        <div className={cn("text-sm font-semibold truncate", accent)}>{value}</div>
      </div>
    </div>
  );
}

function X({ size }: { size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}
