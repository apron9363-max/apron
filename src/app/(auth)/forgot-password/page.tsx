"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { sendPasswordResetEmail } from "firebase/auth";
import { getClientAuth } from "@/firebase/client";
import { SITE_URL } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

const forgotSchema = z.object({
  email: z.string().email("Enter a valid email"),
});
type ForgotValues = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(v: ForgotValues) {
    setSubmitting(true);
    setError(null);
    try {
      const auth = getClientAuth();
      await sendPasswordResetEmail(auth, v.email, {
        url: `${SITE_URL}/login`,
        handleCodeInApp: false,
      });
      setSent(true);
    } catch (e: any) {
      const msg = e?.message ?? "Failed to send reset email";
      if (/user-not-found|invalid-email/i.test(msg)) {
        setError("No account found with that email.");
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Reset your password</h1>
        <p className="mt-1 text-sm text-white/60">
          Enter your email and we&apos;ll send you a link to set a new one.
        </p>
      </div>

      {sent ? (
        <div className="glass p-5">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-apron-gold/15 border border-apron-gold/30 text-apron-gold">
              <CheckCircle2 size={26} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Reset link sent
              </h2>
              <p className="mt-1 text-sm text-white/70">
                If there&apos;s an Apron account associated with that email,
                you&apos;ll receive a link shortly. Check your inbox (and spam folder).
              </p>
            </div>
            <Link href="/login" className="w-full">
              <Button variant="primary" className="w-full">
                <ArrowLeft size={16} /> Back to Sign in
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {error ? (
            <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register("email")}
            />
            <Button type="submit" size="lg" loading={submitting} className="w-full">
              {submitting ? "Sending link…" : "Send reset link"}
            </Button>
          </form>

          <div className="text-center text-sm text-white/70">
            <Link href="/login" className="inline-flex items-center gap-1 text-apron-gold hover:underline">
              <ArrowLeft size={14} /> Back to Sign in
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
