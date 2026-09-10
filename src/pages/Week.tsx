import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useData } from "../context";
import {
  addDays,
  formatDate,
  monday,
  parseDate,
  progress,
  isOverdue,
} from "../model";
import { Empty, Progress, TaskSection } from "../components";
export function Week({ today }: { today: string }) {
  const { tasks } = useData();
  const [selected, setSelected] = useState(today);
  const start = monday(selected);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const week = tasks.filter((t) => dates.includes(t.date));
  const day = tasks
    .filter((t) => t.date === selected)
    .sort((a, b) => (a.startTime ?? "99").localeCompare(b.startTime ?? "99"));
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="overline">ՄԵԿ ՇԱԲԱԹ, ՓՈՔՐ ՔԱՅԼԵՐ</p>
          <h1>Շաբաթ</h1>
          <p className="subtitle">Տեսեք ամբողջ պատկերը։</p>
        </div>
        <Link
          className="icon surface"
          aria-label="Նոր առաջադրանք"
          to={`/task/new?date=${selected}`}
        >
          <Plus />
        </Link>
      </header>
      <div className="week-range">
        <button
          className="icon"
          aria-label="Նախորդ շաբաթ"
          onClick={() => setSelected(addDays(selected, -7))}
        >
          <ChevronLeft />
        </button>
        <strong>
          {formatDate(start, { month: "short", day: "numeric" })} —{" "}
          {formatDate(addDays(start, 6), {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </strong>
        <button
          className="icon"
          aria-label="Հաջորդ շաբաթ"
          onClick={() => setSelected(addDays(selected, 7))}
        >
          <ChevronRight />
        </button>
      </div>
      <div className="week-days">
        {dates.map((date) => {
          const p = progress(tasks.filter((t) => t.date === date));
          return (
            <button
              key={date}
              className={`${selected === date ? "selected" : ""} ${date === today ? "is-today" : ""}`}
              aria-pressed={selected === date}
              aria-label={`${formatDate(date)}․ ${p.done} կատարված՝ ${p.total} առաջադրանքից`}
              onClick={() => setSelected(date)}
            >
              <span>{formatDate(date, { weekday: "short" })}</span>
              <strong>{parseDate(date).getDate()}</strong>
              <small>
                {p.done}/{p.total}
              </small>
            </button>
          );
        })}
      </div>
      <Progress tasks={week} week />
      <div className="section-title">
        <h2>
          {formatDate(selected, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </h2>
        <button className="text-button" onClick={() => setSelected(today)}>
          Այսօր
        </button>
      </div>
      {day.length ? (
        <TaskSection title="Առաջադրանքներ" tasks={day} />
      ) : (
        <Empty
          date={selected}
          text="Այս օրվա համար դեռ առաջադրանք չկա։ Պլանավորեք այն ձեր ռիթմով։"
        />
      )}
      {tasks.some((t) => isOverdue(t)) && (
        <TaskSection
          title="Ուշացած առաջադրանքներ"
          tasks={tasks.filter((t) => isOverdue(t))}
        />
      )}
    </>
  );
}
