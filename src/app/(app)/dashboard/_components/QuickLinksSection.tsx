"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  HelpCircle,
  ClipboardList,
  Trophy,
  Banknote,
  Wallet,
  Gift,
  Crown,
  GraduationCap,
  Share2,
  History,
  Sparkles,
  Coins,
  UserPlus,
  Home,
  Settings,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { saveQuickLinksAction } from "@/server/actions/userActions";
import {
  ALLOWED_QUICKLINK_ICON_NAMES,
  saveQuickLinksSchema,
} from "@/lib/validations/schemas";
import type { QuickLink } from "@/types";
import type { LucideIcon } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

const ICON_MAP: Record<string, LucideIcon> = {
  HelpCircle,
  ClipboardList,
  Trophy,
  Banknote,
  Wallet,
  Gift,
  Crown,
  GraduationCap,
  Share2,
  History,
  Sparkles,
  Coins,
  UserPlus,
  Home,
  Settings,
};

interface QuickLinksSectionProps {
  initial: QuickLink[];
  userId: string;
}

export function QuickLinksSection({ initial }: QuickLinksSectionProps) {
  const [links, setLinks] = useState<QuickLink[]>(initial);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [isPending, startTx] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const persist = useCallback(
    (next: QuickLink[]) => {
      const reordered = next.map((l, i) => ({ ...l, order: i }));
      setLinks(reordered);
      startTx(async () => {
        try {
          const parsed = saveQuickLinksSchema.safeParse({ links: reordered });
          if (!parsed.success) {
            const flat = (parsed.error as any).flatten?.();
            toast({
              title: "Validation error",
              description: flat ? JSON.stringify(flat.fieldErrors) : "Invalid quick links",
              variant: "error",
            });
            return;
          }
          const res = await saveQuickLinksAction({ links: reordered });
          if (res.ok) {
            toast({
              title: "Quick links saved",
              variant: "success",
              duration: 2000,
            });
            router.refresh();
          } else {
            toast({
              title: "Save failed",
              description:
                typeof res.error === "string" ? res.error : "Please try again.",
              variant: "error",
            });
          }
        } catch (e: any) {
          toast({
            title: "Save failed",
            description: e?.message ?? "Unexpected error",
            variant: "error",
          });
        }
      });
    },
    [startTx, toast, router],
  );

  const moveUp = (id: string) => {
    const idx = links.findIndex((l) => l.id === id);
    if (idx <= 0) return;
    const next = links.slice();
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    persist(next);
  };

  const moveDown = (id: string) => {
    const idx = links.findIndex((l) => l.id === id);
    if (idx < 0 || idx >= links.length - 1) return;
    const next = links.slice();
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    persist(next);
  };

  const removeLink = (id: string) => {
    const next = links.filter((l) => l.id !== id);
    persist(next);
    if (selectedId === id) setSelectedId(null);
  };

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const from = links.findIndex((l) => l.id === dragId);
    const to = links.findIndex((l) => l.id === targetId);
    if (from < 0 || to < 0) return;
    const next = links.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDragId(null);
    persist(next);
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
          Quick Links
        </h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              setEditMode((e) => !e);
              setSelectedId(null);
            }}
          >
            {editMode ? "Done" : "Edit mode"}
          </Button>
          {editMode ? (
            <Button
              type="button"
              variant="primary"
              size="xs"
              disabled={isPending || links.length >= 12}
              onClick={() => setAddOpen(true)}
            >
              <Plus size={14} /> Add
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {links.map((link) => {
          const Icon = ICON_MAP[link.iconName] ?? Sparkles;
          const selected = selectedId === link.id;
          const idx = links.findIndex((l) => l.id === link.id);
          const cardEl = (
            <div
              key={link.id}
              draggable={editMode}
              onDragStart={() => setDragId(link.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(link.id);
              }}
              onClick={() => {
                if (editMode) {
                  setSelectedId(selected ? null : link.id);
                }
              }}
              className={
                "glass !p-4 flex items-center gap-3 glass-hover relative" +
                (editMode ? " cursor-pointer" : "") +
                (selected ? " ring-2 ring-apron-gold" : "")
              }
            >
              {editMode ? (
                <div className="absolute top-1.5 left-1.5 text-white/40 cursor-grab active:cursor-grabbing">
                  <GripVertical size={12} />
                </div>
              ) : null}
              {editMode ? (
                <button
                  type="button"
                  aria-label="Remove quick link"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeLink(link.id);
                  }}
                  className="absolute top-1.5 right-1.5 h-6 w-6 flex items-center justify-center rounded-lg text-white/60 hover:text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 size={13} />
                </button>
              ) : null}
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/15 text-apron-gold">
                <Icon size={18} />
              </span>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-semibold text-white truncate">
                  {link.label}
                </span>
                <span className="text-[11px] text-white/60 truncate">
                  {editMode
                    ? selected
                      ? "Selected"
                      : "Tap to select"
                    : "Tap to open"}
                </span>
              </div>
              {editMode && selected ? (
                <div className="flex flex-col gap-1 ml-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label="Move up"
                    disabled={idx === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveUp(link.id);
                    }}
                  >
                    <ArrowUp size={12} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label="Move down"
                    disabled={idx === links.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveDown(link.id);
                    }}
                  >
                    <ArrowDown size={12} />
                  </Button>
                </div>
              ) : null}
            </div>
          );
          return editMode ? (
            cardEl
          ) : (
            <Link
              key={link.id}
              href={link.href}
              target={
                link.href.startsWith("https://") ? "_blank" : undefined
              }
              rel={
                link.href.startsWith("https://")
                  ? "noopener noreferrer"
                  : undefined
              }
            >
              {cardEl}
            </Link>
          );
        })}
      </div>
      <AddQuickLinkModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={(nl) => {
          const id = uuidv4().replace(/-/g, "").slice(0, 16);
          const newLink: QuickLink = {
            ...nl,
            id,
            order: links.length,
            custom: true,
          };
          persist([...links, newLink]);
          setAddOpen(false);
        }}
      />
    </section>
  );
}

