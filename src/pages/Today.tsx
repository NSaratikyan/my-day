import { Plus, Sun } from "lucide-react";
import { Link } from "react-router-dom";
import { useData } from "../context";
import { formatDate, isOverdue, type Task } from "../model";
import { Empty, Progress, TaskSection } from "../components";
export function Today({ today, now }: { today: string; now: Date }) {
  const { tasks } = useData();
  const day = tasks.filter((t) => t.date === today);
  const top = day.filter((t) => t.isTopThree);
  const rest = day.filter((t) => !t.isTopThree);
  const sort = (a: Task, b: Task) =>
    (a.startTime ?? "99").localeCompare(b.startTime ?? "99");
  const late = tasks
    .filter((t) => isOverdue(t, now) && t.date < today)
    .sort((a, b) => a.date.localeCompare(b.date));
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="overline">{formatDate(today)}</p>
          <h1>
            {now.getHours() < 12
              ? "Բարի լույս"
              : now.getHours() < 18
                ? "Բարի օր"
                : "Բարի երեկո"}
            <span className="greeting-dot">.</span>
          </h1>
          <p className="subtitle">Այս օրը ձերն է։ Սկսենք կարևորից։</p>
        </div>
        <span className="sun-mark">
          <Sun size={27} />
        </span>
      </header>
      <Progress tasks={day} />
      <TaskSection title="Օրվա 3 գլխավորը" tasks={top.sort(sort)} top />
      {day.length === 0 && <Empty />}
      {rest.some((t) => !!t.startTime) && (
        <TaskSection
          title="Օրվա ժամանակացույցը"
          tasks={rest.filter((t) => !!t.startTime).sort(sort)}
        />
      )}
      {rest.some((t) => !t.startTime) && (
        <TaskSection
          title="Առանց ժամի"
          tasks={rest.filter((t) => !t.startTime)}
        />
      )}
      {day.some((t) => isOverdue(t, now)) && (
        <TaskSection
          title="Այսօր ուշացած"
          tasks={day.filter((t) => isOverdue(t, now))}
        />
      )}
      {late.length > 0 && (
        <TaskSection title="Նախորդ օրերից ուշացած" tasks={late} />
      )}
      <Link className="fab" to="/task/new" aria-label="Նոր առաջադրանք">
        <Plus size={29} />
      </Link>
    </>
  );
}
