"use client";

import { EditorContent, mergeAttributes, Node, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  BoldIcon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  Redo2Icon,
  Undo2Icon,
} from "lucide-react";
import { useImperativeHandle, useState, type Ref } from "react";
import { Bar, FormatButton, Group } from "@/components/markdown-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const placeholderText = /\{\{\s*([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\s*\}\}/g;
const chipSpan = /<span data-placeholder="[^"]*"[^>]*>(\{\{[^}]*\}\})<\/span>/g;
const allowedHref = /^(?:https?:\/\/|mailto:|\{\{)/i;

/** An atomic `{{field.name}}` chip so a placeholder cannot be split while typing. */
const EmailPlaceholder = Node.create({
  name: "emailPlaceholder",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { path: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "span[data-placeholder]", getAttrs: (element) => ({ path: element.getAttribute("data-placeholder") ?? "" }) }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-placeholder": node.attrs.path,
        class: "rounded bg-primary/10 px-1 font-mono text-[0.8em] text-primary",
      }),
      `{{${node.attrs.path}}}`,
    ];
  },
  renderText({ node }) {
    return `{{${node.attrs.path}}}`;
  },
});

/** Stored HTML keeps plain `{{x}}` text; the editor shows chips. Hrefs keep their placeholders as text. */
function toEditorHtml(html: string) {
  return html
    .replace(chipSpan, "$1")
    .replace(/(<a\b[^>]*>)|(\{\{[^}]*\}\})/g, (match, tag: string | undefined) => {
      if (tag) return tag;
      const path = match.replace(placeholderText, "$1");
      return `<span data-placeholder="${path}">{{${path}}}</span>`;
    });
}

export type EmailTemplateEditorHandle = { insertField: (path: string) => void };

export function EmailTemplateEditor({
  id,
  label,
  value,
  onChange,
  onFocus,
  ref,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (html: string) => void;
  onFocus?: () => void;
  ref?: Ref<EmailTemplateEditorHandle>;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: { openOnClick: false, autolink: false, isAllowedUri: (url) => allowedHref.test(url) },
      }),
      EmailPlaceholder,
    ],
    content: toEditorHtml(value),
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        class: "markdown-editor min-h-56 w-full px-3 py-2 text-sm outline-none",
      },
    },
    onFocus: () => onFocus?.(),
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
  });
  useImperativeHandle(
    ref,
    () => ({
      insertField: (path: string) => {
        editor?.chain().focus().insertContent({ type: "emailPlaceholder", attrs: { path } }).run();
      },
    }),
    [editor],
  );
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? {
            bold: current.isActive("bold"),
            italic: current.isActive("italic"),
            h2: current.isActive("heading", { level: 2 }),
            h3: current.isActive("heading", { level: 3 }),
            bullet: current.isActive("bulletList"),
            ordered: current.isActive("orderedList"),
            link: current.isActive("link"),
            canUndo: current.can().undo(),
            canRedo: current.can().redo(),
          }
        : null,
  });

  function run(command: (current: Editor) => void) {
    if (editor) command(editor);
  }

  function openLink() {
    if (!editor) return;
    setHref(String(editor.getAttributes("link").href ?? ""));
    setLinkError(null);
    setLinkOpen(true);
  }

  function applyLink() {
    if (!editor) return;
    const next = href.trim();
    if (!next) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkOpen(false);
      return;
    }
    if (!allowedHref.test(next)) {
      setLinkError("Use an http, https, or mailto link, or a field such as {{entry.url}}.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: next }).run();
    setLinkOpen(false);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-input px-1 py-1" role="toolbar" aria-label="Formatting">
        <Group>
          <FormatButton label="Bold" pressed={active?.bold} disabled={!editor} onClick={() => run((current) => current.chain().focus().toggleBold().run())}>
            <BoldIcon />
          </FormatButton>
          <FormatButton label="Italic" pressed={active?.italic} disabled={!editor} onClick={() => run((current) => current.chain().focus().toggleItalic().run())}>
            <ItalicIcon />
          </FormatButton>
        </Group>
        <Bar />
        <Group>
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
          <FormatButton label="Link" pressed={active?.link} disabled={!editor} onClick={openLink}>
            <LinkIcon />
          </FormatButton>
        </Group>
        <Bar />
        <Group>
          <FormatButton label="Undo" disabled={!active?.canUndo} onClick={() => run((current) => current.chain().focus().undo().run())}>
            <Undo2Icon />
          </FormatButton>
          <FormatButton label="Redo" disabled={!active?.canRedo} onClick={() => run((current) => current.chain().focus().redo().run())}>
            <Redo2Icon />
          </FormatButton>
        </Group>
      </div>
      {linkOpen ? (
        <div className="flex flex-col gap-1.5 border-b border-input px-2 py-2">
          <div className="flex items-center gap-2">
            <Input
              aria-label="Link address"
              value={href}
              placeholder="https://… or {{entry.url}}"
              onChange={(event) => setHref(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyLink();
                }
              }}
            />
            <Button type="button" size="sm" onClick={applyLink}>
              Apply
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
          </div>
          {linkError ? <p className="text-xs text-destructive">{linkError}</p> : null}
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}
