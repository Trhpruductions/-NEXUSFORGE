import type { Metadata } from "next";
import { EventsPage } from "@/components/events/events-page";

export const metadata: Metadata = {
  title: "Events & Tournaments",
  description: "Schedule community events, register for tournaments, and follow live brackets.",
};

export default function AppEventsPage() {
  return <EventsPage />;
}
