"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthFormCard } from "@/components/auth/auth-form-card";
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

  return (
    <AuthFormCard
      title="Verify Email"
      subtitle="Confirm your token and return to the login flow"
      footer={
        <div className="flex items-center justify-end gap-4">
          <Link href="/login" className="text-amber-300 hover:text-amber-200">
            Back to login
          </Link>
          <Link href="/forgot-password" className="text-amber-300 hover:text-amber-200">
            Forgot password?
          </Link>
        </div>
      }
    >
      <div className="grid gap-4">
        <p role="status" aria-live="polite" className="text-sm text-slate-300">
          {status === "loading"
            ? "Verifying your email..."
            : status === "success"
            ? message || "Email verified successfully."
            : message || "Ready to verify your email."}
        </p>
        <Link
          href="/login"
          className="nexus-interactive-btn inline-flex min-h-11 items-center justify-center rounded-2xl px-5 text-sm font-semibold tracking-wide border border-amber-300/45 bg-[linear-gradient(180deg,var(--button-top),var(--button-mid)_42%,var(--button-bottom))] text-[var(--button-ink)] shadow-[0_16px_34px_rgba(255,184,108,0.24),inset_0_1px_0_rgba(255,255,255,0.32)] hover:-translate-y-[1px]"
        >
          Continue to login
        </Link>
      </div>
    </AuthFormCard>
  );
}
