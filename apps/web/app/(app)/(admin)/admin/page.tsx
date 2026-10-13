"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Trophy, Settings } from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Link href="/admin/users" className="block h-full transition-transform hover:scale-[1.02]">
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Benutzer</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Verwaltung</div>
            <p className="text-xs text-muted-foreground mt-1">
              Nutzerrollen, Profile & Berechtigungen
            </p>
          </CardContent>
        </Card>
      </Link>
      
      <Link href="/admin/tournaments" className="block h-full transition-transform hover:scale-[1.02]">
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Turniere</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Alle Turniere</div>
            <p className="text-xs text-muted-foreground mt-1">
              Globale Turnierübersicht & Support
            </p>
          </CardContent>
        </Card>
      </Link>
      
      <Link href="/admin/settings" className="block h-full transition-transform hover:scale-[1.02]">
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Einstellungen</div>
            <p className="text-xs text-muted-foreground mt-1">
              Globale Konfiguration
            </p>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
