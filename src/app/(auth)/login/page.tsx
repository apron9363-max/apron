"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Chrome } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { loginSchema } from "@/lib/validations/schemas";
import { z } from "zod";
import {
  createSessionFromIdToken,
  signInWithEmailAndPassword,
  signInWithGooglePopup,
} from "@/hooks/useFirebaseAuth";
import {
  getCurrentSession,
  syncGoogleUserDocAction,
} from "@/server/actions/authActions";

export const dynamic = "force-dynamic";

type LoginValues = z.infer<typeof loginSchema>;

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(v: LoginValues) {
    setSubmitting(true);
    setError(null);
    try {
      const cred = await signInWithEmailAndPassword(v.email, v.password);
      const idToken = await cred.user.getIdToken(true);
      await createSessionFromIdToken(idToken);
      const sess = await getCurrentSession();
      if (sess?.status === "banned") {
        router.push("/blocked");
        return;
      }
      if (!sess?.emailVerified) {
        router.push("/verify");
        return;
      }
      router.push(next);
    } catch (e: any) {
      const msg = e?.message ?? "Sign-in failed";
      if (/user-not-found|invalid-email/i.test(msg)) {
        setFieldError("email", { message: "Invalid email or password" });
      } else if (/wrong-password/i.test(msg)) {
        setFieldError("password", { message: "Invalid password" });
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    setError(null);
    try {
      const cred = await signInWithGooglePopup();
      const idToken = await cred.user.getIdToken(true);
      await syncGoogleUserDocAction({
        uid: cred.user.uid,
        name: cred.user.displayName ?? undefined,
        email: cred.user.email ?? "",
      });
      await createSessionFromIdToken(idToken);
      const sess = await getCurrentSession();
      if (sess?.status === "banned") {
        router.push("/blocked");
        return;
      }
      if (!sess?.emailVerified) {
        router.push("/verify");
        return;
      }
      router.push(next);
    } catch (e: any) {
      if (/popup-closed-by-user|cancelled/i.test(e?.message ?? "")) {
        // silently ignore
      } else {
        setError(e?.message ?? "Google sign-in failed");
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Welcome back</h1>
        <p className="mt-1 text-sm text-white/60">
          Sign in to continue earning APN coins.
        </p>
      </div>

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
        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register("password")}
        />
        <Button type="submit" size="lg" loading={submitting} className="mt-1 w-full">
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-white/15" />
        <span className="text-xs uppercase tracking-wide text-white/50">or</span>
        <div className="h-px flex-1 bg-white/15" />
      </div>

      <Button
        variant="outline"
        size="lg"
        onClick={handleGoogle}
        loading={googleLoading}
      >
        <Chrome size={18} className="text-apron-gold" />
        {googleLoading ? "Continuing with Google…" : "Continue with Google"}
      </Button>

      <div className="grid grid-cols-2 gap-4 pt-2 text-center text-sm text-white/60">
        <div>
          No account?{" "}
          <Link href="/register" className="text-apron-gold hover:underline">
            Create one
          </Link>
        </div>
        <div className="text-right">
          <Link href="/forgot-password" className="text-white/60 hover:text-white/90">
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
