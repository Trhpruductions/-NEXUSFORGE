import type { Metadata } from "next";
import { AvatarGallery } from "@/components/avatar3d/avatar-gallery";

export const metadata: Metadata = {
  title: "Your avatars",
  description: "Your saved Nexus Forge characters: edit, duplicate, rename, share or delete them.",
};

export default function AvatarsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="nf-heading text-xl font-bold text-white">Your avatars</h1>
        <p className="text-xs text-slate-400">Your saved characters. Set one as your main gaming profile character.</p>
      </div>
      <AvatarGallery />
    </div>
  );
}
