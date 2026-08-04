"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { MyTournamentsResponse, Tournament, Team } from "@/types";
import { TournamentVisibility, TournamentRoleType } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, MapPin, Calendar, Trophy, Users, ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const createTournamentSchema = z.object({
  name: z.string().min(3, "Der Name muss mindestens 3 Zeichen lang sein."),
  location: z.string().optional(),
  start_time: z.string().min(1, "Bitte gib ein Startdatum und eine Startzeit an."),
  description: z.string().optional(),
  table_count: z.coerce.number().min(1, "Mindestens 1 Tisch.").max(20, "Maximal 20 Tische."),
  visibility: z.nativeEnum(TournamentVisibility),
});

export default function TournamentsPage() {
  const router = useRouter();
  const [data, setData] = useState<MyTournamentsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof createTournamentSchema>>({
    resolver: zodResolver(createTournamentSchema as any),
    defaultValues: {
      name: "",
      location: "",
      start_time: "",
      description: "",
      table_count: 1,
      visibility: TournamentVisibility.PRIVATE,
    },
  });

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    try {
      const response = await api.tournaments.getMyTournaments();
      setData(response);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fehler beim Laden";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof createTournamentSchema>) => {
    setIsCreating(true);
    setApiError(null);
    try {
      const t = await api.tournaments.create({
        name: values.name.trim(),
        location: values.location?.trim() || undefined,
        description: values.description?.trim() || undefined,
        start_time: new Date(values.start_time).toISOString(),
        table_count: values.table_count,
        visibility: values.visibility,
      });
      setDialogOpen(false);
      form.reset();
      router.push(`/tournaments/${t.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fehler beim Erstellen";
      setApiError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const visibilityLabel = (v: TournamentVisibility) => {
    switch (v) {
      case TournamentVisibility.PRIVATE:
        return "Privat";
      case TournamentVisibility.PUBLIC_LISTED:
        return "Öffentlich";
      case TournamentVisibility.PUBLIC_UNLISTED:
        return "Nicht gelistet";
    }
  };

  const roleLabel = (r: TournamentRoleType) => {
    switch (r) {
      case TournamentRoleType.ADMIN:
        return "Admin";
      case TournamentRoleType.MANAGER:
        return "Manager";
      case TournamentRoleType.REFEREE:
        return "Schiedsrichter";
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const combinedTournaments = useMemo(() => {
    if (!data) return [];
    
    const map = new Map<string, { tournament: Tournament, team?: Team, role?: TournamentRoleType }>();
    
    data.participating.forEach(p => {
      map.set(p.tournament.id, { tournament: p.tournament, team: p.team });
    });
    
    data.managing.forEach(m => {
      if (map.has(m.tournament.id)) {
        map.get(m.tournament.id)!.role = m.role;
      } else {
        map.set(m.tournament.id, { tournament: m.tournament, role: m.role });
      }
    });
    
    return Array.from(map.values()).sort((a, b) => {
      const aActive = a.tournament.started_at ? 1 : 0;
      const bActive = b.tournament.started_at ? 1 : 0;
      
      if (aActive !== bActive) {
        return bActive - aActive; // Active first (1 before 0)
      }
      
      const dateA = a.tournament.start_time ? new Date(a.tournament.start_time).getTime() : new Date(a.tournament.created_at).getTime();
      const dateB = b.tournament.start_time ? new Date(b.tournament.start_time).getTime() : new Date(b.tournament.created_at).getTime();
      
      // If active, older first (currently running). If not active, sooner first (upcoming).
      return aActive ? dateB - dateA : dateA - dateB;
    });
  }, [data]);

  const { activeTournaments, plannedTournaments } = useMemo(() => {
    const active: typeof combinedTournaments = [];
    const planned: typeof combinedTournaments = [];
    combinedTournaments.forEach(t => {
      if (t.tournament.started_at) active.push(t);
      else planned.push(t);
    });
    return { activeTournaments: active, plannedTournaments: planned };
  }, [combinedTournaments]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-8 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-4 space-y-10">
            <div className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="h-6 w-6 text-primary" />
          Meine Turniere
        </h2>
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        
        {combinedTournaments.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="Noch keine Turniere"
            description="Du bist noch keinem Turnier beigetreten."
          />
        ) : (
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="active">Laufend / Abgeschlossen ({activeTournaments.length})</TabsTrigger>
              <TabsTrigger value="planned">Geplant ({plannedTournaments.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="space-y-3 mt-0">
              {activeTournaments.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">Keine laufenden Turniere</div>
              ) : (
                activeTournaments.map((item) => {
                  const t = item.tournament;
                  return (
                    <Card
                      key={t.id}
                      className="cursor-pointer transition-colors hover:bg-accent/50 mb-3"
                      onClick={() => router.push(`/tournaments/${t.id}`)}
                    >
                      <CardHeader className="p-3 pb-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base">{t.name}</CardTitle>
                          <div className="flex flex-wrap gap-1 justify-end">
                            {item.team && (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5 shrink-0 border-primary/50 text-primary">
                                Team: {item.team.name}
                              </Badge>
                            )}
                            {item.role && (
                              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
                                {roleLabel(item.role)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {t.description && (
                          <div className="line-clamp-3 text-xs text-muted-foreground overflow-hidden prose prose-sm prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {t.description}
                            </ReactMarkdown>
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="px-3 pb-3 pt-0 mt-2">
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                          {t.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {t.location}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {t.start_time ? formatDate(t.start_time) : formatDate(t.created_at)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
            
            <TabsContent value="planned" className="space-y-3 mt-0">
              {plannedTournaments.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">Keine geplanten Turniere</div>
              ) : (
                plannedTournaments.map((item) => {
                  const t = item.tournament;
                  return (
                    <Card
                      key={t.id}
                      className="cursor-pointer transition-colors hover:bg-accent/50 mb-3"
                      onClick={() => router.push(`/tournaments/${t.id}`)}
                    >
                      <CardHeader className="p-3 pb-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base">{t.name}</CardTitle>
                          <div className="flex flex-wrap gap-1 justify-end">
                            {item.team && (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5 shrink-0 border-primary/50 text-primary">
                                Team: {item.team.name}
                              </Badge>
                            )}
                            {item.role && (
                              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
                                {roleLabel(item.role)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {t.description && (
                          <div className="line-clamp-3 text-xs text-muted-foreground overflow-hidden prose prose-sm prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {t.description}
                            </ReactMarkdown>
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="px-3 pb-3 pt-0 mt-2">
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                          {t.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {t.location}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {t.start_time ? formatDate(t.start_time) : formatDate(t.created_at)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Create Tournament Button */}
      <div className="pt-4 border-t border-border flex justify-center">
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            form.reset();
            setApiError(null);
          }
        }}>
          <DialogTrigger render={<Button size="lg" className="w-full sm:w-auto shadow-md" />}>
            <Plus className="mr-2 h-5 w-5" />
            Neues Turnier
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Turnier erstellen</DialogTitle>
              <DialogDescription>
                Erstelle ein neues Bierpong-Turnier
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="z.B. Sommerfest-Turnier" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ort</FormLabel>
                        <FormControl>
                          <Input placeholder="z.B. Garten, Keller, …" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="start_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Startdatum & -zeit *</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Beschreibung (Markdown unterstützt)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Turnier-Regeln, Zeitplan, Preise..." className="min-h-24" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="table_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tische</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} max={20} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="visibility"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sichtbarkeit</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Wähle die Sichtbarkeit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={TournamentVisibility.PRIVATE}>
                              Privat
                            </SelectItem>
                            <SelectItem value={TournamentVisibility.PUBLIC_LISTED}>
                              Öffentlich
                            </SelectItem>
                            <SelectItem value={TournamentVisibility.PUBLIC_UNLISTED}>
                              Nicht gelistet
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {apiError && <p className="text-sm text-destructive font-medium">{apiError}</p>}

                <Button
                  type="submit"
                  className="w-full mt-2"
                  disabled={isCreating}
                >
                  {isCreating ? "Erstelle…" : "Turnier erstellen"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

    </div>
  );
}
