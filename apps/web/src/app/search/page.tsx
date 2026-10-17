import { redirect } from "next/navigation";

/** Old address: send people to the in-app page, keeping anything after the "?". */
export default async function LegacyRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
  }
  const query = params.toString();
  redirect(query ? `/app/search?${query}` : "/app/search");
}
