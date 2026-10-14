import type { NextRequest } from "next/server";
import { exportCsv } from "@/features/export/export-route";

export async function GET(request: NextRequest) {
  return exportCsv(request, "transactions");
}
