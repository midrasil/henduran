import type { CreationRules, DerivedPreview, WorldContent } from "../../api/journeys";
import { Button, Portrait, Tabs } from "../../ui";
import type { CharacterForm, ReviewTab, TabDef } from "./model";
import type { PortraitDraft } from "./CharacterStep";
import { CardPane, RichTextView } from "./parts";

const TABS_ID = "nj-review";
const TABS: TabDef<ReviewTab>[] = [
  { id: "mundo", label: "Mundo" },
  { id: "personagem", label: "Personagem" },
];

export interface ReviewStepProps {
  rules: CreationRules;
  world: WorldContent;
  /** Mundo salvo (já existente) ou novo, salvo ao criar a Jornada. */
  savedWorld: boolean;
  /** Semente; `null` = gerada ao criar a Jornada. */
  seed: number | null;
  startPlaceId: string | null;
  form: CharacterForm;
  derived: DerivedPreview | null;
  portrait: PortraitDraft | null;
  tab: ReviewTab;
  onTab: (tab: ReviewTab) => void;
  onEditWorld: () => void;
  onEditCharacter: () => void;
}

/** Passo 3: o Mundo e o personagem em duas abas, com Editar. */
export function ReviewStep(props: ReviewStepProps) {
  return (
    <div className="nj-review">
      <section className="nj-card surface-parchment" aria-label="Revisão">
        <Tabs items={TABS} value={props.tab} onChange={props.onTab} label="Partes da Revisão" idPrefix={TABS_ID} className="nj-tabs" />
        <CardPane key={props.tab} idPrefix={TABS_ID} id={props.tab} className="nj-rpane">
          {props.tab === "mundo" ? <WorldReview {...props} /> : <CharacterReview {...props} />}
        </CardPane>
      </section>
    </div>
  );
}

function WorldReview({ world, savedWorld, seed, startPlaceId, onEditWorld }: ReviewStepProps) {
  const c = world.calendar;
  const start = world.places.find((p) => p.id === startPlaceId);
  return (
    <>
      <div className="nj-rtop">
        <h4>{world.name}</h4>
        <Button size="sm" onClick={onEditWorld}>
          Editar Mundo
        </Button>
      </div>
      <div className="nj-rgrid">
        <dl className="nj-facts">
          <dt>Era</dt>
          <dd>{world.era.name}</dd>
          <dt>Tom</dt>
          <dd>{world.tone.name}</dd>
          <dt>Calendário</dt>
          <dd>
            {c.name}, {c.era_label}
          </dd>
          <dt>Começa em</dt>
          <dd>{start ? `${start.name} (${start.type})` : "não escolhido"}</dd>
          <dt>Situação</dt>
          <dd>{savedWorld ? "Mundo salvo, já existente" : "Mundo novo, salvo ao criar a Jornada"}</dd>
          <dt>Semente</dt>
          <dd>{seed === null ? "gerada ao criar a Jornada" : seed}</dd>
        </dl>
        <div className="nj-rtxt">
          <p>
            <b>{world.era.name}.</b> {world.era.description}
          </p>
          <p>
            <b>{world.tone.name}.</b> {world.tone.description}
          </p>
        </div>
      </div>
      <h5>Calendário</h5>
      <ul className="nj-skchips" aria-label="Meses">
        {c.months.map((m, i) => (
          <li key={i}>
            {m.name} <b>{m.days}</b>
          </li>
        ))}
      </ul>
      <p className="hint">Semana: {c.weekdays.join(", ")}.</p>
      <h5>Religiões</h5>
      <div className="nj-rcards">
        {world.religions.map((r, i) => (
          <div key={i} className="nj-rcard">
            <b>{r.name}</b>
            <small>{r.domain}</small>
            <p>{r.description}</p>
          </div>
        ))}
      </div>
      <h5>Lugares</h5>
      <div className="nj-rcards">
        {world.places.map((p) => (
          <div key={p.id} className={`nj-rcard${p.id === startPlaceId ? " nj-rcard--start" : ""}`}>
            <b>{p.name}</b>
            <small>
              {p.type}
              {p.id === startPlaceId ? " · a Jornada começa aqui" : ""}
            </small>
            <p>{p.description}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function CharacterReview({ rules, form, derived, portrait, onEditCharacter }: ReviewStepProps) {
  const optional = (v: string) => (v.trim() ? <dd>{v}</dd> : <dd className="nj-none">não informada</dd>);
  const profile = rules.skill_profiles.find((p) => p.id === form.skill_profile);
  const attrMax = rules.ranges.attribute.max;
  const skills = rules.skills
    .filter((s) => (form.skills[s.id] ?? 0) > 0)
    .sort((a, b) => (form.skills[b.id] ?? 0) - (form.skills[a.id] ?? 0));
  return (
    <>
      <div className="nj-rtop">
        <h4>{form.name}</h4>
        <Button size="sm" onClick={onEditCharacter}>
          Editar Personagem
        </Button>
      </div>
      <div className="nj-revhead">
        <Portrait name={form.name} src={portrait?.url ?? null} crop={portrait?.crop ?? null} size="lg" />
        <dl className="nj-facts">
          <dt>Conceito</dt>
          <dd>{form.concept}</dd>
          <dt>Ambição</dt>
          <dd>{form.ambition}</dd>
          <dt>Desejo</dt>
          <dd>{form.desire}</dd>
          <dt>Idade</dt>
          {optional(form.age)}
          <dt>Altura</dt>
          {optional(form.height)}
          <dt>Origem</dt>
          {optional(form.origin)}
          <dt>Personalidade</dt>
          {optional(form.personality)}
        </dl>
      </div>
      {form.appearance.trim() ? (
        <>
          <h5>Aparência</h5>
          <p className="nj-rtxt prose">{form.appearance}</p>
        </>
      ) : null}
      <h5>História</h5>
      <RichTextView html={form.history} className="nj-rtxt" />
      <div className="nj-rgrid">
        <div>
          <h5>Convicções</h5>
          <ol className="nj-convs">
            {form.convictions.map((c, i) => (
              <li key={i}>
                {c.text}
                <small>Pilar: {c.pillar}</small>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h5>Atributos</h5>
          <div className="nj-mini">
            {rules.attributes.map((a) => {
              const v = form.attributes[a.id] ?? null;
              return (
                <div key={a.id} className="nj-mini__row">
                  <span>{a.name}</span>
                  <span className="nj-mini__bar" role="img" aria-label={`${a.name}: ${v ?? "sem valor"}`}>
                    {Array.from({ length: attrMax }, (_, i) => (
                      <i key={i} className={v !== null && i < v ? "on" : undefined} />
                    ))}
                  </span>
                  <b aria-hidden="true">{v ?? "–"}</b>
                </div>
              );
            })}
          </div>
          <p className="hint">
            {rules.derived.map((d, i) => (
              <span key={d.id}>
                {i > 0 ? " · " : ""}
                {d.name} <b>{derived?.[d.id] ?? "–"}</b>
              </span>
            ))}
          </p>
        </div>
      </div>
      <h5>
        Perícias{profile ? <small className="hint"> perfil {profile.name}</small> : null}
      </h5>
      <ul className="nj-skchips" aria-label="Perícias com valor">
        {skills.map((s) => (
          <li key={s.id}>
            {s.name} <b>{form.skills[s.id]}</b>
          </li>
        ))}
      </ul>
    </>
  );
}
