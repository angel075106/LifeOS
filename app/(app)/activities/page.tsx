import type { Metadata } from "next";
import { ActivitiesScreen } from "@/features/activities/activities-screen";

export const metadata: Metadata = { title: "Activities" };

export default function ActivitiesPage() {
  return <ActivitiesScreen />;
}
