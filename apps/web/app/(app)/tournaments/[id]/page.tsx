"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useTournamentById } from "@/hooks/queries/tournaments";

/** Old links /tournaments/{id} lead to the address /t/{slug}. */
export default function LegacyTournamentRedirect({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = use(params);
  const router = useRouter();
  const { data: tournament, isError } = useTournamentById(id);

  useEffect(() => {
    if (tournament) router.replace(`/t/${tournament.slug}`);
    else if (isError) router.replace("/tournaments");
  }, [tournament, isError, router]);

  return (
    <div className="mx-auto max-w-4xl px-4 pt-6">
      <Skeleton className="h-10 w-3/4 max-w-sm" />
    </div>
  );
}
