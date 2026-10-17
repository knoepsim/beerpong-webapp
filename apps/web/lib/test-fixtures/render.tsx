import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";
import { ConfirmProvider } from "@/components/confirm-dialog";

/** render with what the app layout provides around every page (the global confirmation dialog). */
export function render(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return rtlRender(ui, { wrapper: ConfirmProvider, ...options });
}
