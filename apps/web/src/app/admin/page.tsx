"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { ExperienceShell } from "@/components/layout/experience-shell";

export default function AdminPage() {
  const router = useRouter();
  const { user, hydrated } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return;

    if (!user) {
      router.push("/login?redirect=%2Fadmin");
      return;
    }

    if (!user.isAdmin) {
      router.push("/app");
      return;
    }
  }, [user, hydrated, router]);

  if (!hydrated || !user?.isAdmin) {
    return (
      <ExperienceShell
        eyebrow="Access Denied"
        title="Admin Only"
        subtitle="You do not have permission to access moderation and governance controls."
        metrics={[
          { label: "Access", value: "Restricted", tone: "amber" },
          { label: "Required Role", value: "ADMIN", tone: "slate" },
        ]}
        actions={[{ label: "Return to App", href: "/app", tone: "ghost" }]}
        maxWidthClassName="max-w-7xl"
      >
        <div className="nexus-display-panel rounded-[24px] p-5 text-sm text-slate-300">
          <p className="text-[10px] uppercase tracking-[0.18em] text-amber-200">Restricted Access</p>
          <p className="mt-2">Your current account lacks admin privileges.</p>
        </div>
      </ExperienceShell>
    );
  }

  return (
    <ExperienceShell
      eyebrow="Moderation Console"
      title="Admin Dashboard"
      subtitle="Monitor growth, manage permissions, and enforce launch governance from one hardened control surface."
      metrics={[
        { label: "Governance", value: "Live", tone: "emerald" },
        { label: "Launch Mode", value: "Runtime Controlled", tone: "cyan" },
        { label: "Risk Monitoring", value: "Active", tone: "amber" },
      ]}
      actions={[
        { label: "Open Command Center", href: "/app", tone: "ghost" },
        { label: "Review Notifications", href: "/notifications", tone: "primary" },
      ]}
      maxWidthClassName="max-w-7xl"
    >
      <AdminDashboard />
    </ExperienceShell>
  );
}
