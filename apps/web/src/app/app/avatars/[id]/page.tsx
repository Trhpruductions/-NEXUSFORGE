import type { Metadata } from "next";
import Link from "next/link";
import { AvatarEditor } from "@/components/avatar3d/avatar-editor";

export const metadata: Metadata = {
  title: "Edit avatar",
  description: "Change a saved Nexus Forge avatar.",
};

export default async function EditAvatarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="nf-heading text-xl font-bold text-white">Edit avatar</h1>
          <p className="text-xs text-slate-400">Changes are saved to this avatar when you press Save changes.</p>
        </div>
        <Link href="/app/avatars" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300 hover:text-white">Your avatars</Link>
      </div>
      <AvatarEditor presetId={id} />
    </div>
  );
}
