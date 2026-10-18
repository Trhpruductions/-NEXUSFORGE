import type { Metadata } from "next";
import { AvatarViewerLab } from "@/components/avatar3d/avatar-viewer-lab";

export const metadata: Metadata = {
  title: "3D Avatar Viewer",
  description: "Turn your Nexus Forge avatar in real 3D.",
};

export default function AvatarViewerPage() {
  return <AvatarViewerLab />;
}
