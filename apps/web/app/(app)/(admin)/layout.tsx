"use client";

import { useCurrentUser } from "@/hooks/queries/user";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Spinner } from "@/components/ui/spinner";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, isLoading } = useCurrentUser();

  // If loading, show nothing or spinner
  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner className="size-8 text-primary" />
      </div>
    );
  }

  // If user is not an admin, redirect them away
  if (!user || !user.is_system_admin) {
    redirect("/tournaments");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">System Admin</h1>
      {children}
    </div>
  );
}
