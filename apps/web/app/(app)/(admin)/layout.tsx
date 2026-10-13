"use client";

import { useCurrentUser } from "@/components/user-provider";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, isLoading } = useCurrentUser();

  // If loading, show nothing or spinner
  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
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
