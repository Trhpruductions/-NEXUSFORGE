import type { Metadata } from "next";
import { AvatarStudio } from "@/components/avatar/avatar-studio";

export const metadata: Metadata = {
  title: "Avatar Studio",
  description: "Create. Customize. Be you.",
};

export default function AppAvatarPage() {
  return <AvatarStudio />;
}
