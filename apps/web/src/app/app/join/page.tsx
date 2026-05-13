"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function extractInviteCode(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";

  const direct = trimmed.toLowerCase().replace(/^\/+|\/+$/g, "");
  if (/^[a-z0-9-]{3,32}$/i.test(direct)) {
    return direct;
  }

  try {
    const parsed = new URL(trimmed);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const inviteIndex = segments.findIndex((segment) => segment.toLowerCase() === "invite");
    if (inviteIndex >= 0 && segments[inviteIndex + 1]) {
      const candidate = segments[inviteIndex + 1].toLowerCase();
      return /^[a-z0-9-]{3,32}$/i.test(candidate) ? candidate : "";
    }
  } catch {
    return "";
  }

  return "";
}

export default function JoinServerPage() {
  const router = useRouter();
  const [draft, setDraft] = useState("");

  const inviteCode = useMemo(() => extractInviteCode(draft), [draft]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inviteCode) return;
    router.push(`/invite/${inviteCode}`);
  };

  return (
    <div className="nexus-shell">
      <div className="nexus-shell-inner max-w-3xl space-y-4">
        <section className="nexus-panel rounded-3xl p-6">
          <p className="nexus-eyebrow text-cyan-300">Join Server</p>
          <h1 className="mt-2 font-[family-name:var(--font-orbitron)] text-2xl font-semibold text-white sm:text-3xl">
            Join a NexusForge server from inside the app
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Paste an invite link or code. Example: <span className="text-cyan-200">/invite/trh-development</span>
          </p>

          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <label className="nexus-form-field">
              <span className="nexus-form-label">Invite Link Or Code</span>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="https://www.nexusforge.app/invite/your-code or your-code"
                className="nexus-form-input"
              />
            </label>

            {!inviteCode && draft.trim() ? (
              <p className="nexus-form-error">Invalid invite format. Paste a valid /invite/... link or code.</p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={!inviteCode} className="nexus-glow-button rounded-2xl px-5 py-2 text-sm font-semibold text-cyan-50 disabled:cursor-not-allowed disabled:opacity-60">
                Continue To Invite
              </button>
              <Link href="/app" className="nexus-outline-button rounded-2xl px-5 py-2 text-sm font-semibold text-slate-200">
                Back To Home
              </Link>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
