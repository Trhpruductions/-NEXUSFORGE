"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Crown } from "lucide-react";
import type { ForgeMemberEntry, ForgeRole } from "@/lib/api";
import { UserCard } from "@/components/social/user-card";

type MemberListProps = {
  members: ForgeMemberEntry[];
  roles: ForgeRole[];
  ownerId: string;
  selfId?: string;
  onSelectMember?: (member: ForgeMemberEntry) => void;
};

type Group = {
  key: string;
  label: string;
  color: string | null;
  members: ForgeMemberEntry[];
};

const statusDot: Record<ForgeMemberEntry["user"]["status"], string> = {
  ONLINE: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]",
  IDLE: "bg-yellow-300",
  DND: "bg-rose-400",
  OFFLINE: "bg-slate-600",
};

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** Resolve a member's highest role (owner counts as position 100). */
export function topRoleFor(member: ForgeMemberEntry, roles: ForgeRole[], ownerId: string): ForgeRole | null {
  let top: ForgeRole | null = null;
  for (const link of member.roleLinks) {
    const role = roles.find((entry) => entry.id === link.roleId);
    if (role && (!top || role.position > top.position)) top = role;
  }
  if (member.userId === ownerId && (!top || top.position < 100)) {
    const ownerRole = roles.find((role) => role.position >= 100) ?? null;
    return ownerRole ?? top;
  }
  return top;
}

export function MemberList({ members, roles, ownerId, selfId, onSelectMember }: MemberListProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [cardFor, setCardFor] = useState<string | null>(null);

  const groups = useMemo<Group[]>(() => {
    const sortedRoles = [...roles].sort((a, b) => b.position - a.position);
    const byRole = new Map<string, ForgeMemberEntry[]>();
    const online: ForgeMemberEntry[] = [];
    const offline: ForgeMemberEntry[] = [];

    for (const member of members) {
      if (member.user.status === "OFFLINE") {
        offline.push(member);
        continue;
      }
      const top = topRoleFor(member, roles, ownerId);
      if (top) {
        const list = byRole.get(top.id) ?? [];
        list.push(member);
        byRole.set(top.id, list);
      } else {
        online.push(member);
      }
    }

    const byName = (a: ForgeMemberEntry, b: ForgeMemberEntry) =>
      (a.nickname || a.user.username).localeCompare(b.nickname || b.user.username);

    const result: Group[] = [];
    for (const role of sortedRoles) {
      const list = byRole.get(role.id);
      if (list?.length) result.push({ key: role.id, label: role.name, color: role.color, members: list.sort(byName) });
    }
    if (online.length) result.push({ key: "online", label: "Online", color: null, members: online.sort(byName) });
    if (offline.length) result.push({ key: "offline", label: "Offline", color: null, members: offline.sort(byName) });
    return result;
  }, [members, roles, ownerId]);

  const onlineCount = members.filter((member) => member.user.status !== "OFFLINE").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Members</p>
        <span className="rounded-[14px] border border-slate-700/70 bg-slate-900/75 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-300">
          {onlineCount}/{members.length} online
        </span>
      </div>

      {groups.map((group) => {
        const isCollapsed = collapsed[group.key] ?? group.key === "offline";
        return (
          <div key={group.key}>
            <button
              type="button"
              onClick={() => setCollapsed((current) => ({ ...current, [group.key]: !isCollapsed }))}
              className="flex w-full items-center gap-1.5 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 transition hover:text-slate-200"
            >
              {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <span style={group.color ? { color: group.color } : undefined}>{group.label}</span>
              <span className="text-slate-600">— {group.members.length}</span>
            </button>
            {!isCollapsed ? (
              <ul className="space-y-0.5">
                {group.members.map((member) => {
                  const top = topRoleFor(member, roles, ownerId);
                  const isOffline = member.user.status === "OFFLINE";
                  return (
                    <li key={member.id} className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectMember) onSelectMember(member);
                          else setCardFor((current) => (current === member.userId ? null : member.userId));
                        }}
                        className={`flex w-full items-center gap-2 rounded-[12px] px-2 py-1.5 text-left transition hover:bg-slate-800/70 ${isOffline ? "opacity-50" : ""}`}
                      >
                        <span className="relative shrink-0">
                          {member.user.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={member.user.avatar} alt="" className="h-7 w-7 rounded-full border border-slate-700 object-cover" />
                          ) : (
                            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-[10px] font-semibold text-slate-200">
                              {initials(member.user.username)}
                            </span>
                          )}
                          <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-950 ${statusDot[member.user.status]}`} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm" style={{ color: top?.color ?? "#e2e8f0" }}>
                              {member.nickname || member.user.username}
                            </span>
                            {member.userId === ownerId ? <Crown className="h-3 w-3 shrink-0 text-amber-300" /> : null}
                            {member.userId === selfId ? <span className="text-[9px] uppercase tracking-[0.14em] text-slate-500">you</span> : null}
                          </span>
                          {member.nickname ? <span className="block truncate text-[10px] text-slate-500">@{member.user.username}</span> : null}
                        </span>
                      </button>
                      {cardFor === member.userId ? <UserCard userId={member.userId} onClose={() => setCardFor(null)} align="right" /> : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
