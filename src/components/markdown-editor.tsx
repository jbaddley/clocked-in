"use client";

import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { Placeholder } from "@tiptap/extensions";
import { TableKit } from "@tiptap/extension-table/kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Image from "@tiptap/extension-image";
import {
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  QuoteIcon,
  Redo2Icon,
  SquareCodeIcon,
  StrikethroughIcon,
  TableIcon,
  Undo2Icon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Toggle } from "@/components/ui/toggle";
import { websiteHref } from "@/lib/url";

const editorClass =
  "markdown-editor min-h-32 w-full px-3 py-2 text-sm outline-none";

export function MarkdownEditor({
  id,
  name,
  label,
  defaultValue = "",
  maxLength = 8000,
  placeholder = "Write a description",
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  maxLength?: number;
  placeholder?: string;
}) {
  const [markdown, setMarkdown] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const [panel, setPanel] = useState<"link" | "image" | null>(null);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        underline: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          HTMLAttributes: { rel: "noreferrer", target: "_blank" },
          isAllowedUri: (url) => websiteHref(url) !== null,
        },
      }),
      Placeholder.configure({ placeholder }),
      TableKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ resize: false }),
      Markdown,
    ],
    content: defaultValue,
    contentType: "markdown",
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        class: editorClass,
      },
    },
    onUpdate: ({ editor: current }) => {
      const next = current.getMarkdown();
      if (inputRef.current) inputRef.current.value = next;
      setMarkdown(next);
    },
  });
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form || !editor) return;
    const sync = () => {
      if (!inputRef.current) return;
      inputRef.current.value = editor.getMarkdown();
    };
    form.addEventListener("submit", sync);
    return () => form.removeEventListener("submit", sync);
  }, [editor]);
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current) return null;
      return {
        bold: current.isActive("bold"),
        italic: current.isActive("italic"),
        strike: current.isActive("strike"),
        h1: current.isActive("heading", { level: 1 }),
        h2: current.isActive("heading", { level: 2 }),
        h3: current.isActive("heading", { level: 3 }),
        bullet: current.isActive("bulletList"),
        ordered: current.isActive("orderedList"),
        task: current.isActive("taskList"),
        quote: current.isActive("blockquote"),
        code: current.isActive("code"),
        codeBlock: current.isActive("codeBlock"),
        link: current.isActive("link"),
        canUndo: current.can().undo(),
        canRedo: current.can().redo(),
      };
    },
  });
  const over = markdown.length > maxLength;

  function run(command: (current: Editor) => void) {
    if (!editor) return;
    command(editor);
  }

  function openPanel(next: "link" | "image") {
    if (!editor) return;
    const current = next === "link" ? String(editor.getAttributes("link").href ?? "") : "";
    setDraft(current);
    setDraftError(null);
    setPanel(next);
  }

  function applyDraft() {
    if (!editor) return;
    const href = websiteHref(draft);
    if (panel === "link" && !draft.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setPanel(null);
      setDraftError(null);
      return;
    }
    if (!href) {
      setDraftError("Use an http or https link.");
      return;
    }
    if (panel === "link") {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    } else {
      editor.chain().focus().setImage({ src: href, alt: "Image" }).run();
    }
    setPanel(null);
    setDraftError(null);
  }

  return (
    <div
      data-invalid={over || undefined}
      className="overflow-hidden rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 data-invalid:border-destructive dark:bg-input/30"
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b border-input px-1 py-1" role="toolbar" aria-label="Formatting">
        <Group>
          <FormatButton label="Bold" pressed={active?.bold} disabled={!editor} onClick={() => run((current) => current.chain().focus().toggleBold().run())}>
            <BoldIcon />
          </FormatButton>
          <FormatButton label="Italic" pressed={active?.italic} disabled={!editor} onClick={() => run((current) => current.chain().focus().toggleItalic().run())}>
            <ItalicIcon />
          </FormatButton>
          <FormatButton label="Strikethrough" pressed={active?.strike} disabled={!editor} onClick={() => run((current) => current.chain().focus().toggleStrike().run())}>
            <StrikethroughIcon />
          </FormatButton>
        </Group>
        <Bar />
        <Group>
          <FormatButton label="Heading 1" pressed={active?.h1} disabled={!editor} onClick={() => run((current) => current.chain().focus().toggleHeading({ level: 1 }).run())}>
            <Heading1Icon />
          </FormatButton>
          <FormatButton label="Heading 2" pressed={active?.h2} disabled={!editor} onClick={() => run((current) => current.chain().focus().toggleHeading({ level: 2 }).run())}>
            <Heading2Icon />
          </FormatButton>
          <FormatButton label="Heading 3" pressed={active?.h3} disabled={!editor} onClick={() => run((current) => current.chain().focus().toggleHeading({ level: 3 }).run())}>
            <Heading3Icon />
          </FormatButton>
        </Group>
        <Bar />
        <Group>
          <FormatButton label="Bulleted list" pressed={active?.bullet} disabled={!editor} onClick={() => run((current) => current.chain().focus().toggleBulletList().run())}>
            <ListIcon />
          </FormatButton>
          <FormatButton label="Numbered list" pressed={active?.ordered} disabled={!editor} onClick={() => run((current) => current.chain().focus().toggleOrderedList().run())}>
            <ListOrderedIcon />
          </FormatButton>
          <FormatButton label="Task list" pressed={active?.task} disabled={!editor} onClick={() => run((current) => current.chain().focus().toggleTaskList().run())}>
            <ListChecksIcon />
          </FormatButton>
          <FormatButton label="Quote" pressed={active?.quote} disabled={!editor} onClick={() => run((current) => current.chain().focus().toggleBlockquote().run())}>
            <QuoteIcon />
          </FormatButton>
        </Group>
        <Bar />
        <Group>
          <FormatButton label="Inline code" pressed={active?.code} disabled={!editor} onClick={() => run((current) => current.chain().focus().toggleCode().run())}>
            <CodeIcon />
          </FormatButton>
          <FormatButton label="Code block" pressed={active?.codeBlock} disabled={!editor} onClick={() => run((current) => current.chain().focus().toggleCodeBlock().run())}>
            <SquareCodeIcon />
          </FormatButton>
          <FormatButton label="Divider" disabled={!editor} onClick={() => run((current) => current.chain().focus().setHorizontalRule().run())}>
            <MinusIcon />
          </FormatButton>
          <FormatButton label="Link" pressed={active?.link || panel === "link"} disabled={!editor} onClick={() => openPanel("link")}>
            <LinkIcon />
          </FormatButton>
          <FormatButton label="Image" pressed={panel === "image"} disabled={!editor} onClick={() => openPanel("image")}>
            <ImageIcon />
          </FormatButton>
          <FormatButton label="Table" disabled={!editor} onClick={() => run((current) => current.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}>
            <TableIcon />
          </FormatButton>
        </Group>
        <Bar />
        <Group>
          <FormatButton label="Undo" disabled={!editor || !active?.canUndo} onClick={() => run((current) => current.chain().focus().undo().run())}>
            <Undo2Icon />
          </FormatButton>
          <FormatButton label="Redo" disabled={!editor || !active?.canRedo} onClick={() => run((current) => current.chain().focus().redo().run())}>
            <Redo2Icon />
          </FormatButton>
        </Group>
      </div>
      {panel ? (
        <div className="flex items-center gap-2 border-b border-input px-2 py-1.5">
          <input
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setDraftError(null);
            }}
            placeholder={panel === "link" ? "https://example.com" : "https://example.com/image.png"}
            aria-label={panel === "link" ? "Link address" : "Image address"}
            className="h-7 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyDraft();
              } else if (event.key === "Escape") {
                event.preventDefault();
                setPanel(null);
                editor?.commands.focus();
              }
            }}
          />
          <button type="button" className="text-xs font-medium text-foreground" onClick={applyDraft}>
            {panel === "link" && !draft.trim() ? "Remove" : "Apply"}
          </button>
          {draftError ? <span className="text-xs text-destructive">{draftError}</span> : null}
        </div>
      ) : null}
      {editor ? <EditorContent editor={editor} /> : <div className="min-h-32" />}
      <input ref={inputRef} type="hidden" name={name} value={markdown} />
      <p className={over ? "px-3 py-1 text-right text-xs text-destructive" : "px-3 py-1 text-right text-xs text-muted-foreground"}>
        {markdown.length.toLocaleString()} / {maxLength.toLocaleString()}
        {over ? ` — must be ${maxLength.toLocaleString()} characters or fewer` : ""}
      </p>
    </div>
  );
}

export function Group({ children }: { children: ReactNode }) {
  return <div className="flex items-center">{children}</div>;
}

export function Bar() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-border" />;
}

export function FormatButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Toggle
      type="button"
      size="sm"
      pressed={Boolean(pressed)}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="size-7 min-w-7 px-0"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Toggle>
  );
}
