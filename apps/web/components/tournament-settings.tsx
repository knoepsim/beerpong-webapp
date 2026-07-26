"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Tournament, TournamentUserRole, User } from "@/types";
import { TournamentRoleType } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Play, Trash2, Search, UserPlus, UserMinus, ShieldAlert } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export function TournamentSettings({
  tournament,
  status,
  roles,
  userRole,
  teamCount,
  onGenerateBracket,
  onReload,
}: {
  tournament: Tournament;
  status: string;
  roles: TournamentUserRole[];
  userRole: TournamentRoleType | null;
  teamCount: number;
  onGenerateBracket: () => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<TournamentRoleType>(TournamentRoleType.REFEREE);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit details form state
  const [editName, setEditName] = useState(tournament.name);
  const [editLocation, setEditLocation] = useState(tournament.location || "");
  const [editDescription, setEditDescription] = useState(tournament.description || "");
  const [editTableCount, setEditTableCount] = useState(tournament.table_count.toString());
  const [editVisibility, setEditVisibility] = useState(tournament.visibility);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateTournament = async () => {
    setIsUpdating(true);
    try {
      await api.tournaments.update(tournament.id, {
        name: editName,
        location: editLocation || undefined,
        description: editDescription || undefined,
        table_count: parseInt(editTableCount) || 1,
        visibility: editVisibility,
      });
      await onReload();
      alert("Turnier-Details erfolgreich gespeichert!");
    } catch (err) {
      alert("Fehler beim Speichern der Turnier-Details");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    setIsSearching(true);
    try {
      const results = await api.users.search(searchQuery);
      setSearchResults(results);
    } catch (err) {
      alert("Fehler bei der Suche");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAssignRole = async () => {
    if (!selectedUser) return;
    setIsAssigning(true);
    try {
      await api.roles.assign(tournament.id, selectedUser, selectedRole);
      setSearchQuery("");
      setSearchResults([]);
      setSelectedUser("");
      await onReload();
      alert("Rolle erfolgreich zugewiesen!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Fehler";
      alert(msg);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRevokeRole = async (roleId: string) => {
    if (!confirm("Rolle wirklich entziehen?")) return;
    try {
      await api.roles.revoke(tournament.id, roleId);
      await onReload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Fehler";
      alert(msg);
    }
  };

  const handleDeleteTournament = async () => {
    if (!confirm("Möchtest du dieses Turnier wirklich unwiderruflich löschen?")) return;
    setIsDeleting(true);
    try {
      await api.tournaments.delete(tournament.id);
      router.push("/tournaments");
    } catch (err) {
      alert("Fehler beim Löschen des Turniers");
      setIsDeleting(false);
    }
  };

  const canAssignAdmin = userRole === TournamentRoleType.ADMIN;
  const canAssignManager = userRole === TournamentRoleType.ADMIN;
  const canAssignReferee = userRole === TournamentRoleType.ADMIN || userRole === TournamentRoleType.MANAGER;

  return (
    <div className="space-y-6">
      {status === "SETUP" && (
        <Card>
          <CardHeader>
            <CardTitle>Turnier starten</CardTitle>
            <CardDescription>Sobald alle Teams angemeldet sind, kannst du das Bracket generieren lassen. Danach ist keine Anmeldung mehr möglich.</CardDescription>
          </CardHeader>
          <CardContent>
            {teamCount < 2 ? (
              <div className="text-sm text-destructive mb-3">
                Es müssen mindestens 2 Teams angemeldet sein, um einen Spielplan zu generieren.
              </div>
            ) : null}
            <Button onClick={onGenerateBracket} disabled={teamCount < 2}>
              <Play className="mr-2 h-4 w-4" />
              Spielplan generieren
            </Button>
          </CardContent>
        </Card>
      )}

      {(userRole === TournamentRoleType.ADMIN || userRole === TournamentRoleType.MANAGER) && (
        <Card>
          <CardHeader>
            <CardTitle>Turnier-Details bearbeiten</CardTitle>
            <CardDescription>Passe den Namen, Ort und andere Einstellungen an.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Turniername</Label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Ort (Optional)</Label>
                <Input value={editLocation} onChange={e => setEditLocation(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Anzahl Tische</Label>
                <Input type="number" min="1" value={editTableCount} onChange={e => setEditTableCount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Sichtbarkeit</Label>
                <Select value={editVisibility} onValueChange={(v: any) => setEditVisibility(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC">Öffentlich (sichtbar für alle)</SelectItem>
                    <SelectItem value="PRIVATE">Privat (nur mit Link/Einladung)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Beschreibung (Markdown unterstützt)</Label>
              <Textarea 
                value={editDescription} 
                onChange={e => setEditDescription(e.target.value)} 
                rows={5}
                placeholder="Turnier-Regeln, Zeitplan, Preise..."
              />
            </div>
            <Button onClick={handleUpdateTournament} disabled={isUpdating || !editName.trim()}>
              Speichern
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Rollen & Berechtigungen</CardTitle>
          <CardDescription>Verwalte, wer das Turnier bearbeiten oder Ergebnisse eintragen darf.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-medium text-sm">Rolle zuweisen</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex gap-2">
                <Input 
                  placeholder="Nutzername suchen..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button variant="secondary" onClick={handleSearch} disabled={isSearching || searchQuery.length < 2}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-3 bg-muted/20 p-3 rounded-lg border">
                <div className="space-y-2">
                  <Label>Nutzer auswählen</Label>
                  <Select value={selectedUser} onValueChange={(v) => v && setSelectedUser(v as string)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Nutzer wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {searchResults.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Rolle auswählen</Label>
                  <Select value={selectedRole} onValueChange={(v) => v && setSelectedRole(v as TournamentRoleType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Rolle wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {canAssignAdmin && <SelectItem value={TournamentRoleType.ADMIN}>Admin</SelectItem>}
                      {canAssignManager && <SelectItem value={TournamentRoleType.MANAGER}>Manager</SelectItem>}
                      {canAssignReferee && <SelectItem value={TournamentRoleType.REFEREE}>Schiedsrichter</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleAssignRole} disabled={!selectedUser || isAssigning}>
                  <UserPlus className="h-4 w-4 mr-2" /> Zuweisen
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-4 border-t">
            <h3 className="font-medium text-sm">Aktuelle Berechtigungen</h3>
            <div className="space-y-2">
              {roles.map(r => (
                <div key={r.id} className="flex justify-between items-center p-2 border rounded-md bg-background">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{r.user_name || r.user_id}</span>
                    <span className="text-xs text-muted-foreground uppercase">{r.role}</span>
                  </div>
                  {userRole === TournamentRoleType.ADMIN && (
                    <Button variant="ghost" size="sm" onClick={() => handleRevokeRole(r.id)}>
                      <UserMinus className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {userRole === TournamentRoleType.ADMIN && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Gefahrenzone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleDeleteTournament} disabled={isDeleting}>
              <Trash2 className="mr-2 h-4 w-4" /> Turnier endgültig löschen
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
