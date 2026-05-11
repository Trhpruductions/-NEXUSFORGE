"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { getPublicProfile, PublicProfile, getUserMedals, Medal, getUserActivity, UserActivity } from "@/lib/api";
import { ActivityFeed } from "@/components/profile/activity-feed";
import { MedalsDisplay } from "@/components/profile/medals-display";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { format } from "date-fns";
import { ExperienceShell } from "@/components/layout/experience-shell";

export default function PublicProfilePage() {
  const { user: currentUser, accessToken } = useAuthStore();
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [medals, setMedals] = useState<Medal[]>([]);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser || !accessToken) {
      router.push("/login");
      return;
    }

    const loadProfile = async () => {
      try {
        setLoading(true);
        const [profileData, medalsData, activitiesData] = await Promise.all([
          getPublicProfile(accessToken, userId),
          getUserMedals(accessToken, userId),
          getUserActivity(accessToken, userId, 10, 0),
        ]);

        setProfile(profileData);
        setMedals(medalsData.medals);
        setActivities(activitiesData.activities);
      } catch (err) {
        console.error("Failed to load profile:", err);
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [userId, currentUser, accessToken, router]);

  if (loading) {
    return (
      <ExperienceShell
        eyebrow="Profile"
        title="Loading profile"
        subtitle="Fetching account identity, activity, and reputation data."
        metrics={[{ label: "Status", value: "Syncing", tone: "cyan" }]}
        maxWidthClassName="max-w-6xl"
      >
        <div className="nexus-panel rounded-2xl p-4 text-cyan-400">Loading profile...</div>
      </ExperienceShell>
    );
  }

  if (error || !profile) {
    return (
      <ExperienceShell
        eyebrow="Profile"
        title="Profile unavailable"
        subtitle="This profile could not be loaded right now."
        metrics={[{ label: "Status", value: "Unavailable", tone: "amber" }]}
        maxWidthClassName="max-w-6xl"
      >
        <div className="nexus-panel rounded-2xl p-4 text-red-400">{error || "Profile not found"}</div>
      </ExperienceShell>
    );
  }

  return (
    <ExperienceShell
      eyebrow="Public Profile"
      title={profile.username}
      subtitle="View competitive reputation, boost progression, medals, and recent activity."
      metrics={[
        { label: "Reputation", value: `${profile.reputation}`, tone: "cyan" },
        { label: "App Rank", value: `#${profile.appRank}`, tone: "amber" },
        { label: "Boost Rank", value: `#${profile.boostRank}`, tone: "emerald" },
        { label: "Medals", value: `${medals.length}`, tone: "slate" },
      ]}
      actions={[
        { label: "Search Players", href: "/search", tone: "ghost" },
        { label: "Back to App", href: "/app", tone: "primary" },
      ]}
      maxWidthClassName="max-w-6xl"
    >
      {profile.banner ? (
        <div className="nexus-panel relative h-40 w-full overflow-hidden rounded-3xl bg-slate-900 sm:h-48">
          <Image src={profile.banner} alt="Banner" fill className="object-cover" sizes="(max-width: 768px) 100vw, 1200px" />
        </div>
      ) : (
        <div className="nexus-panel h-40 w-full rounded-3xl bg-gradient-to-r from-cyan-900 to-slate-900 sm:h-48" />
      )}

      <div className="nexus-panel rounded-3xl px-4 py-6 md:px-8 md:py-8">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="-mt-24 relative z-10">
            {profile.avatar ? (
              <Image
                src={profile.avatar}
                alt={profile.username}
                width={120}
                height={120}
                className="rounded-lg border-4 border-slate-950"
              />
            ) : (
              <div className="w-[120px] h-[120px] rounded-lg border-4 border-slate-950 bg-slate-800 flex items-center justify-center">
                <span className="text-2xl font-bold text-cyan-400">{profile.username[0]}</span>
              </div>
            )}
          </div>

          <div className="mt-4 flex-1 md:mt-24">
            <div className="mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-2xl font-bold sm:text-3xl">{profile.username}</h1>
              {profile.clanTag && <span className="text-cyan-400">[{profile.clanTag}]</span>}
              {profile.premium && (
                <span className="px-2 py-1 bg-amber-900 text-amber-300 text-xs font-semibold rounded">
                  {profile.premiumTier}
                </span>
              )}
            </div>

            {profile.bio && <p className="text-slate-300 mb-4">{profile.bio}</p>}

            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              <div className="rounded-xl border border-slate-700/80 bg-slate-900/75 p-4">
                <div className="text-cyan-400 font-semibold">{profile.reputation}</div>
                <div className="text-sm text-slate-400">Reputation</div>
              </div>
              <div className="rounded-xl border border-slate-700/80 bg-slate-900/75 p-4">
                <div className="text-amber-300 font-semibold">#{profile.appRank}</div>
                <div className="text-sm text-slate-400">App Rank</div>
              </div>
              <div className="rounded-xl border border-slate-700/80 bg-slate-900/75 p-4">
                <div className="text-emerald-300 font-semibold">#{profile.boostRank}</div>
                <div className="text-sm text-slate-400">Boost Rank</div>
              </div>
              <div className="rounded-xl border border-slate-700/80 bg-slate-900/75 p-4">
                <div className="text-violet-300 font-semibold">{medals.length}</div>
                <div className="text-sm text-slate-400">Medals</div>
              </div>
              <div className="rounded-xl border border-slate-700/80 bg-slate-900/75 p-4">
                <div className="text-blue-400 font-semibold">{profile.forgesOwned}</div>
                <div className="text-sm text-slate-400">Forges Owned</div>
              </div>
              <div className="rounded-xl border border-slate-700/80 bg-slate-900/75 p-4">
                <div className="text-purple-400 font-semibold">{profile.forgesMember}</div>
                <div className="text-sm text-slate-400">Forges Member</div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 md:grid-cols-3 md:gap-4">
              <div>
                <span className="text-slate-400">Joined:</span>
                <span className="ml-2 text-slate-100">{format(new Date(profile.createdAt), "MMM d, yyyy")}</span>
              </div>
              {(profile.corePlusBoostLevel ?? 0) > 0 && (
                <div>
                  <span className="text-slate-400">Boost Level:</span>
                  <span className="ml-2 text-emerald-400 font-semibold">{profile.corePlusBoostLevel}</span>
                </div>
              )}
              {(profile.corePlusStreakDays ?? 0) > 0 && (
                <div>
                  <span className="text-slate-400">Streak Days:</span>
                  <span className="ml-2 text-orange-400 font-semibold">{profile.corePlusStreakDays}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {medals.length > 0 && (
          <div className="mt-12 rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4">
            <h2 className="text-2xl font-bold mb-4">Medals</h2>
            <MedalsDisplay medals={medals} />
          </div>
        )}

        {activities.length > 0 && (
          <div className="mt-12 rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4">
            <h2 className="text-2xl font-bold mb-4">Recent Activity</h2>
            <ActivityFeed activities={activities} />
          </div>
        )}
      </div>
    </ExperienceShell>
  );
}
