"use client";
/* eslint-disable react-hooks/refs -- the Prosekit editor is an object with a `mount` ref callback; reading it during
   render is how Prosekit attaches the editor (the React compiler takes the whole object for a ref) */

import "prosekit/basic/style.css";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { defineBasicExtension, type BasicExtension } from "prosekit/basic";
import { createEditor, jsonFromHTML, union, type Editor } from "prosekit/core";
import { definePlaceholder } from "prosekit/extensions/placeholder";
import { ProseKit, useDocChange, useEditor, useEditorDerivedValue } from "prosekit/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { proseClassName } from "@/components/markdown";
import { htmlFromMarkdown, markdownFromHTML } from "@/lib/markdown-html";
import { cn } from "@/lib/utils";

interface Tool {
  label: string;
  icon: LucideIcon;
  active: boolean;
  can: boolean;
  run: () => void;
}

/** The formats a description needs: headings, emphasis, lists, quote, divider (no code, images or formulas). */
function tools(editor: Editor<BasicExtension>): Tool[][] {
  const c = editor.commands;
  return [
    [
      { label: "Fett", icon: Bold, active: editor.marks.bold.isActive(), can: c.toggleBold.canExec(), run: () => c.toggleBold() },
      { label: "Kursiv", icon: Italic, active: editor.marks.italic.isActive(), can: c.toggleItalic.canExec(), run: () => c.toggleItalic() },
      {
        label: "Durchgestrichen",
        icon: Strikethrough,
        active: editor.marks.strike.isActive(),
        can: c.toggleStrike.canExec(),
        run: () => c.toggleStrike(),
      },
    ],
    [
      {
        label: "Überschrift",
        icon: Heading2,
        active: editor.nodes.heading.isActive({ level: 2 }),
        can: c.toggleHeading.canExec({ level: 2 }),
        run: () => c.toggleHeading({ level: 2 }),
      },
      {
        label: "Zwischenüberschrift",
        icon: Heading3,
        active: editor.nodes.heading.isActive({ level: 3 }),
        can: c.toggleHeading.canExec({ level: 3 }),
        run: () => c.toggleHeading({ level: 3 }),
      },
    ],
    [
      {
        label: "Liste",
        icon: List,
        active: editor.nodes.list.isActive({ kind: "bullet" }),
        can: c.toggleList.canExec({ kind: "bullet" }),
        run: () => c.toggleList({ kind: "bullet" }),
      },
      {
        label: "Nummerierte Liste",
        icon: ListOrdered,
        active: editor.nodes.list.isActive({ kind: "ordered" }),
        can: c.toggleList.canExec({ kind: "ordered" }),
        run: () => c.toggleList({ kind: "ordered" }),
      },
      {
        label: "Zitat",
        icon: Quote,
        active: editor.nodes.blockquote.isActive(),
        can: c.toggleBlockquote.canExec(),
        run: () => c.toggleBlockquote(),
      },
      {
        label: "Trennlinie",
        icon: Minus,
        active: false,
        can: c.insertHorizontalRule.canExec(),
        run: () => c.insertHorizontalRule(),
      },
    ],
  ];
}

const history = (editor: Editor<BasicExtension>) => ({
  undo: editor.commands.undo.canExec(),
  redo: editor.commands.redo.canExec(),
});

/** Keeps the focus in the text when a button of the toolbar is pressed. */
const keepFocus = (event: React.MouseEvent) => event.preventDefault();

function Toolbar() {
  const groups = useEditorDerivedValue(tools);
  const can = useEditorDerivedValue(history);
  const editor = useEditor<BasicExtension>();
  return (
    <div role="toolbar" aria-label="Formatierung" className="flex flex-wrap items-center gap-1 border-b p-1.5">
      {groups.map((group, i) => (
        <div key={i} className="flex items-center gap-1">
          {i > 0 && <Separator orientation="vertical" className="mx-0.5 h-6" />}
          {group.map((tool) => (
            <Toggle
              key={tool.label}
              size="sm"
              pressed={tool.active}
              disabled={!tool.can}
              onMouseDown={keepFocus}
              onPressedChange={() => tool.run()}
              aria-label={tool.label}
              title={tool.label}
            >
              <tool.icon aria-hidden="true" />
            </Toggle>
          ))}
        </div>
      ))}
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!can.undo}
          onMouseDown={keepFocus}
          onClick={() => editor.commands.undo()}
          aria-label="Rückgängig"
          title="Rückgängig"
        >
          <Undo2 aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!can.redo}
          onMouseDown={keepFocus}
          onClick={() => editor.commands.redo()}
          aria-label="Wiederholen"
          title="Wiederholen"
        >
          <Redo2 aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Text with formats, edited as it looks (no Markdown to learn, no preview to switch to) and stored as Markdown:
 * Prosekit with the toolbar of the app. `value` is read once; every change gives the new Markdown to `onChange`.
 */
export function MarkdownEditor({
  id,
  value,
  onChange,
  placeholder,
  className,
  "aria-label": label,
  "aria-describedby": describedBy,
}: Readonly<{
  id?: string;
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  /** The editable area is no input element: a <label for> does not reach it, so it is named directly. */
  "aria-label"?: string;
  "aria-describedby"?: string;
}>) {
  // created once with the text it starts with: the editor holds the text from then on
  const [editor] = useState(() => {
    const extension = union(defineBasicExtension(), definePlaceholder({ placeholder: placeholder ?? "" }));
    const created = createEditor({ extension });
    if (value) created.setContent(jsonFromHTML(htmlFromMarkdown(value), { schema: created.schema }));
    return created;
  });

  useDocChange(() => onChange(markdownFromHTML(editor.getDocHTML())), { editor });

  return (
    <ProseKit editor={editor}>
      <div
        className={cn(
          "overflow-hidden rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          className,
        )}
      >
        <Toolbar />
        <div
          id={id}
          ref={editor.mount}
          role="textbox"
          aria-multiline="true"
          aria-label={label}
          aria-describedby={describedBy}
          className={cn("ProseMirror min-h-32 px-3 py-2 outline-hidden", proseClassName)}
        />
      </div>
    </ProseKit>
  );
}
