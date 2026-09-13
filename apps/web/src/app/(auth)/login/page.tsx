"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Gamepad2, Mic2, ShieldCheck, Users2 } from "lucide-react";
import { AuthFormCard } from "@/components/auth/auth-form-card";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { AuthField, authPrimaryButtonClass } from "@/components/auth/auth-field";
import { getApiErrorMessage, login, resendTwoFactorLogin, verifyTwoFactorLogin } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const schema = z.object({
  email: z.string().email("Use a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginForm = z.infer<typeof schema>;

function sanitizeRedirectTarget(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  return raw;
}

const highlights = [
  { icon: Gamepad2, label: "Forges", note: "Your squads, channels and invites" },
  { icon: Mic2, label: "Voice", note: "Low-latency rooms and stages" },
  { icon: ShieldCheck, label: "Moderation", note: "Ranked roles, kicks and bans" },
  { icon: Users2, label: "Friends", note: "DMs that follow you everywhere" },
];

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<{ token: string; channels: string[]; devCode?: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);

  const finishLogin = (payload: { accessToken: string; csrfToken: string; user: { isAdmin?: boolean } & Parameters<typeof setSession>[0]["user"] }) => {
    setSession({ accessToken: payload.accessToken, csrfToken: payload.csrfToken, user: payload.user, rememberMe: true });
    router.push(redirectTarget ?? "/app");
  };

  const submitCode = async () => {
    if (!challenge || code.length !== 6) return;
    setBusy(true);
    setServerError(null);
    try {
      const payload = await verifyTwoFactorLogin({ challengeToken: challenge.token, code });
      finishLogin(payload);
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    if (!challenge) return;
    setBusy(true);
    setServerError(null);
    try {
      const result = await resendTwoFactorLogin(challenge.token);
      setChallenge({ token: result.challengeToken, channels: result.channels, devCode: result.devCode });
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = sanitizeRedirectTarget(params.get("redirect") || params.get("next"));
    setRedirectTarget(requested);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: LoginForm) => {
    setServerError(null);
    try {
      const payload = await login(values);
      if ("requiresTwoFactor" in payload && payload.requiresTwoFactor) {
        setChallenge({ token: payload.challengeToken, channels: payload.channels, devCode: payload.devCode });
        setCode("");
        return;
      }
      finishLogin(payload);
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    }
  };

  return (
    <AuthPageShell
      hero={
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(230,179,37,0.9)]" />
            Welcome back
          </div>
          <h2 className="nf-heading text-5xl font-bold leading-[1.05] tracking-tight text-white">
            Drop back into
            <span className="block bg-[linear-gradient(120deg,#f8df8a,#e6b325_45%,#b0820f)] bg-clip-text text-transparent">
              the squad.
            </span>
          </h2>
          <p className="max-w-md text-base leading-relaxed text-slate-300">
            Sign in to pick up your forges, voice rooms, friends and rewards right where you left them.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {highlights.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <item.icon className="mb-3 h-5 w-5 text-amber-200" />
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="mt-1 text-xs text-slate-400">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      }
    >
      {challenge ? (
        <AuthFormCard
          title="Check your codes"
          subtitle={`We sent a 6-digit sign-in code. ${challenge.channels.join(" and ")}.`}
          eyebrow="Two-factor sign-in"
          footer={
            <button type="button" onClick={() => setChallenge(null)} className="font-semibold text-amber-200 transition hover:text-white">
              Use a different account
            </button>
          }
        >
          <div className="space-y-5">
            <AuthField
              id="login-2fa-code"
              label="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submitCode();
              }}
            />
            {challenge.devCode ? (
              <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                Development mode: delivery is not configured, so the code is <span className="font-mono font-bold">{challenge.devCode}</span>.
              </p>
            ) : null}
            {serverError ? (
              <div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {serverError}
              </div>
            ) : null}
            <button type="button" onClick={() => void submitCode()} disabled={busy || code.length !== 6} className={authPrimaryButtonClass}>
              {busy ? "Checking..." : "Verify and sign in"}
              {!busy ? <ArrowRight className="h-4 w-4" /> : null}
            </button>
            <button type="button" onClick={() => void resendCode()} disabled={busy} className="w-full text-center text-xs text-slate-400 transition hover:text-amber-200">
              Resend code
            </button>
          </div>
        </AuthFormCard>
      ) : (
      <AuthFormCard
        title="Sign in"
        subtitle="Use the email and password on your Vexora Gaming account."
        footer={
          <span>
            New here?{" "}
            <Link href="/register" className="font-semibold text-amber-200 transition hover:text-white">
              Create a free account <ArrowRight className="ml-1 inline h-3 w-3" />
            </Link>
          </span>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <AuthField
            id="login-email"
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            {...register("email")}
          />
          <AuthField
            id="login-password"
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            error={errors.password?.message}
            {...register("password")}
          />

          <div className="flex items-center justify-end">
            <Link href="/forgot-password" className="text-xs text-slate-400 transition hover:text-amber-200">
              Forgot password?
            </Link>
          </div>

          {serverError ? (
            <div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {serverError}
            </div>
          ) : null}

          <button type="submit" disabled={isSubmitting} className={authPrimaryButtonClass}>
            {isSubmitting ? "Signing in..." : "Sign in"}
            {!isSubmitting ? <ArrowRight className="h-4 w-4" /> : null}
          </button>
        </form>
      </AuthFormCard>
      )}
    </AuthPageShell>
  );
}
