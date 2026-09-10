import { z } from "zod";
import '@formatjs/intl-datetimeformat/polyfill-force.js';
import '@formatjs/intl-datetimeformat/locale-data/hy.js';
export const statuses = {
  planned: "Նախատեսված",
  in_progress: "Ընթացքի մեջ",
  completed: "Կատարված",
  postponed: "Տեղափոխված",
  cancelled: "Չեղարկված",
} as const;
export const priorities = {
  low: "Ցածր",
  medium: "Միջին",
  high: "Բարձր",
} as const;
export type TaskStatus = keyof typeof statuses;
export type TaskPriority = keyof typeof priorities;
export interface Task {
  id: string;
  title: string;
  categoryId: string;
  date: string;
  startTime?: string;
  durationMinutes?: number;
  priority: TaskPriority;
  isTopThree: boolean;
  reminderMinutes?: number;
  notes?: string;
  status: TaskStatus;
  postponedCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  previousStatus?: Exclude<TaskStatus, "completed">;
}
export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
  isDefault: boolean;
}
export interface DailyNote {
  id: string;
  date: string;
  thoughts: string;
  wins: string;
  tomorrow: string;
  createdAt: string;
  updatedAt: string;
}
export type Theme = "system" | "light" | "dark";
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function parseDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
export function addDays(s: string, n = 1) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return localDate(d);
}
export function monday(s: string) {
  return addDays(s, -((parseDate(s).getDay() + 6) % 7));
}
export function formatDate(
  s: string,
  options: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    weekday: "long",
  },
) {
  // A calendar date has no instant or zone. Anchor its components to UTC only
  // for display; all scheduling and next-day calculations remain device-local.
  const [year, month, day] = s.split('-').map(Number);
  return new Intl.DateTimeFormat("hy-AM", {...options, timeZone: 'UTC'}).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
export function progress(tasks: Task[]) {
  const active = tasks.filter((t) => t.status !== "cancelled");
  const done = active.filter((t) => t.status === "completed").length;
  return {
    done,
    total: active.length,
    percent: active.length ? Math.round((done / active.length) * 100) : 0,
  };
}
export function topThreeConflicts(task: Task, tasks: Task[]) {
  return task.isTopThree
    ? tasks.filter(
        (t) => t.id !== task.id && t.date === task.date && t.isTopThree,
      )
    : [];
}
export function postpone(task: Task): Task {
  return {
    ...task,
    date: addDays(task.date),
    status: "planned",
    completedAt: undefined,
    previousStatus: undefined,
    postponedCount: task.postponedCount + 1,
    updatedAt: new Date().toISOString(),
  };
}
export function toggleTask(task: Task): Task {
  const now = new Date().toISOString();
  return task.status === "completed"
    ? {
        ...task,
        status: task.previousStatus ?? "planned",
        completedAt: undefined,
        previousStatus: undefined,
        updatedAt: now,
      }
    : {
        ...task,
        previousStatus: task.status,
        status: "completed",
        completedAt: now,
        updatedAt: now,
      };
}
export function isOverdue(task: Task, now = new Date()) {
  return (
    !["completed", "cancelled"].includes(task.status) &&
    (task.date < localDate(now) ||
      (task.date === localDate(now) &&
        !!task.startTime &&
        task.startTime <
          `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`))
  );
}
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => localDate(parseDate(s)) === s);
const timestamp = z.string().datetime();
const id = z.string().min(1).max(200);
export const taskSchema = z
  .object({
    id,
    title: z
      .string()
      .trim()
      .min(1, "Մուտքագրեք առաջադրանքի անվանումը։")
      .max(300),
    categoryId: id,
    date: dateSchema,
    startTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    durationMinutes: z.number().int().positive().max(1440).optional(),
    priority: z.enum(["low", "medium", "high"]),
    isTopThree: z.boolean(),
    reminderMinutes: z
      .union([z.literal(5), z.literal(15), z.literal(30), z.literal(60)])
      .optional(),
    notes: z.string().max(10000).optional(),
    status: z.enum([
      "planned",
      "in_progress",
      "completed",
      "postponed",
      "cancelled",
    ]),
    postponedCount: z.number().int().nonnegative(),
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: timestamp.optional(),
    previousStatus: z
      .enum(["planned", "in_progress", "postponed", "cancelled"])
      .optional(),
  })
  .strict();
const categorySchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(100),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    icon: z.string().max(100).optional(),
    isDefault: z.boolean(),
  })
  .strict();
const noteSchema = z
  .object({
    id,
    date: dateSchema,
    thoughts: z.string().max(100000),
    wins: z.string().max(100000),
    tomorrow: z.string().max(100000),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict();
export const backupSchema = z
  .object({
    version: z.literal(1),
    exportedAt: timestamp,
    tasks: z.array(taskSchema).max(50000),
    categories: z.array(categorySchema).min(1).max(1000),
    notes: z.array(noteSchema).max(50000),
    theme: z.enum(["system", "light", "dark"]),
  })
  .strict()
  .superRefine((data, ctx) => {
    const ids = new Set(data.categories.map((c) => c.id));
    const unique = (a: string[]) => new Set(a).size === a.length;
    if (
      !unique(data.tasks.map((t) => t.id)) ||
      !unique(data.categories.map((c) => c.id)) ||
      !unique(data.notes.map((n) => n.id)) ||
      !unique(data.notes.map((n) => n.date))
    )
      ctx.addIssue({ code: "custom", message: "Կրկնվող գրառումներ։" });
    const tops = new Map<string, number>();
    for (const t of data.tasks) {
      if (!ids.has(t.categoryId))
        ctx.addIssue({ code: "custom", message: "Կատեգորիան չի գտնվել։" });
      if (t.isTopThree) tops.set(t.date, (tops.get(t.date) ?? 0) + 1);
    }
    if ([...tops.values()].some((n) => n > 3))
      ctx.addIssue({
        code: "custom",
        message: "Օրվա գլխավորները երեքից ավելի են։",
      });
  });
export function validateTask(
  task: Task,
  categories: Category[],
): string | undefined {
  if (!task.title.trim()) return "Մուտքագրեք առաջադրանքի անվանումը։";
  if (!categories.some((c) => c.id === task.categoryId))
    return "Ընտրեք կատեգորիան։";
  if (!dateSchema.safeParse(task.date).success) return "Ընտրեք վավեր ամսաթիվ։";
  if (!taskSchema.safeParse(task).success)
    return "Ստուգեք ժամը, տևողությունը և դաշտերի արժեքները։";
  if (task.reminderMinutes && !task.startTime)
    return "Հիշեցման համար ընտրեք մեկնարկի ժամը։";
}
