import { useEffect, useRef, useState } from "react";
import { Check, PenLine, Sparkles, ArrowUpRight } from "lucide-react";
import { db, saveNote } from "../db";
import { DayPicker } from "../components";
type Values = { thoughts: string; wins: string; tomorrow: string };
export function Notes({ today }: { today: string }) {
  const [date, setDate] = useState(today);
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="overline">ՄԻ ՓՈՔՐ ԴԱԴԱՐ՝ ՁԵԶ ՀԱՄԱՐ</p>
          <h1>Օրվա նշումներ</h1>
          <p className="subtitle">Մտքերը գրեք։ Կարևորը պահեք։</p>
        </div>
        <PenLine className="heading-icon" />
      </header>
      <DayPicker date={date} onChange={setDate} />
      <NoteEditor key={date} date={date} />
    </>
  );
}
function NoteEditor({ date }: { date: string }) {
  const [values, setValues] = useState<Values>({
    thoughts: "",
    wins: "",
    tomorrow: "",
  });
  const [status, setStatus] = useState("Բեռնվում է…");
  const [ready, setReady] = useState(false);
  const latest = useRef<Values | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  const revision = useRef(0);
  async function persist(v: Values, rev: number) {
    try {
      await saveNote(date, v);
      if (mounted.current && revision.current === rev) {
        latest.current = null;
        setStatus("Փոփոխությունները պահպանված են");
      }
    } catch {
      if (mounted.current) setStatus("Չհաջողվեց պահպանել։ Փորձեք կրկին։");
    }
  }
  useEffect(() => {
    mounted.current = true;
    void db.notes
      .where("date")
      .equals(date)
      .first()
      .then((note) => {
        if (mounted.current) {
          if (note)
            setValues({
              thoughts: note.thoughts,
              wins: note.wins,
              tomorrow: note.tomorrow,
            });
          setReady(true);
          setStatus("Փոփոխությունները պահպանված են");
        }
      })
      .catch(() => {
        if (mounted.current)
          setStatus("Չհաջողվեց բեռնել գրառումը։ Թարմացրեք էջը։");
      });
    const flush = () => {
      if (latest.current) {
        clearTimeout(timer.current);
        void saveNote(date, latest.current);
      }
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [date]);
  function change(key: keyof Values, value: string) {
    const next = { ...values, [key]: value };
    setValues(next);
    latest.current = next;
    revision.current++;
    setStatus("Պահպանվում է…");
    clearTimeout(timer.current);
    const rev = revision.current;
    timer.current = setTimeout(() => void persist(next, rev), 450);
  }
  return (
    <>
      <div
        className={`save-status ${status.startsWith("Չ") ? "danger-text" : ""}`}
        role="status"
      >
        <Check size={15} />
        {status}
        {status.startsWith("Չհաջողվեց պահպանել") && (
          <button onClick={() => void persist(values, revision.current)}>
            Կրկին փորձել
          </button>
        )}
      </div>
      <div className="note-fields">
        {(
          [
            {
              key: "thoughts",
              title: "Օրվա մտքեր",
              hint: "Ի՞նչ կա ձեր մտքում։ Այստեղ կարող եք գրել ազատ ու անկաշկանդ…",
              Icon: PenLine,
            },
            {
              key: "wins",
              title: "Ի՞նչ ստացվեց այսօր",
              hint: "Նույնիսկ փոքր հաղթանակները կարևոր են։ Ի՞նչն այսօր ուրախացրեց ձեզ…",
              Icon: Sparkles,
            },
            {
              key: "tomorrow",
              title: "Ի՞նչ տեղափոխել կամ հիշել վաղվա համար",
              hint: "Մի միտք, անավարտ գործ կամ խոստում վաղվա ձեզ…",
              Icon: ArrowUpRight,
            },
          ] as const
        ).map(({ key, title, hint, Icon }, i) => (
          <section className="note-card" key={key}>
            <label>
              <span className="note-label">
                <span className={`note-icon note-icon-${i}`}>
                  <Icon size={20} />
                </span>
                {title}
              </span>
              <textarea
                disabled={!ready}
                rows={5}
                maxLength={100000}
                placeholder={hint}
                value={values[key]}
                onChange={(e) => change(key, e.target.value)}
                onBlur={() => {
                  if (latest.current) {
                    clearTimeout(timer.current);
                    void persist(latest.current, revision.current);
                  }
                }}
              />
            </label>
          </section>
        ))}
      </div>
      <p className="note-footer">Միայն ձեզ համար։ Պահպանվում է այս սարքում։</p>
    </>
  );
}
