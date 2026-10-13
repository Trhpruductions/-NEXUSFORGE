"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AuthFormCard } from "@/components/auth/auth-form-card";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${mode === value ? "bg-amber-400 text-slate-950" : "text-slate-300 hover:text-white"}`}
    >
      {label}
    </button>
  );

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
              <p className="mt-2 text-sm text-slate-400">Check your inbox (and spam folder) for an email from Vexora Gaming{smsAvailable ? ", or your texts" : ""}.</p>
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
        title="Reset Password"
        subtitle={mode === "email" ? "We'll email you a link to choose a new password" : "We'll text a code to your verified phone"}
        footer={
          <div className="flex items-center justify-end">
            <Link href="/login" className="text-amber-200 hover:text-amber-200">
              Back to login
            </Link>
          </div>
        }
      >
        {done ? (
          <div className="grid gap-3" role="status" aria-live="polite">
            <p className="text-sm text-emerald-200">Your password has been changed and you&apos;ve been signed out on every device.</p>
            <Link href="/login" className="text-amber-200 underline hover:text-amber-100">
              Sign in with your new password
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {smsAvailable ? (
              <div role="tablist" aria-label="How to reset" className="flex gap-1 rounded-xl border border-white/10 bg-[#0d1119] p-1">
                {tab("email", "Email")}
                {tab("phone", "Text message")}
              </div>
            ) : null}

            {mode === "email" ? (
              <form
                className="grid gap-4"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendEmail();
                }}
              >
                <Input id="forgot-password-email" label="Account Email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                {result ? (
                  <p className="text-xs text-amber-200" role="status" aria-live="polite">
                    {result}
                  </p>
                ) : null}
                <Button type="submit" disabled={busy}>
                  {busy ? "Sending..." : result ? "Send again" : "Email me a reset link"}
                </Button>
              </form>
            ) : (
              <form
                className="grid gap-4"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  void (codeSent ? resetWithCode() : sendText());
                }}
              >
                <Input id="forgot-password-phone" label="Verified phone number" type="tel" autoComplete="tel" placeholder="+1 555 123 4567" value={phone} onChange={(event) => setPhone(event.target.value)} disabled={codeSent} />
                {result ? (
                  <p className="text-xs text-amber-200" role="status" aria-live="polite">
                    {result}
                  </p>
                ) : null}
                {codeSent ? (
                  <>
                    <Input id="forgot-password-code" label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
                    <Input id="forgot-password-new" label="New password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                    <Button type="submit" disabled={busy}>
                      {busy ? "Saving..." : "Set new password"}
                    </Button>
                    <button type="button" className="text-xs text-slate-400 underline hover:text-slate-200" onClick={() => switchMode("phone")}>
                      Use a different number or send a new code
                    </button>
                  </>
                ) : (
                  <Button type="submit" disabled={busy}>
                    {busy ? "Sending..." : "Text me a code"}
                  </Button>
                )}
              </form>
            )}

            {serverError ? (
              <p role="alert" className="text-sm text-rose-400">
                {serverError}
              </p>
            ) : null}
          </div>
        )}
      </AuthFormCard>
    </AuthPageShell>
  );
}
