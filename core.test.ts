import { afterEach, describe, expect, it } from "vitest";
import {
  PlannerDB,
  initialize,
  saveNote,
  saveTask,
  exportData,
  importData,
  defaults,
} from "../db";
import {
  addDays,
  backupSchema,
  formatDate,
  localDate,
  monday,
  postpone,
  progress,
  toggleTask,
  validateTask,
  type Task,
} from "../model";
const sample = (changes: Partial<Task> = {}): Task => ({
  id: crypto.randomUUID(),
  title: "Կարդալ գիրք",
  date: "2026-12-31",
  categoryId: defaults[0].id,
  priority: "medium",
  isTopThree: false,
  status: "planned",
  postponedCount: 0,
  createdAt: "2026-09-10T00:00:00.000Z",
  updatedAt: "2026-09-10T00:00:00.000Z",
  ...changes,
});
const databases: PlannerDB[] = [];
async function database() {
  const d = new PlannerDB(`test-${crypto.randomUUID()}`);
  databases.push(d);
  await initialize(d);
  return d;
}
afterEach(async () => {
  for (const d of databases) await d.delete();
  databases.length = 0;
});
describe("Օրվա հաշվարկներ", () => {
  it('ամսաթվերը ցուցադրում է հայերեն՝ առանց օրվա շեղման', () => {
    expect(formatDate('2026-09-10')).toContain('սեպտեմբերի 10');
    expect(formatDate('2026-09-10')).toContain('հինգշաբթի');
    expect(formatDate('2027-01-01', {month:'long',day:'numeric'})).toContain('հունվարի 1');
  });
  it("հաշվում է օրվա առաջընթացը", () =>
    expect(
      progress([
        sample(),
        sample({ status: "completed" }),
        sample({ status: "completed" }),
      ]),
    ).toEqual({ done: 2, total: 3, percent: 67 }));
  it("բացառում է չեղարկվածը", () =>
    expect(
      progress([
        sample({ status: "completed" }),
        sample({ status: "cancelled" }),
      ]).percent,
    ).toBe(100));
  it("դատարկ օրվա առաջընթացը զրո է", () =>
    expect(progress([]).percent).toBe(0));
  it("վերականգնում է նախորդ կարգավիճակը", () =>
    expect(
      toggleTask(toggleTask(sample({ status: "in_progress" }))).status,
    ).toBe("in_progress"));
  it("տեղափոխում է հաջորդ տեղական օրը", () => {
    const moved = postpone(
      sample({ date: "2026-09-10", status: "completed", postponedCount: 2 }),
    );
    expect(moved.date).toBe("2026-09-11");
    expect(moved.status).toBe("planned");
    expect(moved.postponedCount).toBe(3);
    expect(moved.completedAt).toBeUndefined();
  });
  it.each([
    ["2026-12-31", "2027-01-01"],
    ["2026-04-30", "2026-05-01"],
    ["2024-02-28", "2024-02-29"],
    ["2024-02-29", "2024-03-01"],
  ])("ճիշտ է սահմանային օրը %s", (date, next) =>
    expect(postpone(sample({ date })).date).toBe(next),
  );
  it("օրվա հաշվարկում UTC չի օգտագործում", () => {
    expect(localDate(new Date(2026, 0, 1, 0, 1))).toBe("2026-01-01");
    expect(addDays("2026-03-29")).toBe("2026-03-30");
    expect(monday("2026-09-13")).toBe("2026-09-07");
  });
});
describe("Տվյալների ամբողջականություն", () => {
  it("չի պահպանում չորրորդ գլխավորը և թույլ է տալիս փոխարինել", async () => {
    const d = await database();
    const tops = [
      sample({ isTopThree: true }),
      sample({ isTopThree: true }),
      sample({ isTopThree: true }),
    ];
    for (const t of tops) await saveTask(t, undefined, d);
    const fourth = sample({ isTopThree: true });
    await expect(saveTask(fourth, undefined, d)).rejects.toThrow("երեք");
    await saveTask(fourth, tops[0].id, d);
    expect((await d.tasks.toArray()).filter((t) => t.isTopThree)).toHaveLength(
      3,
    );
    expect((await d.tasks.get(tops[0].id))?.isTopThree).toBe(false);
  });
  it("վավերացնում է պարտադիր դաշտերը", () => {
    expect(validateTask(sample({ title: "  " }), defaults)).toContain(
      "անվանումը",
    );
    expect(validateTask(sample({ categoryId: "" }), defaults)).toContain(
      "կատեգորիան",
    );
    expect(validateTask(sample({ date: "" }), defaults)).toContain("ամսաթիվ");
    expect(validateTask(sample({ date: "2026-02-30" }), defaults)).toContain(
      "ամսաթիվ",
    );
    expect(
      validateTask(sample({ durationMinutes: -5 }), defaults),
    ).toBeTruthy();
  });
  it("պահպանում և նորից բեռնում է օրվա գրառումը", async () => {
    const d = await database();
    const values = { thoughts: "Միտք", wins: "Ավարտեցի", tomorrow: "Կարդալ" };
    await saveNote("2026-09-10", values, d);
    d.close();
    await d.open();
    expect(
      await d.notes.where("date").equals("2026-09-10").first(),
    ).toMatchObject(values);
    await saveNote("2026-09-10", { ...values, wins: "Նոր հաղթանակ" }, d);
    expect(await d.notes.count()).toBe(1);
  });
  it("արտահանում և ներմուծում է տվյալները", async () => {
    const a = await database();
    const b = await database();
    await saveTask(sample(), undefined, a);
    await saveNote(
      "2026-09-10",
      { thoughts: "Մտքեր", wins: "", tomorrow: "" },
      a,
    );
    const backup = await exportData(a);
    expect(backupSchema.safeParse(backup).success).toBe(true);
    await importData(backup, b);
    expect(await b.tasks.count()).toBe(1);
    expect(await b.notes.count()).toBe(1);
  });
  it("սխալ ներմուծումը չի փոխում եղած տվյալները", async () => {
    const d = await database();
    await saveTask(sample(), undefined, d);
    const backup = await exportData(d);
    await expect(
      importData({ ...backup, tasks: [sample({ categoryId: "missing" })] }, d),
    ).rejects.toThrow();
    await expect(
      importData({ ...backup, tasks: [sample({ title: "" })] }, d),
    ).rejects.toThrow();
    await expect(importData({ ...backup, version: 2 }, d)).rejects.toThrow();
    expect(await d.tasks.count()).toBe(1);
  });
  it("մերժում է կրկնվող id-ներն ու չորս գլխավորները", async () => {
    const d = await database();
    const b = await exportData(d);
    const t = sample();
    expect(backupSchema.safeParse({ ...b, tasks: [t, t] }).success).toBe(false);
    expect(
      backupSchema.safeParse({
        ...b,
        tasks: Array.from({ length: 4 }, () => sample({ isTopThree: true })),
      }).success,
    ).toBe(false);
  });
  it("սկզբնական կատեգորիաները կրկին չի ավելացնում", async () => {
    const d = await database();
    await initialize(d);
    expect(await d.categories.count()).toBe(9);
  });
});
