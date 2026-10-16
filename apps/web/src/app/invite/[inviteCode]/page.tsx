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
  const inviteCode = typeof params?.inviteCode === "string" ? params.inviteCode.toLowerCase() : "";
  const { accessToken, csrfToken, user, hydrated } = useAuthStore();

  const inviteQuery = useQuery({
    queryKey: ["public-forge-invite", inviteCode],
    queryFn: () => getPublicForgeInvite(inviteCode),
    enabled: Boolean(inviteCode),
    retry: false,
  });

  const invite = inviteQuery.data?.forge ?? null;
  const isInviteLoading = inviteQuery.fetchStatus === "fetching" && !invite && !inviteQuery.isError;
  // A made-up, expired or revoked code lands here. Show the reason once, not in every panel.
  const inviteUnavailable = !isInviteLoading && !invite;

  const joinMutation = useMutation({
    mutationFn: () => joinForge(accessToken!, csrfToken!, inviteCode),
    onSuccess: () => {
      router.push("/app");
    },
  });

  const redirectParam = encodeURIComponent(`/invite/${inviteCode}`);

  const errorMessage = joinMutation.isError
    ? joinMutation.error instanceof Error
      ? joinMutation.error.message
      : "Unable to join this forge right now."
    : null;

  return (
    <ExperienceShell
      eyebrow="Forge Invite"
      title="Join this Nexus Forge Gaming server"
      subtitle="Review the server details, then join instantly if you are signed in."
      metrics={[
        { label: "Invite Code", value: inviteCode || "N/A", tone: "amber" },
        { label: "Status", value: isInviteLoading ? "Loading" : invite ? "Valid" : "Not valid", tone: "amber" },
      ]}
      actions={[
        { label: "Open App", href: "/app", tone: "ghost" },
        { label: "Open Search", href: "/search", tone: "primary" },
      ]}
      maxWidthClassName="max-w-5xl"
    >

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="nexus-panel-glass rounded-[28px] border border-white/10 bg-[#11151e] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            {isInviteLoading ? (
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-amber-300">Invite Intake</p>
                  <p className="mt-2 text-sm text-slate-400">Loading forge invite...</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="nexus-metric-card nexus-interactive-card rounded-[20px] p-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Owner</p>
                    <p className="mt-2 text-sm font-semibold text-white">Resolving</p>
                  </div>
                  <div className="nexus-metric-card nexus-interactive-card rounded-[20px] p-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Members</p>
                    <p className="mt-2 text-sm font-semibold text-white">Scanning</p>
                  </div>
                  <div className="nexus-metric-card nexus-interactive-card rounded-[20px] p-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Status</p>
                    <p className="mt-2 text-sm font-semibold text-amber-200">Fetching invite</p>
                  </div>
                </div>
              </div>
            ) : invite ? (
              <>
                <div className="flex items-start gap-4">
                  {invite.icon ? (
                    <Image
                      src={invite.icon}
                      alt={`${invite.name} icon`}
                      width={80}
                      height={80}
                      unoptimized
                      className="h-20 w-20 rounded-[18px] border border-amber-400/40 object-cover aspect-square"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-[18px] border border-amber-400/40 bg-amber-500/10 text-2xl font-semibold text-amber-200">
                      {invite.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-amber-300">/{invite.inviteCode}</p>
                    <h2 className="mt-2 break-words text-xl font-semibold text-white sm:text-2xl">{invite.name}</h2>
                    <p className="mt-2 text-sm text-slate-400">
                      {invite.description ?? "No public description has been added for this forge yet."}
                    </p>
                  </div>
                </div>

                {invite.banner ? (
                  <Image
                    src={invite.banner}
                    alt={`${invite.name} banner`}
                    width={1200}
                    height={352}
                    unoptimized
                    className="mt-5 h-44 w-full rounded-[22px] border border-white/10 object-cover"
                  />
                ) : null}

                <div className="mt-5 grid gap-3 grid-cols-1 sm:grid-cols-3">
                  <div className="nexus-metric-card rounded-[20px] p-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Owner</p>
                    <p className="mt-2 text-sm font-semibold text-white">{invite.owner.username}</p>
                  </div>
                  <div className="nexus-metric-card rounded-[20px] p-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Members</p>
                    <p className="mt-2 text-sm font-semibold text-white">{invite.memberCount}</p>
                  </div>
                  <div className="nexus-metric-card rounded-[20px] p-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Created</p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {new Date(invite.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 grid-cols-1 sm:grid-cols-2">
                  <div className="nexus-display-panel rounded-[20px] p-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-amber-200">Invite Views</p>
                    <p className="mt-2 text-sm font-semibold text-white">{invite.inviteViewCount}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Last viewed {invite.inviteLastViewedAt ? new Date(invite.inviteLastViewedAt).toLocaleString() : "not yet"}
                    </p>
                  </div>
                  <div className="nexus-display-panel rounded-[20px] p-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-amber-200">Invite Joins</p>
                    <p className="mt-2 text-sm font-semibold text-white">{invite.inviteJoinCount}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Last joined {invite.inviteLastJoinedAt ? new Date(invite.inviteLastJoinedAt).toLocaleString() : "not yet"}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="nexus-display-panel rounded-[20px] p-5 text-sm leading-6 text-slate-300">
                <p className="text-[11px] uppercase tracking-[0.22em] text-amber-200">Invite unavailable</p>
                <p className="mt-2">
                  This invite link isn&apos;t valid anymore. It may have expired, been revoked, or been typed incorrectly.
                </p>
                <p className="mt-2 text-slate-400">Ask the forge owner for a fresh invite link.</p>
              </div>
            )}
          </div>

          <div className="nexus-panel-glass rounded-[28px] border border-white/10 bg-[#11151e] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <p className="text-[11px] uppercase tracking-[0.22em] text-amber-200">Join Flow</p>
            <div className="mt-4 space-y-3 text-sm text-slate-400">
              <p>
                {inviteUnavailable
                  ? "There is nothing to join with this link. Ask the forge owner for a new invite."
                  : hydrated && user
                    ? `Signed in as ${user.username}. Join immediately and drop into the desktop workspace.`
                    : "Sign in or register to accept this invite and attach the forge to your account."}
              </p>
              {errorMessage ? <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-rose-200">{errorMessage}</p> : null}
            </div>

            <div className="mt-5 grid gap-3">
              {hydrated && accessToken && csrfToken && user ? (
                <Button
                  variant="primary"
                  onClick={() => joinMutation.mutate()}
                  disabled={joinMutation.isPending || isInviteLoading || !invite}
                  className="w-full"
                >
                  {joinMutation.isPending ? "Joining Forge..." : "Join Forge"}
                </Button>
              ) : (
                <>
                  <Link
                    href={`/login?redirect=${redirectParam}`}
                    className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[linear-gradient(120deg,#9fd8ff,#2ea4ff_55%,#0b6fe0)] px-5 text-sm font-semibold text-slate-950 shadow-[0_14px_36px_rgba(46,164,255,0.3)] transition hover:-translate-y-px"
                  >
                    Sign in to join
                  </Link>
                  <Link
                    href={`/register?redirect=${redirectParam}`}
                    className="inline-flex h-11 w-full items-center justify-center rounded-full border border-white/15 bg-[#0d1119] px-5 text-sm font-semibold text-white transition hover:border-amber-300/60"
                  >
                    Create account
                  </Link>
                </>
              )}

              <Link
                href="/app"
                className="nexus-outline-button inline-flex h-11 w-full items-center justify-center rounded-full px-5 text-sm font-semibold text-slate-300"
              >
                Open Workspace
              </Link>
            </div>
          </div>
        </section>
    </ExperienceShell>
  );
}