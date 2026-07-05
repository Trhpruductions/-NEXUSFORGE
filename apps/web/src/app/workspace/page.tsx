"use client";

import { useEffect, useMemo, useState } from "react";
import NextImage from "next/image";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { GuestAuthCallout } from "@/components/auth/guest-auth-callout";
import { useAuthStore } from "@/store/auth-store";

const AUTH_PERSIST_MODE_KEY = "nexusforge-auth-persist-mode";
const HEALTH_REFRESH_INTERVAL_MS = 30_000;
const HEALTH_STALE_AFTER_MS = HEALTH_REFRESH_INTERVAL_MS * 3;
const WORKSPACE_AVATAR_KEY = "nexusforge-workspace-avatar";
const WORKSPACE_BADGE_KEY = "nexusforge-workspace-badge";
const MAX_AVATAR_FILE_BYTES = 5 * 1024 * 1024;

type AvatarPreset = {
  id: string;
  label: string;
  src: string;
  tone: string;
};

const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "vip", label: "VIP", src: "/brand/profile-badge-vip.png", tone: "border-amber-300/60" },
  { id: "legend", label: "Legend", src: "/brand/profile-badge-legend.png", tone: "border-fuchsia-300/60" },
  { id: "staff", label: "Staff", src: "/brand/profile-badge-staff.png", tone: "border-sky-300/60" },
  { id: "moderator", label: "Mod", src: "/brand/profile-badge-moderator.png", tone: "border-emerald-300/60" },
  { id: "admin", label: "Admin", src: "/brand/profile-badge-admin.png", tone: "border-rose-300/60" },
  { id: "owner", label: "Owner", src: "/brand/profile-badge-owner.png", tone: "border-indigo-300/60" },
];

function formatDateLabel(value?: string | null): string {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

type WorkspaceHealthStatus = "healthy" | "degraded" | "unknown";

type GateHealthResponse = {
  status: WorkspaceHealthStatus;
  detail?: string;
  generatedAt?: string | null;
  strictMode?: boolean;
  checkpointRequested?: boolean;
  checkpointSaved?: boolean;
  checkpointSkipped?: boolean;
  checkpointSkipReason?: string;
  counts?: {
    total: number;
    pass: number;
    warning: number;
    fail: number;
    error: number;
    blocking: number;
  };
};

function appendHealthSample(previous: WorkspaceHealthStatus[], sample: WorkspaceHealthStatus): WorkspaceHealthStatus[] {
  return [...previous, sample].slice(-10);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to decode image."));
    image.src = dataUrl;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Invalid file payload."));
      }
    };
    reader.onerror = () => reject(new Error("Failed reading image file."));
    reader.readAsDataURL(file);
  });
}

async function buildSquareAvatarDataUrl(file: File): Promise<string> {
  validateAvatarFile(file);
  const fileDataUrl = await readFileAsDataUrl(file);
  return buildSquareAvatarDataUrlFromDataUrl(fileDataUrl, 1, 0, 0);
}

function validateAvatarFile(file: File): void {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload a valid image file.");
  }

  if (file.size > MAX_AVATAR_FILE_BYTES) {
    throw new Error("Image is too large. Max size is 5MB.");
  }
}

async function buildSquareAvatarDataUrlFromDataUrl(dataUrl: string, zoom: number, offsetX: number, offsetY: number): Promise<string> {
  const image = await loadImageFromDataUrl(dataUrl);

  const minSide = Math.min(image.width, image.height);
  const normalizedZoom = clamp(zoom, 1, 3);
  const sourceCropSize = minSide / normalizedZoom;
  const sourceUnitsPerOutputPixel = minSide / 256 / normalizedZoom;

  const sourceCenterX = image.width / 2 - offsetX * sourceUnitsPerOutputPixel;
  const sourceCenterY = image.height / 2 - offsetY * sourceUnitsPerOutputPixel;

  const sourceX = clamp(sourceCenterX - sourceCropSize / 2, 0, image.width - sourceCropSize);
  const sourceY = clamp(sourceCenterY - sourceCropSize / 2, 0, image.height - sourceCropSize);

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas processing unavailable.");
  }

  context.drawImage(image, sourceX, sourceY, sourceCropSize, sourceCropSize, 0, 0, 256, 256);
  return canvas.toDataURL("image/jpeg", 0.92);
}

