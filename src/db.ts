import Dexie, { type Table } from "dexie";
import { config } from "./config";
import {
  backupSchema,
  birthdaySchema,
  addDays, localDate, repeatEnd, seriesSchema, weeklyDates,
  topThreeConflicts,
  validateTask,
  type Category,
  type Task,
  type DailyNote,
  type Theme,
  type TaskSeries, type RepeatOptions,
} from "./model";
export class PlannerDB extends Dexie {
  tasks!: Table<Task>;
  series!: Table<TaskSeries>;
  categories!: Table<Category>;
  notes!: Table<DailyNote>;
  settings!: Table<{ key: string; value: string }>;
  constructor(name: string = config.database) {
    super(name);
    this.version(1).stores({
      tasks: "id,date,categoryId,status",
      categories: "id",
      notes: "id,&date",
      settings: "key",
    });
    this.version(2).stores({
      tasks: "id,date,categoryId,status,seriesId",
      series: "id",
    });
  }
}
export const db = new PlannerDB();
export const defaults: Category[] = [
  "Համալսարան",
  "Նախագծերի կառավարում",
  "«Պատառիկ»",
  "Խորհրդատվություն",
  "Ընտանիք",
  "Անգլերեն",
  "ԱԲ և թվայնացում",
  "Ընթերցանություն",
  "Այլ",
].map((name, i) => ({
  id: `category-${i}`,
  name,
  color: [
    "#167C70",
    "#6572AD",
    "#B27939",
    "#A46686",
    "#B65B54",
    "#498AAB",
    "#737D47",
    "#947044",
    "#6D7D79",
  ][i],
  isDefault: true,
}));
export async function initialize(database = db) {
  await database.transaction(
    "rw",
    [database.settings, database.categories],
    async () => {
      if (!(await database.settings.get("initialized"))) {
        await database.categories.bulkPut(defaults);
        await database.settings.put({ key: "initialized", value: "1" });
      }
    },
  );
  await ensureRepeats(addDays(localDate(), 366), database);
}
export async function ensureRepeats(through = addDays(localDate(), 366), database = db) {
  await database.transaction("rw", [database.tasks, database.series], async () => {
    const tasks = await database.tasks.toArray();
    const present = new Set(tasks.filter(t => t.seriesId).map(t => `${t.seriesId}/${t.occurrenceDate}`));
    const tops = new Map<string, number>();
    for (const t of tasks) if (t.isTopThree) tops.set(t.date, (tops.get(t.date) ?? 0) + 1);
    const now = new Date().toISOString();
    const generated: Task[] = [];
    for (const series of await database.series.toArray()) {
      for (const date of weeklyDates(series, through)) {
        const key = `${series.id}/${date}`;
        if (present.has(key)) continue;
        const isTopThree = series.template.isTopThree && (tops.get(date) ?? 0) < 3;
        if (isTopThree) tops.set(date, (tops.get(date) ?? 0) + 1);
        generated.push({ ...series.template, id: `repeat:${series.id}:${date}`, date, seriesId: series.id,
          occurrenceDate: date, status: "planned", postponedCount: 0, isTopThree,
          completedAt: undefined, previousStatus: undefined, createdAt: now, updatedAt: now });
        present.add(key);
      }
    }
    await database.tasks.bulkPut(generated);
  });
}
export async function saveRepeatingTask(task: Task, options: RepeatOptions | undefined, replaceId?: string, database = db) {
  await database.transaction("rw", [database.tasks, database.categories, database.series], async () => {
    const old = task.seriesId ? await database.series.get(task.seriesId) : undefined;
    if (task.seriesId && !old) throw new Error("Կրկնության շարքը չի գտնվել։");
    let series: TaskSeries | undefined = old;
    if (options) {
      const template = { ...task };
      delete template.seriesId;
      delete template.occurrenceDate;
      series = { id: old?.id ?? crypto.randomUUID(), startDate: old?.startDate ?? task.date,
        enabled: true, options, template: old?.template ?? template, skipped: old?.skipped ?? [] };
      if (!seriesSchema.safeParse(series).success)
        throw new Error("Ստուգեք կրկնության քանակը կամ ավարտի ամսաթիվը։");
      task = { ...task, seriesId: series.id, occurrenceDate: task.occurrenceDate ?? task.date };
    } else if (old) series = { ...old, enabled: false };
    await saveTask(task, replaceId, database);
    if (series) {
      await database.series.put(series);
      const end = repeatEnd(series.startDate, series.options);
      // Preserve past history, completed/in-progress occurrences, and the edited occurrence.
      const future = await database.tasks.where("seriesId").equals(series.id).toArray();
      await database.tasks.bulkDelete(future.filter(t => t.id !== task.id && t.date > localDate() && t.status === "planned" &&
        (!series.enabled || (end && t.occurrenceDate! > end))).map(t => t.id));
      await ensureRepeats(addDays(localDate() > task.date ? localDate() : task.date, 366), database);
    }
  });
}
export async function deleteTask(task: Task, database = db) {
  await database.transaction("rw", [database.tasks, database.series], async () => {
    if (task.seriesId && task.occurrenceDate) {
      const series = await database.series.get(task.seriesId);
      if (series) await database.series.update(series.id, { skipped: [...new Set([...series.skipped, task.occurrenceDate])] });
    }
    await database.tasks.delete(task.id);
  });
}
export async function setSeriesEnabled(id: string, enabled: boolean, database = db) {
  await database.transaction("rw", [database.tasks, database.series], async () => {
    await database.series.update(id, { enabled });
    if (!enabled) {
      const future = await database.tasks.where("seriesId").equals(id).toArray();
      await database.tasks.bulkDelete(future.filter(t => t.date > localDate() && t.status === "planned").map(t => t.id));
    } else await ensureRepeats(undefined, database);
  });
}
export async function saveTask(task: Task, replaceId?: string, database = db) {
  await database.transaction(
    "rw",
    [database.tasks, database.categories],
    async () => {
      const error = validateTask(task, await database.categories.toArray());
      if (error) throw new Error(error);
      const conflicts = topThreeConflicts(
        task,
        await database.tasks.where("date").equals(task.date).toArray(),
      );
      if (conflicts.length >= 3) {
        if (!replaceId || !conflicts.some((t) => t.id === replaceId))
          throw new Error(
            "Այս օրվա համար արդեն ընտրված է երեք գլխավոր առաջադրանք։",
          );
        await database.tasks.update(replaceId, {
          isTopThree: false,
          updatedAt: new Date().toISOString(),
        });
      }
      await database.tasks.put({ ...task, title: task.title.trim() });
    },
  );
}
export async function saveNote(
  date: string,
  values: Pick<DailyNote, "thoughts" | "wins" | "tomorrow">,
  database = db,
) {
  await database.transaction("rw", database.notes, async () => {
    const old = await database.notes.where("date").equals(date).first();
    const now = new Date().toISOString();
    await database.notes.put({
      ...values,
      id: old?.id ?? crypto.randomUUID(),
      date,
      createdAt: old?.createdAt ?? now,
      updatedAt: now,
    });
  });
}
export async function exportData(database = db) {
  return database.transaction(
    "r",
    [database.tasks, database.categories, database.notes, database.settings, database.series],
    async () =>
      backupSchema.parse({
        version: 2,
        series: await database.series.toArray(),
        exportedAt: new Date().toISOString(),
        tasks: await database.tasks.toArray(),
        categories: await database.categories.toArray(),
        notes: await database.notes.toArray(),
        theme: (await database.settings.get("theme"))?.value ?? "system",
        birthday: (await database.settings.get("birthday"))?.value,
      }),
  );
}
export async function importData(input: unknown, database = db) {
  const result = backupSchema.safeParse(input);
  if (!result.success)
    throw new Error(
      "Ֆայլը վավեր պահուստային պատճեն չէ։ Ստուգեք կառուցվածքն ու տվյալները։",
    );
  const data = result.data;
  await database.transaction(
    "rw",
    [database.tasks, database.categories, database.notes, database.settings, database.series],
    async () => {
      await database.tasks.clear();
      await database.categories.clear();
      await database.notes.clear();
      await database.series.clear();
      await database.series.bulkPut(data.series ?? []);
      await database.tasks.bulkPut(data.tasks);
      await database.categories.bulkPut(data.categories);
      await database.notes.bulkPut(data.notes);
      await database.settings.put({ key: "theme", value: data.theme });
      if (data.birthday) await database.settings.put({ key: "birthday", value: data.birthday });
      else await database.settings.delete("birthday");
      await database.settings.put({ key: "initialized", value: "1" });
      await ensureRepeats(undefined, database);
    },
  );
}
export async function clearData() {
  await db.transaction(
    "rw",
    [db.tasks, db.notes, db.categories, db.settings, db.series],
    async () => {
      await db.tasks.clear();
      await db.series.clear();
      await db.notes.clear();
      await db.categories.clear();
      await db.settings.clear();
      await db.categories.bulkPut(defaults);
      await db.settings.bulkPut([
        { key: "initialized", value: "1" },
        { key: "theme", value: "system" },
      ]);
    },
  );
}
export async function deleteCategory(id: string, replacement?: string) {
  await db.transaction("rw", [db.tasks, db.categories, db.series], async () => {
    if ((await db.categories.count()) <= 1)
      throw new Error("Պահեք առնվազն մեկ կատեգորիա։");
    const recurring = (await db.series.toArray()).filter(s => s.template.categoryId === id);
    const used = (await db.tasks.where("categoryId").equals(id).count()) + recurring.length;
    if (
      used &&
      (!replacement ||
        replacement === id ||
        !(await db.categories.get(replacement)))
    )
      throw new Error("Ընտրեք փոխարինող կատեգորիան։");
    if (used)
      await db.tasks
        .where("categoryId")
        .equals(id)
        .modify({
          categoryId: replacement!,
          updatedAt: new Date().toISOString(),
        });
    await db.categories.delete(id);
    for (const s of recurring) await db.series.put({ ...s, template: { ...s.template, categoryId: replacement! } });
  });
}
export async function setTheme(theme: Theme) {
  await db.settings.put({ key: "theme", value: theme });
}
export async function saveBirthday(value: string, database = db) {
  if (!value) {
    await database.settings.delete("birthday");
    return;
  }
  if (!birthdaySchema.safeParse(value).success)
    throw new Error("Ընտրեք վավեր ծննդյան ամսաթիվ՝ ոչ ուշ, քան այսօր։");
  await database.settings.put({ key: "birthday", value });
}
