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
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings2 },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function QuickAddMenu({ align = "end" }: { align?: "start" | "end" }) {
  const { openActivity, openTransaction } = useEntryDialogs();
  const { timezone } = useProfile();
  const today = () => todayInZone(timezone);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="primary" size="md" aria-label="Quick add">
          <Plus aria-hidden="true" />
          <span className="max-md:sr-only">New entry</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        <DropdownMenuLabel>Add for today</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => openActivity({ mode: "create", date: today() })}>
          <Activity className="text-cyan" aria-hidden="true" />
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
        className="sr-only z-[80] rounded-hud bg-cyan px-3 py-2 font-medium text-void focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-base/90 backdrop-blur md:flex">
        <div className="flex h-16 items-center border-b border-line px-5">
          <Link href="/calendar" aria-label="LifeOS home">
            <Wordmark />
          </Link>
        </div>
        <div className="px-4 pt-4">
          <QuickAddMenu align="start" />
        </div>
        <nav aria-label="Primary" className="mt-4 flex-1 px-3">
          <p className="hud-label px-2 pb-2">Navigation</p>
          <ul className="grid gap-0.5">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex h-10 items-center gap-3 rounded-hud px-3 text-sm text-fg-muted transition-colors hover:bg-panel-hover hover:text-fg",
                      active && "bg-cyan/10 text-fg",
                    )}
                  >
                    {active ? (
                      <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-cyan" aria-hidden="true" />
                    ) : null}
                    <Icon className={cn("size-4", active ? "text-cyan" : "text-fg-subtle group-hover:text-fg-muted")} aria-hidden="true" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="grid gap-3 border-t border-line p-4">
          <SyncIndicator />
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-xs text-fg-muted" title={email ?? undefined}>
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
      <header className="sticky top-0 z-30 border-b border-line bg-base/90 pt-safe backdrop-blur md:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link href="/calendar" aria-label="LifeOS home">
            <Wordmark />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <SyncIndicator compact />
            <QuickAddMenu />
          </div>
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-[1600px] px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 outline-none md:px-8 md:pb-10 md:pt-6"
      >
        <TimezoneNotice />
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-base/95 pb-safe backdrop-blur md:hidden"
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
                    "flex h-16 flex-col items-center justify-center gap-1 text-[11px] text-fg-subtle transition-colors",
                    active && "text-cyan",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
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
