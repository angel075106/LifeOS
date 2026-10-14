import type { Metadata } from "next";
import { BudgetsScreen } from "@/features/finance/budgets-screen";

export const metadata: Metadata = { title: "Budgets" };

export default function BudgetsPage() {
  return <BudgetsScreen />;
}
