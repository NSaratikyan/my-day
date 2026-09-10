import Dexie, { type Table } from "dexie";
import { config } from "./config";
import {
  backupSchema,
  topThreeConflicts,
  validateTask,
  type Category,
  type Task,
  type DailyNote,
  type Theme,
} from "./model";
export class PlannerDB extends Dexie {
  tasks!: Table<Task>;
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
    [database.tasks, database.categories, database.notes, database.settings],
    async () =>
      backupSchema.parse({
        version: 1,
        exportedAt: new Date().toISOString(),
        tasks: await database.tasks.toArray(),
        categories: await database.categories.toArray(),
        notes: await database.notes.toArray(),
        theme: (await database.settings.get("theme"))?.value ?? "system",
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
    [database.tasks, database.categories, database.notes, database.settings],
    async () => {
      await database.tasks.clear();
      await database.categories.clear();
      await database.notes.clear();
      await database.tasks.bulkPut(data.tasks);
      await database.categories.bulkPut(data.categories);
      await database.notes.bulkPut(data.notes);
      await database.settings.put({ key: "theme", value: data.theme });
      await database.settings.put({ key: "initialized", value: "1" });
    },
  );
}
export async function clearData() {
  await db.transaction(
    "rw",
    [db.tasks, db.notes, db.categories, db.settings],
    async () => {
      await db.tasks.clear();
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
  await db.transaction("rw", [db.tasks, db.categories], async () => {
    if ((await db.categories.count()) <= 1)
      throw new Error("Պահեք առնվազն մեկ կատեգորիա։");
    const used = await db.tasks.where("categoryId").equals(id).count();
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
  });
}
export async function setTheme(theme: Theme) {
  await db.settings.put({ key: "theme", value: theme });
}
