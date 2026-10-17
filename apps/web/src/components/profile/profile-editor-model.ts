import type { ProfileEditorData, ProfilePrivacy, ProfileSocialKey, ProfileTextPatch } from "@/lib/profile-api";

/**
 * Pure helpers for the profile editor: the form's draft shape, the checks shown while typing, and the
 * request built on save. The server repeats every check, so these only make the feedback quicker.
 */

export type ProfileDraft = {
  displayName: string;
  username: string;
  bio: string;
  links: Record<ProfileSocialKey, string>;
  privacy: ProfilePrivacy;
};

export type ProfileFieldErrors = {
  displayName?: string;
  username?: string;
  bio?: string;
  links?: Partial<Record<ProfileSocialKey, string>>;
};

export const SOCIAL_KEYS: ProfileSocialKey[] = ["discord", "x", "instagram", "kick", "youtube", "twitch"];
export const PRIVACY_KEYS: Array<keyof ProfilePrivacy> = ["showOnlineStatus", "showActivity", "showJoinedServers"];

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,32}$/;
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/** Length in characters (code points), the same count the server uses for bio and display name. */
export function characterCount(text: string) {
  return Array.from(text).length;
}

export function draftFromProfile(profile: ProfileEditorData["profile"]): ProfileDraft {
  return {
    displayName: profile.displayName ?? "",
    username: profile.username,
    bio: profile.bio ?? "",
    links: Object.fromEntries(SOCIAL_KEYS.map((key) => [key, profile.socialLinks[key] ?? ""])) as Record<ProfileSocialKey, string>,
    privacy: { ...profile.privacy },
  };
}

export function draftsMatch(a: ProfileDraft, b: ProfileDraft) {
  return (
    a.displayName === b.displayName &&
    a.username === b.username &&
    a.bio === b.bio &&
    SOCIAL_KEYS.every((key) => a.links[key] === b.links[key]) &&
    PRIVACY_KEYS.every((key) => a.privacy[key] === b.privacy[key])
  );
}

/** A social link check that mirrors the server: https, no login or port, and the platform's own domain. */
export function socialLinkProblem(
  key: ProfileSocialKey,
  value: string,
  platforms: ProfileEditorData["limits"]["socialPlatforms"],
  maxLength: number,
): string | null {
  const text = value.trim();
  if (!text) return null;
  const meta = platforms.find((platform) => platform.key === key);
  const label = meta?.label ?? key;
  const domains = meta?.domains ?? [];
  if (text.length > maxLength) return `${label} link can be up to ${maxLength} characters.`;
  if (/\s/.test(text)) return `${label} link can't contain spaces.`;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return `${label} link must be a full address that starts with https://`;
  }
  if (url.protocol !== "https:") return `${label} link must start with https://`;
  if (url.username || url.password || url.port) return `${label} link can't include a login or a port number.`;
  const host = url.hostname.toLowerCase();
  if (!domains.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
    return `${label} links must be on ${domains[0] ?? "that platform's site"}.`;
  }
  return null;
}

/** Field problems in the draft, judged against the saved profile and the server's limits. */
export function draftErrors(draft: ProfileDraft, limits: ProfileEditorData["limits"]): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};

  const name = draft.displayName.trim();
  if (characterCount(name) > limits.displayNameMax) errors.displayName = `Display name can be up to ${limits.displayNameMax} characters.`;
  else if (CONTROL_CHARACTERS.test(name)) errors.displayName = "Display name can't contain control characters.";

  if (characterCount(draft.bio.replace(/\r\n?/g, "\n").trim()) > limits.bioMax) {
    errors.bio = `Bio can be up to ${limits.bioMax} characters.`;
  }

  if (!USERNAME_PATTERN.test(draft.username.trim())) {
    errors.username = `Usernames are ${limits.usernameMin} to ${limits.usernameMax} letters, numbers or underscores.`;
  }

  const linkErrors: Partial<Record<ProfileSocialKey, string>> = {};
  for (const key of SOCIAL_KEYS) {
    const problem = socialLinkProblem(key, draft.links[key], limits.socialPlatforms, limits.socialLinkMaxLength);
    if (problem) linkErrors[key] = problem;
  }
  if (Object.keys(linkErrors).length) errors.links = linkErrors;

  return errors;
}

export function hasDraftErrors(errors: ProfileFieldErrors) {
  return Boolean(errors.displayName || errors.username || errors.bio || (errors.links && Object.keys(errors.links).length));
}

/** The minimal request for the text fields, or null when nothing changed. */
export function buildTextPatch(saved: ProfileDraft, draft: ProfileDraft): ProfileTextPatch | null {
  const patch: ProfileTextPatch = {};
  if (draft.displayName !== saved.displayName) patch.displayName = draft.displayName.trim() || null;
  if (draft.username !== saved.username) patch.username = draft.username.trim();
  if (draft.bio !== saved.bio) patch.bio = draft.bio.trim() ? draft.bio : null;

  const links: Partial<Record<ProfileSocialKey, string | null>> = {};
  for (const key of SOCIAL_KEYS) {
    if (draft.links[key] !== saved.links[key]) links[key] = draft.links[key].trim() || null;
  }
  if (Object.keys(links).length) patch.socialLinks = links;

  const privacy: Partial<ProfilePrivacy> = {};
  for (const key of PRIVACY_KEYS) {
    if (draft.privacy[key] !== saved.privacy[key]) privacy[key] = draft.privacy[key];
  }
  if (Object.keys(privacy).length) patch.privacy = privacy;

  return Object.keys(patch).length ? patch : null;
}
