import { createContext, useContext, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import type { Task, Category } from "./model";
type Data = {
  tasks: Task[];
  categories: Category[];
  notify: (message: string) => void;
  run: (action: () => Promise<unknown>, message?: string) => Promise<boolean>;
};
const Context = createContext<Data | null>(null);
export function DataProvider({ children }: { children: ReactNode }) {
  const tasks = useLiveQuery(() => db.tasks.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const [toast, setToast] = useState("");
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout>>();
  function notify(message: string) {
    clearTimeout(timer);
    setToast(message);
    setTimer(setTimeout(() => setToast(""), 5000));
  }
  async function run(action: () => Promise<unknown>, message?: string) {
    try {
      await action();
      if (message) notify(message);
      return true;
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Չհաջողվեց պահպանել։ Փորձեք կրկին։",
      );
      return false;
    }
  }
  if (!tasks || !categories)
    return (
      <main className="loading" role="status">
        Բեռնվում է…
      </main>
    );
  return (
    <Context.Provider value={{ tasks, categories, notify, run }}>
      {children}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button
            aria-label="Փակել հաղորդագրությունը"
            onClick={() => setToast("")}
          >
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export function useData() {
  const c = useContext(Context);
  if (!c) throw new Error("Տվյալները հասանելի չեն։");
  return c;
}
