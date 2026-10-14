import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Renders user-written Markdown (tournament description). Only Markdown makes text bold or big:
 * plain text stays plain, headings (#) are larger, **text** is bold. The look comes from the typography plugin.
 */
export function Markdown({ children, className }: Readonly<{ children: string; className?: string }>) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none break-words prose-a:text-primary",
        // headings stay within the size of a card, long words wrap instead of running out of it
        "prose-h1:text-xl prose-h2:text-base prose-h3:text-sm",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
