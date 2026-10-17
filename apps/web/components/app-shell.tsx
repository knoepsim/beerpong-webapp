"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, Users, UserCircle, LogOut, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { useCurrentUser } from "@/hooks/queries/user";
import { useMyInvitations } from "@/hooks/queries/invitations";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { logout } from "@/lib/auth";

/** The number of open invitations; for screen readers as words. */
function NavBadge({ count, floating = false }: Readonly<{ count: number; floating?: boolean }>) {
  if (count === 0) return null;
  return (
    <span
      className={`min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-semibold leading-4 text-white tabular-nums ${floating ? "absolute -top-1.5 -right-2.5" : ""}`}
    >
      {count}
      <span className="sr-only">{count === 1 ? " offene Einladung" : " offene Einladungen"}</span>
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
  // open invitations wait in "Meine Turniere": their number at "Turniere"
  const openInvitations = useMyInvitations({ enabled: !!user }).data?.length ?? 0;
  const badgeFor = (href: string) => (href === "/tournaments" ? openInvitations : 0);
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
            <span className="text-xl">🏓</span>
            <span className="text-lg font-bold tracking-tight text-primary">
              Bierpong
            </span>
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
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  <NavBadge count={badgeFor(item.href)} />
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
                <Wrench className="h-4 w-4" />
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
                    <LogOut className="mr-2 h-4 w-4" />
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
                  <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                  <NavBadge count={badgeFor(item.href)} floating />
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
              <Wrench className={`h-5 w-5 ${pathname.startsWith("/admin") ? "text-primary" : ""}`} />
              Admin
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
