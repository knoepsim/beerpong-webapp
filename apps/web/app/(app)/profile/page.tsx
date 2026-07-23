"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearTokens } from "@/lib/auth";
import { useCurrentUser } from "@/components/user-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { LogOut, Save, User as UserIcon } from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const { user, reload } = useCurrentUser();
  
  const [name, setName] = useState(user?.name || "");
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.users.updateMe(name);
      await reload();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fehler beim Speichern";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    clearTokens();
    window.location.href = "/login";
  };

  if (!user) {
    return <div className="p-8 text-center animate-pulse">Lade Profil…</div>;
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-20 md:pb-6 space-y-6">
      <h1 className="text-2xl font-bold">Dein Profil</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <UserIcon className="h-8 w-8" />
            </div>
            <div>
              <CardTitle>Persönliche Daten</CardTitle>
              <CardDescription>Passe deinen Namen an, der im Turnier angezeigt wird.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Telefonnummer</Label>
            <Input value={user.phone_number} disabled className="bg-muted text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Deine Nummer ist privat und wird nicht veröffentlicht.</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="name">Anzeigename</Label>
            <Input 
              id="name" 
              placeholder="Wie möchtest du genannt werden?" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-green-500">Profil erfolgreich aktualisiert!</p>}

          <Button 
            onClick={handleSave} 
            disabled={isSaving || name === user.name} 
            className="w-full sm:w-auto"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Speichere…" : "Speichern"}
          </Button>
        </CardContent>
      </Card>

      <div className="pt-8">
        <Button variant="destructive" className="w-full sm:w-auto" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Abmelden
        </Button>
      </div>
    </div>
  );
}
