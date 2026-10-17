import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Something that went wrong, said where it happened: the Alert in its error tone (the icon carries the color, the
 * text stays readable). `children` below the message: the way out, e.g. a button to try again.
 */
export function ErrorAlert({ message, children }: Readonly<{ message: string; children?: React.ReactNode }>) {
  return (
    <Alert variant="error">
      <CircleAlert aria-hidden="true" />
      <AlertTitle className="font-normal">{message}</AlertTitle>
      {children && <AlertDescription className="mt-2">{children}</AlertDescription>}
    </Alert>
  );
}
