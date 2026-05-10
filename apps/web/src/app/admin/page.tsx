"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

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
      <div className="nexus-shell px-4 py-6 sm:px-8">
        <div className="nexus-shell-inner max-w-7xl space-y-4">
          <div className="nexus-hero">
            <p className="nexus-eyebrow text-red-400">Access Denied</p>
            <h1 className="nexus-title mt-2 text-slate-50">Admin Only</h1>
            <p className="nexus-subtitle mt-2 text-slate-400">You do not have permission to access this section.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="nexus-shell px-4 py-6 sm:px-8">
      <div className="nexus-shell-inner max-w-7xl space-y-4">
        <div className="nexus-hero">
          <p className="nexus-eyebrow text-cyan-300">Moderation Console</p>
          <h1 className="nexus-title mt-2 text-slate-50">Admin Dashboard</h1>
          <p className="nexus-subtitle mt-2 text-slate-400">Monitor growth, manage user permissions, and keep the community stable.</p>
        </div>
        <AdminDashboard />
      </div>
    </div>
  );
}
