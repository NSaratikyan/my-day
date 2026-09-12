import { afterEach, expect, it } from "vitest";
import { zodiacForBirthday, dailyHoroscope } from "../zodiac";
import { PlannerDB, initialize, saveBirthday, exportData, importData } from "../db";
import { addDays, birthdaySchema } from "../model";

const databases: PlannerDB[] = [];
async function database() {
  const d = new PlannerDB(`horoscope-${crypto.randomUUID()}`);
  databases.push(d);
  await initialize(d);
  return d;
}
afterEach(async () => { for (const d of databases) await d.delete(); databases.length = 0; });

it.each([
  ["01-20", "Ջրհոս", "Այծեղջյուր"], ["02-19", "Ձկներ", "Ջրհոս"],
  ["03-21", "Խոյ", "Ձկներ"], ["04-20", "Ցուլ", "Խոյ"],
  ["05-21", "Երկվորյակներ", "Ցուլ"], ["06-21", "Խեցգետին", "Երկվորյակներ"],
  ["07-23", "Առյուծ", "Խեցգետին"], ["08-23", "Կույս", "Առյուծ"],
  ["09-23", "Կշեռք", "Կույս"], ["10-23", "Կարիճ", "Կշեռք"],
  ["11-22", "Աղեղնավոր", "Կարիճ"], ["12-22", "Այծեղջյուր", "Աղեղնավոր"],
])("detects both sides of zodiac boundary %s", (date, current, previous) => {
  expect(zodiacForBirthday(`2000-${date}`)?.name).toBe(current);
  expect(zodiacForBirthday(addDays(`2000-${date}`, -1))?.name).toBe(previous);
});
it("handles leap birthdays and year boundary", () => {
  expect(zodiacForBirthday("2000-02-29")?.name).toBe("Ձկներ");
  expect(zodiacForBirthday("2000-12-31")?.name).toBe("Այծեղջյուր");
  expect(zodiacForBirthday("2000-01-01")?.name).toBe("Այծեղջյուր");
});
it.each(["", "2001-02-29", "2020-13-01", "2999-01-01", "not a date"])("rejects invalid birthday %s", birthday => {
  expect(birthdaySchema.safeParse(birthday).success).toBe(false);
  expect(zodiacForBirthday(birthday)).toBeUndefined();
});
it("keeps today's advice stable and changes across consecutive local days", () => {
  const first = dailyHoroscope("2000-03-21", "2026-12-31");
  expect(dailyHoroscope("2000-03-21", "2026-12-31")).toEqual(first);
  expect(dailyHoroscope("2000-03-21", "2027-01-01")?.text).not.toBe(first?.text);
  expect(dailyHoroscope("2000-08-23", "2026-12-31")?.text).not.toBe(first?.text);
});
it("persists birthday after reopen, exports/imports it, and removes it", async () => {
  const a = await database(), b = await database();
  await saveBirthday("2000-02-29", a);
  a.close(); await a.open();
  expect((await a.settings.get("birthday"))?.value).toBe("2000-02-29");
  const backup = await exportData(a);
  expect(backup.birthday).toBe("2000-02-29");
  await importData(backup, b);
  expect((await b.settings.get("birthday"))?.value).toBe("2000-02-29");
  await expect(importData({ ...backup, birthday: "2001-02-29" }, b)).rejects.toThrow();
  expect((await b.settings.get("birthday"))?.value).toBe("2000-02-29");
  await saveBirthday("", a);
  expect(await a.settings.get("birthday")).toBeUndefined();
  await importData(await exportData(a), b);
  expect(await b.settings.get("birthday")).toBeUndefined();
  await expect(saveBirthday("2999-01-01", b)).rejects.toThrow("ծննդյան");
});