function WorkspaceAnalyticsCards({
  roleLabel,
  sessionMode,
  emailVerified,
  premiumTier,
  joinedAt,
  lastSeenAt,
}: {
  roleLabel: string;
  sessionMode: string;
  emailVerified: boolean;
  premiumTier: string;
  joinedAt: string;
  lastSeenAt: string;
}) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <section className="nexus-display-panel rounded-[24px] p-5 text-slate-600">
        <p className="text-[10px] uppercase tracking-[0.18em] text-sky-700">Role & Session</p>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p>
            <span className="font-semibold text-slate-900">Role:</span> {roleLabel}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Session Mode:</span> {sessionMode}
          </p>
        </div>
      </section>

      <section className="nexus-display-panel rounded-[24px] p-5 text-slate-600">
        <p className="text-[10px] uppercase tracking-[0.18em] text-amber-700">Account Readiness</p>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p>
            <span className="font-semibold text-slate-900">Email:</span> {emailVerified ? "Verified" : "Unverified"}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Premium:</span> {premiumTier}
          </p>
        </div>
      </section>

      <section className="nexus-display-panel rounded-[24px] p-5 text-slate-600 sm:col-span-2 xl:col-span-1">
        <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-700">Timeline</p>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p>
            <span className="font-semibold text-slate-900">Joined:</span> {joinedAt}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Last Seen:</span> {lastSeenAt}
          </p>
        </div>
      </section>
    </div>
  );
}

function WorkspaceGuestView() {
  return (
    <GuestAuthCallout
      title="Sign in to unlock your workspace"
      description="NexusForge workspace gives regular users direct access to social coordination, mining systems, rewards, and profile controls."
      loginHref="/login?redirect=/workspace"
      registerHref="/register?redirect=/workspace"
      loginLabel="Sign in to Workspace"
      registerLabel="Create account"
    />
  );
}

function WorkspaceUserView() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <section className="nexus-display-panel rounded-[24px] p-5 text-slate-600">
        <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-700">Core Access</p>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>Activity, friends, and voice collaboration</li>
          <li>Mining, rewards, and progression systems</li>
          <li>Profile management and notifications</li>
        </ul>
      </section>

      <section className="nexus-display-panel rounded-[24px] p-5 text-slate-600">
        <p className="text-[10px] uppercase tracking-[0.18em] text-sky-700">Recommended Flow</p>
        <ol className="mt-3 space-y-2 text-sm text-slate-700">
          <li>Start in App Home for live feed context</li>
          <li>Open Mining or Rewards to continue progression</li>
          <li>Check Notifications for operational updates</li>
        </ol>
      </section>

      <section className="nexus-display-panel rounded-[24px] p-5 text-slate-600 md:col-span-2 xl:col-span-1">
        <p className="text-[10px] uppercase tracking-[0.18em] text-amber-700">Admin Separation</p>
        <p className="mt-3 text-sm text-slate-700">
          Governance and moderation controls remain isolated under admin routes. This workspace is optimized for regular-user operations and progression.
        </p>
      </section>
    </div>
  );
}

function WorkspaceAdminView() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <section className="nexus-display-panel rounded-[24px] p-5 text-slate-600">
        <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-700">Admin Account Detected</p>
        <p className="mt-3 text-sm text-slate-700">
          You are signed in with administrative privileges. Workspace remains available, but governance tooling is best handled in the admin console.
        </p>
      </section>

      <section className="nexus-display-panel rounded-[24px] p-5 text-slate-600">
        <p className="text-[10px] uppercase tracking-[0.18em] text-sky-700">Recommended Action</p>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>Open admin dashboard for launch governance</li>
          <li>Review age-gate and moderation queues</li>
          <li>Return to workspace for user-journey audits</li>
        </ul>
      </section>

      <section className="nexus-display-panel rounded-[24px] p-5 text-slate-600 md:col-span-2 xl:col-span-1">
        <p className="text-[10px] uppercase tracking-[0.18em] text-amber-700">Operator Note</p>
        <p className="mt-3 text-sm text-slate-700">
          Keep policy and economy operations in admin surfaces to reduce accidental workflow crossover during live operations.
        </p>
      </section>
    </div>
  );
}

