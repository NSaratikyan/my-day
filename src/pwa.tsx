import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Bell, Download, WifiOff } from "lucide-react";
import { useData } from "./context";
import { deliverReminder, notificationPermission, reminderDue, reminderKey as key } from "./reminders";
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
export function Reminders({ now }: { now: Date }) {
  const { tasks } = useData();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [deliveryError, setDeliveryError] = useState(false);
  const due = tasks.filter(t => reminderDue(t, now));
  useEffect(() => {
    if (notificationPermission() !== "granted") return;
    for (const task of tasks.filter(t => reminderDue(t, now))) {
      void deliverReminder(task).catch(() => setDeliveryError(true));
    }
  }, [tasks, now]);
  return <>
    {deliveryError && <div className="warning" role="alert">
      Չհաջողվեց ուղարկել համակարգային ծանուցումը։ «Ավելին» բաժնում ստուգեք փորձնական ծանուցումը։
      <button onClick={() => setDeliveryError(false)} aria-label="Փակել ծանուցման սխալը">×</button>
    </div>}
    {due.filter(t => !dismissed.includes(key(t))).map(t => <div className="reminder" role="status" key={key(t)}>
      <Bell size={20} />
      <span><strong>{now.getTime() >= new Date(`${t.date}T${t.startTime}:00`).getTime() ? "Առաջադրանքի ժամն է" : "Մոտենում է առաջադրանքը"}</strong><br />{t.startTime} · {t.title}</span>
      <button className="icon" aria-label="Փակել հիշեցումը" onClick={() => setDismissed(d => [...d, key(t)])}>×</button>
    </div>)}
  </>;
}
