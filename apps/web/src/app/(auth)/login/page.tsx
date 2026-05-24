"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthFormCard } from "@/components/auth/auth-form-card";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
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
    setRedirectTarget(params.get("redirect") || params.get("next") || "/app");
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: true,
    },
  });

  const onQuickLogin = async () => {
    const demoEmail = "trhdevelopment@nexusforge.local";
    const demoPassword = "Sample!2026";

    setValue("email", demoEmail);
    setValue("password", demoPassword);
    setValue("rememberMe", true);

    await handleSubmit(onSubmit)();
  };

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
    <AuthPageShell
      hero={
        <>
          <p className="text-[11px] uppercase tracking-[0.24em] text-amber-300">Command Access</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-emerald-200 shadow-[0_14px_40px_rgba(52,211,153,0.14)]">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.35)]" />
            Live auth channel
          </div>
          <h2 className="mt-6 font-[family-name:var(--font-orbitron)] text-4xl font-semibold leading-[1.04] text-white sm:text-5xl">
            Secure your command vault.
            <br />
            Sign in to unleash your NexusForge control center.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
            Authenticate instantly and reconnect your desktop command surface with encrypted session sync, premium access, and live activity routing.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <article className="nexus-metric-card auth-hero-card rounded-2xl px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Access Mode</p>
              <p className="mt-1 text-sm font-semibold text-amber-200">Secure sign-in</p>
            </article>
            <article className="nexus-metric-card auth-hero-card rounded-2xl px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Session</p>
              <p className="mt-1 text-sm font-semibold text-amber-200">Restores to app</p>
            </article>
            <article className="nexus-metric-card auth-hero-card rounded-2xl px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Recovery</p>
              <p className="mt-1 text-sm font-semibold text-amber-200">Password reset ready</p>
            </article>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="glass-cut auth-hero-card rounded-3xl px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-amber-300">Signal</p>
              <p className="mt-1 text-sm text-slate-200">Realtime command graph and activity lanes reconnect after auth.</p>
            </div>
            <div className="glass-cut rounded-3xl px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-amber-300">Coverage</p>
              <p className="mt-1 text-sm text-slate-200">Desktop and mobile surfaces are synchronized with one identity.</p>
            </div>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="glass-cut rounded-3xl border border-slate-700/70 bg-slate-950/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">Instant resume</p>
              <p className="mt-2 text-sm text-slate-300">Your secure session restores quickly so you can get back into command without waiting.</p>
            </div>
            <div className="glass-cut rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-emerald-200">Premium access</p>
              <p className="mt-2 text-sm text-emerald-100">Unlock NexusForge tools, voice arenas, and shared command feeds with one secure login.</p>
            </div>
          </div>
        </>
      }
    >
      <div className="relative">
        <div className="absolute -inset-x-4 -top-4 -bottom-4 hidden rounded-[2rem] bg-gradient-to-br from-amber-500/10 via-slate-950/20 to-sky-500/5 blur-3xl opacity-70 sm:block" />
        <AuthFormCard
          title="Sign In"
          subtitle="Enter your credentials to access your NexusForge account"
          footer={
            <div className="flex items-center justify-between gap-4">
              <Link href="/forgot-password" className="text-amber-300 hover:text-amber-200">
                Forgot password?
              </Link>
              <Link href={`/register?redirect=${encodeURIComponent(redirectTarget)}`} className="text-amber-300 hover:text-amber-200">
                Create account
              </Link>
            </div>
          }
        >
          <div className="mb-5 grid gap-3 rounded-[28px] border border-amber-500/15 bg-slate-950/88 p-4 shadow-[0_18px_50px_rgba(255,184,108,0.08)] lg:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs uppercase tracking-[0.24em] text-emerald-200 shadow-[0_10px_30px_rgba(52,211,153,0.12)]">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.35)]" />
                Live auth channel
              </span>
              <span className="text-xs text-slate-400">Auto-sync workspace on login</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 pt-3">
              <div className="glass-cut rounded-3xl border border-amber-500/15 bg-slate-950/80 p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">Encrypted vault</p>
                <p className="mt-2 text-sm font-semibold text-white">FIDO-level identity</p>
                <p className="mt-2 text-sm text-slate-400">Session keys stay secure while your workspace restores instantly.</p>
              </div>
              <div className="glass-cut rounded-3xl border border-slate-700/70 bg-slate-950/80 p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">Command-ready</p>
                <p className="mt-2 text-sm font-semibold text-white">Premium launch sync</p>
                <p className="mt-2 text-sm text-slate-400">Your last active command lanes and voice channels reconnect smoothly.</p>
              </div>
            </div>
          </div>
          <div className="mb-5 hidden gap-3 lg:grid lg:grid-cols-2">
            <div className="glass-cut rounded-3xl border border-amber-500/15 bg-slate-950/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">Encrypted vault</p>
              <p className="mt-2 text-sm font-semibold text-white">FIDO-level identity</p>
              <p className="mt-2 text-sm text-slate-400">Session keys stay secure while your workspace restores instantly.</p>
            </div>
            <div className="glass-cut rounded-3xl border border-slate-700/70 bg-slate-950/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">Command-ready</p>
              <p className="mt-2 text-sm font-semibold text-white">Premium launch sync</p>
              <p className="mt-2 text-sm text-slate-400">Your last active command lanes and voice channels reconnect smoothly.</p>
            </div>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            <Input id="login-email" label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
            <Input
              id="login-password"
              label="Password"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
            />
            <label className="nexus-display-panel inline-flex items-center gap-2 rounded-[20px] px-3 py-2 text-sm text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border border-slate-600 bg-slate-900 text-amber-300 focus:ring-2 focus:ring-amber-500/40"
                {...register("rememberMe")}
              />
              <span>Save login for one-tap access</span>
            </label>
            {serverError ? (
              <p role="alert" className="text-sm text-rose-400">
                {serverError}
              </p>
            ) : null}
            <div className="grid gap-3">
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Authenticating..." : "Sign In"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={onQuickLogin}
                disabled={isSubmitting}
                className="w-full"
              >
                One-tap login as TRH Development
              </Button>
            </div>
          </form>
        </AuthFormCard>
      </div>
    </AuthPageShell>
  );
}
