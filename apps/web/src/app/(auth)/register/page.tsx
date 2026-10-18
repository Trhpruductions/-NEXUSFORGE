"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Crosshair, Gamepad2, Users2, Wrench } from "lucide-react";
import { AuthFormCard } from "@/components/auth/auth-form-card";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { AuthField, authPrimaryButtonClass } from "@/components/auth/auth-field";
import { getApiErrorMessage, register as registerApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { getRequiredPolicies } from "@/lib/legal-api";
import { useAuthStore } from "@/store/auth-store";
import { safeRedirectPath } from "@/lib/safe-redirect";

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

const sanitizeRedirectTarget = safeRedirectPath;

const pillars = [
  { icon: Gamepad2, label: "Play", note: "Squads, scrims and LFG channels." },
  { icon: Users2, label: "Connect", note: "Voice rooms, DMs and friends." },
  { icon: Wrench, label: "Create", note: "Bots, roles and forge templates." },
  { icon: Crosshair, label: "Dominate", note: "Leaderboards, rewards and stats." },
];

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null);
  const setSession = useAuthStore((state) => state.setSession);
  // Published policies that must be accepted, one unticked box each, with the exact wording.
  const requiredQuery = useQuery({ queryKey: ["legal-required"], queryFn: getRequiredPolicies });
  const requiredPolicies = requiredQuery.data?.policies ?? [];
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const allAccepted = requiredPolicies.every((policy) => accepted[policy.versionId]);

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
        acceptedPolicyVersionIds: requiredPolicies.filter((policy) => accepted[policy.versionId]).map((policy) => policy.versionId),
      });

      setSession({
        accessToken: payload.accessToken,
        csrfToken: payload.csrfToken,
        user: payload.user,
        rememberMe: true,
      });
      setVerificationToken(payload.verification.devCode ?? null);
      router.push(redirectTarget ?? "/welcome");
    } catch (error) {
      setServerError(getApiErrorMessage(error));
      // A policy may have been updated while the form was open: show the current versions.
      void requiredQuery.refetch();
    }
  };

  return (
    <AuthPageShell
      hero={
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(46,164,255,0.9)]" />
            Built for gamers. Connected by community.
          </div>
          <h2 className="nf-heading text-5xl font-bold leading-[1.05] tracking-tight text-white">
            Forge your
            <span className="block bg-[linear-gradient(120deg,#9fd8ff,#2ea4ff_45%,#0b6fe0)] bg-clip-text text-transparent">
              community.
            </span>
          </h2>
          <p className="max-w-md text-base leading-relaxed text-slate-300">
            Free to start. Create an account, pick a forge template, and be live with your squad in under a minute.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {pillars.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <item.icon className="mb-3 h-5 w-5 text-amber-200" />
                <p className="nf-heading text-xs font-bold uppercase tracking-[0.3em] text-white">{item.label}</p>
                <p className="mt-1 text-xs text-slate-400">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      }
    >
      <AuthFormCard
        title="Create your account"
        subtitle="You must be 18 or older to join Nexus Forge Gaming."
        footer={
          <span>
            Already have an account?{" "}
            <Link
              href={`/login?redirect=${encodeURIComponent(redirectTarget ?? "/app")}`}
              className="font-semibold text-amber-200 transition hover:text-white"
            >
              Sign in <ArrowRight className="ml-1 inline h-3 w-3" />
            </Link>
          </span>
        }
      >
        <form method="post" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <AuthField
            id="register-username"
            label="Username"
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="username"
            placeholder="gamertag"
            error={errors.username?.message}
            {...register("username")}
          />
          <AuthField
            id="register-email"
            label="Email"
            type="email"
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            {...register("email")}
          />
          <AuthField id="register-birthdate" label="Birthdate" type="date" error={errors.birthdate?.message} {...register("birthdate")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <AuthField
              id="register-password"
              label="Password"
              type="password"
              autoComplete="new-password"
              placeholder="8+ characters"
              error={errors.password?.message}
              {...register("password")}
            />
            <AuthField
              id="register-confirm-password"
              label="Confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat it"
              error={errors.confirmPassword?.message}
              {...register("confirmPassword")}
            />
          </div>

          {serverError ? (
            <div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {serverError}
            </div>
          ) : null}

          {verificationToken ? (
            <div className="space-y-1 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
              <p>Development mode: your email code is <span className="font-mono font-bold">{verificationToken}</span>.</p>
            </div>
          ) : null}

          {requiredPolicies.length ? (
            <fieldset className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
              <legend className="sr-only">Agreements</legend>
              {requiredPolicies.map((policy) => (
                <label key={policy.versionId} className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-slate-300">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 accent-amber-400"
                    checked={Boolean(accepted[policy.versionId])}
                    onChange={(event) => setAccepted((current) => ({ ...current, [policy.versionId]: event.target.checked }))}
                  />
                  <span>
                    {policy.consentText}{" "}
                    <Link href={`/legal/${policy.slug}`} target="_blank" className="font-semibold text-sky-300 underline-offset-2 hover:underline">
                      Read the {policy.title}
                    </Link>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}

          <button type="submit" disabled={isSubmitting || requiredQuery.isLoading || !allAccepted} className={authPrimaryButtonClass}>
            {isSubmitting ? "Creating account..." : "Create account"}
            {!isSubmitting ? <ArrowRight className="h-4 w-4" /> : null}
          </button>

          <p className="text-center text-[11px] leading-relaxed text-slate-500">
            Our policies and their history are in the{" "}
            <Link href="/legal" className="text-slate-300 hover:text-white">Legal Center</Link>.
          </p>
        </form>
      </AuthFormCard>
    </AuthPageShell>
  );
}
