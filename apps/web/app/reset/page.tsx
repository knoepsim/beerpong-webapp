import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ResetPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-sm">
        <h1 className="text-2xl font-bold">Nummer zurücksetzen</h1>
        <p className="text-muted-foreground">
          Dieser Bereich befindet sich noch in der Entwicklung. In Zukunft kannst du hier deine hinterlegte Telefonnummer durch Verifizierung anderer Faktoren ändern.
        </p>
        <Link href="/login" className={cn(buttonVariants({ variant: "default" }), "w-full")}>
          Zurück zum Login
        </Link>
      </div>
    </div>
  );
}
