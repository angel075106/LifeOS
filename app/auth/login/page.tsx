import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { Skeleton } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  // The form reads ?next= (useSearchParams), so it renders inside a Suspense boundary.
  return (
    <Suspense fallback={<Skeleton className="h-80" />}>
      <LoginForm />
    </Suspense>
  );
}
