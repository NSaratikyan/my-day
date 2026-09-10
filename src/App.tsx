import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarDays, Sun, NotebookPen, Settings2, Check } from "lucide-react";
import { db } from "./db";
import { config } from "./config";
import { localDate } from "./model";
import { DataProvider } from "./context";
import { Today } from "./pages/Today";
import { Week } from "./pages/Week";
import { Notes } from "./pages/Notes";
import { TaskForm } from "./pages/TaskForm";
import { More } from "./pages/More";
import { PwaStatus, Reminders } from "./pwa";
export function App() {
  const [now, setNow] = useState(new Date());
  const theme = useLiveQuery(() => db.settings.get("theme"));
  const location = useLocation();
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme?.value === "dark" ||
        ((!theme || theme.value === "system") && media.matches)
          ? "dark"
          : "light";
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = setInterval(update, 15000);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const today = localDate(now);
  return (
    <DataProvider>
      <a className="skip-link" href="#main" onClick={(event) => {
        event.preventDefault();
        document.getElementById('main')?.focus();
      }}>
        Անցնել բովանդակությանը
      </a>
      <div className="app-shell">
        <div className="brand-bar">
          <Link to="/" className="brand">
            <span>
              <Check size={20} />
            </span>
            {config.name}
          </Link>
          <span className="brand-caption">ՕՐԸ՝ ՁԵՐ ՌԻԹՄՈՎ</span>
        </div>
        <PwaStatus />
        <Reminders now={now} />
        <main id="main" tabIndex={-1}>
          <Routes>
            <Route path="/" element={<Today today={today} now={now} />} />
            <Route path="/week" element={<Week today={today} />} />
            <Route path="/notes" element={<Notes today={today} />} />
            <Route path="/more" element={<More />} />
            <Route path="/task/:id" element={<TaskForm key={location.key} />} />
            <Route
              path="*"
              element={
                <div className="empty">
                  <h1>Էջը չի գտնվել</h1>
                  <Link to="/">Վերադառնալ այսօր</Link>
                </div>
              }
            />
          </Routes>
        </main>
        <nav className="bottom-nav" aria-label="Հիմնական նավիգացիա">
          {[
            { to: "/", label: "Այսօր", Icon: Sun },
            { to: "/week", label: "Շաբաթ", Icon: CalendarDays },
            { to: "/notes", label: "Նշումներ", Icon: NotebookPen },
            { to: "/more", label: "Ավելին", Icon: Settings2 },
          ].map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === "/"}>
              <span>
                <Icon size={22} />
              </span>
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </DataProvider>
  );
}
