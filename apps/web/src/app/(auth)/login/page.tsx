"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthFormCard } from "@/components/auth/auth-form-card";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { login } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { Terminal, ShieldAlert, Activity, ArrowRight } from "lucide-react";

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

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null);
  const setSession = useAuthStore((state) => state.setSession);

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
      setSession({
        accessToken: payload.accessToken,
        csrfToken: payload.csrfToken,
        user: payload.user,
        rememberMe: true,
      });
      const defaultDestination = payload.user.isAdmin ? "/admin" : "/workspace";
      router.push(redirectTarget ?? defaultDestination);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Login failed");
    }
  };

  return (
    <AuthPageShell
      hero={
        <div className="space-y-12">
           <div className="flex items-center gap-4">
              <div className="w-12 h-px bg-amber-500 shadow-[0_0_10px_rgba(251,191,36,0.6)]" />
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.5em]">Command_Access</span>
           </div>
           
           <h2 className="text-6xl font-black uppercase leading-tight italic tracking-tighter text-slate-950">
             Secure Your <br/> <span className="text-amber-500">Node_Vault</span>.
           </h2>
           
           <p className="max-w-md text-[13px] text-slate-500 uppercase tracking-widest leading-loose">
             Synchronize session keys and initialize your localized control deck with industrial-grade encryption layers.
           </p>

           <div className="grid grid-cols-2 gap-4">
              {[
                { label: "IP_Masking", status: "ACTIVE", icon: ShieldAlert },
                { label: "Auth_Sync", status: "READY", icon: Activity },
              ].map(stat => (
                 <div key={stat.label} className="flex flex-col gap-4 rounded-[20px] border border-slate-900/10 bg-white/80 p-6">
                   <stat.icon className="w-4 h-4 text-emerald-500" />
                   <div>
                      <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{stat.label}</p>
                     <p className="text-[10px] text-slate-900 font-black uppercase tracking-widest">{stat.status}</p>
                   </div>
                </div>
              ))}
           </div>
        </div>
      }
    >
      <AuthFormCard 
        title="Initialize Session"
        subtitle="Provide credentials to establish a secure tunnel to the NexusForge grid."
        footer={
          <Link href="/register" className="hover:text-amber-500 transition-colors">
             No account? Request Node Access <ArrowRight className="inline w-3 h-3 ml-2" />
          </Link>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Email_Address</label>
              <input 
                 {...register("email")}
                  className="w-full rounded-[18px] border border-slate-900/10 bg-white p-4 text-[12px] font-bold uppercase tracking-widest text-slate-900 transition-colors focus:border-amber-400/60 focus:outline-none"
                 placeholder="COMMANDER@NEXUS"
              />
              {errors.email && <p className="text-[9px] text-rose-500 uppercase font-black">{errors.email.message}</p>}
           </div>

           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Security_Key</label>
              <input 
                 type="password"
                 {...register("password")}
                  className="w-full rounded-[18px] border border-slate-900/10 bg-white p-4 text-[12px] font-bold uppercase tracking-widest text-slate-900 transition-colors focus:border-amber-400/60 focus:outline-none"
                 placeholder="********"
              />
              {errors.password && <p className="text-[9px] text-rose-500 uppercase font-black">{errors.password.message}</p>}
           </div>

           {serverError && (
              <div className="p-4 bg-rose-500/5 border border-rose-500/20 text-[10px] text-rose-500 font-bold uppercase tracking-widest">
                 {serverError}
              </div>
           )}

           <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full py-5 bg-amber-500 text-black font-black uppercase tracking-[0.2em] text-[11px] hover:bg-amber-400 transition-all disabled:opacity-50"
           >
              {isSubmitting ? "THROTTLING AUTH..." : "IDENTIFY & SYNC"}
           </button>
        </form>
      </AuthFormCard>
    </AuthPageShell>
  );
}
