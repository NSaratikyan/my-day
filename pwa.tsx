import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Bell, Download, WifiOff } from "lucide-react";
import { useData } from "./context";
import { config } from "./config";
import type { Task } from "./model";
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
let pendingInstall: InstallEvent | null = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  pendingInstall = e as InstallEvent;
});
export function PwaStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return (
    <>
      {!online && (
        <div className="offline" role="status">
          <WifiOff size={16} />
          Անցանց եք․ փոփոխությունները պահվում են սարքում։
        </div>
      )}
      {needRefresh && (
        <div className="update-banner" role="status">
          <span>Նոր տարբերակը պատրաստ է։</span>
          <button onClick={() => void updateServiceWorker(true)}>
            Թարմացնել
          </button>
          <button
            aria-label="Հետաձգել թարմացումը"
            onClick={() => setNeedRefresh(false)}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
export function InstallHelp() {
  const [install, setInstall] = useState<InstallEvent | null>(pendingInstall);
  const [installed, setInstalled] = useState(
    window.matchMedia("(display-mode: standalone)").matches,
  );
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    const done = () => {
      setInstalled(true);
      setInstall(null);
      pendingInstall = null;
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  return (
    <section className="settings-card">
      <h2>
        <Download size={20} />
        Տեղադրել հեռախոսում
      </h2>
      {installed ? (
        <p>Հավելվածն արդեն աշխատում է առանձին պատուհանում։</p>
      ) : (
        <>
          {install && (
            <button
              className="primary"
              onClick={async () => {
                await install.prompt();
                await install.userChoice;
                setInstall(null);
                pendingInstall = null;
              }}
            >
              Տեղադրել հավելվածը
            </button>
          )}
          <p>
            <strong>Android․</strong> Chrome-ի մենյուից ընտրեք «Տեղադրել
            հավելվածը» կամ «Ավելացնել գլխավոր էկրանին»։
          </p>
          <p>
            <strong>iPhone․</strong> Բացեք Safari-ով, սեղմեք «Կիսվել» (Share),
            ապա «Add to Home Screen»։
          </p>
        </>
      )}
      <p className="muted">
        Առաջին անգամ բացեք ինտերնետով։ Հետո պլաններն ու նշումները հասանելի
        կլինեն նաև անցանց։
      </p>
    </section>
  );
}
export interface ReminderDelivery {
  send: (task: Task) => Promise<void>;
}
export const browserDelivery: ReminderDelivery = {
  async send(task) {
    if ("Notification" in window && Notification.permission === "granted") {
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration)
        await registration.showNotification(config.name, {
          body: `${task.startTime} · ${task.title}`,
          tag: `task-${task.id}`,
          icon: `${import.meta.env.BASE_URL}icon-192.png`,
        });
      else new Notification(config.name, { body: task.title, tag: task.id });
    }
  },
};
export function Reminders({ now }: { now: Date }) {
  const { tasks } = useData();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const due = tasks.filter((t) => {
    if (
      !t.reminderMinutes ||
      !t.startTime ||
      ["completed", "cancelled"].includes(t.status)
    )
      return false;
    const start = new Date(`${t.date}T${t.startTime}:00`).getTime();
    return (
      now.getTime() >= start - t.reminderMinutes * 60000 &&
      now.getTime() < start + 60000
    );
  });
  const key = (t: Task) =>
    `${t.id}-${t.date}-${t.startTime}-${t.reminderMinutes}`;
  useEffect(() => {
    for (const t of tasks) {
      if (
        !t.startTime ||
        !t.reminderMinutes ||
        ["completed", "cancelled"].includes(t.status)
      )
        continue;
      const start = new Date(`${t.date}T${t.startTime}:00`).getTime();
      const k = key(t);
      if (
        now.getTime() >= start - t.reminderMinutes * 60000 &&
        now.getTime() < start + 60000 &&
        sessionStorage.getItem(k) !== "sent" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        sessionStorage.setItem(k, "sent");
        void browserDelivery.send(t).catch(() => sessionStorage.removeItem(k));
      }
    }
  }, [tasks, now]);
  return (
    <>
      {due
        .filter((t) => !dismissed.includes(key(t)))
        .map((t) => (
          <div className="reminder" role="status" key={key(t)}>
            <Bell size={20} />
            <span>
              <strong>Մոտենում է առաջադրանքը</strong>
              <br />
              {t.startTime} · {t.title}
            </span>
            <button
              className="icon"
              aria-label="Փակել հիշեցումը"
              onClick={() => setDismissed((d) => [...d, key(t)])}
            >
              ×
            </button>
          </div>
        ))}
    </>
  );
}
