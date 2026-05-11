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
import { login } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const schema = z.object({
  email: z.string().email("Use a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean(),
});

type LoginForm = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
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
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: true,
    },
  });

  const onSubmit = async (values: LoginForm) => {
    setServerError(null);
    try {
      const payload = await login(values);
      setSession({
        accessToken: payload.accessToken,
        csrfToken: payload.csrfToken,
        user: payload.user,
        rememberMe: values.rememberMe,
      });
      router.push(redirectTarget);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Login failed");
    }
  };

  return (
    <div className="nexus-shell flex items-center justify-center">
      <AuthFormCard
        title="Sign In"
        subtitle="Enter your credentials to access your NexusForge account"
        footer={
          <div className="flex items-center justify-between gap-4">
            <Link href="/forgot-password" className="text-cyan-400 hover:text-cyan-300">
              Forgot password?
            </Link>
            <Link href={`/register?redirect=${encodeURIComponent(redirectTarget)}`} className="text-cyan-400 hover:text-cyan-300">
              Create account
            </Link>
          </div>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password")}
          />
          <label className="inline-flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border border-slate-600 bg-slate-900 text-cyan-400 focus:ring-2 focus:ring-cyan-500/40"
              {...register("rememberMe")}
            />
            <span>Remember me on this device</span>
          </label>
          {serverError ? <p className="text-sm text-rose-400">{serverError}</p> : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Authenticating..." : "Sign In"}
          </Button>
        </form>
      </AuthFormCard>
    </div>
  );
}
