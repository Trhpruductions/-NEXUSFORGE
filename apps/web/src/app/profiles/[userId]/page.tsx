import { redirect } from "next/navigation";

export default async function LegacyProfileRedirect({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  redirect(`/app/profile?user=${encodeURIComponent(userId)}`);
}
