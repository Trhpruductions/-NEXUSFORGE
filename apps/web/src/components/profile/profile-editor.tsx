"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Trash2, Upload } from "lucide-react";
import { LoadingNote } from "@/components/ui/loading-note";
import { getApiErrorMessage } from "@/lib/api";
import {
  checkUsernameAvailability,
  getProfileEditor,
  removeProfilePicture,
  saveProfileText,
  uploadProfilePicture,
  type PictureKind,
  type ProfileEditorData,
  type ProfileSocialKey,
  type UsernameAvailability,
} from "@/lib/profile-api";
import { useAuthStore } from "@/store/auth-store";
import { ProfilePreview } from "./profile-preview";
import { PictureCropDialog, validatePictureFile } from "./profile-picture-crop";
import { useUnsavedChangesGuard } from "./use-unsaved-changes-guard";
import {
  PRIVACY_KEYS,
  SOCIAL_KEYS,
  buildTextPatch,
  characterCount,
  draftErrors,
  draftFromProfile,
  draftsMatch,
  hasDraftErrors,
  type ProfileDraft,
  type ProfileFieldErrors,
} from "./profile-editor-model";

/** The profile editor: text fields, pictures (crop and upload), links, privacy, live preview and save. */

type PictureState = { blob: Blob | null; previewUrl: string | null; remove: boolean };
const EMPTY_PICTURE: PictureState = { blob: null, previewUrl: null, remove: false };
type Notice = { tone: "success" | "error" | "info"; text: string };
type Progress = { label: string; fraction: number | null };

const PICTURE_LABEL: Record<PictureKind, string> = { avatar: "Avatar", banner: "Banner" };
const PRIVACY_COPY: Record<(typeof PRIVACY_KEYS)[number], { label: string; hint: string }> = {
  showOnlineStatus: { label: "Show when I'm online", hint: "Other people can see whether you're online." },
  showActivity: { label: "Show what I'm doing", hint: "Your current activity appears on your profile." },
  showJoinedServers: { label: "Show the servers I've joined", hint: "Your server list appears on your profile." },
};

const inputClass =
  "w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-400/60 focus:outline-none disabled:opacity-60";
const labelClass = "block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300";
const panelClass = "rounded-2xl border border-white/5 bg-[#0d1119] p-4 sm:p-5";
const sectionTitle = "text-[13px] font-bold uppercase tracking-[0.18em] text-white";
const goldBtn =
  "inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-amber-300 disabled:opacity-50";
const ghostBtn =
  "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 transition hover:border-amber-400/50 disabled:opacity-50";

function Shell({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">{children}</div>;
}

export function ProfileEditor() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const query = useQuery({
    // Keyed on the user, not the access token: a token refresh must not remount the form and drop
    // unsaved edits, and a different account never sees the previous account's cached profile.
    queryKey: ["profile-editor", userId],
    queryFn: () => getProfileEditor(accessToken!),
    enabled: Boolean(accessToken),
    refetchOnWindowFocus: false,
  });

  if (!accessToken) {
    return (
      <Shell>
        <p className="text-sm text-slate-300">Sign in to edit your profile.</p>
      </Shell>
    );
  }
  if (query.isError) {
    return (
      <Shell>
        <div role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
          <p>Couldn&apos;t load your profile: {getApiErrorMessage(query.error)}</p>
          <button type="button" onClick={() => query.refetch()} className={`${ghostBtn} mt-3`}>Try again</button>
        </div>
      </Shell>
    );
  }
  if (!query.data) {
    return (
      <Shell>
        <LoadingNote label="Loading your profile" onRetry={() => query.refetch()} />
      </Shell>
    );
  }
  return <EditorForm initial={query.data} />;
}

