import { ProfileSettingsForm } from "@/components/profile/profile-settings-form";

export default function SettingsPage() {
  return (
    <div className="nexus-shell px-4 py-6 sm:px-8">
      <div className="nexus-shell-inner max-w-5xl space-y-4">
        <div className="nexus-hero">
          <p className="nexus-eyebrow text-cyan-300">Account Control</p>
          <h1 className="nexus-title mt-2 text-slate-50">Profile and Presence Settings</h1>
          <p className="nexus-subtitle mt-2 text-slate-400">Update your identity, rich presence, and notification permissions.</p>
        </div>
        <ProfileSettingsForm />
      </div>
    </div>
  );
}
