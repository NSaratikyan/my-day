import { afterEach, expect, it } from "vitest";
import Dexie from "dexie";
import { PlannerDB, defaults, initialize, saveRepeatingTask, ensureRepeats, saveTask, deleteTask, exportData, importData } from "../db";
import { addDays, localDate, postpone, repeatEnd, weeklyDates, backupSchema, type Task, type TaskSeries } from "../model";
const databases: PlannerDB[] = [];
async function database() {
  const db = new PlannerDB(`repeat-${crypto.randomUUID()}`);
  databases.push(db); await initialize(db); return db;
}
afterEach(async () => { for (const db of databases) await db.delete(); databases.length = 0; });
const task = (date = localDate()): Task => ({ id: crypto.randomUUID(), title: "Անգլերեն", categoryId: defaults[0].id,
  date, priority: "medium", isTopThree: false, status: "planned", postponedCount: 0,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
it("երկու շաբաթը ներառում է առաջին օրը և տարվա սահմանը", () => {
  const series: TaskSeries = { id: "s", startDate: "2026-12-31", template: task(), enabled: true, skipped: [], options: { mode: "weeks", count: 2 } };
  expect(weeklyDates(series, "2027-12-31")).toEqual(["2026-12-31", "2027-01-07"]);
});
it("ամիսները օրացուցային են, վերջնաժամկետը՝ ներառական", () => {
  expect(repeatEnd("2026-01-31", { mode: "months", count: 3 })).toBe("2026-04-29");
  expect(repeatEnd("2024-01-31", { mode: "months", count: 1 })).toBe("2024-02-28");
  const series: TaskSeries = { id: "s", startDate: "2026-09-11", template: task(), enabled: true, skipped: [], options: { mode: "until", until: "2026-09-25" } };
  expect(weeklyDates(series, "2027-01-01")).toHaveLength(3);
});
it("կրկին բացելը չի կրկնապատկում, ավարտը և տեղափոխումը անկախ են", async () => {
  const db = await database(); const t = task();
  await saveRepeatingTask(t, { mode: "weeks", count: 2 }, undefined, db);
  const first = (await db.tasks.get(t.id))!;
  await saveTask({ ...first, status: "completed" }, undefined, db);
  const second = (await db.tasks.toArray()).find(x => x.id !== t.id)!;
  expect(second.id).not.toContain("/");
  await saveTask(postpone(second), undefined, db);
  db.close(); await db.open(); await ensureRepeats(addDays(t.date, 30), db);
  expect(await db.tasks.count()).toBe(2);
  expect((await db.tasks.get(t.id))?.status).toBe("completed");
  expect((await db.tasks.get(second.id))?.date).toBe(addDays(t.date, 8));
});
it("ջնջված մեկ կրկնությունը չի վերականգնվում", async () => {
  const db = await database(); const t = task();
  await saveRepeatingTask(t, { mode: "weeks", count: 2 }, undefined, db);
  await deleteTask((await db.tasks.get(t.id))!, db);
  await ensureRepeats(addDays(t.date, 30), db);
  expect(await db.tasks.count()).toBe(1);
});
it("անընդհատ շարքը երկարացվում է, անջատելը պահպանում է կատարվածը", async () => {
  const db = await database(); const t = task();
  await saveRepeatingTask(t, { mode: "forever" }, undefined, db);
  const first = (await db.tasks.get(t.id))!;
  await ensureRepeats(addDays(t.date, 800), db);
  expect(await db.tasks.count()).toBe(115);
  await saveRepeatingTask({ ...first, status: "completed" }, undefined, undefined, db);
  await ensureRepeats(addDays(t.date, 900), db);
  expect(await db.tasks.count()).toBe(1);
  expect((await db.tasks.get(t.id))?.status).toBe("completed");
});
it("ապագա օրվա երեք գլխավորների սահմանը պահպանվում է", async () => {
  const db = await database(); const t = task();
  for (let i = 0; i < 3; i++) await saveTask({ ...task(addDays(t.date, 7)), isTopThree: true }, undefined, db);
  await saveRepeatingTask({ ...t, isTopThree: true }, { mode: "weeks", count: 2 }, undefined, db);
  expect((await db.tasks.where("date").equals(addDays(t.date, 7)).toArray()).filter(x => x.isTopThree)).toHaveLength(3);
});
it("սխալ քանակը և ավարտը չեն պահվում", async () => {
  const db = await database(); const t = task();
  await expect(saveRepeatingTask(t, { mode: "weeks", count: 0 }, undefined, db)).rejects.toThrow();
  await expect(saveRepeatingTask(t, { mode: "until", until: addDays(t.date, -1) }, undefined, db)).rejects.toThrow();
  expect(await db.tasks.count()).toBe(0);
});
it("պահուստը ներառում է շարքերը և ընդունում է հին v1 տվյալները", async () => {
  const db = await database(); const target = await database(); const t = task();
  await saveRepeatingTask(t, { mode: "weeks", count: 2 }, undefined, db);
  const backup = await exportData(db);
  await importData(backup, target);
  await ensureRepeats(addDays(t.date, 30), target);
  expect(await target.tasks.count()).toBe(2);
  expect(await target.series.count()).toBe(1);
  expect(backupSchema.safeParse({ ...backup, series: [] }).success).toBe(false);
  const legacy = { ...backup, version: 1, tasks: [task()] };
  delete legacy.series;
  await importData(legacy, target);
  expect(await target.series.count()).toBe(0);
  expect(await target.tasks.count()).toBe(1);
});
it("v1 բազայի թարմացումը պահպանում է առաջադրանքներն ու նշումները", async () => {
  const name = `legacy-${crypto.randomUUID()}`;
  const old = new Dexie(name);
  old.version(1).stores({ tasks: "id,date,categoryId,status", categories: "id", notes: "id,&date", settings: "key" });
  const t = task();
  await old.table("tasks").put(t);
  await old.table("notes").put({ id: "note", date: t.date, thoughts: "Հին միտք", wins: "", tomorrow: "", createdAt: t.createdAt, updatedAt: t.updatedAt });
  old.close();
  const upgraded = new PlannerDB(name); databases.push(upgraded);
  await initialize(upgraded);
  expect(await upgraded.tasks.get(t.id)).toEqual(t);
  expect((await upgraded.notes.get("note"))?.thoughts).toBe("Հին միտք");
  expect(await upgraded.series.count()).toBe(0);
});
