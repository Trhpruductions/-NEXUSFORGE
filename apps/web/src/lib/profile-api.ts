import { api, authHeaders } from "./api";

/** Client calls for the profile editor. They use the shared axios instance from api.ts, so auth and token refresh work the same way. */

export type ProfileSocialKey = "discord" | "x" | "instagram" | "kick" | "youtube" | "twitch";
export type ProfilePrivacy = { showOnlineStatus: boolean; showActivity: boolean; showJoinedServers: boolean };
export type PictureKind = "avatar" | "banner";

export type ProfileEditorData = {
  profile: {
    id: string;
    username: string;
    displayName: string | null;
    bio: string | null;
    avatar: string | null;
    banner: string | null;
    socialLinks: Partial<Record<ProfileSocialKey, string>>;
    privacy: ProfilePrivacy;
    /** ISO time the next username change is allowed, or null when it can change now. */
    usernameChangeAvailableAt: string | null;
  };
  limits: {
    displayNameMax: number;
    bioMax: number;
    socialLinkMaxLength: number;
    socialLinksMax: number;
    socialPlatforms: Array<{ key: ProfileSocialKey; label: string; domains: string[] }>;
    usernameMin: number;
    usernameMax: number;
    pictures: {
      avatar: { maxBytes: number; minSide: number; maxSide: number };
      banner: { maxBytes: number; minWidth: number; maxWidth: number; minHeight: number; maxHeight: number };
      maxPixels: number;
      types: string[];
    };
  };
};

/** Only the fields that changed are sent. A social link set to null is removed. */
export type ProfileTextPatch = {
  displayName?: string | null;
  username?: string;
  bio?: string | null;
  socialLinks?: Partial<Record<ProfileSocialKey, string | null>>;
  privacy?: Partial<ProfilePrivacy>;
};

export type UsernameAvailability = {
  available: boolean;
  reason: "current" | "free" | "invalid" | "reserved" | "cooldown" | "taken";
  message: string;
  availableAt?: string;
};

export async function getProfileEditor(accessToken: string) {
  return (await api.get<ProfileEditorData>("/api/profiles/me", { headers: authHeaders(accessToken) })).data;
}

export async function saveProfileText(accessToken: string, csrfToken: string, patch: ProfileTextPatch) {
  return (await api.patch<ProfileEditorData>("/api/profiles/me", patch, { headers: authHeaders(accessToken, csrfToken) })).data;
}

/** Advisory: the database's unique username constraint still decides on save. */
export async function checkUsernameAvailability(accessToken: string, username: string, signal?: AbortSignal) {
  return (
    await api.get<UsernameAvailability>("/api/profiles/me/username-availability", {
      headers: authHeaders(accessToken),
      params: { username },
      signal,
    })
  ).data;
}

/**
 * Sends the picture bytes (already cropped and re-encoded in the browser). `onProgress` reports the
 * real bytes sent so far, as a fraction from 0 to 1.
 */
export async function uploadProfilePicture(
  accessToken: string,
  csrfToken: string,
  kind: PictureKind,
  blob: Blob,
  onProgress?: (fraction: number) => void,
): Promise<string | null> {
  const response = await api.post<Partial<Record<PictureKind, string | null>>>(`/api/profiles/me/${kind}`, blob, {
    headers: { ...authHeaders(accessToken, csrfToken), "Content-Type": blob.type },
    timeout: 120000,
    onUploadProgress: (event) => {
      if (onProgress && event.total) onProgress(Math.min(1, event.loaded / event.total));
    },
  });
  return response.data[kind] ?? null;
}

export async function removeProfilePicture(accessToken: string, csrfToken: string, kind: PictureKind) {
  await api.delete(`/api/profiles/me/${kind}`, { headers: authHeaders(accessToken, csrfToken) });
}
