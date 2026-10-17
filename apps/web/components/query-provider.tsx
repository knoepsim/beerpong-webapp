"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { makeQueryClient } from "@/lib/query-client";

export function QueryProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  // one client per browser tab (and per request on the server), created once
  const [queryClient] = useState(makeQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
