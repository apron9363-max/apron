"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Ban,
  UserCheck,
  Edit2,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import {
  adminListUsersAction,
  adminSetUserStatusAction,
  adminSetUserRoleAction,
  adminExportUsersCsvAction,
} from "@/server/actions/adminActions";
import { formatAPN, formatDateTime, cn } from "@/lib/utils";
import type { UserDoc } from "@/types";
import { Crown } from "lucide-react";

const PAGE_SIZE = 10;
const PAGE_SIZES = [10, 25, 50, 100];

const SORTS = [
  { by: "createdAt", label: "Joined", dir: "desc" as const },
  { by: "balance", label: "Balance", dir: "desc" as const },
  { by: "name", label: "Name (A→Z)", dir: "asc" as const },
  { by: "name", label: "Name (Z→A)", dir: "desc" as const },
  { by: "plan", label: "Plan", dir: "asc" as const },
] as const;

type Sort = (typeof SORTS)[number];

export default function AdminUsersClient() {
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE);
  const [sort, setSort] = useState<Sort>(SORTS[0]);
  const [, startTx] = useTransition();

  const [openBan, setOpenBan] = useState<{ user: UserDoc } | null>(null);
  const [banReason, setBanReason] = useState("");
  const [openRole, setOpenRole] = useState<{ user: UserDoc } | null>(null);
  const [roleInput, setRoleInput] = useState<UserDoc["role"]>("user");
  const [busy, setBusy] = useState<string | null>(null);

  const effectiveSearch = query.trim();

  const refresh = useCallback(() => {
    setLoading(true);
    startTx(async () => {
      const res = await adminListUsersAction({
        search: effectiveSearch || undefined,
        status: statusFilter === "all" ? undefined : (statusFilter as any),
        role: roleFilter === "all" ? undefined : (roleFilter as any),
        sortBy: sort.by,
        sortDir: sort.dir,
        limit: pageSize,
        offset: page * pageSize,
      });
      const r = res as any;
      setUsers((r.users ?? []) as UserDoc[]);
      setTotal((prev) => r.total ?? prev ?? users.length);
      setLoading(false);
    });
  }, [effectiveSearch, statusFilter, roleFilter, sort.by, sort.dir, pageSize, page, users.length]);

  useEffect(refresh, [refresh]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function resetPageAndRefresh() {
    setPage(0);
    refresh();
  }

  async function handleToggleStatus(user: UserDoc, to: UserDoc["status"]) {
    setBusy(`status-${user.uid}`);
    const note = banReason.trim() || undefined;
    if (to === "banned" && (!note || note.length < 2)) {
      // reason required
    }
    const res = await adminSetUserStatusAction({
      uid: user.uid,
      status: to,
      reason: note,
    } as any);
    setBusy(null);
    if ((res as any).ok) {
      setOpenBan(null);
      setBanReason("");
      refresh();
    }
  }

  async function handleSaveRole() {
    if (!openRole) return;
    setBusy(`role-${openRole.user.uid}`);
    const res = await adminSetUserRoleAction({
      uid: openRole.user.uid,
      role: roleInput,
    });
    setBusy(null);
    if ((res as any).ok) {
      setOpenRole(null);
      refresh();
    }
  }

  async function handleExportCsv() {
    const res = await adminExportUsersCsvAction({
      search: effectiveSearch || undefined,
      status: statusFilter === "all" ? undefined : (statusFilter as any),
      role: roleFilter === "all" ? undefined : (roleFilter as any),
    });
    const r = res as any;
    if (!r.ok) return;
    const blob = new Blob([r.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = r.filename || `users-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const sortLabel = SORTS.find(
    (s) => s.by === sort.by && s.dir === sort.dir,
  )?.label;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="mt-1 text-sm text-white/60">
            Manage users, roles, and account status.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
            />
            <Input
              placeholder="Search name, email, uid, referral…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && resetPageAndRefresh()}
              className="pl-9 h-9 min-w-[220px]"
            />
          </div>
          <Button size="sm" onClick={resetPageAndRefresh}>
            <Search size={14} /> Search
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportCsv}>
            <Download size={14} /> CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-wide text-white/50 flex items-center gap-1">
              <Filter size={12} /> Filters
            </span>
            <Select
              className="h-8 text-xs min-w-[120px]"
              value={statusFilter}
              options={[
                { value: "all", label: "All statuses" },
                { value: "active", label: "Active" },
                { value: "banned", label: "Banned" },
                { value: "pending", label: "Pending" },
              ]}
              onChange={(v) => {
                setStatusFilter(v as string);
                setPage(0);
              }}
            />
            <Select
              className="h-8 text-xs min-w-[120px]"
              value={roleFilter}
              options={[
                { value: "all", label: "All roles" },
                { value: "user", label: "User" },
                { value: "vip", label: "VIP" },
                { value: "admin", label: "Admin" },
              ]}
              onChange={(v) => {
                setRoleFilter(v as string);
                setPage(0);
              }}
            />
            <Select
              className="h-8 text-xs min-w-[150px]"
              value={sortLabel ?? SORTS[0].label}
              options={SORTS.map((s) => ({
                value: `${s.by}|${s.dir}`,
                label: s.label,
              }))}
              onChange={(v) => {
                const [by, dir] = v.split("|");
                setSort({
                  by: by as Sort["by"],
                  dir: (dir === "asc" ? "asc" : "desc") as Sort["dir"],
                  label: SORTS.find((s) => `${s.by}|${s.dir}` === v)!.label,
                } as any);
                setPage(0);
              }}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-white/60">
            <span>{total.toLocaleString()} total</span>
            <Select
              className="h-8 w-[96px] text-xs"
              value={String(pageSize)}
              options={PAGE_SIZES.map((s) => ({ value: String(s), label: `${s} / pg` }))}
              onChange={(v) => {
                setPageSize(Number(v));
                setPage(0);
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-white/50 border-b border-white/5">
                  <th className="py-2.5 pr-2 min-w-[220px]">User</th>
                  <th className="py-2.5 pr-2 min-w-[100px]">
                    <button
                      className="inline-flex items-center gap-0.5 hover:text-white/80"
                      onClick={() => setSort({ by: "plan", dir: "asc", label: "Plan" } as any)}
                    >
                      Plan {sort.by === "plan" ? (sort.dir === "asc" ? <ChevronUp size={10} /> : <ChevronDown size={10} />) : null}
                    </button>
                  </th>
                  <th className="py-2.5 pr-2">Role</th>
                  <th className="py-2.5 pr-2">Status</th>
                  <th className="py-2.5 pr-2">Joined</th>
                  <th className="py-2.5 pr-2 text-right">Balance</th>
                  <th className="py-2.5 pr-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-white/50 py-8 text-sm">
                      Loading users…
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-white/50 py-8 text-sm">
                      No users match your filters.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.uid} className="border-t border-white/5 hover:bg-white/[0.02]">
                      <td className="py-3 pr-2">
                        <Link href={`/admin/users/${u.uid}`} className="flex items-center gap-2 -mx-2 px-2 py-1 rounded-lg hover:bg-white/5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white shrink-0">
                            {u.name.slice(0, 1).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-white">{u.name}</div>
                            <div className="truncate text-[11px] text-white/50">
                              {u.email} {u.phone ? ` · ${u.phone}` : null}
                            </div>
                            <div className="truncate text-[10px] text-white/40 font-mono">{u.uid.slice(0, 12)}…</div>
                          </div>
                        </Link>
                      </td>
                      <td className="py-3 pr-2 text-xs text-white/80 capitalize">
                        <span className="inline-flex items-center gap-1">
                          <Crown size={12} className="text-apron-gold" />
                          {u.plan}
                        </span>
                      </td>
                      <td className="py-3 pr-2">
                        <button
                          onClick={() => {
                            setOpenRole({ user: u });
                            setRoleInput(u.role);
                          }}
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase border",
                            u.role === "admin"
                              ? "bg-apron-gold/15 text-apron-gold border-apron-gold/30"
                              : u.role === "vip"
                              ? "bg-apron-pink/15 text-apron-pink border-apron-pink/30"
                              : "bg-white/5 text-white/70 border-white/10",
                          )}
                        >
                          {u.role}
                        </button>
                      </td>
                      <td className="py-3 pr-2">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase border",
                            u.status === "banned"
                              ? "bg-red-500/15 text-red-300 border-red-400/30"
                              : u.status === "pending"
                              ? "bg-yellow-500/15 text-yellow-300 border-yellow-400/30"
                              : "bg-green-500/15 text-green-300 border-green-400/30",
                          )}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3 pr-2 text-xs text-white/60">{formatDateTime(u.createdAt)}</td>
                      <td className="py-3 pr-2 text-right text-xs font-medium text-white">
                        {formatAPN(u.balance)}
                      </td>
                      <td className="py-3 pr-2 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Link href={`/admin/users/${u.uid}`}>
                            <Button size="xs" variant="outline">
                              <Edit2 size={12} /> Edit
                            </Button>
                          </Link>
                          {u.status === "banned" ? (
                            <Button
                              size="xs"
                              variant="outline"
                              className="text-green-300 border-green-400/30 hover:bg-green-500/10"
                              onClick={() => handleToggleStatus(u, "active")}
                              loading={busy === `status-${u.uid}`}
                            >
                              <UserCheck size={12} /> Unban
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              variant="danger"
                              onClick={() => {
                                setOpenBan({ user: u });
                                setBanReason("");
                              }}
                              loading={busy === `status-${u.uid}`}
                            >
                              <Ban size={12} /> Ban
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs text-white/60">
              Showing {page * pageSize + (users.length === 0 ? 0 : 1)}–{Math.min(total, (page + 1) * pageSize)} of {total.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="xs"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft size={14} /> Prev
              </Button>
              <span className="text-xs text-white/60 px-2">
                {page + 1} / {totalPages}
              </span>
              <Button
                size="xs"
                variant="outline"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                Next <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Modal
        open={!!openBan}
        onOpenChange={(o) => !o && setOpenBan(null)}
        title={
          openBan
            ? `Ban user ${openBan.user.name}`
            : "Ban user"
        }
        description="Please provide a reason — this action is audited and can be reversed later."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpenBan(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy === `status-${openBan?.user.uid}`}
              onClick={() => openBan && handleToggleStatus(openBan.user, "banned")}
              disabled={!banReason.trim() || banReason.trim().length < 2}
            >
              <Ban size={14} /> Confirm ban
            </Button>
          </>
        }
      >
        <Textarea
          rows={4}
          placeholder="Reason for the ban (minimum 2 chars)…"
          value={banReason}
          onChange={(e) => setBanReason(e.target.value)}
        />
        {banReason.trim() && banReason.trim().length < 2 ? (
          <div className="mt-2 text-[11px] text-red-300">Please enter a valid reason.</div>
        ) : null}
      </Modal>

      <Modal
        open={!!openRole}
        onOpenChange={(o) => !o && setOpenRole(null)}
        title={`Change role: ${openRole?.user.name ?? ""}`}
        description="Promote or demote a user. You cannot demote yourself to a non-admin role from the list UI."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpenRole(null)}>Cancel</Button>
            <Button loading={busy === `role-${openRole?.user.uid}`} onClick={handleSaveRole}>
              Save role
            </Button>
          </>
        }
      >
        <Select
          value={roleInput}
          options={[
            { value: "user", label: "User" },
            { value: "vip", label: "VIP" },
            { value: "admin", label: "Admin" },
          ]}
          onChange={(v) => setRoleInput(v as UserDoc["role"])}
        />
      </Modal>
    </div>
  );
}
