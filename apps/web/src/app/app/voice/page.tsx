import { redirect } from "next/navigation";

export default function LegacyRedirect() {
  redirect("/app/chat?voice=1");
}
