"use client";

import { useMemo, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Placeholder } from "@tiptap/extension-placeholder";
import {
  Bold,
  Code,
  Download,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Plus,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Trash2,
  Undo2,
} from "lucide-react";
import { usePlanly } from "../lib/store";
import { htmlToMarkdown, htmlToText } from "../lib/markdown";
import { downloadFile } from "../lib/utils";
import type { Note } from "../lib/types";
import { Button, Card, EmptyState, Input, cx } from "./ui";

function ToolbarButton({ onClick, active, label, children }: { onClick: () => void; active?: boolean; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cx(
        "cursor-pointer rounded-lg p-1.5 transition-colors",
        active ? "bg-[var(--pl-accent-soft)] text-[var(--pl-accent-ink)]" : "text-[var(--pl-muted)] hover:bg-[var(--pl-hover)] hover:text-[var(--pl-text)]"
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const c = () => editor.chain().focus();
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--pl-border)] pb-2">
      <ToolbarButton label="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => c().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => c().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-[var(--pl-border)]" />
      <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => c().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => c().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => c().toggleStrike().run()}>
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Inline code" active={editor.isActive("code")} onClick={() => c().toggleCode().run()}>
        <Code className="h-4 w-4" />
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-[var(--pl-border)]" />
      <ToolbarButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => c().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => c().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Checklist" active={editor.isActive("taskList")} onClick={() => c().toggleTaskList().run()}>
        <ListChecks className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Quote" active={editor.isActive("blockquote")} onClick={() => c().toggleBlockquote().run()}>
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Code block" active={editor.isActive("codeBlock")} onClick={() => c().toggleCodeBlock().run()}>
        <SquareCode className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Divider" onClick={() => c().setHorizontalRule().run()}>
        <Minus className="h-4 w-4" />
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-[var(--pl-border)]" />
      <ToolbarButton label="Undo" onClick={() => c().undo().run()}>
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Redo" onClick={() => c().redo().run()}>
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

function NoteEditor({ note }: { note: Note }) {
  const { updateNote, deleteNote } = usePlanly.getState();
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Start writing… Markdown shortcuts work: # heading, - list, [] checklist, **bold**, > quote, ``` code" }),
    ],
    content: note.html || "",
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { class: "planly-prose min-h-[380px] outline-none" } },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const patch: Partial<Note> = { html };
      // The title follows the first line until the user renames the note themselves.
      const latest = usePlanly.getState().notes.find((n) => n.id === note.id);
      if (latest && latest.autoTitle !== false) {
        const firstLine = editor.getText().split("\n").find((l) => l.trim());
        patch.title = firstLine ? firstLine.trim().slice(0, 60) : "Untitled note";
      }
      updateNote(note.id, patch);
    },
  });

  return (
    <Card className="flex min-h-[520px] flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Input value={note.title} onChange={(e) => updateNote(note.id, { title: e.target.value.slice(0, 120), autoTitle: false })} className="flex-1 !text-base font-bold" aria-label="Note title" />
        <Button size="sm" variant="ghost" onClick={() => downloadFile(`${note.title || "note"}.md`.replace(/[\\/:*?"<>|]/g, "_"), htmlToMarkdown(note.html), "text/markdown;charset=utf-8")}>
          <Download className="h-4 w-4" /> .md
        </Button>
        <Button size="sm" variant="ghost" onClick={() => confirm(`Delete “${note.title}”?`) && deleteNote(note.id)} aria-label="Delete note">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {editor ? (
        <>
          <Toolbar editor={editor} />
          <div className="flex-1 overflow-y-auto pt-3 custom-scroll">
            <EditorContent editor={editor} />
          </div>
        </>
      ) : (
        <div className="flex-1" />
      )}
      <div className="mt-2 text-right text-[11px] text-[var(--pl-muted)]">Saved · {new Date(note.updatedAt).toLocaleString()}</div>
    </Card>
  );
}

export default function Notes() {
  const notes = usePlanly((s) => s.notes);
  const addNote = usePlanly((s) => s.addNote);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...notes]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .filter((n) => !q || n.title.toLowerCase().includes(q) || htmlToText(n.html).toLowerCase().includes(q));
  }, [notes, query]);

  const current = notes.find((n) => n.id === selected) || sorted[0] || null;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card className="!p-3">
        <div className="mb-2 flex gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" />
          <Button variant="primary" onClick={() => setSelected(addNote())} aria-label="New note">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-[560px] space-y-1 overflow-y-auto custom-scroll">
          {sorted.map((n) => (
            <button
              key={n.id}
              onClick={() => setSelected(n.id)}
              className={cx(
                "w-full cursor-pointer rounded-xl px-3 py-2 text-left transition-colors",
                current?.id === n.id ? "bg-[var(--pl-accent-soft)]" : "hover:bg-[var(--pl-hover)]"
              )}
            >
              <div className={cx("truncate text-sm font-semibold", current?.id === n.id ? "text-[var(--pl-accent-ink)]" : "text-[var(--pl-text)]")}>{n.title || "Untitled note"}</div>
              <div className="truncate text-[11px] text-[var(--pl-muted)]">{htmlToText(n.html).slice(0, 80) || "Empty"}</div>
            </button>
          ))}
          {sorted.length === 0 && <p className="px-2 py-4 text-center text-xs text-[var(--pl-muted)]">{notes.length ? "No matches." : "No notes yet."}</p>}
        </div>
      </Card>
      {current ? (
        <NoteEditor key={current.id} note={current} />
      ) : (
        <EmptyState>
          <p className="mb-3">Capture lecture notes, summaries and ideas.</p>
          <Button variant="primary" onClick={() => setSelected(addNote())}>
            <Plus className="h-4 w-4" /> New note
          </Button>
        </EmptyState>
      )}
    </div>
  );
}
