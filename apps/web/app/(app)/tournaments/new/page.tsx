"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// browser only: the form starts from the draft in the session storage, which the server does not have
const NewTournamentForm = dynamic(() => import("@/components/new-tournament-form").then((m) => m.NewTournamentForm), {
  ssr: false,
  loading: () => <Skeleton className="h-96 w-full rounded-xl" />,
});

/** /tournaments/new: a new tournament on its own page, step by step. */
export default function NewTournamentPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 pt-6">
      <h1 className="text-2xl font-bold">Neues Turnier</h1>
      <NewTournamentForm />
    </div>
  );
}
