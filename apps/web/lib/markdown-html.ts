import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

/**
 * The description of a tournament is stored as Markdown (shown with react-markdown); the editor works on HTML.
 * These two convert between them (the pipeline of the Prosekit example "save-markdown").
 */
export function markdownFromHTML(html: string): string {
  return unified().use(rehypeParse).use(rehypeRemark).use(remarkGfm).use(remarkStringify).processSync(html).toString().trim();
}

export function htmlFromMarkdown(markdown: string): string {
  return unified().use(remarkParse).use(remarkGfm).use(remarkHtml).processSync(markdown).toString();
}