function EditorForm({ initial }: { initial: ProfileEditorData }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const csrfToken = useAuthStore((state) => state.csrfToken);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const queryClient = useQueryClient();

  // `saved` is what the server last confirmed. Everything else in this form is a draft.
  const [saved, setSaved] = useState<ProfileEditorData>(initial);
  const savedDraft = useMemo(() => draftFromProfile(saved.profile), [saved]);
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromProfile(initial.profile));
  const [pictures, setPictures] = useState<Record<PictureKind, PictureState>>({ avatar: EMPTY_PICTURE, banner: EMPTY_PICTURE });
  const picturesRef = useRef(pictures);
  const [cropping, setCropping] = useState<{ kind: PictureKind; file: File } | null>(null);
  const [pickKind, setPickKind] = useState<PictureKind>("avatar");
  const fileInput = useRef<HTMLInputElement>(null);

  const [availability, setAvailability] = useState<UsernameAvailability | null>(null);
  const [checkingName, setCheckingName] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [serverErrors, setServerErrors] = useState<ProfileFieldErrors>({});
  const [confirmReset, setConfirmReset] = useState(false);

  const limits = saved.limits;
  const picturesDirty = (["avatar", "banner"] as PictureKind[]).some((kind) => pictures[kind].blob !== null || pictures[kind].remove);
  const dirty = !draftsMatch(savedDraft, draft) || picturesDirty;
  const guard = useUnsavedChangesGuard(dirty);

  useEffect(() => {
    picturesRef.current = pictures;
  }, [pictures]);

  // Release any preview URLs when the editor closes.
  useEffect(() => {
    return () => {
      for (const kind of ["avatar", "banner"] as PictureKind[]) {
        const url = picturesRef.current[kind].previewUrl;
        if (url) URL.revokeObjectURL(url);
      }
    };
  }, []);

  const clientErrors = useMemo(() => draftErrors(draft, limits), [draft, limits]);
  const nameChanged = draft.username !== savedDraft.username;
  const caseOnlyChange = nameChanged && draft.username.toLowerCase() === savedDraft.username.toLowerCase();
  const cooldownUntil = saved.profile.usernameChangeAvailableAt ? Date.parse(saved.profile.usernameChangeAvailableAt) : null;
  const cooldownActive = nameChanged && !caseOnlyChange && cooldownUntil !== null && cooldownUntil > Date.now();

  // Live username check: debounced, cancelled when the name changes, and advisory only.
  useEffect(() => {
    setAvailability(null);
    setCheckFailed(false);
    const name = draft.username.trim();
    const shouldCheck = Boolean(accessToken) && name !== savedDraft.username && /^[A-Za-z0-9_]{3,32}$/.test(name);
    if (!shouldCheck) {
      setCheckingName(false);
      return;
    }
    const controller = new AbortController();
    setCheckingName(true);
    const timer = window.setTimeout(() => {
      checkUsernameAvailability(accessToken!, name, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setAvailability(result);
        })
        .catch(() => {
          if (!controller.signal.aborted) setCheckFailed(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setCheckingName(false);
        });
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [accessToken, draft.username, savedDraft.username]);

  const usernameMessage = (() => {
    if (!nameChanged || clientErrors.username) return null;
    if (caseOnlyChange) return { tone: "ok" as const, text: "Only the letter case changes." };
    if (cooldownActive && cooldownUntil) {
      return { tone: "bad" as const, text: `You can change your username again after ${new Date(cooldownUntil).toLocaleString()}.` };
    }
    if (checkingName) return { tone: "info" as const, text: "Checking…" };
    if (availability) {
      if (availability.reason === "current") return null;
      return availability.available
        ? { tone: "ok" as const, text: availability.message }
        : { tone: "bad" as const, text: availability.message };
    }
    if (checkFailed) return { tone: "info" as const, text: "Couldn't check that name right now. Saving will check it again." };
    return null;
  })();

  const usernameBlocksSave =
    nameChanged && !caseOnlyChange && (Boolean(clientErrors.username) || cooldownActive || checkingName || (availability !== null && !availability.available));

  const fieldErrors: ProfileFieldErrors = {
    displayName: clientErrors.displayName ?? serverErrors.displayName,
    bio: clientErrors.bio ?? serverErrors.bio,
    username: clientErrors.username ?? serverErrors.username,
    links: clientErrors.links,
  };
  const formHasErrors = hasDraftErrors(clientErrors) || usernameBlocksSave;

  const setPicture = (kind: PictureKind, next: PictureState) => {
    setPictures((current) => {
      const previous = current[kind].previewUrl;
      if (previous && previous !== next.previewUrl) URL.revokeObjectURL(previous);
      return { ...current, [kind]: next };
    });
  };

  const pickPicture = (kind: PictureKind) => {
    setPickKind(kind);
    fileInput.current?.click();
  };

  const onFileChosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const problem = await validatePictureFile(file, limits.pictures);
    if (problem) {
      setNotice({ tone: "error", text: problem });
      return;
    }
    setNotice(null);
    setCropping({ kind: pickKind, file });
  };

  const onCropReady = (blob: Blob) => {
    if (!cropping) return;
    const kind = cropping.kind;
    setPicture(kind, { blob, previewUrl: URL.createObjectURL(blob), remove: false });
    setCropping(null);
    setNotice({ tone: "info", text: `New ${PICTURE_LABEL[kind].toLowerCase()} is ready. Save to apply it.` });
  };

  const stageRemove = (kind: PictureKind) => {
    setPicture(kind, { blob: null, previewUrl: null, remove: true });
    setNotice({ tone: "info", text: `${PICTURE_LABEL[kind]} will be removed when you save.` });
  };

  const undoPicture = (kind: PictureKind) => {
    setPicture(kind, EMPTY_PICTURE);
    setNotice(null);
  };

  const applySession = (profile: ProfileEditorData["profile"]) => {
    useAuthStore.setState((state) =>
      state.user
        ? {
            user: {
              ...state.user,
              username: profile.username,
              displayName: profile.displayName,
              bio: profile.bio,
              avatar: profile.avatar,
              banner: profile.banner,
            },
          }
        : {},
    );
  };

  const save = async () => {
    if (!accessToken || !csrfToken) {
      setNotice({ tone: "error", text: "Your session needs to refresh. Sign in again, then save." });
      return;
    }
    if (!dirty) return;
    if (formHasErrors) {
      setNotice({ tone: "error", text: "Fix the highlighted fields, then save again." });
      return;
    }

    setSaving(true);
    setNotice(null);
    setServerErrors({});
    const done: string[] = [];
    let current = saved;
    let activeKind: PictureKind | null = null;

    // 1. Pictures first, each on its own request, so a failed upload never leaves text half-saved.
    try {
      for (const kind of ["avatar", "banner"] as PictureKind[]) {
        const pending = pictures[kind];
        if (pending.blob) {
          activeKind = kind;
          setProgress({ label: `Uploading ${kind}`, fraction: 0 });
          const url = await uploadProfilePicture(accessToken, csrfToken, kind, pending.blob, (fraction) =>
            setProgress({ label: `Uploading ${kind}`, fraction }),
          );
          current = { ...current, profile: { ...current.profile, [kind]: url } };
          setSaved(current);
          setPicture(kind, EMPTY_PICTURE);
          done.push(`${PICTURE_LABEL[kind]} saved`);
        } else if (pending.remove) {
          activeKind = kind;
          setProgress({ label: `Removing ${kind}`, fraction: null });
          await removeProfilePicture(accessToken, csrfToken, kind);
          current = { ...current, profile: { ...current.profile, [kind]: null } };
          setSaved(current);
          setPicture(kind, EMPTY_PICTURE);
          done.push(`${PICTURE_LABEL[kind]} removed`);
        }
      }
    } catch (error) {
      setProgress(null);
      setSaving(false);
      const label = activeKind ? PICTURE_LABEL[activeKind] : "Picture";
      setNotice({
        tone: "error",
        text: `${done.length ? `${done.join(". ")}. ` : ""}${label} wasn't saved: ${getApiErrorMessage(error)}. Your other changes were not saved.`,
      });
      return;
    }

    // 2. Text fields, in one request, sending only what changed.
    const patch = buildTextPatch(savedDraft, draft);
    if (patch) {
      setProgress({ label: "Saving your details", fraction: null });
      try {
        const updated = await saveProfileText(accessToken, csrfToken, patch);
        current = updated;
        setSaved(updated);
        setDraft(draftFromProfile(updated.profile));
        applySession(updated.profile);
        queryClient.setQueryData(["profile-editor", userId], updated);
        queryClient.invalidateQueries({ queryKey: ["profile-summary"] });
      } catch (error) {
        setProgress(null);
        setSaving(false);
        const message = getApiErrorMessage(error);
        if (/username/i.test(message)) setServerErrors({ username: message });
        setNotice({
          tone: "error",
          text: `${done.length ? `${done.join(". ")}. ` : ""}Your details weren't saved: ${message}`,
        });
        return;
      }
    }

    setProgress(null);
    setSaving(false);
    const messages = [...done, patch ? "Profile saved" : ""].filter(Boolean);
    setNotice({ tone: "success", text: messages.length ? `${messages.join(". ")}.` : "Nothing to save." });
  };

  const discardEdits = () => {
    setDraft(draftFromProfile(saved.profile));
    setPicture("avatar", EMPTY_PICTURE);
    setPicture("banner", EMPTY_PICTURE);
    setServerErrors({});
    setConfirmReset(false);
    setNotice({ tone: "info", text: "Changes discarded. Your saved profile is shown." });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void save();
  };

  const avatarShown = pictures.avatar.previewUrl ?? (pictures.avatar.remove ? null : saved.profile.avatar);
  const bannerShown = pictures.banner.previewUrl ?? (pictures.banner.remove ? null : saved.profile.banner);
  const previewLinks = SOCIAL_KEYS.map((key: ProfileSocialKey) => ({
    key,
    label: limits.socialPlatforms.find((platform) => platform.key === key)?.label ?? key,
    value: draft.links[key],
  }));

  const setLink = (key: ProfileSocialKey, value: string) => setDraft((current) => ({ ...current, links: { ...current.links, [key]: value } }));
  const setPrivacy = (key: (typeof PRIVACY_KEYS)[number], value: boolean) =>
    setDraft((current) => ({ ...current, privacy: { ...current.privacy, [key]: value } }));

  return (
    <Shell>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Edit profile</h1>
          <p className="mt-1 text-xs text-slate-400">Changes show in the preview. Nothing is public until you save.</p>
        </div>
        <Link href="/app/profile" className={ghostBtn}>
          Back to profile
        </Link>
      </header>

      {notice ? (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={`mb-4 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
            notice.tone === "error"
              ? "border-rose-400/30 bg-rose-500/10 text-rose-100"
              : notice.tone === "success"
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                : "border-white/10 bg-white/5 text-slate-200"
          }`}
        >
          {notice.tone === "error" ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : notice.tone === "success" ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : null}
          <span>{notice.text}</span>
        </div>
      ) : null}

      {progress ? (
        <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">
          <div className="flex items-center justify-between gap-3">
            <span>{progress.label}…</span>
            {progress.fraction !== null ? <span>{Math.round(progress.fraction * 100)}%</span> : null}
          </div>
          {progress.fraction !== null ? (
            <div role="progressbar" aria-label={progress.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.fraction * 100)} className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-amber-400 transition-[width]" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        <form onSubmit={onSubmit} className="space-y-5 lg:col-span-7" noValidate>
          <fieldset disabled={saving} className="space-y-5">
            <input
              ref={fileInput}
              type="file"
              accept={limits.pictures.types.join(",")}
              className="hidden"
              onChange={onFileChosen}
              aria-hidden="true"
              tabIndex={-1}
            />

            {/* Pictures */}
            <section className={panelClass} aria-labelledby="pictures-title">
              <h2 id="pictures-title" className={`${sectionTitle} mb-3`}>Pictures</h2>

              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-100">Banner</p>
                    <span className="text-[11px] text-slate-500">PNG, JPEG or WebP, up to {Math.round(limits.pictures.banner.maxBytes / (1024 * 1024))} MB</span>
                  </div>
                  <div className="relative h-24 overflow-hidden rounded-xl bg-slate-900 ring-1 ring-white/10 sm:h-28">
                    {bannerShown ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={bannerShown} alt="Current banner" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-500">No banner</div>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className={ghostBtn} onClick={() => pickPicture("banner")}><Upload className="h-3.5 w-3.5" /> Choose banner</button>
                    {pictures.banner.blob || pictures.banner.remove ? (
                      <button type="button" className={ghostBtn} onClick={() => undoPicture("banner")}><RotateCcw className="h-3.5 w-3.5" /> Undo</button>
                    ) : saved.profile.banner ? (
                      <button type="button" className={ghostBtn} onClick={() => stageRemove("banner")}><Trash2 className="h-3.5 w-3.5" /> Remove</button>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-900 ring-1 ring-white/10">
                    {avatarShown ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarShown} alt="Current avatar" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs text-slate-500">No avatar</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-100">Avatar</p>
                    <p className="text-[11px] text-slate-500">Square, at least {limits.pictures.avatar.minSide} px. Up to {Math.round(limits.pictures.avatar.maxBytes / (1024 * 1024))} MB.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" className={ghostBtn} onClick={() => pickPicture("avatar")}><Upload className="h-3.5 w-3.5" /> Choose avatar</button>
                      {pictures.avatar.blob || pictures.avatar.remove ? (
                        <button type="button" className={ghostBtn} onClick={() => undoPicture("avatar")}><RotateCcw className="h-3.5 w-3.5" /> Undo</button>
                      ) : saved.profile.avatar ? (
                        <button type="button" className={ghostBtn} onClick={() => stageRemove("avatar")}><Trash2 className="h-3.5 w-3.5" /> Remove</button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Identity */}
            <section className={panelClass} aria-labelledby="identity-title">
              <h2 id="identity-title" className={`${sectionTitle} mb-3`}>Name and username</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="profile-display-name" className={labelClass}>Display name</label>
                  <input
                    id="profile-display-name"
                    className={`${inputClass} mt-1.5`}
                    value={draft.displayName}
                    maxLength={limits.displayNameMax}
                    placeholder={saved.profile.username}
                    autoComplete="nickname"
                    onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
                    aria-invalid={Boolean(fieldErrors.displayName)}
                    aria-describedby="profile-display-name-help"
                  />
                  <p id="profile-display-name-help" className={`mt-1 text-[11px] ${fieldErrors.displayName ? "text-rose-300" : "text-slate-500"}`}>
                    {fieldErrors.displayName ?? `${characterCount(draft.displayName)}/${limits.displayNameMax}`}
                  </p>
                </div>

                <div>
                  <label htmlFor="profile-username" className={labelClass}>Username</label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-sm text-slate-500" aria-hidden="true">@</span>
                    <input
                      id="profile-username"
                      className={inputClass}
                      value={draft.username}
                      maxLength={limits.usernameMax}
                      autoComplete="username"
                      onChange={(event) => {
                        setServerErrors((current) => (current.username ? { ...current, username: undefined } : current));
                        setDraft((current) => ({ ...current, username: event.target.value.replace(/[^A-Za-z0-9_]/g, "") }));
                      }}
                      aria-invalid={Boolean(fieldErrors.username)}
                      aria-describedby="profile-username-help"
                    />
                  </div>
                  <p id="profile-username-help" className={`mt-1 text-[11px] ${fieldErrors.username || usernameMessage?.tone === "bad" ? "text-rose-300" : usernameMessage?.tone === "ok" ? "text-emerald-300" : "text-slate-500"}`}>
                    {fieldErrors.username ?? usernameMessage?.text ?? `${limits.usernameMin} to ${limits.usernameMax} letters, numbers or underscores.`}
                  </p>
                </div>
              </div>
            </section>

            {/* Bio */}
            <section className={panelClass} aria-labelledby="bio-title">
              <h2 id="bio-title" className={`${sectionTitle} mb-3`}>About you</h2>
              <label htmlFor="profile-bio" className={labelClass}>Bio</label>
              <textarea
                id="profile-bio"
                className={`${inputClass} mt-1.5 h-28 resize-y`}
                value={draft.bio}
                maxLength={limits.bioMax}
                onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))}
                placeholder="Gaming. Streaming. Creating."
                aria-invalid={Boolean(fieldErrors.bio)}
                aria-describedby="profile-bio-help"
              />
              <p id="profile-bio-help" className={`mt-1 text-right text-[11px] ${fieldErrors.bio ? "text-rose-300" : "text-slate-500"}`}>
                {fieldErrors.bio ?? `${characterCount(draft.bio)}/${limits.bioMax}`}
              </p>
            </section>

            {/* Links */}
            <section className={panelClass} aria-labelledby="links-title">
              <h2 id="links-title" className={`${sectionTitle} mb-1`}>Links</h2>
              <p className="mb-3 text-[11px] text-slate-500">Full https links, on each platform&apos;s own site. Leave a field empty to remove it. Up to {limits.socialLinksMax} links.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {SOCIAL_KEYS.map((key) => {
                  const platform = limits.socialPlatforms.find((entry) => entry.key === key);
                  const id = `profile-link-${key}`;
                  const error = fieldErrors.links?.[key];
                  return (
                    <div key={key}>
                      <label htmlFor={id} className={labelClass}>{platform?.label ?? key}</label>
                      <input
                        id={id}
                        type="url"
                        inputMode="url"
                        className={`${inputClass} mt-1.5`}
                        value={draft.links[key]}
                        maxLength={limits.socialLinkMaxLength}
                        placeholder={`https://${platform?.domains[0] ?? ""}/yourname`}
                        onChange={(event) => setLink(key, event.target.value)}
                        aria-invalid={Boolean(error)}
                        aria-describedby={`${id}-help`}
                      />
                      <p id={`${id}-help`} className={`mt-1 text-[11px] ${error ? "text-rose-300" : "text-slate-500"}`}>{error ?? " "}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Privacy */}
            <section className={panelClass} aria-labelledby="privacy-title">
              <h2 id="privacy-title" className={`${sectionTitle} mb-3`}>Optional details</h2>
              <ul className="divide-y divide-white/5">
                {PRIVACY_KEYS.map((key) => (
                  <li key={key} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-sm text-slate-100">{PRIVACY_COPY[key].label}</p>
                      <p className="text-[11px] text-slate-500">{PRIVACY_COPY[key].hint}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={draft.privacy[key]}
                      aria-label={PRIVACY_COPY[key].label}
                      onClick={() => setPrivacy(key, !draft.privacy[key])}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition ${draft.privacy[key] ? "bg-amber-400" : "bg-slate-700"}`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${draft.privacy[key] ? "left-5" : "left-0.5"}`} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {/* Actions */}
            <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#0b0f17]/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
              <p className="text-[11px] text-slate-400" aria-live="polite">{dirty ? "Unsaved changes" : "All changes saved"}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={ghostBtn} onClick={() => guard.requestLeave("/app/profile")} disabled={saving}>Cancel</button>
                <button type="button" className={ghostBtn} onClick={() => setConfirmReset(true)} disabled={!dirty || saving}>
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </button>
                <button type="submit" className={goldBtn} disabled={!dirty || saving || formHasErrors}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </fieldset>
        </form>

        <div className="lg:col-span-5 lg:sticky lg:top-6 lg:self-start">
          <h2 className={`${sectionTitle} mb-3`}>Preview</h2>
          <ProfilePreview
            seed={saved.profile.id}
            displayName={draft.displayName}
            username={draft.username}
            bio={draft.bio}
            avatarUrl={avatarShown}
            bannerUrl={bannerShown}
            links={previewLinks}
          />
          <p className="mt-2 text-[11px] text-slate-500">This is how your profile looks to other people, with unsaved changes applied.</p>
        </div>
      </div>

      {cropping ? (
        <PictureCropDialog
          key={`${cropping.kind}-${cropping.file.name}-${cropping.file.size}`}
          kind={cropping.kind}
          file={cropping.file}
          limits={limits.pictures}
          onCancel={() => setCropping(null)}
          onReady={onCropReady}
        />
      ) : null}

      {guard.pendingHref || confirmReset ? (
        <ConfirmDialog
          title={confirmReset ? "Reset your changes?" : "Leave without saving?"}
          body={confirmReset ? "Your unsaved changes will be discarded and your saved profile shown." : "You have unsaved changes. They will be lost if you leave now."}
          confirmLabel={confirmReset ? "Discard changes" : "Leave without saving"}
          cancelLabel="Keep editing"
          onConfirm={() => (confirmReset ? discardEdits() : guard.confirmLeave())}
          onCancel={() => {
            setConfirmReset(false);
            guard.cancelLeave();
          }}
        />
      ) : null}
    </Shell>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation">
      <div role="alertdialog" aria-modal="true" aria-labelledby="profile-confirm-title" aria-describedby="profile-confirm-body" className="w-full max-w-sm rounded-2xl border border-amber-500/20 bg-[#0d1119] p-5 shadow-2xl">
        <h2 id="profile-confirm-title" className="text-sm font-bold text-white">{title}</h2>
        <p id="profile-confirm-body" className="mt-2 text-xs text-slate-300">{body}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} className={ghostBtn} autoFocus>{cancelLabel}</button>
          <button type="button" onClick={onConfirm} className="inline-flex items-center rounded-lg bg-rose-500 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white hover:bg-rose-400">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
