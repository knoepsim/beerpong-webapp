"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BeerpongTable } from "@/components/BeerpongTable";
import { useCurrentUser } from "@/components/user-provider";

export default function Home() {
  const { user, isLoading } = useCurrentUser();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="w-full h-16 flex items-center justify-between px-6 border-b">
        <div className="font-bold text-xl flex items-center gap-2">
          <span>🏓</span>
          <span>Bierpong</span>
        </div>
        {!isLoading && (
          <Link href={user ? "/tournaments" : "/login"}>
            <Button variant={user ? "default" : "outline"}>
              {user ? "Zum Dashboard" : "Anmelden"}
            </Button>
          </Link>
        )}
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 space-y-12">
        <div className="text-center max-w-2xl space-y-4">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight">
            {user ? `Willkommen zurück, ${user.name}!` : "Das ultimative Turnier-Tool"}
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground">
            Organisiere deine Bierpong-Turniere, erstelle Teams und verfolge den KO-Baum live.
          </p>
          <div className="pt-4 flex items-center justify-center gap-4">
            <Link href={user ? "/tournaments" : "/login"}>
              <Button size="lg" className="h-12 px-8 text-base">
                {user ? "Zu deinen Turnieren" : "Jetzt loslegen"}
              </Button>
            </Link>
          </div>
        </div>

        <div className="w-full max-w-4xl">
          <BeerpongTable leftCups={10} rightCups={10} />
        </div>
      </main>

      <footer className="w-full py-6 text-center text-sm text-muted-foreground border-t">
        Bierpong Turnier-App &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
