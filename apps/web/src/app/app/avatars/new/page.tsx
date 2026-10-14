import type { Metadata } from "next";
import Link from "next/link";
import { AvatarBuilder } from "@/components/avatar3d/avatar-builder";

export const metadata: Metadata = {
  title: "Build an avatar",
  description: "Design your Nexus Forge character in 3D: body, skin, hair, eyes, clothing and accessories.",
};

export default function NewAvatarPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="nf-heading text-xl font-bold text-white">Build an avatar</h1>
          <p className="text-xs text-slate-400">Every option changes the 3D character you see.</p>
        </div>
        <Link href="/app/avatars" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300 hover:text-white">Your avatars</Link>
      </div>
      <AvatarBuilder />
    </div>
  );
}
