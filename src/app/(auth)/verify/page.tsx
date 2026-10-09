"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MailCheck, AlertTriangle, RefreshCw, ArrowRight, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
  markEmailVerifiedAction,
  getCurrentSession,
  sendVerificationEmailAction,
} from "@/server/actions/authActions";
import {
  useFirebaseAuth,
  reloadAuthUser,
  signOutClient,
} from "@/hooks/useFirebaseAuth";

export const dynamic = "force-dynamic";

function VerifyContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading: authLoading } = useFirebaseAuth();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [verified, setVerified] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [sendWarn, setSendWarn] = useState<string | null>(null);
  const [directLink, setDirectLink] = useState<string | null>(null);

  useEffect(() => {
    if (!params) return;
    const err = params.get("err");
    const warn = params.get("warn");
    const link = params.get("link");
    if (err) {
      setSendErr(err);
    } else if (warn) {
      setSendWarn(warn);
    } else {
      setMsg("We sent a verification link to your email. Click it to activate your account.");
    }
    if (link) setDirectLink(link);
  }, [params]);

  async function checkStatus() {
    if (!user) return;
    setChecking(true);
    setMsg(null);
    try {
      await reloadAuthUser(user);
      if (user.emailVerified) {
        const sess = await getCurrentSession();
        await markEmailVerifiedAction({ uid: sess?.uid ?? user.uid });
        setVerified(true);
        setTimeout(() => router.push("/dashboard"), 1500);
      } else {
        setMsg("Email not yet verified. Click the link in your inbox.");
      }
    } catch (e: any) {
      setMsg(e?.message ?? "Unable to check status");
    } finally {
      setChecking(false);
    }
  }

  async function handleResend() {
    if (!user || resendCooldown) return;
    setResending(true);
    setSendErr(null);
    setSendWarn(null);
    try {
      const sess = await getCurrentSession();
      const uid = sess?.uid ?? user.uid;
      let idToken: string | undefined;
      try {
        idToken = await user.getIdToken(true);
      } catch {
        idToken = undefined;
      }
      const res: any = await sendVerificationEmailAction({
        idToken,
        uid,
      });
      if (res?.ok) {
        if (res?.directLink) setDirectLink(res.directLink);
        setMsg("Verification email re-sent. Please check your inbox (and spam folder).");
        setSendWarn(res?.warning ?? null);
      } else {
        setSendErr(res?.error ?? "Unable to re-send verification");
        if (res?.directLink) setDirectLink(res.directLink);
      }
      setResendCooldown(true);
      window.setTimeout(() => setResendCooldown(false), 30_000);
    } catch (e: any) {
      setSendErr(e?.message ?? "Unable to re-send verification");
    } finally {
      setResending(false);
    }
  }

  async function handleLogout() {
    await signOutClient();
    router.push("/login");
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center p-10">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-apron-gold border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 pt-2 text-center">
          <AlertTriangle className="h-10 w-10 text-apron-pink" />
          <h2 className="text-xl font-semibold">Not signed in</h2>
          <p className="text-sm text-white/70">
            Please sign in first to verify your email.
          </p>
          <Link href="/login">
            <Button>Go to Sign in</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const headerMsg = sendErr
    ? "We encountered an issue sending your verification email"
    : sendWarn
    ? "Verification email may not have been delivered"
    : `We sent a verification link to ${user.email}. Click it to activate your account.`;

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-apron-gold/15 border border-apron-gold/30 text-apron-gold">
          <MailCheck size={26} />
        </div>
        <h1 className="text-2xl font-bold text-white">Verify your email</h1>
        <p className="mt-1 text-sm text-white/60">
          {headerMsg}
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2">
            {verified ? (
              <>
                <div className="h-12 w-12 rounded-full bg-green-500/15 border border-green-400/40 text-green-300 flex items-center justify-center">
                  <span className="text-2xl">✓</span>
                </div>
                <h3 className="text-lg font-semibold">Verified! Redirecting…</h3>
                <Link href="/dashboard">
                  <Button size="sm" className="mt-2">
                    Go to Dashboard <ArrowRight size={16} />
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-apron-gold/30 border-t-apron-gold animate-spin" />
                <h3 className="text-lg font-semibold">Waiting for verification…</h3>
                <p className="text-sm text-center text-white/70 max-w-xs">
                  Click the link in your email, then press "Check status" below.
                </p>
              </>
            )}
          </div>

          {sendErr ? (
            <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200 flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="font-medium">Send error</div>
                <div className="opacity-90 mt-0.5">{sendErr}</div>
                <div className="opacity-80 mt-1 text-xs">
                  Try again below. If the issue persists, use the emergency verification link (if available) or contact support.
                </div>
              </div>
            </div>
          ) : null}

          {sendWarn && !sendErr ? (
            <div className="rounded-xl border border-apron-gold/30 bg-apron-gold/5 p-3 text-sm flex items-start gap-2 text-apron-gold/90">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="font-medium">{sendWarn}</div>
                <div className="opacity-80 mt-0.5 text-xs">
                  Use the emergency link below or try resending.
                </div>
              </div>
            </div>
          ) : null}

          {directLink ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-white/90">
                <ExternalLink size={16} className="text-apron-gold" />
                Emergency verification link
              </div>
              <div className="break-all rounded-lg border border-white/10 bg-black/30 p-2 text-xs text-white/70">
                {directLink}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between pt-1">
                <p className="text-[11px] text-white/50">
                  Use only if email delivery failed. Clicking this link completes verification.
                </p>
                <a
                  href={directLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-gold h-9 px-3 text-xs inline-flex items-center justify-center w-full sm:w-auto"
                >
                  Open verification link
                </a>
              </div>
            </div>
          ) : null}

          {msg && !sendErr ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/80 text-center">
              {msg}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Button variant="primary" onClick={checkStatus} loading={checking} disabled={verified}>
              <RefreshCw size={16} className={checking ? "animate-spin" : ""} />
              Check status
            </Button>
            <Button variant="primary" onClick={handleResend} loading={resending} disabled={verified || resendCooldown}>
              Resend email
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-sm text-white/50">
        Wrong account?{" "}
        <button onClick={handleLogout} className="text-apron-gold hover:underline">
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyContent />
    </Suspense>
  );
}
