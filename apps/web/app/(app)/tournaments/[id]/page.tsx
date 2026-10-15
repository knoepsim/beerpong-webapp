"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

/** Old links /tournaments/{id} lead to the address /t/{slug}. */
export default function LegacyTournamentRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    api.tournaments
      .get(id)
      .then((t) => router.replace(`/t/${t.slug}`))
      .catch(() => router.replace("/tournaments"));
  }, [id, router]);

  return (
    <div className="mx-auto max-w-4xl px-4 pt-6">
      <Skeleton className="h-10 w-3/4 max-w-sm" />
    </div>
  );
}
