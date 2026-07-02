"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthFormCard } from "@/components/auth/auth-form-card";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPassword, getApiErrorMessage } from "@/lib/api";

const schema = z.object({
  email: z.string().email("Use a valid email"),
});

type ForgotForm = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [result, setResult] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: ForgotForm) => {
    setResult(null);
    setServerError(null);

    try {
      const payload = await forgotPassword(values);
      setResult(payload.token ? `${payload.message} Token: ${payload.token}` : payload.message);
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    }
  };

  return (
    <AuthPageShell
      hero={
        <>
          <p className="nexus-eyebrow text-amber-300">Recovery Rail</p>
          <h2 className="mt-2 font-[family-name:var(--font-orbitron)] text-3xl leading-tight text-white">
            Recover access without breaking session trust.
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Generate a one-time recovery token and return to authenticated command flow with minimal friction.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <article className="nexus-metric-card auth-hero-card rounded-none px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Recovery Mode</p>
              <p className="mt-1 text-sm font-semibold text-amber-200">Token generation</p>
            </article>
            <article className="nexus-metric-card auth-hero-card rounded-none px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Security</p>
              <p className="mt-1 text-sm font-semibold text-amber-200">One-time flow</p>
            </article>
            <article className="nexus-metric-card auth-hero-card rounded-none px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Next Step</p>
              <p className="mt-1 text-sm font-semibold text-amber-200">Back to sign in</p>
            </article>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="glass-cut auth-hero-card rounded-none border border-slate-700/70 bg-slate-950/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">Fast recovery</p>
              <p className="mt-2 text-sm text-slate-300">Reset tokens are issued quickly to get you back into command flow without delay.</p>
            </div>
            <div className="glass-cut rounded-none border border-sky-400/20 bg-sky-500/10 p-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-sky-200">Safe return</p>
              <p className="mt-2 text-sm text-sky-100">Your account recovery keeps your workspace secure while restoring access.</p>
            </div>
          </div>
        </>
      }
    >
      <AuthFormCard
        title="Reset Password"
        subtitle="Generate a one-time reset token for your account"
        footer={
          <div className="flex items-center justify-end">
            <Link href="/login" className="text-amber-300 hover:text-amber-200">
              Back to login
            </Link>
          </div>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <Input id="forgot-password-email" label="Account Email" type="email" error={errors.email?.message} {...register("email")} />
          {result ? (
            <div className="grid gap-2" role="status" aria-live="polite">
              <p className="text-xs text-amber-200">{result}</p>
              <Link href="/reset-password" className="text-amber-300 underline hover:text-amber-200">
                Continue to reset password
              </Link>
            </div>
          ) : null}
          {serverError ? (
            <p role="alert" className="text-sm text-rose-400">
              {serverError}
            </p>
          ) : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Generating token..." : "Send reset token"}
          </Button>
        </form>
      </AuthFormCard>
    </AuthPageShell>
  );
}
