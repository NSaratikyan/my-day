import {
  Check,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Star,
  Sun,
  CalendarCheck,
  ArrowUpRight,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { db, saveTask } from "./db";
import { useData } from "./context";
import {
  addDays,
  formatDate,
  localDate,
  postpone,
  progress,
  statuses,
  toggleTask,
  type Task,
} from "./model";
export function DayPicker({
  date,
  onChange,
}: {
  date: string;
  onChange: (date: string) => void;
}) {
  return (
    <div className="day-picker">
      <button
        className="icon"
        aria-label="Նախորդ օրը"
        onClick={() => onChange(addDays(date, -1))}
      >
        <ChevronLeft />
      </button>
      <label className="date-label">
        <span>
          {formatDate(date, { month: "long", day: "numeric", year: "numeric" })}
        </span>
        <input
          aria-label="Ընտրել ամսաթիվը"
          type="date"
          value={date}
          onChange={(e) => e.target.value && onChange(e.target.value)}
        />
      </label>
      <button
        className="icon"
        aria-label="Հաջորդ օրը"
        onClick={() => onChange(addDays(date))}
      >
        <ChevronRight />
      </button>
    </div>
  );
}
export function Progress({
  tasks,
  week = false,
}: {
  tasks: Task[];
  week?: boolean;
}) {
  const p = progress(tasks);
  return (
    <section
      className="progress-card"
      aria-label={week ? "Շաբաթվա առաջընթացը" : "Օրվա առաջընթացը"}
    >
      <div>
        <span className="eyebrow">
          {week ? "ՇԱԲԱԹՎԱ ՌԻԹՄԸ" : "ՔԱՅԼ ԱՌ ՔԱՅԼ"}
        </span>
        <h2>{week ? "Շաբաթվա առաջընթացը" : "Ձեր օրվա առաջընթացը"}</h2>
        <p>
          {p.done} / {p.total} առաջադրանք կատարված է
        </p>
        <div className="progress-track">
          <span style={{ width: `${p.percent}%` }} />
        </div>
      </div>
      <div
        className="ring"
        style={{
          background: `conic-gradient(#b7ead8 ${p.percent}%, #ffffff26 0)`,
        }}
      >
        <div>
          <strong>
            {p.percent}
            <small>%</small>
          </strong>
          <Check size={17} />
        </div>
      </div>
    </section>
  );
}
export function Empty({
  text = "Այսօրվա պլանը դեռ դատարկ է։ Ավելացրեք առաջին առաջադրանքը։",
  date = localDate(),
  action = true,
}: {
  text?: string;
  date?: string;
  action?: boolean;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <CalendarCheck size={30} />
      </span>
      <h3>Տեղ՝ նոր սկիզբների համար</h3>
      <p>{text}</p>
      {action && (
        <Link className="text-button" to={`/task/new?date=${date}`}>
          <Plus size={18} />
          Ավելացնել առաջադրանք
        </Link>
      )}
    </div>
  );
}
export function TaskCard({ task }: { task: Task }) {
  const { categories, run, notify, tasks } = useData();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const category = categories.find((c) => c.id === task.categoryId);
  async function move() {
    if (
      task.status === "completed" &&
      !confirm("Այս առաջադրանքն արդեն կատարված է։ Տեղափոխե՞լ հաջորդ օրը։")
    )
      return;
    const moved = postpone(task);
    if (
      moved.isTopThree &&
      tasks.filter(
        (t) => t.date === moved.date && t.isTopThree && t.id !== task.id,
      ).length >= 3
    ) {
      notify(
        "Հաջորդ օրվա երեք գլխավորներն արդեն ընտրված են։ Խմբագրման էջում ընտրեք փոխարինվող առաջադրանքը։",
      );
      navigate(`/task/${task.id}?move=1`);
      return;
    }
    await run(() => saveTask(moved), "Առաջադրանքը տեղափոխվել է հաջորդ օրը։");
  }
  async function action(name: string) {
    setMenu(false);
    if (name === "edit") navigate(`/task/${task.id}`);
    if (name === "start")
      await run(
        () =>
          saveTask({
            ...task,
            status: "in_progress",
            completedAt: undefined,
            updatedAt: new Date().toISOString(),
          }),
        "Առաջադրանքը սկսված է։",
      );
    if (name === "done")
      await run(() => saveTask(toggleTask(task)), "Կարգավիճակը փոխված է։");
    if (name === "move") await move();
    if (name === "cancel")
      await run(
        () =>
          saveTask({
            ...task,
            status: "cancelled",
            completedAt: undefined,
            updatedAt: new Date().toISOString(),
          }),
        "Առաջադրանքը չեղարկված է։",
      );
    if (
      name === "delete" &&
      confirm("Ջնջե՞լ այս առաջադրանքը։ Այն վերականգնել հնարավոր չի լինի։")
    )
      await run(() => db.tasks.delete(task.id), "Առաջադրանքը ջնջված է։");
  }
  return (
    <article
      className={`task-card ${task.status === "completed" ? "completed" : ""}`}
    >
      <button
        className="check-button"
        aria-label={
          task.status === "completed"
            ? `Վերականգնել՝ ${task.title}`
            : `Նշել կատարված՝ ${task.title}`
        }
        aria-pressed={task.status === "completed"}
        onClick={() => void action("done")}
      >
        <span>{task.status === "completed" && <Check size={16} />}</span>
      </button>
      <button
        className="task-body"
        onClick={() => navigate(`/task/${task.id}`)}
      >
        <span className="task-title">{task.title}</span>
        <span className="task-meta">
          <span className="category" style={{ borderColor: category?.color }}>
            {category?.name}
          </span>
          {task.startTime && <span>{task.startTime}</span>}
          {task.durationMinutes && <span>{task.durationMinutes} ր.</span>}
          {task.priority === "high" && <span className="high">Բարձր</span>}
        </span>
        {task.status !== "planned" && (
          <span className="status-label">{statuses[task.status]}</span>
        )}
        {task.postponedCount > 0 && (
          <span className="status-label">
            Տեղափոխվել է {task.postponedCount} անգամ
          </span>
        )}
      </button>
      <div className="task-side">
        {task.isTopThree && <Star className="star" size={15} />}
        <button
          className="icon"
          aria-label={`Գործողություններ՝ ${task.title}`}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          <MoreHorizontal size={20} />
        </button>
      </div>
      {menu && (
        <>
          <button
            className="menu-scrim"
            aria-label="Փակել գործողությունները"
            onClick={() => setMenu(false)}
          />
          <div
            className="task-menu"
            onKeyDown={(e) => e.key === "Escape" && setMenu(false)}
          >
            {[
              ["edit", "Խմբագրել"],
              ["start", "Սկսել"],
              [
                "done",
                task.status === "completed"
                  ? "Վերականգնել կարգավիճակը"
                  : "Նշել կատարված",
              ],
              ["move", "Տեղափոխել վաղվան"],
              ["cancel", "Չեղարկել"],
              ["delete", "Ջնջել"],
            ].map(([id, label]) => (
              <button
                className={id === "delete" ? "danger-text" : ""}
                key={id}
                onClick={() => void action(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </article>
  );
}
export function TaskSection({
  title,
  tasks,
  top = false,
}: {
  title: string;
  tasks: Task[];
  top?: boolean;
}) {
  return (
    <section className="task-section">
      <div className="section-title">
        <h2>
          {top && <Star size={19} />} {title}
        </h2>
        <span>{top ? `${tasks.length} / 3` : tasks.length}</span>
      </div>
      {tasks.length ? (
        <div className="task-list">
          {tasks.map((t) => (
            <TaskCard task={t} key={t.id} />
          ))}
        </div>
      ) : top ? (
        <div className="top-empty">
          <Sun size={22} />
          <p>Ընտրեք այն երեքը, որոնք այսօր իսկապես կարևոր են։</p>
          <Link to="/task/new">
            <ArrowUpRight size={22} />
            <span className="sr-only">Ընտրել գլխավոր առաջադրանք</span>
          </Link>
        </div>
      ) : null}
    </section>
  );
}
