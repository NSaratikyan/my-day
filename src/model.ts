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
  seriesId?: string;
  occurrenceDate?: string;
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
export const birthdaySchema = dateSchema.refine(s => s <= localDate(), "Ծննդյան ամսաթիվը չի կարող ապագայում լինել։");
const timestamp = z.string().datetime();
const id = z.string().min(1).max(200);
export const taskSchema = z
  .object({
    seriesId: id.optional(),
    occurrenceDate: dateSchema.optional(),
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
      .union([z.literal(0), z.literal(5), z.literal(15), z.literal(30), z.literal(60)])
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
export const repeatOptionsSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("forever") }).strict(),
  z.object({ mode: z.literal("weeks"), count: z.number().int().min(1).max(520) }).strict(),
  z.object({ mode: z.literal("months"), count: z.number().int().min(1).max(120) }).strict(),
  z.object({ mode: z.literal("until"), until: dateSchema }).strict(),
]);
export type RepeatOptions = z.infer<typeof repeatOptionsSchema>;
export const seriesSchema = z.object({
  id, startDate: dateSchema, enabled: z.boolean(),
  options: repeatOptionsSchema, template: taskSchema,
  skipped: z.array(dateSchema).max(50000),
}).strict().superRefine((s, ctx) => {
  if (s.options.mode === "until" && s.options.until < s.startDate)
    ctx.addIssue({ code: "custom", message: "Ավարտը չի կարող լինել սկզբից առաջ։" });
  if (s.template.seriesId || s.template.occurrenceDate)
    ctx.addIssue({ code: "custom", message: "Սխալ կրկնության ձևանմուշ։" });
});
export type TaskSeries = Omit<z.infer<typeof seriesSchema>, "template"> & { template: Task };
export function repeatEnd(start: string, options: RepeatOptions): string | undefined {
  if (options.mode === "forever") return undefined;
  if (options.mode === "until") return options.until;
  if (options.mode === "weeks") return addDays(start, (options.count - 1) * 7);
  const date = parseDate(start);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + options.count);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, last));
  return addDays(localDate(date), -1);
}
export function weeklyDates(series: TaskSeries, through: string): string[] {
  if (!series.enabled) return [];
  const end = repeatEnd(series.startDate, series.options);
  const limit = end && end < through ? end : through;
  const skipped = new Set(series.skipped);
  const dates: string[] = [];
  for (let date = series.startDate; date <= limit; date = addDays(date, 7)) {
    if (dates.length >= 50000) throw new Error("Կրկնության ժամանակահատվածը չափազանց երկար է։");
    if (!skipped.has(date)) dates.push(date);
  }
  return dates;
}
export const backupSchema = z
  .object({
    version: z.union([z.literal(1), z.literal(2)]),
    series: z.array(seriesSchema).max(1000).optional(),
    exportedAt: timestamp,
    tasks: z.array(taskSchema).max(50000),
    categories: z.array(categorySchema).min(1).max(1000),
    notes: z.array(noteSchema).max(50000),
    theme: z.enum(["system", "light", "dark"]),
    birthday: birthdaySchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if ((data.version === 2 && !data.series) || (data.version === 1 && data.series))
      ctx.addIssue({ code: "custom", message: "Սխալ պահուստային տարբերակ։" });
    const series = data.series ?? [];
    const seriesIds = new Set(series.map((s) => s.id));
    if (seriesIds.size !== series.length)
      ctx.addIssue({ code: "custom", message: "Կրկնվող շարքեր։" });
    const occurrenceKeys = new Set<string>();
    for (const task of data.tasks) {
      if (!!task.seriesId !== !!task.occurrenceDate || (task.seriesId && !seriesIds.has(task.seriesId)))
        ctx.addIssue({ code: "custom", message: "Կրկնության շարքը չի գտնվել։" });
      if (task.seriesId) {
        const key = `${task.seriesId}/${task.occurrenceDate}`;
        if (occurrenceKeys.has(key)) ctx.addIssue({ code: "custom", message: "Կրկնվող առաջադրանք։" });
        occurrenceKeys.add(key);
      }
    }
    const ids = new Set(data.categories.map((c) => c.id));
    for (const s of series) if (!ids.has(s.template.categoryId))
      ctx.addIssue({ code: "custom", message: "Կրկնության կատեգորիան չի գտնվել։" });
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
  if (task.reminderMinutes !== undefined && !task.startTime)
    return "Հիշեցման համար ընտրեք մեկնարկի ժամը։";
}
