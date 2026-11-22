"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { CheckSquare, NotebookPen, Square, Trash2 } from "lucide-react";
import { usePlanly } from "../lib/store";
import { uid } from "../lib/utils";
import type { ScratchLine } from "../lib/types";
import { Button, Card, CardTitle, cx } from "./ui";

export default function Scratchpad() {
  const lines = usePlanly((s) => s.scratch);
  const setScratch = usePlanly((s) => s.setScratch);
  const refs = useRef(new Map<string, HTMLInputElement>());
  const [focusId, setFocusId] = useState<{ id: string; caret?: number } | null>(null);

  // Layout effect: move focus before the browser handles the next keystroke.
  useLayoutEffect(() => {
    if (!focusId) return;
    const el = refs.current.get(focusId.id);
    if (el) {
      el.focus();
      const pos = focusId.caret ?? el.value.length;
      el.setSelectionRange(pos, pos);
    }
    setFocusId(null);
  }, [focusId]);

  const update = (id: string, patch: Partial<ScratchLine>) => setScratch(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const onChange = (line: ScratchLine, value: string) => {
    // Typing "[] " or "[ ] " at the start turns the line into a checkbox.
    const m = value.match(/^\[( |x)?\]\s/i);
    if (m && !line.checkbox) {
      // The input keeps focus; React places the caret at the end of the shortened value.
      update(line.id, { text: value.slice(m[0].length), checkbox: true, checked: (m[1] || "").toLowerCase() === "x" });
      return;
    }
    update(line.id, { text: value.slice(0, 1000) });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, line: ScratchLine, idx: number) => {
    const el = e.currentTarget;
    if (e.key === "Enter") {
      e.preventDefault();
      const caret = el.selectionStart ?? line.text.length;
      const before = line.text.slice(0, caret);
      const after = line.text.slice(caret);
      // Enter on an empty checkbox line turns it back into plain text (like most editors).
      if (line.checkbox && !line.text) {
        update(line.id, { checkbox: false, checked: false });
        return;
      }
      const next: ScratchLine = { id: uid(), text: after, checkbox: line.checkbox, checked: false };
      const copy = [...lines];
      copy.splice(idx, 1, { ...line, text: before }, next);
      setScratch(copy);
      setFocusId({ id: next.id, caret: 0 });
    } else if (e.key === "Backspace" && (el.selectionStart ?? 0) === 0 && el.selectionEnd === 0) {
      if (line.checkbox) {
        e.preventDefault();
        update(line.id, { checkbox: false, checked: false });
      } else if (idx > 0) {
        e.preventDefault();
        const prev = lines[idx - 1];
        const caret = prev.text.length;
        const copy = lines.filter((l) => l.id !== line.id).map((l) => (l.id === prev.id ? { ...l, text: l.text + line.text } : l));
        setScratch(copy);
        setFocusId({ id: prev.id, caret });
      }
    } else if (e.key === "ArrowUp" && idx > 0) {
      e.preventDefault();
      setFocusId({ id: lines[idx - 1].id, caret: Math.min(el.selectionStart ?? 0, lines[idx - 1].text.length) });
    } else if (e.key === "ArrowDown" && idx < lines.length - 1) {
      e.preventDefault();
      setFocusId({ id: lines[idx + 1].id, caret: Math.min(el.selectionStart ?? 0, lines[idx + 1].text.length) });
    }
  };

  const checkedCount = lines.filter((l) => l.checkbox && l.checked).length;

  return (
    <Card>
      <CardTitle
        icon={<NotebookPen className="h-4 w-4" />}
        right={
          <div className="flex gap-1">
            {checkedCount > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setScratch(lines.filter((l) => !(l.checkbox && l.checked)))}>
                Clear done ({checkedCount})
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              title="Clear scratchpad"
              onClick={() => {
                if (confirm("Clear the whole scratchpad?")) setScratch([]);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        }
      >
        Scratchpad
      </CardTitle>
      <p className="mb-2 text-[11px] text-[var(--pl-muted)]">Brain-dump here. Start a line with <code>[] </code> or tap the box to make it a checklist item. Saved as you type.</p>
      <div className="max-h-[360px] space-y-0.5 overflow-y-auto rounded-xl bg-[var(--pl-card2)] p-2 custom-scroll">
        {lines.map((line, idx) => (
          <div key={line.id} className="group flex items-center gap-1.5">
            <button
              onClick={() => (line.checkbox ? update(line.id, { checked: !line.checked }) : update(line.id, { checkbox: true }))}
              className={cx(
                "flex-shrink-0 cursor-pointer rounded p-0.5 transition-opacity",
                line.checkbox ? "text-[var(--pl-accent-ink)]" : "text-[var(--pl-muted)] opacity-0 group-hover:opacity-60 focus:opacity-100"
              )}
              aria-label={line.checkbox ? (line.checked ? "Uncheck" : "Check") : "Make checklist item"}
            >
              {line.checkbox && line.checked ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            </button>
            <input
              ref={(el) => {
                if (el) refs.current.set(line.id, el);
                else refs.current.delete(line.id);
              }}
              value={line.text}
              onChange={(e) => onChange(line, e.target.value)}
              onKeyDown={(e) => onKeyDown(e, line, idx)}
              placeholder={idx === 0 && lines.length === 1 ? "Type anything…" : ""}
              className={cx(
                "w-full bg-transparent py-1 text-sm text-[var(--pl-text)] outline-none placeholder:text-[var(--pl-muted)]",
                line.checkbox && line.checked && "text-[var(--pl-muted)] line-through"
              )}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
