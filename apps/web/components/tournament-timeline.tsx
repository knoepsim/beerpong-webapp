import type { Tournament } from "@/types";
import { formatWhen } from "@/lib/format-when";


interface Step {
  key: string;
  icon: string;
  label: string;
  description: string;
  done: boolean;
  active: boolean;
}

function buildSteps(tournament: Tournament): Step[] {
  const started = tournament.started_at !== null;
  const finished = tournament.phase === "finished";
  const steps: Step[] = [
    {
      key: "registration",
      icon: "📋",
      label: "Anmeldung",
      description: !tournament.registration_open
        ? "Geschlossen"
        : tournament.registration_auto_close && tournament.registration_end_time
          ? `Offen bis ${formatWhen(tournament.registration_end_time)}`
          : "Offen",
      done: !tournament.registration_open,
      active: tournament.registration_open,
    },
  ];

  // The check-in step only exists if the organizer switched check-in on
  if (tournament.checkin_enabled) {
    steps.push({
      key: "checkin",
      icon: "✅",
      label: "Check-in vor Ort",
      description: checkinDescription(tournament, started),
      done: started,
      active: tournament.checkin_open,
    });
  }

  steps.push({
    key: "play",
    icon: "🏓",
    label: "Turnier",
    description: finished ? "Beendet" : started ? "Läuft" : startDescription(tournament),
    done: finished,
    active: started && !finished,
  });
  return steps;
}

function startDescription(tournament: Tournament): string {
  return tournament.start_time ? `Start ${formatWhen(tournament.start_time)}` : "Wartet auf den Start";
}

function checkinDescription(tournament: Tournament, started: boolean): string {
  if (started) return "Beendet";
  if (tournament.checkin_open) return "Offen";
  if (tournament.checkin_auto_open && tournament.checkin_start_time) {
    return `Ab ${formatWhen(tournament.checkin_start_time)}`;
  }
  return "Geschlossen";
}

/** Progress of a tournament: registration and (optional) check-in, then play. Registration and check-in can be open at the same time. */
export function TournamentTimeline({ tournament }: Readonly<{ tournament: Tournament }>) {
  const steps = buildSteps(tournament);

  return (
    <ol className="flex flex-col sm:flex-row w-full gap-0 mt-2" aria-label="Turnier-Ablauf">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <li
            key={step.key}
            className="flex sm:flex-col flex-row flex-1 items-start sm:items-stretch min-w-0"
            aria-current={step.active ? "step" : undefined}
          >
            <div className="flex sm:flex-col flex-row items-center gap-3 sm:gap-1 flex-1 min-w-0 w-full">
              {/* Connector + circle: horizontal on desktop, vertical on mobile */}
              <div className="flex sm:flex-row flex-col items-center sm:w-full self-stretch sm:self-auto">
                <div
                  className={`sm:h-1 sm:flex-1 w-1 flex-1 min-h-[1rem] ${i === 0 ? "opacity-0" : steps[i - 1].done ? "bg-primary" : "bg-border"}`}
                />
                <div
                  className={`relative z-10 flex items-center justify-center size-9 rounded-full border-2 shrink-0 text-base transition-colors ${
                    step.done
                      ? "bg-primary border-primary text-primary-foreground"
                      : step.active
                        ? "bg-primary/10 border-primary text-primary ring-4 ring-primary/20"
                        : "bg-muted border-border text-muted-foreground"
                  }`}
                >
                  <span aria-hidden="true">{step.done ? "✓" : step.icon}</span>
                </div>
                <div
                  className={`sm:h-1 sm:flex-1 w-1 flex-1 min-h-[1rem] ${isLast ? "opacity-0" : step.done ? "bg-primary" : "bg-border"}`}
                />
              </div>

              <div className="text-left sm:text-center px-1 sm:px-2 flex-1 sm:flex-none sm:w-full self-center">
                <p
                  className={`text-sm font-semibold leading-tight ${
                    step.active ? "text-primary" : step.done ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {step.description}
                  {step.done && <span className="sr-only"> (abgeschlossen)</span>}
                  {step.active && <span className="sr-only"> (aktuell)</span>}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
