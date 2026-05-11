"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getPublicForgeInvite, joinForge } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { ExperienceShell } from "@/components/layout/experience-shell";

export default function InvitePage() {
  const params = useParams<{ inviteCode: string }>();
  const router = useRouter();
  const inviteCode = typeof params.inviteCode === "string" ? params.inviteCode.toLowerCase() : "";
  const { accessToken, csrfToken, user, hydrated } = useAuthStore();

  const inviteQuery = useQuery({
    queryKey: ["public-forge-invite", inviteCode],
    queryFn: () => getPublicForgeInvite(inviteCode),
    enabled: Boolean(inviteCode),
  });

  const joinMutation = useMutation({
    mutationFn: () => joinForge(accessToken!, csrfToken!, inviteCode),
    onSuccess: () => {
      router.push("/app");
    },
  });

  const redirectParam = encodeURIComponent(`/invite/${inviteCode}`);

  const errorMessage = inviteQuery.isError
    ? "This invite link does not exist anymore."
    : joinMutation.isError
      ? joinMutation.error instanceof Error
        ? joinMutation.error.message
        : "Unable to join this forge right now."
      : null;

  return (
    <ExperienceShell
      eyebrow="Forge Invite"
      title="Join this NexusForge server"
      subtitle="Review the server details, then join instantly if you are signed in."
      metrics={[
        { label: "Invite Code", value: inviteCode || "N/A", tone: "cyan" },
        { label: "Status", value: inviteQuery.isLoading ? "Loading" : inviteQuery.data ? "Valid" : "Unavailable", tone: inviteQuery.data ? "emerald" : "amber" },
      ]}
      actions={[
        { label: "Open App", href: "/app", tone: "ghost" },
        { label: "Open Search", href: "/search", tone: "primary" },
      ]}
      maxWidthClassName="max-w-5xl"
    >

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="nexus-panel rounded-3xl p-6">
            {inviteQuery.isLoading ? (
              <p className="text-sm text-slate-300">Loading forge invite...</p>
            ) : inviteQuery.data ? (
              <>
                <div className="flex items-start gap-4">
                  {inviteQuery.data.forge.icon ? (
                    <Image
                      src={inviteQuery.data.forge.icon}
                      alt={`${inviteQuery.data.forge.name} icon`}
                      width={80}
                      height={80}
                      unoptimized
                      className="h-20 w-20 rounded-2xl border border-cyan-500/35 object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-cyan-500/35 bg-cyan-950/35 text-2xl font-semibold text-cyan-100">
                      {inviteQuery.data.forge.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">/{inviteQuery.data.forge.inviteCode}</p>
                    <h2 className="mt-2 break-words text-xl font-semibold text-slate-50 sm:text-2xl">{inviteQuery.data.forge.name}</h2>
                    <p className="mt-2 text-sm text-slate-300">
                      {inviteQuery.data.forge.description ?? "No public description has been added for this forge yet."}
                    </p>
                  </div>
                </div>

                {inviteQuery.data.forge.banner ? (
                  <Image
                    src={inviteQuery.data.forge.banner}
                    alt={`${inviteQuery.data.forge.name} banner`}
                    width={1200}
                    height={352}
                    unoptimized
                    className="mt-5 h-44 w-full rounded-2xl border border-slate-700/80 object-cover"
                  />
                ) : null}

                <div className="mt-5 grid gap-3 grid-cols-1 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Owner</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{inviteQuery.data.forge.owner.username}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Members</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{inviteQuery.data.forge.memberCount}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Created</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">
                      {new Date(inviteQuery.data.forge.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 grid-cols-1 sm:grid-cols-2">
                  <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">Invite Views</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{inviteQuery.data.forge.inviteViewCount}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Last viewed {inviteQuery.data.forge.inviteLastViewedAt ? new Date(inviteQuery.data.forge.inviteLastViewedAt).toLocaleString() : "not yet"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-amber-200">Invite Joins</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{inviteQuery.data.forge.inviteJoinCount}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Last joined {inviteQuery.data.forge.inviteLastJoinedAt ? new Date(inviteQuery.data.forge.inviteLastJoinedAt).toLocaleString() : "not yet"}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-300">Invite unavailable.</p>
            )}
          </div>

          <div className="nexus-panel rounded-3xl p-6">
            <p className="text-[11px] uppercase tracking-[0.22em] text-amber-200">Join Flow</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p>
                {hydrated && user
                  ? `Signed in as ${user.username}. Join immediately and drop into the command center.`
                  : "Sign in or register to accept this invite and attach the forge to your account."}
              </p>
              {errorMessage ? <p className="text-rose-300">{errorMessage}</p> : null}
            </div>

            <div className="mt-5 grid gap-3">
              {hydrated && accessToken && csrfToken && user ? (
                <Button
                  onClick={() => joinMutation.mutate()}
                  disabled={joinMutation.isPending || inviteQuery.isLoading || !inviteQuery.data}
                >
                  {joinMutation.isPending ? "Joining Forge..." : "Join Forge"}
                </Button>
              ) : (
                <>
                  <Link
                    href={`/login?redirect=${redirectParam}`}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-cyan-400 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
                  >
                    Sign In To Join
                  </Link>
                  <Link
                    href={`/register?redirect=${redirectParam}`}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-cyan-500/35 bg-cyan-950/25 px-5 text-sm font-semibold text-cyan-100 hover:border-cyan-300"
                  >
                    Create Account
                  </Link>
                </>
              )}

              <Link
                href="/app"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/80 px-5 text-sm font-semibold text-slate-100 hover:border-cyan-500/50"
              >
                Open Command Center
              </Link>
            </div>
          </div>
        </section>
    </ExperienceShell>
  );
}