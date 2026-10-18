import { redirect } from "next/navigation";

// The Terms now live in the Legal Center, with versions and history.
export default function TermsPage() {
  redirect("/legal/terms");
}
