import { useState, type FormEvent } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ArrowLeft, Check, Star } from "lucide-react";
import { useData } from "../context";
import { saveRepeatingTask } from "../db";
import {
  localDate,
  formatDate, repeatEnd,
  postpone,
  priorities,
  statuses,
  topThreeConflicts,
  validateTask,
  type Task,
  type RepeatOptions,
} from "../model";
export function TaskForm() {
  const { id } = useParams();
  const { tasks, categories, series = [], notify } = useData();
  const [search] = useSearchParams();
  const existing = tasks.find((t) => t.id === id);
  const existingSeries = series.find(s => s.id === existing?.seriesId);
  const [repeat, setRepeat] = useState<RepeatOptions | undefined>(existingSeries?.enabled ? existingSeries.options : undefined);
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
  const repeatStart = existingSeries?.startDate || task.date || localDate();
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
      await saveRepeatingTask(
        {
          ...task,
          updatedAt: new Date().toISOString(),
          completedAt:
            task.status === "completed"
              ? (task.completedAt ?? new Date().toISOString())
              : undefined,
        },
        repeat,
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
          <h2>Կրկնություն</h2>
          <label>Կրկնել
            <select value={repeat?.mode ?? "off"} onChange={e => {
              const mode = e.target.value;
              setRepeat(mode === "off" ? undefined : mode === "forever" ? { mode } : mode === "until" ? { mode, until: task.date } : { mode: mode as "weeks" | "months", count: mode === "weeks" ? 2 : 3 });
            }}>
              <option value="off">Չկրկնել / անջատել</option>
              <option value="weeks">Ամեն շաբաթ՝ որոշակի շաբաթների քանակով</option>
              <option value="months">Ամեն շաբաթ՝ որոշակի ամիսների ընթացքում</option>
              <option value="until">Ամեն շաբաթ՝ մինչև ընտրված օրը</option>
              <option value="forever">Ամեն շաբաթ՝ մինչև անջատելը</option>
            </select>
          </label>
          {repeat && <p className="muted">Ամեն {formatDate(repeatStart, { weekday: "long" })}։ Սկիզբը՝ {formatDate(repeatStart, { day: "numeric", month: "long", year: "numeric" })}։</p>}
          {(repeat?.mode === "weeks" || repeat?.mode === "months") && <label>
            {repeat.mode === "weeks" ? "Շաբաթների քանակը" : "Ամիսների քանակը"}
            <input type="number" min="1" max={repeat.mode === "weeks" ? 520 : 120} value={repeat.count || ""} onChange={e => setRepeat({ ...repeat, count: Number(e.target.value) })} />
          </label>}
          {repeat?.mode === "until" && <label>Կրկնության վերջին օրը
            <input type="date" min={existingSeries?.startDate ?? task.date} value={repeat.until} onChange={e => setRepeat({ ...repeat, until: e.target.value })} />
          </label>}
          {repeat?.mode === "weeks" && <p className="muted">Առաջին օրը ներառված է քանակի մեջ․ 2 շաբաթը նշանակում է երկու առաջադրանք։</p>}
          {repeat && repeat.mode !== "forever" && ("count" in repeat ? repeat.count > 0 && repeat.count <= 520 : !!repeat.until) && <p className="muted">Մինչև՝ {repeatEnd(repeatStart, repeat)} (ներառյալ)։</p>}
          {existingSeries && <p className="muted">Կրկնության կարգավորումները վերաբերում են ամբողջ շարքին։ Մյուս դաշտերի փոփոխությունը, կատարելը կամ ջնջելը վերաբերում են միայն այս առաջադրանքին։ Անջատելիս ապագա նախատեսված կրկնությունները կհեռացվեն, իսկ այս առաջադրանքն ու պատմությունը կմնան։</p>}
          {repeat && <p className="muted">Հաջորդ շաբաթների համար ստեղծվում են առանձին առաջադրանքներ՝ նույն անվանումով, ժամով և նշումով։ Եթե օրվա երեք գլխավորներն արդեն ընտրված են, կրկնությունը կավելացվի սովորական ցանկում։</p>}
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
