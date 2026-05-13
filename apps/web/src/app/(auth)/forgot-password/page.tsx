"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthFormCard } from "@/components/auth/auth-form-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPassword } from "@/lib/api";

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
      setServerError(error instanceof Error ? error.message : "Request failed");
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      <div className="solar-grid pointer-events-none absolute inset-0 -z-10" />
      <div className="nexus-ambient" aria-hidden="true">
        <div className="nexus-ambient-orb nexus-ambient-orb-a" />
        <div className="nexus-ambient-orb nexus-ambient-orb-c" />
      </div>
      <div className="mx-auto my-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section className="nexus-display-panel hidden rounded-[24px] p-5 lg:block">
          <p className="nexus-eyebrow text-cyan-300">Recovery Rail</p>
          <h2 className="mt-2 font-[family-name:var(--font-orbitron)] text-3xl leading-tight text-white">
            Recover access without breaking session trust.
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Generate a one-time recovery token and return to authenticated command flow with minimal friction.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <article className="nexus-metric-card mt-4 rounded-2xl px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Recovery Mode</p>
              <p className="mt-1 text-sm font-semibold text-cyan-200">Token generation</p>
            </article>
            <article className="nexus-metric-card mt-4 rounded-2xl px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Security</p>
              <p className="mt-1 text-sm font-semibold text-emerald-200">One-time flow</p>
            </article>
            <article className="nexus-metric-card mt-4 rounded-2xl px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Next Step</p>
              <p className="mt-1 text-sm font-semibold text-amber-200">Back to sign in</p>
            </article>
          </div>
        </section>

        <AuthFormCard
          title="Reset Password"
          subtitle="Generate a one-time reset token for your account"
          footer={
            <div className="flex items-center justify-end">
              <Link href="/login" className="text-cyan-300 hover:text-cyan-200">
                Back to login
              </Link>
            </div>
          }
        >
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            <Input label="Account Email" type="email" error={errors.email?.message} {...register("email")} />
            {result ? <p className="text-xs text-cyan-200">{result}</p> : null}
            {serverError ? <p className="text-sm text-rose-400">{serverError}</p> : null}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Generating token..." : "Send reset token"}
            </Button>
          </form>
        </AuthFormCard>
      </div>
    </div>
  );
}
