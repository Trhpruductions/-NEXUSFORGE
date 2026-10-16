import { redirect } from "next/navigation";

// The Avatar Studio is the saved-looks editor at /app/avatars. This route stays so older links keep working.
export default function AppAvatarPage() {
  redirect("/app/avatars");
}