function WorkspaceVisualGallery() {
  const imageCards = [
    {
      src: "/brand/core-plus-card.png",
      alt: "Core Plus command interface card",
      label: "Core+ Surface",
      note: "Production card art used in premium routes.",
    },
    {
      src: "/brand/boost-tier-badges.png",
      alt: "Boost tier badges matrix",
      label: "Tier Ladder",
      note: "Actual tier progression visuals rendered at full resolution.",
    },
    {
      src: "/brand/boost-pack-icon.png",
      alt: "Boost pack icon",
      label: "Boost Pack",
      note: "Live commerce emblem with native image detail preserved.",
    },
  ] as const;

  return (
    <section className="mb-4 grid gap-3 md:grid-cols-3">
      {imageCards.map((card) => (
        <article key={card.src} className="nexus-display-panel overflow-hidden rounded-[24px] p-0 text-slate-700">
          <div className="relative aspect-[16/10] w-full bg-slate-100">
            <NextImage src={card.src} alt={card.alt} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
          </div>
          <div className="p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{card.label}</p>
            <p className="mt-2 text-sm text-slate-700">{card.note}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

function WorkspaceAvatarSection({
  activeAvatar,
  activeBadge,
  username,
  roleLabel,
  onSelectAvatar,
  onSelectBadge,
  onStageAvatarUpload,
  onApplyStagedAvatar,
  onCancelStagedAvatar,
  hasCustomAvatar,
  customAvatarUrl,
  uploadError,
  isUploading,
  stagedAvatarDataUrl,
  stagedZoom,
  stagedOffsetX,
  stagedOffsetY,
  onZoomChange,
  onOffsetXChange,
  onOffsetYChange,
}: {
  activeAvatar: string;
  activeBadge: string;
  username: string;
  roleLabel: string;
  onSelectAvatar: (avatarUrl: string) => void;
  onSelectBadge: (badgeUrl: string) => void;
  onStageAvatarUpload: (file: File) => Promise<void>;
  onApplyStagedAvatar: () => Promise<void>;
  onCancelStagedAvatar: () => void;
  hasCustomAvatar: boolean;
  customAvatarUrl: string;
  uploadError: string | null;
  isUploading: boolean;
  stagedAvatarDataUrl: string | null;
  stagedZoom: number;
  stagedOffsetX: number;
  stagedOffsetY: number;
  onZoomChange: (value: number) => void;
  onOffsetXChange: (value: number) => void;
  onOffsetYChange: (value: number) => void;
}) {
  async function handleAvatarFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    await onStageAvatarUpload(selectedFile);
    event.target.value = "";
  }

  async function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const selectedFile = event.dataTransfer.files?.[0];
    if (!selectedFile) return;
    await onStageAvatarUpload(selectedFile);
  }

  return (
    <section className="mb-4 nexus-display-panel overflow-hidden rounded-[24px] p-5 text-slate-700">
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="relative rounded-[20px] border border-slate-200/80 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),rgba(255,255,255,0.95)_58%)] p-5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Avatar Command</p>
          <div className="mt-3 flex justify-center">
            <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-white shadow-[0_14px_30px_rgba(15,23,42,0.22)]">
              {/* Keep preview flexible for both local and account-provided image URLs. */}
              <img src={activeAvatar} alt={`${username} avatar`} className="h-full w-full object-cover" draggable={false} />
            </div>
          </div>
          <p className="mt-4 text-center text-sm font-semibold text-slate-800">{username}</p>
          <p className="mt-1 text-center text-xs uppercase tracking-[0.16em] text-slate-500">{roleLabel}</p>
          <div className="mt-3 rounded-xl border border-slate-200/80 bg-white/85 p-2">
            <p className="text-center text-[9px] uppercase tracking-[0.16em] text-slate-500">Active Badge</p>
            <div className="relative mt-1 h-8 w-full overflow-hidden rounded-md bg-slate-50">
                <NextImage src={activeBadge} alt="Active badge" fill sizes="240px" className="object-contain" />
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-slate-600">Selection is saved on this device for instant workspace identity continuity.</p>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Badge Presets</p>
            <div className="flex flex-wrap items-center gap-2">
              <label
                className="inline-flex cursor-pointer items-center rounded-full border border-slate-300/70 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700 transition-colors hover:bg-slate-100"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => void handleDrop(event)}
              >
                {isUploading ? "Processing..." : "Upload Avatar"}
                <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleAvatarFileChange(event)} disabled={isUploading} />
              </label>
              {hasCustomAvatar ? (
                <button
                  type="button"
                  onClick={() => onSelectAvatar(customAvatarUrl)}
                  className="inline-flex items-center rounded-full border border-slate-300/70 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700 transition-colors hover:bg-slate-100"
                >
                  Use Account Avatar
                </button>
              ) : null}
            </div>
          </div>

          {uploadError ? <p className="mt-2 text-xs text-rose-600">{uploadError}</p> : null}

          {stagedAvatarDataUrl ? (
            <div className="mt-3 rounded-[18px] border border-slate-200/80 bg-slate-50/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Avatar Crop Studio</p>
              <div className="mt-3 grid gap-4 lg:grid-cols-[270px_minmax(0,1fr)]">
                <div className="relative h-[270px] w-[270px] overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.04)]">
                  <img
                    src={stagedAvatarDataUrl}
                    alt="Staged avatar preview"
                    className="h-full w-full object-cover"
                    style={{ transform: `translate(${stagedOffsetX}px, ${stagedOffsetY}px) scale(${stagedZoom})` }}
                    draggable={false}
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Zoom</p>
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.05}
                      value={stagedZoom}
                      onChange={(event) => onZoomChange(Number(event.target.value))}
                      className="mt-1 w-full"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Horizontal</p>
                    <input
                      type="range"
                      min={-80}
                      max={80}
                      step={1}
                      value={stagedOffsetX}
                      onChange={(event) => onOffsetXChange(Number(event.target.value))}
                      className="mt-1 w-full"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Vertical</p>
                    <input
                      type="range"
                      min={-80}
                      max={80}
                      step={1}
                      value={stagedOffsetY}
                      onChange={(event) => onOffsetYChange(Number(event.target.value))}
                      className="mt-1 w-full"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void onApplyStagedAvatar()}
                      className="inline-flex items-center rounded-full border border-emerald-300/80 bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 transition-colors hover:bg-emerald-100"
                    >
                      Apply Avatar
                    </button>
                    <button
                      type="button"
                      onClick={onCancelStagedAvatar}
                      className="inline-flex items-center rounded-full border border-slate-300/80 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700 transition-colors hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {AVATAR_PRESETS.map((preset) => {
              const active = activeBadge === preset.src;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectBadge(preset.src)}
                  className={`group flex items-center gap-3 rounded-[16px] border bg-white/90 p-3 text-left transition-all ${active ? `${preset.tone} shadow-[0_8px_20px_rgba(15,23,42,0.12)]` : "border-slate-200/80 hover:border-slate-300/80"}`}
                >
                  <div className="relative h-9 w-20 overflow-hidden rounded-md border border-slate-200 bg-white">
                    <NextImage src={preset.src} alt={`${preset.label} badge preset`} fill sizes="80px" className="object-contain" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">{preset.label}</p>
                    <p className="text-[11px] text-slate-500">{active ? "Selected badge" : "Set as badge"}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function WorkspacePage() {
  const { user, hydrated } = useAuthStore();
  const [sessionMode, setSessionMode] = useState("local");
  const [healthStatus, setHealthStatus] = useState<WorkspaceHealthStatus>("unknown");
  const [healthDetailsOpen, setHealthDetailsOpen] = useState(false);
  const [gateHealth, setGateHealth] = useState<GateHealthResponse | null>(null);
  const [isHealthRefreshing, setIsHealthRefreshing] = useState(false);
  const [lastHealthCheckedAt, setLastHealthCheckedAt] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [nowEpochMs, setNowEpochMs] = useState(() => Date.now());
  const [healthTimeline, setHealthTimeline] = useState<WorkspaceHealthStatus[]>([]);
  const [activeAvatar, setActiveAvatar] = useState(AVATAR_PRESETS[0]?.src ?? "/brand/profile-badge-vip.png");
  const [activeBadge, setActiveBadge] = useState(AVATAR_PRESETS[0]?.src ?? "/brand/profile-badge-vip.png");
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [stagedAvatarDataUrl, setStagedAvatarDataUrl] = useState<string | null>(null);
  const [stagedAvatarZoom, setStagedAvatarZoom] = useState(1);
  const [stagedAvatarOffsetX, setStagedAvatarOffsetX] = useState(0);
  const [stagedAvatarOffsetY, setStagedAvatarOffsetY] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mode = window.localStorage.getItem(AUTH_PERSIST_MODE_KEY);
    if (mode === "local" || mode === "session") {
      setSessionMode(mode);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedAvatar = window.localStorage.getItem(WORKSPACE_AVATAR_KEY);
    if (storedAvatar) {
      setActiveAvatar(storedAvatar);
      return;
    }

    if (user?.avatar) {
      setActiveAvatar(user.avatar);
      return;
    }

    if (user?.isAdmin) {
      setActiveAvatar("/brand/profile-badge-admin.png");
      return;
    }

    setActiveAvatar(AVATAR_PRESETS[0]?.src ?? "/brand/profile-badge-vip.png");
  }, [user?.avatar, user?.isAdmin]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedBadge = window.localStorage.getItem(WORKSPACE_BADGE_KEY);
    if (storedBadge) {
      setActiveBadge(storedBadge);
      return;
    }
    setActiveBadge(AVATAR_PRESETS[0]?.src ?? "/brand/profile-badge-vip.png");
  }, []);

  useEffect(() => {
    const tickId = window.setInterval(() => {
      setNowEpochMs(Date.now());
    }, 5_000);

    return () => {
      window.clearInterval(tickId);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let requestInFlight = false;
    let activeController: AbortController | null = null;

    async function loadGateHealth() {
      if (requestInFlight) return;
      requestInFlight = true;
      setIsHealthRefreshing(true);

      const controller = new AbortController();
      activeController = controller;

      try {
        const response = await fetch("/api/ops/stability-gate", { cache: "no-store", signal: controller.signal });
        if (!response.ok) {
          if (active) {
            setGateHealth(null);
            setHealthStatus("unknown");
            setHealthTimeline((previous) => appendHealthSample(previous, "unknown"));
            setLastHealthCheckedAt(new Date().toISOString());
          }
          return;
        }

        const payload = (await response.json()) as GateHealthResponse;
        if (active) {
          const nextStatus = payload.status === "healthy" || payload.status === "degraded" ? payload.status : "unknown";
          setGateHealth(payload);
          setHealthStatus(nextStatus);
          setHealthTimeline((previous) => appendHealthSample(previous, nextStatus));
          setLastHealthCheckedAt(new Date().toISOString());
        }
      } catch {
        if (active) {
          setGateHealth(null);
          setHealthStatus("unknown");
          setHealthTimeline((previous) => appendHealthSample(previous, "unknown"));
          setLastHealthCheckedAt(new Date().toISOString());
        }
      } finally {
        if (activeController === controller) {
          activeController = null;
        }
        requestInFlight = false;
        if (active) {
          setIsHealthRefreshing(false);
        }
      }
    }

    void loadGateHealth();
    const intervalId = window.setInterval(() => {
      void loadGateHealth();
    }, HEALTH_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      if (activeController) {
        activeController.abort();
      }
    };
  }, [refreshTrigger]);

  const roleLabel = useMemo(() => {
    if (!user) return "Guest";
    if (user.appRole) return user.appRole;
    return user.isAdmin ? "ADMIN" : "USER";
  }, [user]);

  const premiumLabel = useMemo(() => {
    if (!user) return "None";
    if (user.premiumTier && user.premiumTier !== "NONE") return user.premiumTier;
    return user.premium ? "ACTIVE" : "NONE";
  }, [user]);

  const lastCheckedAgeMs = useMemo(() => {
    if (!lastHealthCheckedAt) return null;
    const parsed = new Date(lastHealthCheckedAt).getTime();
    if (Number.isNaN(parsed)) return null;
    return Math.max(0, nowEpochMs - parsed);
  }, [lastHealthCheckedAt, nowEpochMs]);

  const isHealthStale = useMemo(() => {
    if (lastCheckedAgeMs == null) return false;
    return lastCheckedAgeMs > HEALTH_STALE_AFTER_MS;
  }, [lastCheckedAgeMs]);

  const healthMetric = useMemo(() => {
    if (isHealthStale) {
      return { value: "Stale", tone: "amber" as const };
    }

    if (healthStatus === "healthy") {
      return { value: "Healthy", tone: "emerald" as const };
    }

    if (healthStatus === "degraded") {
      return { value: "Degraded", tone: "amber" as const };
    }

    return { value: "Unknown", tone: "slate" as const };
  }, [healthStatus, isHealthStale]);

  const healthBadgeClass = useMemo(() => {
    if (isHealthStale) return "text-amber-700 border-amber-300/60 bg-amber-50";
    if (healthStatus === "healthy") return "text-emerald-700 border-emerald-300/60 bg-emerald-50";
    if (healthStatus === "degraded") return "text-amber-700 border-amber-300/60 bg-amber-50";
    return "text-slate-600 border-slate-300/60 bg-slate-100";
  }, [healthStatus, isHealthStale]);

  const generatedAtLabel = useMemo(() => {
    if (!gateHealth?.generatedAt) return "Unavailable";
    const parsed = new Date(gateHealth.generatedAt);
    if (Number.isNaN(parsed.getTime())) return "Unavailable";
    return parsed.toLocaleString();
  }, [gateHealth?.generatedAt]);

  const lastCheckedLabel = useMemo(() => {
    if (!lastHealthCheckedAt) return "Pending";
    const parsed = new Date(lastHealthCheckedAt);
    if (Number.isNaN(parsed.getTime())) return "Pending";
    return parsed.toLocaleString();
  }, [lastHealthCheckedAt]);

  const freshnessLabel = useMemo(() => {
    if (isHealthRefreshing) return "Refreshing";
    if (lastCheckedAgeMs == null) return "Pending";
    if (lastCheckedAgeMs > HEALTH_STALE_AFTER_MS) return "Stale";
    if (lastCheckedAgeMs > HEALTH_REFRESH_INTERVAL_MS) return "Aging";
    return "Fresh";
  }, [isHealthRefreshing, lastCheckedAgeMs]);

  const nextRefreshCountdownLabel = useMemo(() => {
    if (isHealthRefreshing) return "Refreshing now";
    if (lastCheckedAgeMs == null) return "Awaiting first sync";
    const remainingMs = Math.max(0, HEALTH_REFRESH_INTERVAL_MS - lastCheckedAgeMs);
    const seconds = Math.ceil(remainingMs / 1000);
    return `${seconds}s`;
  }, [isHealthRefreshing, lastCheckedAgeMs]);

  const healthTimelineLabel = useMemo(() => {
    if (!healthTimeline.length) return "No samples yet";
    const healthyCount = healthTimeline.filter((state) => state === "healthy").length;
    const degradedCount = healthTimeline.filter((state) => state === "degraded").length;
    const unknownCount = healthTimeline.filter((state) => state === "unknown").length;
    return `${healthyCount} healthy · ${degradedCount} degraded · ${unknownCount} unknown`;
  }, [healthTimeline]);

  const isGuest = hydrated && !user;
  const isReady = hydrated;
  const currentUser = user ?? null;
  const avatarDisplayName = useMemo(() => {
    if (currentUser?.username) return currentUser.username;
    return isGuest ? "Guest Commander" : "Forge Commander";
  }, [currentUser?.username, isGuest]);

  const accountAvatarUrl = currentUser?.avatar ?? "";

  function handleAvatarSelection(avatarUrl: string) {
    setAvatarUploadError(null);
    setStagedAvatarDataUrl(null);
    setActiveAvatar(avatarUrl);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(WORKSPACE_AVATAR_KEY, avatarUrl);
    }
  }

  function handleBadgeSelection(badgeUrl: string) {
    setActiveBadge(badgeUrl);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(WORKSPACE_BADGE_KEY, badgeUrl);
    }
  }

  async function handleAvatarUpload(file: File) {
    setAvatarUploading(true);
    setAvatarUploadError(null);

    try {
      validateAvatarFile(file);
      const stagedDataUrl = await readFileAsDataUrl(file);
      setStagedAvatarDataUrl(stagedDataUrl);
      setStagedAvatarZoom(1);
      setStagedAvatarOffsetX(0);
      setStagedAvatarOffsetY(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to process avatar image.";
      setAvatarUploadError(message);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleApplyStagedAvatar() {
    if (!stagedAvatarDataUrl) return;
    setAvatarUploading(true);
    setAvatarUploadError(null);

    try {
      const processedAvatarDataUrl = await buildSquareAvatarDataUrlFromDataUrl(
        stagedAvatarDataUrl,
        stagedAvatarZoom,
        stagedAvatarOffsetX,
        stagedAvatarOffsetY,
      );
      handleAvatarSelection(processedAvatarDataUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to apply avatar crop.";
      setAvatarUploadError(message);
    } finally {
      setAvatarUploading(false);
    }
  }

  function handleCancelStagedAvatar() {
    setStagedAvatarDataUrl(null);
    setStagedAvatarZoom(1);
    setStagedAvatarOffsetX(0);
    setStagedAvatarOffsetY(0);
  }

  return (
    <ExperienceShell
      eyebrow="Regular User Hub"
      title="Workspace Command Deck"
      subtitle="A focused control surface for regular users to coordinate, progress, and stay synced without admin overhead."
      metrics={[
        { label: "Audience", value: "Regular Users", tone: "emerald" },
        { label: "Admin Tools", value: "Separated", tone: "amber" },
        { label: "Workspace", value: "Operational", tone: "cyan" },
        { label: "Runtime Health", value: healthMetric.value, tone: healthMetric.tone },
      ]}
      actions={[
        { label: user?.isAdmin ? "Open Admin Console" : "Open App Home", href: user?.isAdmin ? "/admin" : "/app", tone: "primary" },
        { label: "Mining", href: "/app/mining", tone: "ghost" },
        { label: "Notifications", href: "/notifications", tone: "ghost" },
      ]}
      maxWidthClassName="max-w-7xl"
    >
      <div className="mb-4 nexus-display-panel rounded-[24px] p-4 text-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Runtime Health</p>
            <p className="mt-1 text-sm text-slate-700">Inspect live gate results without leaving workspace.</p>
            <p className="mt-1 text-xs text-slate-500">Last checked: {lastCheckedLabel}</p>
            <p className="mt-1 text-xs text-slate-500">Freshness: {freshnessLabel}</p>
            <p className="mt-1 text-xs text-slate-500">Next refresh in: {nextRefreshCountdownLabel}</p>
            <p className="mt-1 text-xs text-slate-500">Recent samples: {healthTimelineLabel}</p>
            <div className="mt-2 flex items-center gap-1">
              {healthTimeline.length ? (
                healthTimeline.map((state, index) => (
                  <span
                    key={`${state}-${index}`}
                    className={`h-2.5 w-5 rounded-full ${state === "healthy" ? "bg-emerald-500/85" : state === "degraded" ? "bg-amber-500/85" : "bg-slate-400/80"}`}
                    title={`Sample ${index + 1}: ${state}`}
                    aria-label={`Health sample ${index + 1}: ${state}`}
                  />
                ))
              ) : (
                <span className="text-[10px] text-slate-400">Awaiting samples</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setRefreshTrigger((value) => value + 1)}
              disabled={isHealthRefreshing}
              className="inline-flex items-center rounded-full border border-slate-300/70 bg-white/90 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isHealthRefreshing ? "Refreshing" : "Refresh Now"}
            </button>
            <button
              type="button"
              onClick={() => setHealthDetailsOpen((current) => !current)}
              className={`inline-flex items-center rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors ${healthBadgeClass}`}
            >
              {healthMetric.value} · {healthDetailsOpen ? "Hide" : "Show"} Details
            </button>
          </div>
        </div>

        {healthDetailsOpen ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Generated</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{generatedAtLabel}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Strict Mode</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{gateHealth?.strictMode ? "Enabled" : "Disabled"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Pass / Total</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">
                {gateHealth?.counts ? `${gateHealth.counts.pass}/${gateHealth.counts.total}` : "Unavailable"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Blocking Issues</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{gateHealth?.counts ? String(gateHealth.counts.blocking) : "Unavailable"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Warnings</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{gateHealth?.counts ? String(gateHealth.counts.warning) : "Unavailable"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Failures + Errors</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">
                {gateHealth?.counts ? String(gateHealth.counts.fail + gateHealth.counts.error) : "Unavailable"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 sm:col-span-2 xl:col-span-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Checkpoint Action</p>
              <p className="mt-2 text-sm text-slate-700">
                {gateHealth?.checkpointRequested
                  ? gateHealth?.checkpointSaved
                    ? "Checkpoint saved"
                    : gateHealth?.checkpointSkipped
                      ? `Checkpoint skipped (${gateHealth.checkpointSkipReason ?? "unknown-reason"})`
                      : "Checkpoint requested"
                  : "No checkpoint requested in this run"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 sm:col-span-2 xl:col-span-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Gate Detail</p>
              <p className="mt-2 text-sm text-slate-700">{gateHealth?.detail ?? "No additional detail"}</p>
            </div>
          </div>
        ) : null}
      </div>

      <WorkspaceVisualGallery />

      <WorkspaceAvatarSection
        activeAvatar={activeAvatar}
        activeBadge={activeBadge}
        username={avatarDisplayName}
        roleLabel={roleLabel}
        onSelectAvatar={handleAvatarSelection}
        onSelectBadge={handleBadgeSelection}
        onStageAvatarUpload={handleAvatarUpload}
        onApplyStagedAvatar={handleApplyStagedAvatar}
        onCancelStagedAvatar={handleCancelStagedAvatar}
        hasCustomAvatar={Boolean(accountAvatarUrl)}
        customAvatarUrl={accountAvatarUrl}
        uploadError={avatarUploadError}
        isUploading={avatarUploading}
        stagedAvatarDataUrl={stagedAvatarDataUrl}
        stagedZoom={stagedAvatarZoom}
        stagedOffsetX={stagedAvatarOffsetX}
        stagedOffsetY={stagedAvatarOffsetY}
        onZoomChange={setStagedAvatarZoom}
        onOffsetXChange={setStagedAvatarOffsetX}
        onOffsetYChange={setStagedAvatarOffsetY}
      />

      {!isReady ? (
        <div className="nexus-display-panel rounded-[24px] p-5 text-slate-600">Loading workspace profile...</div>
      ) : isGuest ? (
        <WorkspaceGuestView />
      ) : currentUser?.isAdmin ? (
        <>
          <WorkspaceAnalyticsCards
            roleLabel={roleLabel}
            sessionMode={sessionMode}
            emailVerified={Boolean(currentUser.emailVerified)}
            premiumTier={premiumLabel}
            joinedAt={formatDateLabel(currentUser.createdAt)}
            lastSeenAt={formatDateLabel(currentUser.lastSeenAt)}
          />
          <WorkspaceAdminView />
        </>
      ) : (
        <>
          <WorkspaceAnalyticsCards
            roleLabel={roleLabel}
            sessionMode={sessionMode}
            emailVerified={Boolean(currentUser?.emailVerified)}
            premiumTier={premiumLabel}
            joinedAt={formatDateLabel(currentUser?.createdAt)}
            lastSeenAt={formatDateLabel(currentUser?.lastSeenAt)}
          />
          <WorkspaceUserView />
        </>
      )}
    </ExperienceShell>
  );
}
