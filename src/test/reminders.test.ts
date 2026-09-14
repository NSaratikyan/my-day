import { expect, it, vi } from "vitest";
import { deliverReminder, reminderDue, reminderKey, showNotification } from "../reminders";
import { defaults } from "../db";
import { validateTask, type Task } from "../model";

const sample = (changes: Partial<Task> = {}): Task => ({
  id: crypto.randomUUID(), title: "Հանդիպում", date: "2026-09-14", startTime: "10:00",
  reminderMinutes: 0, categoryId: defaults[0].id, priority: "medium", isTopThree: false,
  status: "planned", postponedCount: 0, createdAt: "2026-09-14T00:00:00.000Z", updatedAt: "2026-09-14T00:00:00.000Z", ...changes,
});
it("supports start-time reminders without enabling disabled reminders", () => {
  const now = new Date(2026, 8, 14, 10);
  expect(reminderDue(sample(), now)).toBe(true);
  expect(reminderDue(sample({ reminderMinutes: undefined }), now)).toBe(false);
  expect(reminderDue(sample(), new Date(2026, 8, 14, 9, 59))).toBe(false);
  expect(validateTask(sample(), defaults)).toBeFalsy();
  expect(validateTask(sample({ startTime: undefined }), defaults)).toBeTruthy();
});
it("uses local time and the selected advance reminder across midnight", () => {
  const task = sample({ startTime: "00:05", reminderMinutes: 15 });
  expect(reminderDue(task, new Date(2026, 8, 13, 23, 49))).toBe(false);
  expect(reminderDue(task, new Date(2026, 8, 13, 23, 50))).toBe(true);
});
it("catches up briefly after resuming and excludes inactive tasks", () => {
  expect(reminderDue(sample(), new Date(2026, 8, 14, 10, 5))).toBe(true);
  expect(reminderDue(sample(), new Date(2026, 8, 14, 10, 15))).toBe(false);
  for (const status of ["completed", "cancelled", "postponed"] as const)
    expect(reminderDue(sample({ status }), new Date(2026, 8, 14, 10))).toBe(false);
});
it("retries failed delivery and deduplicates successful sends", async () => {
  const task = sample();
  const delivery = { send: vi.fn().mockRejectedValueOnce(new Error("failed")).mockResolvedValue(undefined) };
  await expect(deliverReminder(task, delivery)).rejects.toThrow("failed");
  expect(sessionStorage.getItem(reminderKey(task))).toBeNull();
  await deliverReminder(task, delivery);
  await deliverReminder(task, delivery);
  expect(delivery.send).toHaveBeenCalledTimes(2);
  expect(sessionStorage.getItem(reminderKey(task))).toBe("sent");
});
it("does not send twice while delivery is in progress", async () => {
  const task = sample();
  let finish!: () => void;
  const delivery = { send: vi.fn(() => new Promise<void>(resolve => { finish = resolve; })) };
  const first = deliverReminder(task, delivery);
  await deliverReminder(task, delivery);
  expect(delivery.send).toHaveBeenCalledTimes(1);
  finish(); await first;
});
it("reports blocked notification permission", async () => {
  vi.stubGlobal("Notification", { permission: "denied" });
  try { await expect(showNotification("test", "test")).rejects.toThrow("թույլտվությունը"); }
  finally { vi.unstubAllGlobals(); }
});
it("uses persistent service-worker notifications on mobile", async () => {
  const notify = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("Notification", { permission: "granted" });
  vi.stubGlobal("navigator", { serviceWorker: { getRegistration: vi.fn().mockResolvedValue({ active: {}, showNotification: notify }) } });
  try {
    await showNotification("Հանդիպում", "meeting");
    expect(notify).toHaveBeenCalledWith("Իմ օրը", expect.objectContaining({ body: "Հանդիպում", tag: "meeting" }));
  } finally { vi.unstubAllGlobals(); }
});
