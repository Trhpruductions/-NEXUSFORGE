"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AuthFormCard } from "@/components/auth/auth-form-card";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { AuthField, authPrimaryButtonClass } from "@/components/auth/auth-field";
import { forgotPassword, forgotPasswordByPhone, getApiErrorMessage, getDeliveryOptions, resetPasswordByPhone } from "@/lib/api";

type Mode = "email" | "phone";

/** Reset by emailed link, or (when texting is set up) by a code texted to a verified phone. */
export default function ForgotPasswordPage() {
  const delivery = useQuery({ queryKey: ["delivery-options"], queryFn: getDeliveryOptions, staleTime: 5 * 60_000, retry: false });
  const smsAvailable = delivery.data?.sms === true;

  const [mode, setMode] = useState<Mode>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setServerError(null);
    try {
      await action();
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setResult(null);
    setServerError(null);
    setCodeSent(false);
  };

  const sendEmail = () =>
    run(async () => {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error("Use a valid email");
      setResult((await forgotPassword({ email: email.trim() })).message);
    });

  const sendText = () =>
    run(async () => {
      if (phone.replace(/\D/g, "").length < 7) throw new Error("Enter your phone number with country code, e.g. +1 555 123 4567");
      setResult((await forgotPasswordByPhone(phone.trim())).message);
      setCodeSent(true);
    });

  const resetWithCode = () =>
    run(async () => {
      if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit code from the text");
      if (newPassword.length < 8) throw new Error("Choose a password with at least 8 characters");
      await resetPasswordByPhone({ phone: phone.trim(), code, newPassword });
      setDone(true);
    });

  const tab = (value: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      onClick={() => switchMode(value)}
      className={`flex-1 rounded-lg px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] transition ${
        mode === value ? "bg-amber-400 text-slate-950" : "text-slate-300 hover:text-white"
      }`}
    >
      {label}
    </button>
  );

  const resultBox = result ? (
    <p role="status" aria-live="polite" className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      {result}
    </p>
  ) : null;

  const errorBox = serverError ? (
    <p role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
      {serverError}
    </p>
  ) : null;

  return (
    <AuthPageShell
      hero={
        <>
          <p className="nexus-eyebrow text-amber-200">Recovery</p>
          <h2 className="mt-2 font-[family-name:var(--font-orbitron)] text-3xl leading-tight text-white">Forgot your password?</h2>
          <p className="mt-2 text-sm text-slate-400">
            {smsAvailable
              ? "Get a reset link by email, or a 6-digit code by text if you've verified your phone number."
              : "Enter your account email and we'll send you a link to choose a new password. The link works for 30 minutes."}
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="glass-cut auth-hero-card rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-amber-200">Fast recovery</p>
              <p className="mt-2 text-sm text-slate-400">Check your inbox (and spam folder) for an email from Nexus Forge Gaming{smsAvailable ? ", or your texts" : ""}.</p>
            </div>
            <div className="glass-cut auth-hero-card rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-sky-300">Signed out everywhere</p>
              <p className="mt-2 text-sm text-slate-400">Choosing a new password signs your account out on every device.</p>
            </div>
          </div>
        </>
      }
    >
      <AuthFormCard
        title="Reset your password"
        subtitle={mode === "email" ? "We'll email you a link to choose a new password." : "We'll text a code to your verified phone."}
        footer={
          <Link href="/login" className="font-semibold text-amber-200 transition hover:text-white">
            Back to sign in
          </Link>
        }
      >
        {done ? (
          <div className="grid gap-4" role="status" aria-live="polite">
            <p className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              Your password has been changed and you&apos;ve been signed out on every device.
            </p>
            <Link href="/login" className={authPrimaryButtonClass}>
              Sign in with your new password
            </Link>
          </div>
        ) : (
          <div className="grid gap-5">
            {smsAvailable ? (
              <div role="tablist" aria-label="How to reset" className="flex gap-1 rounded-xl border border-white/10 bg-[#0d1119] p-1">
                {tab("email", "Email")}
                {tab("phone", "Text message")}
              </div>
            ) : null}

            {mode === "email" ? (
              <form
                method="post"
                className="grid gap-5"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendEmail();
                }}
              >
                <AuthField
                  id="forgot-password-email"
                  label="Account email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                {resultBox}
                {errorBox}
                <button type="submit" disabled={busy} className={authPrimaryButtonClass}>
                  {busy ? "Sending..." : result ? "Send again" : "Email me a reset link"}
                </button>
              </form>
            ) : (
              <form
                method="post"
                className="grid gap-5"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  void (codeSent ? resetWithCode() : sendText());
                }}
              >
                <AuthField
                  id="forgot-password-phone"
                  label="Verified phone number"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+1 555 123 4567"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  disabled={codeSent}
                />
                {resultBox}
                {codeSent ? (
                  <>
                    <AuthField
                      id="forgot-password-code"
                      label="6-digit code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                    <AuthField
                      id="forgot-password-new"
                      label="New password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="8+ characters"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                    />
                    {errorBox}
                    <button type="submit" disabled={busy} className={authPrimaryButtonClass}>
                      {busy ? "Saving..." : "Set new password"}
                    </button>
                    <button
                      type="button"
                      className="justify-self-center py-2 text-xs font-semibold text-slate-300 underline underline-offset-2 hover:text-white"
                      onClick={() => switchMode("phone")}
                    >
                      Use a different number or send a new code
                    </button>
                  </>
                ) : (
                  <>
                    {errorBox}
                    <button type="submit" disabled={busy} className={authPrimaryButtonClass}>
                      {busy ? "Sending..." : "Text me a code"}
                    </button>
                  </>
                )}
              </form>
            )}
          </div>
        )}
      </AuthFormCard>
    </AuthPageShell>
  );
}
