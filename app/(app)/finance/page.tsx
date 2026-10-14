import type { Metadata } from "next";
import { FinanceOverviewScreen } from "@/features/finance/overview-screen";

export const metadata: Metadata = { title: "Finance" };

export default function FinancePage() {
  return <FinanceOverviewScreen />;
}
