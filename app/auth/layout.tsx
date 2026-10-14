import { Wordmark } from "@/components/domain/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10 pt-safe">
      <div className="grid w-full max-w-sm gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Wordmark size="lg" />
          <p className="text-sm text-fg-muted">Your calendar, time and money in one place.</p>
        </div>
        {children}
      </div>
    </main>
  );
}
