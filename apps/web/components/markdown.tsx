import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** The look of written text, shared by the rendered description and its editor (what you edit is what everybody reads). */
export const proseClassName = cn(
  "prose prose-sm dark:prose-invert max-w-none break-words prose-a:text-primary",
  // headings stay within the size of a card, long words wrap instead of running out of it
  "prose-h1:text-xl prose-h2:text-base prose-h3:text-sm",
);

/**
 * Renders user-written Markdown (tournament description). Only Markdown makes text bold or big:
 * plain text stays plain, headings (#) are larger, **text** is bold. The look comes from the typography plugin.
 */
export function Markdown({ children, className }: Readonly<{ children: string; className?: string }>) {
  return (
    <div className={cn(proseClassName, className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
