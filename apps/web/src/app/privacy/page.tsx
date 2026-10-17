import { redirect } from "next/navigation";

// The Privacy Policy now lives in the Legal Center, with versions and history.
export default function PrivacyPage() {
  redirect("/legal/privacy");
}
