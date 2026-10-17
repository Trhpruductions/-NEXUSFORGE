import type { Metadata } from "next";
import { ProfileEditor } from "@/components/profile/profile-editor";

export const metadata: Metadata = {
  title: "Edit profile",
  description: "Update your name, username, bio, pictures, links and privacy.",
};

export default function EditProfilePage() {
  return <ProfileEditor />;
}
