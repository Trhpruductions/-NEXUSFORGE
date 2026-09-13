import type { Metadata } from "next";
import { SearchPage } from "@/components/search/search-page";

export const metadata: Metadata = { title: "Search", description: "Messages, people and forges." };

export default function AppSearchPage() {
  return <SearchPage />;
}
