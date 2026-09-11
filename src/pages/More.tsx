import { useState, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Bell,
  Download,
  Upload,
  Trash2,
  Plus,
  Pencil,
  Check,
  Tags,
  Palette,
  ShieldCheck,
} from "lucide-react";
import { config } from "../config";
import {
  clearData,
  db,
  deleteCategory,
  exportData,
  importData,
  setTheme,
  setSeriesEnabled,
} from "../db";
import { useData } from "../context";
import { backupSchema, localDate, type Category, type Theme } from "../model";
import { InstallHelp } from "../pwa";
export function More() {
  const { categories, series, run, notify, tasks } = useData();
  const theme = useLiveQuery(() => db.settings.get("theme"));
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#167C70");
  const [removing, setRemoving] = useState("");
  const [replacement, setReplacement] = useState("");
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState(
    "Notification" in window ? Notification.permission : "unsupported",
  );
  async function categorySubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      notify("Մուտքագրեք կատեգորիայի անվանումը։");
      return;
    }
    if (
      categories.some(
        (c) => c.name.trim() === name.trim() && c.id !== editing?.id,
      )
    ) {
      notify("Այս անունով կատեգորիա արդեն կա։");
      return;
    }
    if (
      await run(
        () =>
          db.categories.put({
            id: editing?.id ?? crypto.randomUUID(),
            name: name.trim(),
            color,
            isDefault: editing?.isDefault ?? false,
          }),
        "Կատեգորիան պահպանված է։",
      )
    ) {
      setName("");
      setEditing(null);
    }
  }
  async function download() {
    await run(async () => {
      const blob = new Blob([JSON.stringify(await exportData(), null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `im-ory-${localDate()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }, "Պահուստային պատճենը պատրաստ է։");
  }
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      notify("Ֆայլը չափազանց մեծ է։ Առավելագույնը՝ 20 ՄԲ։");
      return;
    }
    setBusy(true);
    try {
      const data = backupSchema.safeParse(JSON.parse(await file.text()));
      if (!data.success)
        throw new Error(
          "Ֆայլի կառուցվածքը կամ տվյալները սխալ են։ Ներմուծումը չի կատարվել։",
        );
      if (
        confirm(
          `Ներմուծե՞լ ${data.data.tasks.length} առաջադրանք և ${data.data.notes.length} գրառում։ Ընթացիկ տվյալներն ամբողջությամբ կփոխարինվեն։`,
        )
      )
        await run(() => importData(data.data), "Տվյալները ներմուծված են։");
    } catch (e) {
      notify(
        e instanceof SyntaxError
          ? "Ֆայլը վավեր JSON չէ։"
          : e instanceof Error
            ? e.message
            : "Չհաջողվեց կարդալ ֆայլը։",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="overline">ՁԵՐ ՏԱՐԱԾՔԸ, ՁԵՐ ՁԵՎՈՎ</p>
          <h1>Ավելին</h1>
          <p className="subtitle">Փոքր կարգավորումներ՝ հարմար օրվա համար։</p>
        </div>
      </header>
      <section className="settings-card">
        <h2>
          <Palette size={20} />
          Արտաքին տեսք
        </h2>
        <fieldset className="theme-choice">
          <legend className="sr-only">Թեմայի ընտրություն</legend>
          {(["system", "light", "dark"] as const).map((v, i) => (
            <label
              key={v}
              className={(theme?.value ?? "system") === v ? "active" : ""}
            >
              <input
                type="radio"
                name="theme"
                value={v}
                checked={(theme?.value ?? "system") === v}
                onChange={() => void run(() => setTheme(v as Theme))}
              />
              {["Համակարգային", "Բաց", "Մուգ"][i]}
            </label>
          ))}
        </fieldset>
      </section>
      <section className="settings-card">
        <h2>
          <Tags size={20} />
          Կատեգորիաներ <span className="count">{categories.length}</span>
        </h2>
        <div className="category-list">
          {categories.map((c) => (
            <div className="category-row" key={c.id}>
              <span className="color-dot" style={{ background: c.color }} />
              <span>{c.name}</span>
              <button
                className="icon"
                aria-label={`Խմբագրել՝ ${c.name}`}
                onClick={() => {
                  setEditing(c);
                  setName(c.name);
                  setColor(c.color);
                }}
              >
                <Pencil size={17} />
              </button>
              <button
                className="icon danger-text"
                aria-label={`Հեռացնել՝ ${c.name}`}
                onClick={() => {
                  setRemoving(c.id);
                  setReplacement("");
                }}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
        {removing && (
          <div className="warning">
            <p>
              Հեռացնե՞լ «{categories.find((c) => c.id === removing)?.name}»
              կատեգորիան։
            </p>
            {(tasks.some((t) => t.categoryId === removing) || series.some(s => s.template.categoryId === removing)) && (
              <label>
                Ընտրեք փոխարինող կատեգորիա
                <select
                  value={replacement}
                  onChange={(e) => setReplacement(e.target.value)}
                >
                  <option value="">Ընտրեք կատեգորիան</option>
                  {categories
                    .filter((c) => c.id !== removing)
                    .map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <div className="button-row">
              <button className="secondary" onClick={() => setRemoving("")}>
                Չեղարկել
              </button>
              <button
                className="danger"
                onClick={async () => {
                  if (
                    await run(
                      () => deleteCategory(removing, replacement),
                      "Կատեգորիան հեռացված է։",
                    )
                  )
                    setRemoving("");
                }}
              >
                Հեռացնել
              </button>
            </div>
          </div>
        )}
        <form
          className="category-form"
          onSubmit={(e) => void categorySubmit(e)}
        >
          <label>
            {editing ? "Խմբագրել կատեգորիան" : "Նոր կատեգորիա"}
            <input
              value={name}
              maxLength={100}
              placeholder="Կատեգորիայի անունը"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="button-row">
            <label className="color-label">
              Գույն
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
            {editing && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setEditing(null);
                  setName("");
                }}
              >
                Չեղարկել
              </button>
            )}
            <button className="primary" type="submit">
              {editing ? <Check size={18} /> : <Plus size={18} />}
              {editing ? "Պահպանել" : "Ավելացնել"}
            </button>
          </div>
        </form>
      </section>
      <section className="settings-card">
        <h2>
          <ShieldCheck size={20} />
          Ձեր տվյալները
        </h2>
        <p>
          Տվյալները պահվում են միայն այս սարքում։ Պահուստային պատճենը կօգնի
          դրանք տեղափոխել այլ սարք։
        </p>
        <button className="settings-action" onClick={() => void download()}>
          <Download size={20} />
          Արտահանել JSON ֆայլով
        </button>
        <label className="settings-action upload">
          <Upload size={20} />
          {busy ? "Ներմուծվում է…" : "Ներմուծել պահուստային ֆայլ"}
          <input
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </section>
      <section className="settings-card">
        <h2>
          <Bell size={20} />
          Հիշեցումներ
        </h2>
        <p>
          Մոտեցող առաջադրանքները ցուցադրվում են հավելվածի ներսում։ Համակարգային
          ծանուցումները գործում են, երբ հավելվածը բաց է կամ ակտիվ։
        </p>
        <button
          className="secondary"
          disabled={permission === "unsupported" || permission === "granted"}
          onClick={async () => {
            try {
              setPermission(await Notification.requestPermission());
            } catch {
              notify("Այս դիտարկիչը չի թույլատրում ծանուցումները։");
            }
          }}
        >
          {permission === "granted"
            ? "Ծանուցումները թույլատրված են"
            : permission === "unsupported"
              ? "Ծանուցումները չեն աջակցվում"
              : "Միացնել ծանուցումները"}
        </button>
        {permission === "denied" && (
          <p className="muted">
            Թույլտվությունը փակված է։ Այն կարող եք փոխել դիտարկիչի
            կարգավորումներում։
          </p>
        )}
        <p className="muted">
          Փակ հավելվածի ֆոնային ծանուցումները այս տարբերակում երաշխավորված չեն։
        </p>
      </section>
        <InstallHelp />
        <section className="settings-card">
          <h2>Կրկնվող առաջադրանքներ</h2>
          <p>Անջատելիս ապագա նախատեսված կրկնությունները կհեռացվեն։ Անցած օրերն ու կատարված առաջադրանքները կմնան։</p>
          {!series.length && <p>Դեռ կրկնություններ չկան։ Դրանք կարող եք կարգավորել առաջադրանք ավելացնելիս։</p>}
          {series.map(s => <div key={s.id} className="repeat-setting">
            <strong>{s.template.title}</strong>
            <span>{s.enabled ? "Միացված է" : "Անջատված է"}</span>
            <button className="secondary" onClick={() => void run(() => setSeriesEnabled(s.id, !s.enabled), s.enabled ? "Կրկնությունն անջատված է։" : "Կրկնությունը միացված է։")}>
              {s.enabled ? "Անջատել" : "Միացնել"}
              <span className="sr-only">՝ {s.template.title}</span>
            </button>
          </div>)}
        </section>
      <section className="settings-card danger-zone">
        <h2>Մաքրել տվյալները</h2>
        <p>
          Կջնջվեն այս սարքի բոլոր առաջադրանքներն ու նշումները։ Նախ արտահանեք
          պահուստային պատճենը։
        </p>
        <button
          className="danger"
          onClick={() => {
            if (
              confirm(
                "Վերջնական հաստատում․ ջնջե՞լ այս սարքի ԲՈԼՈՐ առաջադրանքները, նշումները և սեփական կատեգորիաները։ Այս գործողությունն անշրջելի է։",
              )
            )
              void run(clearData, "Տվյալները մաքրված են։");
          }}
        >
          <Trash2 size={18} />
          Մաքրել բոլոր տվյալները
        </button>
      </section>
      <footer className="app-version">
        {config.name} · Տարբերակ {config.version}
        <p>Ավելի գիտակից օր՝ մեկ փոքր քայլով։</p>
      </footer>
    </>
  );
}
