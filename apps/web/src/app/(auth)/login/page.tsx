"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthFormCard } from "@/components/auth/auth-form-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const schema = z.object({
  email: z.string().email("Use a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean(),
});

type LoginForm = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [redirectTarget, setRedirectTarget] = useState("/app");
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRedirectTarget(params.get("redirect") || "/app");
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: true,
    },
  });

  const onSubmit = async (values: LoginForm) => {
    setServerError(null);
    try {
      const payload = await login(values);
      setSession({
        accessToken: payload.accessToken,
        csrfToken: payload.csrfToken,
        user: payload.user,
        rememberMe: values.rememberMe,
      });
      router.push(redirectTarget);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Login failed");
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full items-center overflow-hidden px-4 py-8 sm:px-6">
      <div className="solar-grid pointer-events-none absolute inset-0 -z-10" />
      <div className="nexus-ambient" aria-hidden="true">
        <div className="nexus-ambient-orb nexus-ambient-orb-a" />
        <div className="nexus-ambient-orb nexus-ambient-orb-b" />
      </div>
      <div className="mx-auto my-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <section className="nexus-display-panel hidden rounded-[24px] p-5 lg:block">
          <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-300">Command Access</p>
          <h2 className="mt-2 font-[family-name:var(--font-orbitron)] text-3xl leading-tight text-white">
            Full-screen operations,
            <br />
            one secure sign-in.
          </h2>
          <p className="mt-2 max-w-xl text-sm text-slate-300">
            Resume your live command surface instantly with premium routing, friend activity, and billing-aware controls already synced.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <article className="nexus-metric-card rounded-xl px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Access Mode</p>
              <p className="mt-1 text-sm font-semibold text-cyan-200">Secure sign-in</p>
            </article>
            <article className="nexus-metric-card rounded-xl px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Session</p>
              <p className="mt-1 text-sm font-semibold text-emerald-200">Restores to app</p>
            </article>
            <article className="nexus-metric-card rounded-xl px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Recovery</p>
              <p className="mt-1 text-sm font-semibold text-amber-200">Password reset ready</p>
            </article>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="glass-cut rounded-2xl px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-300">Signal</p>
              <p className="mt-1 text-sm text-slate-200">Realtime command graph and activity lanes reconnect after auth.</p>
            </div>
            <div className="glass-cut rounded-2xl px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300">Coverage</p>
              <p className="mt-1 text-sm text-slate-200">Desktop and mobile surfaces are synchronized with one identity.</p>
            </div>
          </div>
        </section>

        <AuthFormCard
          title="Sign In"
          subtitle="Enter your credentials to access your NexusForge account"
          footer={
            <div className="flex items-center justify-between gap-4">
              <Link href="/forgot-password" className="text-cyan-400 hover:text-cyan-300">
                Forgot password?
              </Link>
              <Link href={`/register?redirect=${encodeURIComponent(redirectTarget)}`} className="text-cyan-400 hover:text-cyan-300">
                Create account
              </Link>
            </div>
          }
        >
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
            />
            <label className="nexus-display-panel inline-flex items-center gap-2 rounded-[20px] px-3 py-2 text-sm text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border border-slate-600 bg-slate-900 text-cyan-400 focus:ring-2 focus:ring-cyan-500/40"
                {...register("rememberMe")}
              />
              <span>Remember me on this device</span>
            </label>
            {serverError ? <p className="text-sm text-rose-400">{serverError}</p> : null}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Authenticating..." : "Sign In"}
            </Button>
          </form>
        </AuthFormCard>
      </div>
    </div>
  );
}
