import { useState, type FormEvent } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ArrowLeft, Check, Star } from "lucide-react";
import { useData } from "../context";
import { saveTask } from "../db";
import {
  localDate,
  postpone,
  priorities,
  statuses,
  topThreeConflicts,
  validateTask,
  type Task,
} from "../model";
export function TaskForm() {
  const { id } = useParams();
  const { tasks, categories, notify } = useData();
  const [search] = useSearchParams();
  const existing = tasks.find((t) => t.id === id);
  const now = new Date().toISOString();
  const [task, setTask] = useState<Task>(() =>
    existing
      ? search.get("move") === "1"
        ? postpone(existing)
        : { ...existing }
      : {
          id: crypto.randomUUID(),
          title: "",
          categoryId: categories[0]?.id ?? "",
          date: search.get("date") ?? localDate(),
          priority: "medium",
          isTopThree: false,
          status: "planned",
          postponedCount: 0,
          createdAt: now,
          updatedAt: now,
        },
  );
  const [error, setError] = useState("");
  const [replacement, setReplacement] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  function back() {
    if (location.key === "default") navigate("/");
    else navigate(-1);
  }
  function field<K extends keyof Task>(key: K, value: Task[K]) {
    setTask((t) => ({ ...t, [key]: value }));
    setError("");
    setReplacement("");
  }
  const conflicts = topThreeConflicts(task, tasks);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const invalid = validateTask(task, categories);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (conflicts.length >= 3 && !replacement) {
      setError(
        "Արդեն ընտրված է երեք գլխավոր առաջադրանք։ Ընտրեք՝ որին փոխարինել։",
      );
      return;
    }
    setSaving(true);
    try {
      await saveTask(
        {
          ...task,
          updatedAt: new Date().toISOString(),
          completedAt:
            task.status === "completed"
              ? (task.completedAt ?? new Date().toISOString())
              : undefined,
        },
        replacement,
      );
      notify("Առաջադրանքը պահպանված է։");
      back();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Չհաջողվեց պահպանել։ Փորձեք կրկին։",
      );
    } finally {
      setSaving(false);
    }
  }
  if (id !== "new" && !existing)
    return (
      <div className="empty">
        <h1>Առաջադրանքը չի գտնվել</h1>
        <button onClick={() => navigate("/")}>Վերադառնալ այսօր</button>
      </div>
    );
  return (
    <>
      <header className="form-heading">
        <button className="icon surface" aria-label="Վերադառնալ" onClick={back}>
          <ArrowLeft />
        </button>
        <div>
          <p className="overline">ՄԵԿ ՔԱՅԼ ԱՎԵԼԻ ՄՈՏ</p>
          <h1>{existing ? "Խմբագրել առաջադրանքը" : "Նոր առաջադրանք"}</h1>
        </div>
      </header>
      <form className="task-form" onSubmit={(e) => void submit(e)} noValidate>
        <section className="form-card">
          <label>
            Անվանում <span className="required">*</span>
            <input
              autoFocus
              maxLength={300}
              placeholder="Ի՞նչ եք ցանկանում անել"
              value={task.title}
              onChange={(e) => field("title", e.target.value)}
              required
              aria-invalid={!!error && !task.title.trim()}
            />
          </label>
          <label>
            Կատեգորիա <span className="required">*</span>
            <select
              value={task.categoryId}
              onChange={(e) => field("categoryId", e.target.value)}
              required
            >
              {categories.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              Ամսաթիվ <span className="required">*</span>
              <input
                type="date"
                value={task.date}
                onChange={(e) => field("date", e.target.value)}
                required
              />
            </label>
            <label>
              Մեկնարկի ժամ
              <input
                type="time"
                value={task.startTime ?? ""}
                onChange={(e) =>
                  field("startTime", e.target.value || undefined)
                }
              />
            </label>
          </div>
          <div className="form-grid">
            <label>
              Տևողություն (րոպե)
              <input
                type="number"
                min="1"
                max="1440"
                placeholder="Օրինակ՝ 30"
                value={task.durationMinutes ?? ""}
                onChange={(e) =>
                  field(
                    "durationMinutes",
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
              />
            </label>
            <label>
              Առաջնահերթություն
              <select
                value={task.priority}
                onChange={(e) =>
                  field("priority", e.target.value as Task["priority"])
                }
              >
                {Object.entries(priorities).map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
        <section className="form-card">
          <label className="top-toggle">
            <Star />
            <span>
              Օրվա 3 գլխավորներից է
              <small>Տվեք առաջնահերթություն կարևորին</small>
            </span>
            <input
              type="checkbox"
              checked={task.isTopThree}
              onChange={(e) => field("isTopThree", e.target.checked)}
            />
          </label>
          {conflicts.length >= 3 && (
            <div className="warning">
              <p>
                Այս օրվա համար արդեն ընտրված է երեք գլխավոր առաջադրանք։ Ո՞րն եք
                ցանկանում փոխարինել։
              </p>
              <label>
                Փոխարինվող առաջադրանքը
                <select
                  value={replacement}
                  onChange={(e) => setReplacement(e.target.value)}
                >
                  <option value="">Ընտրեք առաջադրանքը</option>
                  {conflicts.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <label>
            Հիշեցում
            <select
              value={task.reminderMinutes ?? 0}
              onChange={(e) =>
                field("reminderMinutes", Number(e.target.value) || undefined)
              }
            >
              <option value="0">Անջատված</option>
              {[5, 15, 30, 60].map((n) => (
                <option key={n} value={n}>
                  {n} րոպե առաջ
                </option>
              ))}
            </select>
          </label>
          <label>
            Կարճ նշում
            <textarea
              rows={3}
              maxLength={10000}
              placeholder="Մանրամասներ, հղումներ կամ փոքր հիշեցում…"
              value={task.notes ?? ""}
              onChange={(e) => field("notes", e.target.value)}
            />
          </label>
          <label>
            Կարգավիճակ
            <select
              value={task.status}
              onChange={(e) =>
                field("status", e.target.value as Task["status"])
              }
            >
              {Object.entries(statuses).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          {task.postponedCount > 0 && (
            <p className="muted">Տեղափոխվել է {task.postponedCount} անգամ</p>
          )}
        </section>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="secondary" onClick={back}>
            Չեղարկել
          </button>
          <button type="submit" className="primary" disabled={saving}>
            <Check size={19} />
            {saving ? "Պահպանվում է…" : "Պահպանել"}
          </button>
        </div>
      </form>
    </>
  );
}
