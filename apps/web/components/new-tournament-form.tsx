"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFormState, useWatch, type DefaultValues, type FieldError } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AccessFields } from "@/components/access-fields";
import { useConfirm } from "@/components/confirm-dialog";
import { StepProgress, StepSection, useFormSteps } from "@/components/form-steps";
import { GamePicker } from "@/components/game-picker";
import { GAMES } from "@/components/games";
import { MarkdownEditor } from "@/components/markdown-editor";
import { ModePicker } from "@/components/mode-picker";
import { TournamentScheduleFields } from "@/components/tournament-schedule-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCreateTournament } from "@/hooks/queries/tournaments";
import { clearDraft, readDraft, useFormDraft } from "@/hooks/use-form-draft";
import { errorMessage } from "@/lib/errors";
import {
  NEW_TOURNAMENT_DEFAULTS,
  NEW_TOURNAMENT_STEPS,
  SCHEDULE_FIELDS,
  newTournamentSchema,
  toCreateRequest,
  type NewTournamentValues,
} from "@/lib/new-tournament";
import type { ScheduleErrors, ScheduleValues } from "@/lib/tournament-schedule";

const DRAFT_KEY = "draft:new-tournament";

/** The messages of the schedule fields: the error of the schedule is one per field inside it. */
function scheduleErrors(error: FieldError | undefined): ScheduleErrors {
  const nested = error as Partial<Record<keyof ScheduleErrors, FieldError>> | undefined;
  return {
    start_time: nested?.start_time?.message,
    registration_end_time: nested?.registration_end_time?.message,
    checkin_start_time: nested?.checkin_start_time?.message,
  };
}

/** The draft of this tab over the defaults (a schedule from an older draft gets the fields it lacks). */
function startValues(): { values: DefaultValues<NewTournamentValues>; restored: boolean } {
  const draft = readDraft<NewTournamentValues>(DRAFT_KEY);
  if (!draft) return { values: NEW_TOURNAMENT_DEFAULTS, restored: false };
  return {
    values: { ...NEW_TOURNAMENT_DEFAULTS, ...draft, schedule: { ...NEW_TOURNAMENT_DEFAULTS.schedule, ...draft.schedule } },
    restored: true,
  };
}

/**
 * A new tournament in four steps. Rendered in the browser only (see the page): it starts from the draft of the tab,
 * so a reload or the back button keeps what was entered.
 */
