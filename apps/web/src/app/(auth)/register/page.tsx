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
import { register as registerApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const schema = z
  .object({
    username: z.string().min(3, "Username needs at least 3 characters"),
    email: z.string().email("Use a valid email"),
    birthdate: z.string().min(1, "Birthdate is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type RegisterForm = z.infer<typeof schema>;

function sanitizeRedirectTarget(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  return raw;
}

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null);
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = sanitizeRedirectTarget(params.get("redirect") || params.get("next"));
    setRedirectTarget(requested);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: RegisterForm) => {
    setServerError(null);
    setVerificationToken(null);

    try {
      const payload = await registerApi({
        username: values.username,
        email: values.email,
        password: values.password,
        birthdate: values.birthdate,
      });

      setSession({
        accessToken: payload.accessToken,
        csrfToken: payload.csrfToken,
        user: payload.user,
        rememberMe: true,
      });
      setVerificationToken(payload.verification.token);
      const defaultDestination = payload.user.isAdmin ? "/admin" : "/workspace";
      router.push(redirectTarget ?? defaultDestination);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Registration failed");
    }
  };

  return (
    <AuthPageShell
      hero={
        <>
          <p className="nexus-eyebrow text-amber-600">Onboarding Rail</p>
          <h2 className="mt-2 font-[family-name:var(--font-orbitron)] text-3xl leading-tight text-slate-950">
            Launch your account and drop into the command network fast.
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Registration is wired for immediate session activation, route handoff, and premium posture visibility from first login.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <article className="nexus-metric-card auth-hero-card rounded-[20px] px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Onboarding</p>
              <p className="mt-1 text-sm font-semibold text-amber-200">Create forge-ready access</p>
            </article>
            <article className="nexus-metric-card auth-hero-card rounded-[20px] px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Session</p>
              <p className="mt-1 text-sm font-semibold text-amber-200">Redirects into app</p>
            </article>
            <article className="nexus-metric-card auth-hero-card rounded-[20px] px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Verification</p>
              <p className="mt-1 text-sm font-semibold text-amber-200">Demo token issued</p>
            </article>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="glass-cut auth-hero-card rounded-[20px] border border-slate-900/10 bg-white/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-amber-600">Instant activation</p>
              <p className="mt-2 text-sm text-slate-600">Account setup completes quickly so your Forge is ready to deploy immediately.</p>
            </div>
            <div className="glass-cut rounded-[20px] border border-fuchsia-200 bg-fuchsia-50 p-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-fuchsia-700">Forge ready</p>
              <p className="mt-2 text-sm text-fuchsia-800">Start building your command network with premium tools from first login.</p>
            </div>
          </div>
        </>
      }
    >
      <AuthFormCard
        title="Create Account"
        subtitle="Join NexusForge and launch your first Forge"
        footer={
          <div className="flex items-center justify-end">
            <Link href={`/login?redirect=${encodeURIComponent(redirectTarget ?? "/workspace")}`} className="text-amber-700 hover:text-amber-600">
              Already have an account?
            </Link>
          </div>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <Input id="register-username" label="Username" autoComplete="username" error={errors.username?.message} {...register("username")} />
          <Input id="register-email" label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
          <Input id="register-birthdate" label="Birthdate" type="date" error={errors.birthdate?.message} {...register("birthdate")} />
          <Input
            id="register-password"
            label="Password"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register("password")}
          />
          <Input
            id="register-confirm-password"
            label="Confirm Password"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
          {serverError ? (
            <p role="alert" className="text-sm text-rose-400">
              {serverError}
            </p>
          ) : null}
          {verificationToken ? (
            <div className="grid gap-2 rounded-[20px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <p>Demo verification token: {verificationToken}</p>
              <Link
                href={`/verify-email?token=${encodeURIComponent(verificationToken)}`}
                className="text-amber-700 hover:text-amber-600 underline"
              >
                Verify email now
              </Link>
            </div>
          ) : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create Account"}
          </Button>
        </form>
      </AuthFormCard>
    </AuthPageShell>
  );
}
