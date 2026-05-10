"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthFormCard } from "@/components/auth/auth-form-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPassword } from "@/lib/api";

const schema = z.object({
  email: z.string().email("Use a valid email"),
});

type ForgotForm = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [result, setResult] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: ForgotForm) => {
    setResult(null);
    setServerError(null);

    try {
      const payload = await forgotPassword(values);
      setResult(payload.token ? `${payload.message} Token: ${payload.token}` : payload.message);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Request failed");
    }
  };

  return (
    <div className="nexus-shell relative flex items-center justify-center overflow-hidden">
      <div className="solar-grid pointer-events-none absolute inset-0 -z-10" />
      <AuthFormCard
        title="Reset Password"
        subtitle="Generate a one-time reset token for your account"
        footer={
          <div className="flex items-center justify-end">
            <Link href="/login" className="text-cyan-300 hover:text-cyan-200">
              Back to login
            </Link>
          </div>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <Input label="Account Email" type="email" error={errors.email?.message} {...register("email")} />
          {result ? <p className="text-xs text-cyan-200">{result}</p> : null}
          {serverError ? <p className="text-sm text-rose-400">{serverError}</p> : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Generating token..." : "Send reset token"}
          </Button>
        </form>
      </AuthFormCard>
    </div>
  );
}
