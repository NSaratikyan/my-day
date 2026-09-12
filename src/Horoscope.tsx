import { useState, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Sparkles, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { db, saveBirthday } from "./db";
import { birthdaySchema, localDate } from "./model";
import { useData } from "./context";
import { dailyHoroscope, zodiacForBirthday } from "./zodiac";

export function Horoscope({ today }: { today: string }) {
  const birthday = useLiveQuery(async () => (await db.settings.get("birthday"))?.value ?? "");
  if (birthday === undefined) return null;
  const horoscope = dailyHoroscope(birthday, today);
  return <section className="horoscope-card" aria-labelledby="horoscope-heading">
    <div className="horoscope-heading">
      <Sparkles size={22} aria-hidden="true" />
      <h2 id="horoscope-heading">{horoscope ? `${horoscope.sign.name} · Օրվա խորհուրդը` : "Ձեր օրվա հորոսկոպը"}</h2>
      {horoscope && <Link className="icon" to="/more" aria-label="Փոխել ծննդյան ամսաթիվը"><Pencil size={17} /></Link>}
    </div>
    {horoscope ? <>
      <p>{horoscope.text}</p>
      <p className="horoscope-focus"><span aria-hidden="true">{horoscope.sign.symbol}</span> {horoscope.focus}</p>
      <small>Ժամանցային խորհուրդներ՝ պատրաստված հավելվածի համար։ Փոխվում են ամեն օր, աշխատում են նաև անցանց։</small>
    </> : <>
      <p>Նշեք ծննդյան ամսաթիվը՝ ձեր նշանն ու ամենօրյա ժամանցային խորհուրդը տեսնելու համար։</p>
      <Link className="secondary" to="/more">Ընտրել ծննդյան ամսաթիվը</Link>
    </>}
  </section>;
}

export function BirthdaySettings() {
  const saved = useLiveQuery(async () => (await db.settings.get("birthday"))?.value ?? "");
  const [draft, setDraft] = useState<string>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { run } = useData();
  const value = draft ?? saved ?? "";
  const sign = zodiacForBirthday(value);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!birthdaySchema.safeParse(value).success) {
      setError("Ընտրեք վավեր ծննդյան ամսաթիվ՝ ոչ ուշ, քան այսօր։");
      return;
    }
    setBusy(true);
    if (await run(() => saveBirthday(value), "Ծննդյան ամսաթիվը պահպանված է։ Օրվա խորհուրդը կտեսնեք «Այսօր» բաժնում։")) setDraft(undefined);
    setBusy(false);
  }
  return <section className="settings-card birthday-settings">
    <h2><Sparkles size={20} />Ծննդյան ամսաթիվ և հորոսկոպ</h2>
    <p>Ընտրեք ծննդյան ամսաթիվը։ Ձեր կենդանակերպի նշանը կորոշվի ավտոմատ։</p>
    <form onSubmit={e => void submit(e)} noValidate>
      <label htmlFor="birthday">Ծննդյան ամսաթիվ</label>
      <input id="birthday" type="date" value={value} max={localDate()} required disabled={busy || saved === undefined}
        aria-invalid={!!error} aria-describedby={error ? "birthday-error" : "birthday-privacy"}
        onChange={e => { setDraft(e.target.value); setError(""); }} />
      {error && <p className="danger-text" role="alert" id="birthday-error">{error}</p>}
      {sign && <p className="birthday-sign" role="status"><span aria-hidden="true">{sign.symbol}</span> Ձեր նշանը՝ <strong>{sign.name}</strong></p>}
      <div className="button-row">
        <button className="primary" disabled={busy || saved === undefined} type="submit">{busy ? "Պահպանվում է…" : "Պահպանել ծննդյան ամսաթիվը"}</button>
        {saved && <button className="secondary" type="button" disabled={busy} onClick={async () => {
          setBusy(true);
          if (await run(() => saveBirthday(""), "Ծննդյան ամսաթիվը հեռացված է։")) { setDraft(""); setError(""); }
          setBusy(false);
        }}>Հեռացնել ամսաթիվը</button>}
      </div>
    </form>
    <p className="muted" id="birthday-privacy">Ամսաթիվը պահվում է միայն այս սարքում և ներառվում է ձեր արտահանած պահուստային ֆայլում։</p>
    <p className="muted">Օգտագործվում են արևմտյան կենդանակերպի ընդունված ամսաթվերը՝ առանց ծննդյան ժամի հաշվարկի։ Խորհուրդները ժամանցային են, նախապես պատրաստված և արտաքին ծառայությունից չեն ստացվում։</p>
  </section>;
}
