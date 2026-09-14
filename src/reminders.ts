import { config } from "./config";
import type { Task } from "./model";

export function reminderKey(task: Task) {
  return `${task.id}-${task.date}-${task.startTime}-${task.reminderMinutes}`;
}

export function reminderDue(task: Task, now: Date) {
  if (task.reminderMinutes === undefined || !task.startTime ||
    !["planned", "in_progress"].includes(task.status)) return false;
  const start = new Date(`${task.date}T${task.startTime}:00`).getTime();
  // Keep a short catch-up window when an active tab resumes after throttling.
  return now.getTime() >= start - task.reminderMinutes * 60000 && now.getTime() < start + 15 * 60000;
}

export function notificationPermission() {
  return "Notification" in window ? Notification.permission : "unsupported";
}

export async function showNotification(body: string, tag: string) {
  if (notificationPermission() !== "granted")
    throw new Error("Համակարգային ծանուցումների թույլտվությունը միացված չէ։");
  const registration = await navigator.serviceWorker?.getRegistration();
  const options = { body, tag, icon: `${import.meta.env.BASE_URL}icon-192.png` };
  if (registration?.active) await registration.showNotification(config.name, options);
  else {
    try { new Notification(config.name, options); }
    catch { throw new Error("Ծանուցման ծառայությունը պատրաստ չէ։ Կրկին բացեք տեղադրված հավելվածը և փորձեք։"); }
  }
}

export interface ReminderDelivery { send: (task: Task) => Promise<void> }
export const browserDelivery: ReminderDelivery = {
  send: task => showNotification(`${task.startTime} · ${task.title}`, `task-${reminderKey(task)}`),
};

// Mark delivery only after success. A failed attempt can be retried; concurrent
// renders share the same in-flight guard. Storage may be unavailable in browsers.
const sending = new Set<string>();
const sent = new Set<string>();
export async function deliverReminder(task: Task, delivery = browserDelivery) {
  const key = reminderKey(task);
  let recorded = false;
  try { recorded = sessionStorage.getItem(key) === "sent"; } catch { /* Memory fallback. */ }
  if (sending.has(key) || sent.has(key) || recorded) return;
  sending.add(key);
  try {
    await delivery.send(task);
    sent.add(key);
    try { sessionStorage.setItem(key, "sent"); } catch { /* Memory fallback. */ }
  } finally { sending.delete(key); }
}
