"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { MyTournamentsResponse } from "@/types";
import { TournamentVisibility } from "@/types";
import { TournamentCard } from "@/components/tournament-card";
import { groupTournaments, mergeMyTournaments, type MyTournament } from "@/lib/tournament-groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, MapPin, Calendar, Trophy, Users, ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { z } from "zod";
import { TournamentScheduleFields } from "@/components/tournament-schedule-fields";
import { toIsoOrNull, validateSchedule, type ScheduleValues } from "@/lib/tournament-schedule";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const createTournamentSchema = z.object({
  name: z.string().min(3, "Der Name muss mindestens 3 Zeichen lang sein."),
  location: z.string().optional(),
  description: z.string().optional(),
  table_count: z.coerce.number().min(1, "Mindestens 1 Tisch.").max(20, "Maximal 20 Tische."),
  visibility: z.nativeEnum(TournamentVisibility),
});

const EMPTY_SCHEDULE: ScheduleValues = {
  start_time: "",
  registration_end_time: "",
  checkin_enabled: false,
  checkin_start_time: "",
};

function TournamentSection({ title, items }: Readonly<{ title: string; items: MyTournament[] }>) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title} className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.tournament.id}>
            <TournamentCard item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function TournamentsPage() {
  const router = useRouter();
  const [data, setData] = useState<MyTournamentsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleValues>(EMPTY_SCHEDULE);
  const [showScheduleErrors, setShowScheduleErrors] = useState(false);
  const scheduleErrors = validateSchedule(schedule);
  const startMissing = showScheduleErrors && !schedule.start_time;

  const form = useForm<z.infer<typeof createTournamentSchema>>({
    resolver: zodResolver(createTournamentSchema as any),
    defaultValues: {
      name: "",
      location: "",
      description: "",
      table_count: 1,
      visibility: TournamentVisibility.PRIVATE,
    },
  });

  useEffect(() => {
    void loadTournaments();
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
    setShowScheduleErrors(true);
    if (!schedule.start_time || Object.keys(scheduleErrors).length > 0) return;
    setIsCreating(true);
    setApiError(null);
    try {
      const t = await api.tournaments.create({
        name: values.name.trim(),
        location: values.location?.trim() || undefined,
        description: values.description?.trim() || undefined,
        start_time: toIsoOrNull(schedule.start_time)!,
        registration_end_time: toIsoOrNull(schedule.registration_end_time),
        checkin_enabled: schedule.checkin_enabled,
        checkin_start_time: schedule.checkin_enabled ? toIsoOrNull(schedule.checkin_start_time) : null,
        table_count: values.table_count,
        visibility: values.visibility,
      });
      setDialogOpen(false);
      form.reset();
      setSchedule(EMPTY_SCHEDULE);
      setShowScheduleErrors(false);
      router.push(`/tournaments/${t.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fehler beim Erstellen";
      setApiError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const groups = useMemo(() => (data ? groupTournaments(mergeMyTournaments(data)) : null), [data]);
  const hasTournaments = !!groups && groups.active.length + groups.planned.length + groups.finished.length > 0;

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
        
        {groups && hasTournaments ? (
          // a heading only appears when there is something under it
          <div className="space-y-8">
            <TournamentSection title="Aktive Turniere" items={groups.active} />
            <TournamentSection title="Geplante Turniere" items={groups.planned} />
            <TournamentSection title="Abgeschlossene Turniere" items={groups.finished} />
          </div>
        ) : (
          <EmptyState
            icon={Trophy}
            title="Noch keine Turniere"
            description="Du bist noch keinem Turnier beigetreten."
          />
        )}
      </div>

      {/* Create Tournament Button */}
      <div className="pt-4 border-t border-border flex justify-center">
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            form.reset();
            setSchedule(EMPTY_SCHEDULE);
            setShowScheduleErrors(false);
            setApiError(null);
          }
        }}>
          <DialogTrigger render={<Button size="lg" className="w-full sm:w-auto shadow-md" />}>
            <Plus className="mr-2 h-5 w-5" />
            Neues Turnier
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
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

                <TournamentScheduleFields
                  idPrefix="create"
                  values={schedule}
                  errors={{
                    ...scheduleErrors,
                    ...(startMissing ? { start_time: "Bitte gib ein Startdatum und eine Startzeit an." } : {}),
                  }}
                  onChange={(patch) => setSchedule((prev) => ({ ...prev, ...patch }))}
                  disabled={isCreating}
                />

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
