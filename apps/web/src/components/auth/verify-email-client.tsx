"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthFormCard } from "@/components/auth/auth-form-card";
import { authPrimaryButtonClass } from "@/components/auth/auth-field";
import { verifyEmail } from "@/lib/api";

export function VerifyEmailClient({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }

    setStatus("loading");
    setMessage(null);

    const verify = async () => {
      try {
        const payload = await verifyEmail(token);
        setStatus("success");
        setMessage(payload.message);
      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Email verification failed.");
      }
    };

    verify();
  }, [token]);

  const text =
    status === "loading"
      ? "Verifying your email..."
      : status === "success"
        ? message || "Email verified successfully."
        : message || "Ready to verify your email.";

  const tone =
    status === "success"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
      : status === "error"
        ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
        : "border-white/10 bg-white/[0.03] text-slate-300";

  return (
    <AuthFormCard
      title="Verify your email"
      subtitle="We're confirming the email address on your account."
      footer={
        <div className="flex items-center justify-end gap-4">
          <Link href="/login" className="font-semibold text-amber-200 transition hover:text-white">
            Back to sign in
          </Link>
          <Link href="/forgot-password" className="font-semibold text-amber-200 transition hover:text-white">
            Forgot password?
          </Link>
        </div>
      }
    >
      <div className="grid gap-5">
        <p role="status" aria-live="polite" className={`rounded-2xl border px-4 py-3 text-sm ${tone}`}>
          {text}
        </p>
        <Link href="/login" className={authPrimaryButtonClass}>
          Continue to sign in
        </Link>
      </div>
    </AuthFormCard>
  );
}