interface AddQuickLinkModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (l: { href: string; label: string; iconName: string }) => void;
}

function AddQuickLinkModal({ open, onClose, onSave }: AddQuickLinkModalProps) {
  const [label, setLabel] = useState("");
  const [href, setHref] = useState("");
  const [iconName, setIconName] = useState<string>("Sparkles");
  const [errors, setErrors] = useState<{
    label?: string;
    href?: string;
  }>({});
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setLabel("");
      setHref("");
      setIconName("Sparkles");
      setErrors({});
    }
  }, [open]);

  const submit = () => {
    const e: typeof errors = {};
    if (!label.trim() || label.length > 40)
      e.label = "Label required (max 40 chars)";
    if (!href.trim() || (!href.startsWith("/") && !href.startsWith("https://"))) {
      e.href = "Must start with / or https://";
    }
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast({
        title: "Please fix errors",
        variant: "warning",
      });
      return;
    }
    onSave({ href: href.trim(), label: label.trim(), iconName });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Quick Link"
      description="Create a shortcut to any page."
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={submit}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-white/60 mb-1">Label</label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Tasks"
            maxLength={40}
          />
          {errors.label ? (
            <p className="mt-1 text-xs text-red-400">{errors.label}</p>
          ) : null}
        </div>
        <div>
          <label className="block text-xs text-white/60 mb-1">Link</label>
          <Input
            value={href}
            onChange={(e) => setHref(e.target.value)}
            placeholder="/tasks or https://…"
          />
          {errors.href ? (
            <p className="mt-1 text-xs text-red-400">{errors.href}</p>
          ) : null}
        </div>
        <div>
          <label className="block text-xs text-white/60 mb-1.5">Icon</label>
          <div className="grid grid-cols-5 gap-2">
            {ALLOWED_QUICKLINK_ICON_NAMES.map((name) => {
              const Icon = ICON_MAP[name] ?? Sparkles;
              const active = iconName === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setIconName(name)}
                  aria-label={`Icon ${name}`}
                  aria-pressed={active}
                  className={
                    "h-9 w-9 flex items-center justify-center rounded-lg border text-white/80 hover:text-apron-gold transition-colors" +
                    (active
                      ? " border-apron-gold bg-apron-gold/10 text-apron-gold"
                      : " border-white/10 bg-white/5")
                  }
                >
                  <Icon size={16} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default QuickLinksSection;
