import { render as rtlRender, renderHook as rtlRenderHook, type RenderOptions } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { makeQueryClient } from "@/lib/query-client";

/** The query client of the app (its toasts and loading again included), without asking a failed query again. */
export function testQueryClient() {
  const client = makeQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    queries: { ...client.getDefaultOptions().queries, retry: false },
  });
  return client;
}

/** What the app layout provides around every page: the query client and the global confirmation dialog. */
export function Providers({ children, client = testQueryClient() }: Readonly<{ children: ReactNode; client?: ReturnType<typeof makeQueryClient> }>) {
  return (
    <QueryClientProvider client={client}>
      <ConfirmProvider>{children}</ConfirmProvider>
    </QueryClientProvider>
  );
}

export function render(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  const client = testQueryClient();
  return { client, ...rtlRender(ui, { wrapper: ({ children }) => <Providers client={client}>{children}</Providers>, ...options }) };
}

export function renderHook<T>(hook: () => T) {
  const client = testQueryClient();
  return { client, ...rtlRenderHook(hook, { wrapper: ({ children }) => <Providers client={client}>{children}</Providers> }) };
}
