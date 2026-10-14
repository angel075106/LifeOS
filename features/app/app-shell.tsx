"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  LogOut,
  Plus,
  Settings2,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/domain/logo";
import { ThemeMenu } from "@/components/theme/theme-menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEntryDialogs } from "@/features/entries/entry-dialogs";
import { todayInZone } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useProfile, useSession } from "./session";
import { SyncIndicator } from "./sync-indicator";
import { TimezoneNotice } from "./timezone-notice";
import { useSignOut } from "./use-sign-out";

const NAV_ITEMS = [
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/activities", label: "Activities", icon: Activity },
  { href: "/finance", label: "Finance", icon: Wallet },
  { href: "/stats", label: "Statistics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings2 },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function QuickAddMenu({ align = "end", className }: { align?: "start" | "end"; className?: string }) {
  const { openActivity, openTransaction } = useEntryDialogs();
  const { timezone } = useProfile();
  const today = () => todayInZone(timezone);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="primary" className={className}>
          <Plus aria-hidden="true" />
          <span className="max-md:sr-only">New entry</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        <DropdownMenuLabel>Add for today</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => openActivity({ mode: "create", date: today() })}>
          <Activity className="text-accent-text" aria-hidden="true" />
          Activity
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openTransaction({ mode: "create", date: today(), type: "income" })}>
          <ArrowUpRight className="text-income" aria-hidden="true" />
          Income
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openTransaction({ mode: "create", date: today(), type: "expense" })}>
          <ArrowDownRight className="text-expense" aria-hidden="true" />
          Expense
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { email } = useSession();
  const { signOut, pending } = useSignOut();

  return (
    <div className="min-h-dvh md:pl-60">
      <a
        href="#main"
        className="sr-only z-[80] rounded-lg bg-accent px-3 py-2 font-medium text-accent-fg shadow-popover focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-canvas md:flex">
        <div className="flex h-14 items-center px-4">
          <Link href="/calendar" aria-label="LifeOS home" className="rounded-md">
            <Wordmark />
          </Link>
        </div>
        <div className="px-3 pt-1">
          <QuickAddMenu align="start" className="w-full" />
        </div>
        <nav aria-label="Primary" className="mt-5 flex-1 px-3">
          <ul className="grid gap-0.5">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex h-9 items-center gap-2.5 rounded-lg border px-2.5 text-sm font-medium transition-colors",
                      active
                        ? "border-border bg-segment text-fg shadow-card"
                        : "border-transparent text-fg-muted hover:bg-muted hover:text-fg",
                    )}
                  >
                    <Icon
                      className={cn("size-4", active ? "text-accent-text" : "text-fg-subtle group-hover:text-fg-muted")}
                      aria-hidden="true"
                    />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="grid gap-1 border-t border-border p-3">
          <div className="flex h-8 items-center justify-between gap-2 pl-1">
            <SyncIndicator />
            <ThemeMenu align="start" side="top" />
          </div>
          <div className="flex items-center gap-2 pl-1">
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted-strong text-xs font-semibold uppercase text-fg-muted"
              aria-hidden="true"
            >
              {email?.charAt(0) ?? "?"}
            </span>
            <p className="min-w-0 flex-1 truncate text-[13px] text-fg-muted" title={email ?? undefined}>
              {email}
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void signOut("local")}
              loading={pending}
              aria-label="Sign out"
              title="Sign out"
            >
              {!pending ? <LogOut aria-hidden="true" /> : null}
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-canvas/85 pt-safe backdrop-blur-md md:hidden">
        <div className="flex h-14 items-center gap-2 px-4">
          <Link href="/calendar" aria-label="LifeOS home" className="rounded-md">
            <Wordmark />
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <SyncIndicator compact />
            <ThemeMenu align="end" side="bottom" />
            <QuickAddMenu className="ml-1" />
          </div>
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-[1440px] px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 outline-none md:px-8 md:pb-10 md:pt-7"
      >
        <TimezoneNotice />
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/90 pb-safe backdrop-blur-md md:hidden"
      >
        <ul className="grid grid-cols-5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                    active ? "text-accent-text" : "text-fg-subtle hover:text-fg",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                      active && "bg-accent-soft",
                    )}
                    aria-hidden="true"
                  >
                    <Icon className="size-[1.15rem]" />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
