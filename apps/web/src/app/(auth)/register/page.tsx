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
import { register as registerApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const schema = z
  .object({
    username: z.string().min(3, "Username needs at least 3 characters"),
    email: z.string().email("Use a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type RegisterForm = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
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
      });

      setSession({
        accessToken: payload.accessToken,
        csrfToken: payload.csrfToken,
        user: payload.user,
        rememberMe: true,
      });
      setVerificationToken(payload.verification.token);
      router.push(redirectTarget);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Registration failed");
    }
  };

  return (
    <div className="nexus-shell relative flex items-center justify-center overflow-hidden">
      <div className="solar-grid pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto grid w-full max-w-5xl gap-4">
        <section className="nexus-display-panel hidden rounded-[24px] p-4 sm:block">
          <div className="grid gap-3 sm:grid-cols-3">
            <article className="nexus-metric-card rounded-xl px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Onboarding</p>
              <p className="mt-1 text-sm font-semibold text-cyan-200">Create forge-ready access</p>
            </article>
            <article className="nexus-metric-card rounded-xl px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Session</p>
              <p className="mt-1 text-sm font-semibold text-emerald-200">Redirects into app</p>
            </article>
            <article className="nexus-metric-card rounded-xl px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Verification</p>
              <p className="mt-1 text-sm font-semibold text-amber-200">Demo token issued</p>
            </article>
          </div>
        </section>

        <AuthFormCard
          title="Create Account"
          subtitle="Join NexusForge and launch your first Forge"
          footer={
            <div className="flex items-center justify-end">
              <Link href={`/login?redirect=${encodeURIComponent(redirectTarget)}`} className="text-cyan-400 hover:text-cyan-300">
                Already have an account?
              </Link>
            </div>
          }
        >
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            <Input label="Username" autoComplete="username" error={errors.username?.message} {...register("username")} />
            <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              error={errors.password?.message}
              {...register("password")}
            />
            <Input
              label="Confirm Password"
              type="password"
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              {...register("confirmPassword")}
            />
            {serverError ? <p className="text-sm text-rose-400">{serverError}</p> : null}
            {verificationToken ? (
              <p className="nexus-display-panel rounded-[20px] px-3 py-2 text-xs text-cyan-200">
                Demo verification token: {verificationToken}
              </p>
            ) : null}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create Account"}
            </Button>
          </form>
        </AuthFormCard>
      </div>
    </div>
  );
}
