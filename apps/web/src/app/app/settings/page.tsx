import type { Metadata } from "next";
import { SettingsPage } from "@/components/settings/settings-page";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your account, privacy, and community settings.",
};

export default function AppSettingsPage() {
  return <SettingsPage />;
}
