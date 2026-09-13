import { redirect } from "next/navigation";

export default function LegacyRedirect() {
  redirect("/app/server");
}
