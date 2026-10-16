"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthFormCard } from "@/components/auth/auth-form-card";
import { AuthField, authPrimaryButtonClass } from "@/components/auth/auth-field";
import { resetPassword } from "@/lib/api";

const schema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm password is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type ResetForm = z.infer<typeof schema>;

export function ResetPasswordClient({ token }: { token: string }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      token,
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (token) {
      setValue("token", token);
    }
  }, [token, setValue]);

  const onSubmit = async (values: ResetForm) => {
    setServerError(null);
    setResult(null);

    try {
      const payload = await resetPassword({ token: values.token, newPassword: values.newPassword });
      setResult(payload.message);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Unable to reset password");
    }
  };

  return (
    <AuthFormCard
      title="Choose a new password"
      subtitle="Use the reset token from your email to set a new password."
      footer={
        <Link href="/login" className="font-semibold text-amber-200 transition hover:text-white">
          Back to sign in
        </Link>
      }
    >
      {result ? (
        <div className="space-y-4" role="status" aria-live="polite">
          <p className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{result}</p>
          <Link href="/login" className={authPrimaryButtonClass}>
            Sign in with your new password
          </Link>
        </div>
      ) : (
        <form method="post" onSubmit={handleSubmit(onSubmit)} className="grid gap-5" noValidate>
          <AuthField
            id="reset-token"
            label="Reset token"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            error={errors.token?.message}
            {...register("token")}
          />
          <AuthField
            id="reset-new-password"
            label="New password"
            type="password"
            autoComplete="new-password"
            placeholder="8+ characters"
            error={errors.newPassword?.message}
            {...register("newPassword")}
          />
          <AuthField
            id="reset-confirm-password"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
          {serverError ? (
            <div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {serverError}
            </div>
          ) : null}
          <button type="submit" disabled={isSubmitting} className={authPrimaryButtonClass}>
            {isSubmitting ? "Resetting password..." : "Reset password"}
          </button>
        </form>
      )}
    </AuthFormCard>
  );
}
