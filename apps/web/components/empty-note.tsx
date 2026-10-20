import type { LucideIcon } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

/**
 * Nothing here yet, said once with what comes next (the shadcn Empty): an invitation to act, not an apology.
 * The same look wherever a list or a view has nothing to show.
 */
export function EmptyNote({
  icon: Icon,
  title,
  description,
  children,
}: Readonly<{ icon?: LucideIcon; title: string; description?: string; children?: React.ReactNode }>) {
  return (
    <Empty className="border">
      <EmptyHeader>
        {Icon && (
          <EmptyMedia variant="icon">
            <Icon aria-hidden="true" />
          </EmptyMedia>
        )}
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {children}
    </Empty>
  );
}
