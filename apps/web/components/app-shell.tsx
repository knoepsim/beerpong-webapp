"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, Users, UserCircle, LogOut, Wrench } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { useCurrentUser } from "@/hooks/queries/user";
import { useMyInvitations } from "@/hooks/queries/invitations";
import { useMyTournaments } from "@/hooks/queries/tournaments";
import { groupTournaments, mergeMyTournaments } from "@/lib/tournament-groups";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { logout } from "@/lib/auth";
import { BrandMark, BrandName } from "@/components/brand";
import { cn } from "@/lib/utils";

/** A dot: there is something to look at (an open invitation, a tournament that runs); for screen readers in words. */
function NavDot({ label, floating = false }: Readonly<{ label: string | null; floating?: boolean }>) {
  if (!label) return null;
  return (
    <span className={`size-2.5 rounded-full bg-primary ring-2 ring-background ${floating ? "absolute -top-0.5 -right-1" : ""}`}>
      <span className="sr-only">{label}</span>
    </span>
  );
}

const navItems = [
  // an invitation belongs to the tournaments
  { href: "/tournaments", label: "Turniere", icon: Trophy, also: "/invitations" },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/profile", label: "Profil", icon: UserCircle },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, isLoading } = useCurrentUser();
  // a dot at "Turniere" while an invitation waits there or a tournament of mine runs
  const hasInvitations = (useMyInvitations({ enabled: !!user }).data?.length ?? 0) > 0;
  const mine = useMyTournaments({ enabled: !!user }).data;
  const hasRunning = useMemo(() => !!mine && groupTournaments(mergeMyTournaments(mine)).active.length > 0, [mine]);
  let tournamentsDot: string | null = null;
  if (hasInvitations) tournamentsDot = "Offene Einladung";
  else if (hasRunning) tournamentsDot = "Turnier läuft";
  const dotFor = (href: string) => (href === "/tournaments" ? tournamentsDot : null);
  const isActiveItem = (item: (typeof navItems)[number]) =>
    pathname.startsWith(item.href) || (!!item.also && pathname.startsWith(item.also));
  // somebody without login (a spectator on a public tournament) only has the page in front of him: no app navigation
  const isGuest = !isLoading && !user;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/tournaments" className="flex items-center gap-2">
            <BrandMark size={28} />
            <BrandName className="text-lg" />
          </Link>

          {isGuest && (
            <Link
              href={`/login?redirect=${encodeURIComponent(pathname)}`}
              className="rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10"
            >
              Anmelden
            </Link>
          )}

          {/* Desktop nav */}
          <nav className={`hidden items-center gap-1 ${isGuest ? "" : "md:flex"}`}>
            {navItems.map((item) => {
              const isActive = isActiveItem(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                >
                  <item.icon className="size-4" aria-hidden="true" />
                  {item.label}
                  <NavDot label={dotFor(item.href)} />
                </Link>
              );
            })}

            {user?.is_system_admin && (
              <Link
                href="/admin"
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${pathname.startsWith("/admin")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
              >
                <Wrench className="size-4" aria-hidden="true" />
                Admin
              </Link>
            )}
          </nav>

          {user && (
            <div className="hidden md:flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" className="text-sm text-muted-foreground font-normal hover:text-foreground" />}>
                  {user.name}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem render={<Link href="/profile" className="cursor-pointer" />}>
                    Profil bearbeiten
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:text-destructive"
                    onClick={() => void logout()}
                  >
                    <LogOut aria-hidden="true" />
                    Abmelden
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className={`flex-1 md:pb-6 ${isGuest ? "pb-6" : "pb-20"}`}>{children}</main>

      {/* Bottom navigation — mobile only */}
      <nav className={`fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/90 backdrop-blur-md md:hidden ${isGuest ? "hidden" : ""}`}>
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = isActiveItem(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-medium transition-colors ${isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                  }`}
              >
                <span className="relative">
                  <item.icon className={cn("size-5", isActive && "text-primary")} aria-hidden="true" />
                  <NavDot label={dotFor(item.href)} floating />
                </span>
                {item.label}
              </Link>
            );
          })}

          {user?.is_system_admin && (
            <Link
              href="/admin"
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-medium transition-colors ${pathname.startsWith("/admin")
                  ? "text-primary"
                  : "text-muted-foreground"
                }`}
            >
              <Wrench className={cn("size-5", pathname.startsWith("/admin") && "text-primary")} aria-hidden="true" />
              Admin
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
