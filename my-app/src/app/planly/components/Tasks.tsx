"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, FolderKanban, Loader2, Pencil, Pin, PinOff, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { usePlanly } from "../lib/store";
import { COLORS, dayKey, parseDayKey } from "../lib/utils";
import type { Assignment, Difficulty, Task, TaskStatus } from "../lib/types";
import { Badge, Button, Card, EmptyState, Input, Modal, Select, cx, inputClass } from "./ui";

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "doing", label: "In progress" },
  { id: "done", label: "Done" },
];

const DIFF_COLOR: Record<Difficulty, string> = { easy: "#34d399", medium: "#fbbf24", hard: "#f87171" };
const DIFF_RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

type SortMode = "manual" | "due" | "difficulty" | "newest";

function sortTasks(tasks: Task[], mode: SortMode): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (mode === "due") return (a.due || "9999").localeCompare(b.due || "9999") || a.order - b.order;
    if (mode === "difficulty") return DIFF_RANK[b.difficulty] - DIFF_RANK[a.difficulty] || a.order - b.order;
    if (mode === "newest") return b.createdAt - a.createdAt;
    return a.order - b.order;
  });
}

function dueLabel(due: string | null, done: boolean) {
  if (!due) return null;
  const today = dayKey();
  const d = parseDayKey(due);
  const text = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (done) return { text, color: "var(--pl-muted)" };
  if (due < today) return { text: `${text} · overdue`, color: "#f87171" };
  if (due === today) return { text: "Today", color: "#fbbf24" };
  return { text, color: "var(--pl-muted)" };
}

