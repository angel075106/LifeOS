import type { Metadata } from "next";
import { TransactionsScreen } from "@/features/finance/transactions-screen";

export const metadata: Metadata = { title: "Transactions" };

export default function TransactionsPage() {
  return <TransactionsScreen />;
}
