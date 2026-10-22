"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/** Where the start page sends its visitors: the login knows they came from there (`?from=start`). */
export const LOGIN_FROM_START = "/login?from=start";

function BackLink() {
  if (useSearchParams().get("from") !== "start") return null;
  return (
    <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
      <ArrowLeft data-icon="inline-start" aria-hidden="true" />
      Zurück zur Startseite
    </Link>
  );
}

/** The way back for whoever came from the start page; nothing for everybody else (e.g. sent here by a link). */
export function BackToStart() {
  return (
    <Suspense fallback={null}>
      <BackLink />
    </Suspense>
  );
}