export function NewTournamentForm() {
  const router = useRouter();
  const confirm = useConfirm();
  const create = useCreateTournament();
  const [start] = useState(startValues);
  const [restored, setRestored] = useState(start.restored);
  const form = useForm<NewTournamentValues>({
    resolver: zodResolver(newTournamentSchema),
    defaultValues: start.values,
  });
  const steps = useFormSteps(form, NEW_TOURNAMENT_STEPS);
  useFormDraft(DRAFT_KEY, form);

  const [game, visibility, joinPolicy] = useWatch({ control: form.control, name: ["game", "visibility", "join_policy"] });
  // a hook, not form.formState: the compiler would keep an old proxy value
  const { isDirty } = useFormState({ control: form.control });

  const startOver = () => {
    clearDraft(DRAFT_KEY);
    form.reset(NEW_TOURNAMENT_DEFAULTS);
    setRestored(false);
    steps.goTo(0);
  };

  const leave = () => {
    clearDraft(DRAFT_KEY);
    router.push("/tournaments");
  };

  // nothing entered: nothing to lose, no question
  const cancel = () => {
    if (!isDirty && !restored) return leave();
    void confirm({
      title: "Entwurf verwerfen?",
      description: "Deine Eingaben für das neue Turnier gehen verloren.",
      confirmLabel: "Entwurf verwerfen",
      destructive: true,
      action: leave,
    });
  };

  const submit = form.handleSubmit(
    (values) =>
      create.mutate(toCreateRequest(values), {
        onSuccess: (tournament) => {
          clearDraft(DRAFT_KEY);
          router.push(`/t/${tournament.slug}`);
        },
      }),
    steps.showFirstError,
  );

  // Enter in a field goes on to the next step; only the last step creates the tournament
  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (steps.isLast) void submit(event);
    else void steps.next();
  };

  const [gameStep, detailsStep, scheduleStep, accessStep] = NEW_TOURNAMENT_STEPS;

  return (
    <>
      <StepProgress steps={NEW_TOURNAMENT_STEPS} index={steps.index} reached={steps.reached} onGoTo={steps.goTo} />

      {restored && (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            Dein Entwurf von vorhin ist wieder da.
            <Button type="button" variant="link" className="h-auto p-0" onClick={startOver}>
              Neu beginnen
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <StepSection id={gameStep.id} title={gameStep.title} active={steps.index === 0}>
            <FormField
              control={form.control}
              name="game"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Spiel</FormLabel>
                  <FormControl>
                    <GamePicker value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormDescription>Es bestimmt, wie ein Ergebnis eingetragen wird.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="mode"
              render={({ field, fieldState }) => (
                <div className="flex flex-col gap-2">
                  <ModePicker
                    value={field.value}
                    onChange={field.onChange}
                    errorId={fieldState.error ? "new-mode-error" : undefined}
                  />
                  {fieldState.error && (
                    <p id="new-mode-error" className="text-[0.8rem] font-medium text-destructive">
                      {fieldState.error.message}
                    </p>
                  )}
                </div>
              )}
            />
          </StepSection>

          <StepSection id={detailsStep.id} title={detailsStep.title} active={steps.index === 1}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder={game ? GAMES[game].namePlaceholder : "z. B. Sommerfest-Turnier"} {...field} />
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
                  <FormLabel>Ort (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="z. B. Garten, Keller, Vereinsheim" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschreibung (optional)</FormLabel>
                  <MarkdownEditor
                    value={field.value}
                    onChange={field.onChange}
                    aria-label="Beschreibung"
                    placeholder="Regeln, Ablauf, Preise…"
                  />
                </FormItem>
              )}
            />
          </StepSection>

          <StepSection id={scheduleStep.id} title={scheduleStep.title} active={steps.index === 2}>
            {/* a field of the form like the others: its errors come with the field state (react-hook-form changes its
                error object in place, a value read from it outside of a field would stay old) */}
            <FormField
              control={form.control}
              name="schedule"
              render={({ field, fieldState }) => {
                const errors = scheduleErrors(fieldState.error);
                return (
                  <TournamentScheduleFields
                    idPrefix="new"
                    values={field.value}
                    errors={errors}
                    onChange={(patch: Partial<ScheduleValues>) => {
                      form.setValue("schedule", { ...field.value, ...patch }, { shouldDirty: true });
                      // once checked, every change checks again (an error goes away as soon as it is fixed)
                      if (fieldState.error) void form.trigger([...SCHEDULE_FIELDS]);
                    }}
                  />
                );
              }}
            />
          </StepSection>

          <StepSection id={accessStep.id} title={accessStep.title} active={steps.index === 3}>
            <AccessFields
              values={{ visibility, join_policy: joinPolicy }}
              onChange={(patch) => {
                if (patch.visibility) form.setValue("visibility", patch.visibility, { shouldDirty: true });
                if (patch.join_policy) form.setValue("join_policy", patch.join_policy, { shouldDirty: true });
              }}
            />
            <FormField
              control={form.control}
              name="table_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Anzahl Tische</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={100}
                      className="max-w-32"
                      {...field}
                      value={Number.isNaN(field.value) ? "" : field.value}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormDescription>Du kannst sie später benennen, hinzufügen und löschen.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <p className="text-sm text-muted-foreground">
              Alles außer Spiel und Modus kannst du später in den Einstellungen ändern, Spiel und Modus bis zum Start.
            </p>
          </StepSection>

          {create.isError && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {errorMessage(create.error)}
            </p>
          )}

          {/* in thumb reach above the tab bar; back on the left, the step forward is the one primary action */}
          <div className="sticky bottom-16 z-10 -mx-4 flex gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur md:bottom-0">
            {steps.isFirst ? (
              <Button type="button" variant="outline" className="h-11 flex-1" onClick={cancel}>
                Abbrechen
              </Button>
            ) : (
              <Button type="button" variant="outline" className="h-11 flex-1" onClick={steps.back}>
                <ArrowLeft data-icon="inline-start" aria-hidden="true" />
                Zurück
              </Button>
            )}
            <Button type="submit" className="h-11 flex-1" disabled={create.isPending}>
              {steps.isLast && (create.isPending ? "Wird erstellt…" : "Turnier erstellen")}
              {!steps.isLast && (
                <>
                  Weiter
                  <ArrowRight data-icon="inline-end" aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
