"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { registerSchema } from "@/lib/validations/schemas";
import {
  createSessionFromIdToken,
  signInWithEmailAndPassword,
} from "@/hooks/useFirebaseAuth";
import { registerUserAction, sendVerificationEmailAction } from "@/server/actions/authActions";

export const dynamic = "force-dynamic";

type FormValues = z.infer<typeof registerSchema>;

function RegisterContent() {
  const router = useRouter();
  const params = useSearchParams();
  const refCode = params.get("ref") ?? "";
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      referralCode: refCode,
    },
  });

  useEffect(() => {
    if (refCode) setValue("referralCode", refCode);
  }, [refCode, setValue]);

  const onSubmit = useCallback(
    async (v: FormValues) => {
      setSubmitting(true);
      setServerError(null);
      try {
        const result = await registerUserAction(v);
        if (!result.ok) {
          const fieldErr = result.error as Record<string, string[]>;
          if (fieldErr) {
            for (const [key, messages] of Object.entries(fieldErr)) {
              if (key === "_") continue;
              const msg = Array.isArray(messages) ? messages[0] : String(messages);
              if (msg) setError(key as keyof FormValues, { message: msg });
            }
            if (fieldErr._) setServerError(fieldErr._[0]);
          } else {
            setServerError("Unable to create account");
          }
          return;
        }

        let cred;
        const maxAttempts = 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            cred = await signInWithEmailAndPassword(v.email, v.password);
            break;
          } catch (signInErr: any) {
            const code = signInErr?.code ?? "";
            const msg = signInErr?.message ?? "";
            const retryable =
              code === "auth/user-not-found" ||
              /user-not-found|internal-error|network-request-failed/i.test(msg);
            if (!retryable || attempt === maxAttempts) {
              throw signInErr;
            }
            await new Promise<void>((res) => setTimeout(res, attempt * 600));
          }
        }
        if (!cred) {
          throw new Error("Unable to sign in after registration");
        }
        const idToken = await cred.user.getIdToken(true);
        await createSessionFromIdToken(idToken);
        let vEmailErr: string | undefined;
        let localWarn: string | undefined;
        let localLink: string | undefined;
        try {
          const sendRes: any = await sendVerificationEmailAction({ idToken });
          if (sendRes?.error) vEmailErr = sendRes.error;
          if (sendRes?.warning) localWarn = sendRes.warning;
          if (sendRes?.directLink) localLink = sendRes.directLink;
        } catch (e: any) {
          vEmailErr = e?.message ?? "Unable to send verification";
        }
        const searchParams = new URLSearchParams();
        if (vEmailErr) searchParams.set("err", vEmailErr);
        if (localWarn) searchParams.set("warn", localWarn);
        if (localLink) searchParams.set("link", localLink);
        const qs = searchParams.toString();
        router.push("/verify" + (qs ? `?${qs}` : ""));
      } catch (e: any) {
        const msg: string = e?.message ?? "Registration failed";
        if (/email.*already/i.test(msg)) {
          setError("email", { message: "Email already registered" });
        } else if (/weak-password|password/i.test(msg)) {
          setError("password", { message: msg });
        } else {
          setServerError(msg);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [setError, router],
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Create your account</h1>
        <p className="mt-1 text-sm text-white/60">
          Start earning APN coins today. Fields marked with * are required.
        </p>
      </div>

      {serverError ? (
        <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
          {serverError}
        </div>
      ) : null}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <Input
          label="Full name *"
          placeholder="Adaeze Nwosu"
          error={errors.name?.message}
          {...register("name")}
        />
        <Input
          label="Email *"
          type="email"
          placeholder="adaeze@example.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <Input
          label="Phone *"
          placeholder="+234 801 234 5678"
          error={errors.phone?.message}
          {...register("phone")}
        />
        <Input
          label="Password *"
          type="password"
          placeholder="At least 8 chars, 1 uppercase, 1 number"
          error={errors.password?.message}
          {...register("password")}
        />
        <Input
          label="Confirm password *"
          type="password"
          placeholder="Re-enter your password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        <Input
          label="Referral code (optional)"
          placeholder="Leave blank if none"
          error={errors.referralCode?.message}
          {...register("referralCode")}
        />

        <Button type="submit" size="lg" loading={submitting} className="mt-2 w-full">
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <div className="text-center text-sm text-white/70">
        Already have an account?{" "}
        <Link href="/login" className="text-apron-gold hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterContent />
    </Suspense>
  );
}
