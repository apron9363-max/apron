"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  UserCheck,
  MessageCircle,
  Twitter,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatAPN } from "@/lib/utils";
import {
  incrementReferralClickAction,
  refreshDashboardRateAction,
} from "@/server/actions/userActions";

export function HeroRateRefresh() {
  const [, startTx] = useTransition();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 ml-1"
      aria-label="Refresh rate"
      type="button"
      disabled={loading}
      onClick={() => {
        setLoading(true);
        startTx(async () => {
          try {
            const res = await refreshDashboardRateAction();
            if (res.ok) {
              router.refresh();
              toast({
                title: "Rate refreshed",
                description: `Current: ${formatAPN(res.data.apnRate)}/hr`,
                variant: "success",
                duration: 2500,
              });
            } else {
              toast({
                title: "Refresh failed",
                description: res.error,
                variant: "error",
              });
            }
          } finally {
            setLoading(false);
          }
        });
      }}
    >
      <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
    </Button>
  );
}

export function CopyReferral({ text }: { text: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    let ok = false;
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(text);
        ok = true;
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      }
    } catch {
      ok = false;
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast({
        title: "Link copied",
        description: text,
        variant: "success",
      });
    } else {
      toast({
        title: "Copy failed",
        description: "Please copy manually.",
        variant: "error",
      });
    }
  }

  return (
    <>
      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied to clipboard" : ""}
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleCopy}
        className="shrink-0"
      >
        {copied ? (
          <>
            <UserCheck size={14} /> Copied
          </>
        ) : (
          <>
            <ClipboardList size={14} /> Copy
          </>
        )}
      </Button>
    </>
  );
}

export function ReferralShareWhatsApp({ text }: { text: string }) {
  const [, startTx] = useTransition();
  const href = `https://wa.me/?text=${encodeURIComponent(
    "Join Apron with my referral: " + text,
  )}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        startTx(async () => {
          try {
            await incrementReferralClickAction();
          } catch {
            // ignore
          }
        });
      }}
    >
      <Button variant="outline" size="sm" type="button" className="gap-1.5">
        <MessageCircle size={14} /> WhatsApp
      </Button>
    </a>
  );
}

export function ReferralShareTwitter({ text }: { text: string }) {
  const [, startTx] = useTransition();
  const href = `https://twitter.com/intent/tweet?url=${encodeURIComponent(
    text,
  )}&text=Join+Apron+earn+daily+APN`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        startTx(async () => {
          try {
            await incrementReferralClickAction();
          } catch {
            // ignore
          }
        });
      }}
    >
      <Button variant="outline" size="sm" type="button" className="gap-1.5">
        <Twitter size={14} /> Twitter
      </Button>
    </a>
  );
}
