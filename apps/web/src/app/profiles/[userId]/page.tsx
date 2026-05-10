"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { getPublicProfile, PublicProfile, getUserMedals, Medal, getUserActivity, UserActivity } from "@/lib/api";
import { ActivityFeed } from "@/components/profile/activity-feed";
import { MedalsDisplay } from "@/components/profile/medals-display";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { format } from "date-fns";

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-cyan-400">Loading profile...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-400">{error || "Profile not found"}</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Banner */}
      {profile.banner ? (
        <div className="relative h-48 w-full bg-slate-900">
          <Image src={profile.banner} alt="Banner" fill className="object-cover" />
        </div>
      ) : (
        <div className="h-48 w-full bg-gradient-to-r from-cyan-900 to-slate-900" />
      )}

      {/* Profile Header */}
      <div className="px-4 md:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Avatar */}
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

          {/* User Info */}
          <div className="flex-1 mt-4 md:mt-24">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{profile.username}</h1>
              {profile.clanTag && <span className="text-cyan-400">[{profile.clanTag}]</span>}
              {profile.premium && (
                <span className="px-2 py-1 bg-amber-900 text-amber-300 text-xs font-semibold rounded">
                  {profile.premiumTier}
                </span>
              )}
            </div>

            {profile.bio && <p className="text-slate-300 mb-4">{profile.bio}</p>}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-slate-900 p-4 rounded">
                <div className="text-cyan-400 font-semibold">{profile.reputation}</div>
                <div className="text-sm text-slate-400">Reputation</div>
              </div>
              <div className="bg-slate-900 p-4 rounded">
                <div className="text-amber-300 font-semibold">#{profile.appRank}</div>
                <div className="text-sm text-slate-400">App Rank</div>
              </div>
              <div className="bg-slate-900 p-4 rounded">
                <div className="text-emerald-300 font-semibold">#{profile.boostRank}</div>
                <div className="text-sm text-slate-400">Boost Rank</div>
              </div>
              <div className="bg-slate-900 p-4 rounded">
                <div className="text-violet-300 font-semibold">{medals.length}</div>
                <div className="text-sm text-slate-400">Medals</div>
              </div>
              <div className="bg-slate-900 p-4 rounded">
                <div className="text-blue-400 font-semibold">{profile.forgesOwned}</div>
                <div className="text-sm text-slate-400">Forges Owned</div>
              </div>
              <div className="bg-slate-900 p-4 rounded">
                <div className="text-purple-400 font-semibold">{profile.forgesMember}</div>
                <div className="text-sm text-slate-400">Forges Member</div>
              </div>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6 text-sm">
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

        {/* Medals Section */}
        {medals.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-4">Medals</h2>
            <MedalsDisplay medals={medals} />
          </div>
        )}

        {/* Activity Section */}
        {activities.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-4">Recent Activity</h2>
            <ActivityFeed activities={activities} />
          </div>
        )}
      </div>
    </main>
  );
}