function TaskCard({ task, assignment, onEdit, dragging }: { task: Task; assignment?: Assignment; onEdit: () => void; dragging?: boolean }) {
  const { updateTask, deleteTask } = usePlanly.getState();
  const due = dueLabel(task.due, task.status === "done");
  return (
    <div
      className={cx(
        "group rounded-xl border bg-[var(--pl-card)] p-3 text-left shadow-sm transition-shadow",
        task.pinned ? "border-[var(--pl-accent-line)]" : "border-[var(--pl-border)]",
        dragging && "shadow-xl ring-2 ring-[var(--pl-accent)]"
      )}
      style={assignment ? { borderLeft: `3px solid ${assignment.color}` } : undefined}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={task.status === "done"}
          onChange={(e) => updateTask(task.id, { status: e.target.checked ? "done" : "todo" })}
          onPointerDown={(e) => e.stopPropagation()}
          className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer accent-[var(--pl-accent)]"
          aria-label="Mark done"
        />
        <div className="min-w-0 flex-1">
          <div className={cx("break-words text-sm font-semibold text-[var(--pl-text)]", task.status === "done" && "text-[var(--pl-muted)] line-through")}>
            {task.title}
          </div>
          {task.notes && <div className="mt-0.5 line-clamp-2 text-xs text-[var(--pl-muted)]">{task.notes}</div>}
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <Badge color={DIFF_COLOR[task.difficulty]}>{task.difficulty}</Badge>
            {assignment && <Badge color={assignment.color}>{assignment.name}</Badge>}
            {task.tags.map((t) => (
              <Badge key={t} color="#94a3b8">
                #{t}
              </Badge>
            ))}
            {due && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: due.color }}>
                <CalendarDays className="h-3 w-3" /> {due.text}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-0.5 opacity-60 transition-opacity group-hover:opacity-100" onPointerDown={(e) => e.stopPropagation()}>
          <button className="cursor-pointer rounded p-1 text-[var(--pl-muted)] hover:text-[var(--pl-accent-ink)]" onClick={() => updateTask(task.id, { pinned: !task.pinned })} aria-label={task.pinned ? "Unpin" : "Pin"}>
            {task.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
          <button className="cursor-pointer rounded p-1 text-[var(--pl-muted)] hover:text-[var(--pl-accent-ink)]" onClick={onEdit} aria-label="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            className="cursor-pointer rounded p-1 text-[var(--pl-muted)] hover:text-red-400"
            onClick={() => confirm(`Delete “${task.title}”?`) && deleteTask(task.id)}
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableTask(props: { task: Task; assignment?: Assignment; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      className="cursor-grab touch-manipulation active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <TaskCard {...props} />
    </div>
  );
}

function Column({ id, label, tasks, assignments, onEdit, onQuickAdd }: {
  id: TaskStatus;
  label: string;
  tasks: Task[];
  assignments: Map<string, Assignment>;
  onEdit: (t: Task) => void;
  onQuickAdd?: (title: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${id}` });
  const [quick, setQuick] = useState("");
  return (
    <div
      ref={setNodeRef}
      className={cx(
        "flex min-h-[300px] flex-col rounded-2xl border bg-[var(--pl-card2)] p-3 transition-colors",
        isOver ? "border-[var(--pl-accent)]" : "border-[var(--pl-border)]"
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--pl-text)]">{label}</span>
        <span className="rounded-full bg-[var(--pl-border)] px-2 py-0.5 text-[10px] font-bold text-[var(--pl-muted)]">{tasks.length}</span>
      </div>
      {onQuickAdd && (
        <form
          className="mb-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (quick.trim()) {
              onQuickAdd(quick.trim());
              setQuick("");
            }
          }}
        >
          <Input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="+ Quick add task" />
        </form>
      )}
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2">
          {tasks.map((t) => (
            <SortableTask key={t.id} task={t} assignment={t.assignmentId ? assignments.get(t.assignmentId) : undefined} onEdit={() => onEdit(t)} />
          ))}
          {tasks.length === 0 && <div className="flex flex-1 items-center justify-center text-xs text-[var(--pl-muted)]">Drop tasks here</div>}
        </div>
      </SortableContext>
    </div>
  );
}

function TaskEditor({ task, onClose }: { task: Partial<Task> | null; onClose: () => void }) {
  const assignments = usePlanly((s) => s.assignments);
  const { addTask, updateTask } = usePlanly.getState();
  const [draft, setDraft] = useState<Partial<Task>>(task || {});
  const [tags, setTags] = useState((task?.tags || []).join(", "));
  if (!task) return null;
  const set = (patch: Partial<Task>) => setDraft((d) => ({ ...d, ...patch }));
  const save = () => {
    if (!draft.title?.trim()) return;
    const payload: Partial<Task> = {
      ...draft,
      title: draft.title.trim(),
      tags: tags.split(",").map((t) => t.trim().toLowerCase().replace(/^#/, "")).filter(Boolean).slice(0, 8),
      due: draft.due || null,
    };
    if (task.id) updateTask(task.id, payload);
    else addTask(payload as Partial<Task> & { title: string });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={task.id ? "Edit task" : "New task"}>
      <div className="space-y-3">
        <Input autoFocus value={draft.title || ""} onChange={(e) => set({ title: e.target.value })} placeholder="Task title" onKeyDown={(e) => e.key === "Enter" && save()} />
        <textarea value={draft.notes || ""} onChange={(e) => set({ notes: e.target.value })} placeholder="Notes (optional)" rows={3} className={inputClass} />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-[var(--pl-muted)]">
            Status
            <Select value={draft.status || "todo"} onChange={(e) => set({ status: e.target.value as TaskStatus })}>
              {COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-xs text-[var(--pl-muted)]">
            Difficulty
            <Select value={draft.difficulty || "medium"} onChange={(e) => set({ difficulty: e.target.value as Difficulty })}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </Select>
          </label>
          <label className="text-xs text-[var(--pl-muted)]">
            Assignment
            <Select value={draft.assignmentId || ""} onChange={(e) => set({ assignmentId: e.target.value || null })}>
              <option value="">None</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-xs text-[var(--pl-muted)]">
            Due date
            <Input type="date" value={draft.due || ""} onChange={(e) => set({ due: e.target.value || null })} />
          </label>
        </div>
        <label className="block text-xs text-[var(--pl-muted)]">
          Tags (comma separated)
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="exam, reading" />
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--pl-text)]">
          <input type="checkbox" className="accent-[var(--pl-accent)]" checked={!!draft.pinned} onChange={(e) => set({ pinned: e.target.checked })} />
          Pin to top
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!draft.title?.trim()}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AssignmentsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const assignments = usePlanly((s) => s.assignments);
  const tasks = usePlanly((s) => s.tasks);
  const { addAssignment, updateAssignment, deleteAssignment } = usePlanly.getState();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  return (
    <Modal open={open} onClose={onClose} title="Assignments & projects" wide>
      <div className="space-y-2">
        {assignments.length === 0 && <EmptyState>No assignments yet. Group tasks by course, project or category.</EmptyState>}
        {assignments.map((a) => {
          const list = tasks.filter((t) => t.assignmentId === a.id);
          return (
            <div key={a.id} className="flex items-center gap-2 rounded-xl border border-[var(--pl-border)] bg-[var(--pl-card2)] p-2">
              <input type="color" value={a.color} onChange={(e) => updateAssignment(a.id, { color: e.target.value })} className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent" aria-label="Colour" />
              <Input value={a.name} onChange={(e) => updateAssignment(a.id, { name: e.target.value.slice(0, 60) })} className="flex-1" />
              <Input value={a.category} onChange={(e) => updateAssignment(a.id, { category: e.target.value.slice(0, 40) })} placeholder="Category" className="w-32" />
              <span className="w-14 text-center text-xs text-[var(--pl-muted)]">{list.length} tasks</span>
              <Button size="sm" variant="ghost" onClick={() => confirm(`Delete “${a.name}”? Its tasks are kept.`) && deleteAssignment(a.id)} aria-label="Delete assignment">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
      <form
        className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--pl-border)] pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          addAssignment({ name: name.trim().slice(0, 60), category: category.trim().slice(0, 40), color });
          setName("");
          setCategory("");
          setColor(COLORS[(assignments.length + 1) % COLORS.length]);
        }}
      >
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border-0 bg-transparent" aria-label="Colour" />
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. DBMS Project" className="min-w-[160px] flex-1" />
        <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className="w-36" />
        <Button variant="primary" type="submit" disabled={!name.trim()}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </form>
    </Modal>
  );
}

interface AiTask {
  title: string;
  notes: string;
  difficulty: Difficulty;
  due: string | null;
  tags: string[];
}

function AiModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const assignments = usePlanly((s) => s.assignments);
  const { addTask } = usePlanly.getState();
  const [goal, setGoal] = useState("");
  const [assignmentId, setAssignmentId] = useState("");
  const [count, setCount] = useState(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<AiTask[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/planly/ai-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, count, today: dayKey(), assignment: assignments.find((a) => a.id === assignmentId)?.name || "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Request failed");
      setResults(data.tasks);
      setSelected(new Set(data.tasks.map((_: AiTask, i: number) => i)));
    } catch (e: any) {
      setError(navigator.onLine ? e.message || "Could not generate tasks." : "You're offline — AI task creation needs a connection.");
    } finally {
      setLoading(false);
    }
  };

  const addSelected = () => {
    // New tasks go to the top of the column, so add them last-first to keep the AI's order.
    [...results.entries()].reverse().forEach(([i, t]) => {
      if (selected.has(i)) addTask({ ...t, assignmentId: assignmentId || null });
    });
    setResults([]);
    setGoal("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Create tasks with AI" wide>
      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        rows={3}
        placeholder="e.g. Prepare for my Operating Systems mid-sem on Friday — chapters 3 to 6 and two past papers"
        className={inputClass}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Select value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)} className="w-auto flex-1">
          <option value="">No assignment</option>
          {assignments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Select value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-28">
          {[3, 5, 6, 8, 10, 12].map((n) => (
            <option key={n} value={n}>
              {n} tasks
            </option>
          ))}
        </Select>
        <Button variant="primary" onClick={generate} disabled={!goal.trim() || loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Generate
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {results.length > 0 && (
        <div className="mt-4 space-y-2">
          {results.map((t, i) => (
            <label key={i} className="flex cursor-pointer items-start gap-2 rounded-xl border border-[var(--pl-border)] bg-[var(--pl-card2)] p-2.5">
              <input
                type="checkbox"
                className="mt-1 accent-[var(--pl-accent)]"
                checked={selected.has(i)}
                onChange={() =>
                  setSelected((s) => {
                    const n = new Set(s);
                    if (n.has(i)) n.delete(i);
                    else n.add(i);
                    return n;
                  })
                }
              />
              <div className="flex-1">
                <div className="text-sm font-semibold text-[var(--pl-text)]">{t.title}</div>
                {t.notes && <div className="text-xs text-[var(--pl-muted)]">{t.notes}</div>}
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge color={DIFF_COLOR[t.difficulty]}>{t.difficulty}</Badge>
                  {t.due && <Badge color="#94a3b8">due {t.due}</Badge>}
                  {t.tags.map((tag) => (
                    <Badge key={tag} color="#94a3b8">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </label>
          ))}
          <div className="flex justify-end pt-1">
            <Button variant="primary" onClick={addSelected} disabled={selected.size === 0}>
              <Plus className="h-4 w-4" /> Add {selected.size} task{selected.size === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Tasks() {
  const tasks = usePlanly((s) => s.tasks);
  const assignmentsList = usePlanly((s) => s.assignments);
  const { moveTask, addTask } = usePlanly.getState();
  const [sortMode, setSortMode] = useState<SortMode>("manual");
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<Task> | null>(null);
  const [showAssignments, setShowAssignments] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const assignments = useMemo(() => new Map(assignmentsList.map((a) => [a.id, a])), [assignmentsList]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (filter === "none" && t.assignmentId) return false;
      if (filter && filter !== "none" && t.assignmentId !== filter) return false;
      if (q && !`${t.title} ${t.notes} ${t.tags.join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, filter, search]);

  const columns = useMemo(
    () => Object.fromEntries(COLUMNS.map((c) => [c.id, sortTasks(visible.filter((t) => t.status === c.id), sortMode)])) as Record<TaskStatus, Task[]>,
    [visible, sortMode]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const id = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || overId === id) return;
    if (overId.startsWith("col-")) {
      moveTask(id, overId.slice(4) as TaskStatus, null);
      return;
    }
    const overTask = tasks.find((t) => t.id === overId);
    const activeTask = tasks.find((t) => t.id === id);
    if (!overTask || !activeTask) return;
    const col = columns[overTask.status];
    const overIdx = col.findIndex((t) => t.id === overId);
    const activeIdx = col.findIndex((t) => t.id === id);
    // Moving down within a column: drop after the hovered card, otherwise before it.
    const beforeId = activeIdx !== -1 && activeIdx < overIdx ? col[overIdx + 1]?.id ?? null : overId;
    moveTask(id, overTask.status, beforeId);
  };

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <div className="space-y-4">
      {/* Assignments with progress */}
      <div className="flex gap-3 overflow-x-auto pb-1 custom-scroll">
        {assignmentsList.map((a) => {
          const list = tasks.filter((t) => t.assignmentId === a.id);
          const done = list.filter((t) => t.status === "done").length;
          const pct = list.length ? Math.round((done / list.length) * 100) : 0;
          return (
            <button
              key={a.id}
              onClick={() => setFilter(filter === a.id ? "" : a.id)}
              className={cx(
                "min-w-[180px] cursor-pointer rounded-2xl border bg-[var(--pl-card)] p-3 text-left transition-colors",
                filter === a.id ? "border-[var(--pl-accent)]" : "border-[var(--pl-border)] hover:border-[var(--pl-accent-line)]"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
                <span className="truncate text-sm font-bold text-[var(--pl-text)]">{a.name}</span>
              </div>
              {a.category && <div className="mt-0.5 text-[11px] text-[var(--pl-muted)]">{a.category}</div>}
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--pl-border)]">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: a.color }} />
              </div>
              <div className="mt-1 text-[11px] text-[var(--pl-muted)]">
                {done}/{list.length} done · {pct}%
              </div>
            </button>
          );
        })}
        <button
          onClick={() => setShowAssignments(true)}
          className="flex min-w-[160px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--pl-border)] p-3 text-sm text-[var(--pl-muted)] hover:border-[var(--pl-accent)] hover:text-[var(--pl-accent-ink)]"
        >
          <FolderKanban className="h-4 w-4" /> {assignmentsList.length ? "Manage" : "Add assignment"}
        </button>
      </div>

      {/* Toolbar */}
      <Card className="flex flex-wrap items-center gap-2 !p-3">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks or #tags" className="min-w-[160px] flex-1" />
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-auto">
          <option value="">All assignments</option>
          <option value="none">No assignment</option>
          {assignmentsList.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} className="w-auto" aria-label="Sort">
          <option value="manual">Sort: manual</option>
          <option value="due">Sort: due date</option>
          <option value="difficulty">Sort: hardest first</option>
          <option value="newest">Sort: newest</option>
        </Select>
        <Button variant="soft" onClick={() => setShowAi(true)}>
          <Sparkles className="h-4 w-4" /> AI tasks
        </Button>
        <Button variant="primary" onClick={() => setEditing({ status: "todo", difficulty: "medium", assignmentId: filter && filter !== "none" ? filter : null })}>
          <Plus className="h-4 w-4" /> New task
        </Button>
      </Card>
      {sortMode !== "manual" && <p className="-mt-2 text-xs text-[var(--pl-muted)]">Drag between columns to change status. Switch to manual sort to reorder within a column.</p>}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((c) => (
            <Column
              key={c.id}
              id={c.id}
              label={c.label}
              tasks={columns[c.id]}
              assignments={assignments}
              onEdit={(t) => setEditing(t)}
              onQuickAdd={
                c.id === "todo"
                  ? (title) => addTask({ title, assignmentId: filter && filter !== "none" ? filter : null })
                  : undefined
              }
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <TaskCard task={activeTask} assignment={activeTask.assignmentId ? assignments.get(activeTask.assignmentId) : undefined} onEdit={() => {}} dragging />
          ) : null}
        </DragOverlay>
      </DndContext>

      {editing && <TaskEditor key={editing.id || "new"} task={editing} onClose={() => setEditing(null)} />}
      <AssignmentsModal open={showAssignments} onClose={() => setShowAssignments(false)} />
      <AiModal open={showAi} onClose={() => setShowAi(false)} />
    </div>
  );
}
