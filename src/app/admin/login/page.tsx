"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Shield } from "lucide-react";
import * as z from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApronIcon } from "@/components/icons/ApronIcon";

export const dynamic = "force-dynamic";

const adminLoginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type AdminLoginValues = z.infer<typeof adminLoginSchema>;

function AdminLoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/admin";
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors },
  } = useForm<AdminLoginValues>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(v: AdminLoginValues) {
    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
        credentials: "same-origin",
      });
      const data = await resp.json().catch(() => ({} as any));
      if (!resp.ok || data.ok === false) {
        setFieldError("email", { message: " " });
        setFieldError("password", {
          message: data?.error ?? "Invalid credentials",
        });
      } else if (data.ok === true) {
        window.location.href = next;
      }
    } catch (e: any) {
      setError(e?.message ?? "Sign-in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/"
        className="mb-2 flex items-center justify-center gap-3 self-start"
      >
        <ApronIcon size={36} />
        <div className="leading-tight">
          <div className="text-xl font-bold text-gradient-gold">APRON</div>
          <div className="text-xs text-white/60">Rewards Platform</div>
        </div>
      </Link>

      <div className="glass p-6 animate-fade-in">
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-apron-gold/30 bg-apron-gold/10">
              <Shield size={22} className="text-apron-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Admin Sign In</h1>
              <p className="mt-1 text-sm text-white/60">
                Restricted access. Authorized personnel only.
              </p>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <form
            className="flex flex-col gap-4"
            onSubmit={handleSubmit(onSubmit)}
          >
            <Input
              label="Admin Email"
              type="email"
              placeholder="admin@apron.com"
              autoComplete="email"
              error={errors.email?.message}
              {...register("email")}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
            />
            <Button
              type="submit"
              size="lg"
              loading={submitting}
              className="mt-1 w-full"
            >
              {submitting ? "Signing in…" : "Sign in to Admin Console"}
            </Button>
          </form>

          <div className="pt-2 text-center text-sm">
            <Link
              href="/login"
              className="text-white/60 hover:text-white/90 transition"
            >
              ← Back to user sign in
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-2 text-center text-xs text-white/40">
        © {new Date().getFullYear()} Apron. All rights reserved.
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginContent />
    </Suspense>
  );
}
