"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthFormCard } from "@/components/auth/auth-form-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      title="Reset Password"
      subtitle="Use your recovery token to set a new password"
      footer={
        <div className="flex items-center justify-end">
          <Link href="/login" className="text-amber-300 hover:text-amber-200">
            Back to login
          </Link>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
        <Input label="Reset Token" error={errors.token?.message} {...register("token")} />
        <Input
          label="New Password"
          type="password"
          autoComplete="new-password"
          error={errors.newPassword?.message}
          {...register("newPassword")}
        />
        <Input
          label="Confirm New Password"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        {result ? <p className="text-xs text-amber-200">{result}</p> : null}
        {serverError ? <p className="text-sm text-rose-400">{serverError}</p> : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Resetting password..." : "Reset password"}
        </Button>
      </form>
    </AuthFormCard>
  );
}
