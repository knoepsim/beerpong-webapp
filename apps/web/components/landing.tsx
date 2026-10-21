"use client";

import Link from "next/link";
import { ArrowRight, Plus, Radio, Trophy, Users, type LucideIcon } from "lucide-react";
import { BrandMark, BrandName } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/queries/user";
import { cn } from "@/lib/utils";

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Trophy,
    title: "Jeder Turniermodus",
    text: "K.-o.-System, jeder gegen jeden oder Gruppenphase mit K.-o.-Runde.",
  },
  {
    icon: Users,
    title: "Anmeldung und Check-in",
    text: "Teams kommen per Link dazu und checken vor Ort ein.",
  },
  {
    icon: Radio,
    title: "Live für alle",
    text: "Spielplan, Ergebnisse und Tabelle sofort auf jedem Handy.",
  },
];

/**
 * What the start page says depends on who looks: a greeting with the name and the way into the app, or the way in.
 * Without a session there is nothing to load; with one the name comes, and an expired session is a visitor again.
 */
function Welcome({ hasSession }: Readonly<{ hasSession: boolean }>) {
  const { user, isLoading } = useCurrentUser();

  if (hasSession && isLoading) {
    return (
      <div className="flex flex-col items-center gap-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-72" />
        <Skeleton className="h-11 w-48" />
      </div>
    );
  }

  if (hasSession && user) {
    return (
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Hallo {user.name}!</h1>
        <p className="max-w-md text-muted-foreground">Deine Turniere, Einladungen und Spiele warten auf dich.</p>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link href="/tournaments" className={cn(buttonVariants({ size: "lg" }), "h-11")}>
            Zu meinen Turnieren
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Link>
          <Link href="/tournaments/new" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-11")}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            Turnier erstellen
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Turniere einfach organisieren.</h1>
      <p className="max-w-md text-muted-foreground">
        Anmeldung, Spielplan und Ergebnisse an einem Ort, gemacht fürs Handy.
      </p>
      <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "h-11 w-full sm:w-auto")}>
        Jetzt starten
        <ArrowRight data-icon="inline-end" aria-hidden="true" />
      </Link>
    </div>
  );
}

/** The start page: open for everybody, a greeting and the way into the app, three things the app does. */
export function Landing({ hasSession }: Readonly<{ hasSession: boolean }>) {
  const { user, isLoading } = useCurrentUser();
  const visitor = !hasSession || (!isLoading && !user);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="MatchBase, Startseite">
          <BrandMark size={28} />
          <BrandName className="text-lg" />
        </Link>
        {visitor && (
          <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
            Anmelden
          </Link>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center gap-12 px-4 py-12 text-center sm:py-20">
        <div className="flex flex-col items-center gap-6">
          <BrandMark size={88} className="rounded-3xl shadow-lg" />
          <Badge variant="secondary">Bierpong, Fußball und mehr</Badge>
          <Welcome hasSession={hasSession} />
        </div>

        <ul className="grid w-full gap-3 text-left sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <Card className="h-full">
                <CardHeader>
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                  <CardTitle className="text-base">{title}</CardTitle>
                  <CardDescription>{text}</CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground">MatchBase</footer>
    </div>
  );
}
