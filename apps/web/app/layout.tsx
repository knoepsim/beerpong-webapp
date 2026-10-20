import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// text and data: compact for long team names, with tabular figures for scores, times and match numbers
// (`tabular-nums`). DM Sans was considered: it has no tabular figures, numbers in lists would jump.
const text = Inter({
  variable: "--font-text",
  subsets: ["latin", "latin-ext"],
});
// headings: geometric, with energy in the bold weights
const heading = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
});

// the browser bar and native controls (scrollbars, date fields) in the colours of the page
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F5F7" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0C12" },
  ],
  colorScheme: "light dark",
};

export const metadata: Metadata = {
  title: "Turnierplattform",
  description: "Organisiere Turniere und spiel mit: Anmeldung, Check-in, Spielplan und Ergebnisse an einem Ort"
};

import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning className={`${text.variable} ${heading.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <QueryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ConfirmProvider>{children}</ConfirmProvider>
            <Toaster />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
