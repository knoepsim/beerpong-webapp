import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Bierpong Turnier",
  description: "Organisiere und verwalte deine Bierpong-Turniere",
};

import { ThemeProvider } from "@/components/theme-provider";
import { UserProvider } from "@/components/user-provider";
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
            <UserProvider>
              <ConfirmProvider>{children}</ConfirmProvider>
            </UserProvider>
            <Toaster />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
