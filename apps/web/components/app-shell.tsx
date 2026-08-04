"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, Users, UserCircle, LogOut, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { useCurrentUser } from "./user-provider";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { clearTokens } from "@/lib/auth";

const navItems = [
  { href: "/tournaments", label: "Turniere", icon: Trophy },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/profile", label: "Profil", icon: UserCircle },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useCurrentUser();

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

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
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
                    onClick={() => {
                      clearTokens();
                      window.location.href = "/login";
                    }}
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
      <main className="flex-1 pb-20 md:pb-6">{children}</main>

      {/* Bottom navigation — mobile only */}
      <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/90 backdrop-blur-md md:hidden">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-medium transition-colors ${isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                  }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
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
