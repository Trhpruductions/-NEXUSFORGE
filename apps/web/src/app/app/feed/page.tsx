import type { Metadata } from "next";
import { FeedPage } from "@/components/social/feed-page";

export const metadata: Metadata = { title: "Feed", description: "Posts and clips from the people you follow." };

export default function AppFeedPage() {
  return <FeedPage />;
}
