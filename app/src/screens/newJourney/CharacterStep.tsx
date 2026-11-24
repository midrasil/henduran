import type { FieldError } from "../../api/backend";
import type { CreationRules, DerivedPreview, SkillProfile } from "../../api/journeys";
import { HELP } from "../../lib/copy";
import { describeCounts, errorsByField, joinList } from "../../lib/format";
import { Button, HistoryEditor, PixelIcon, Portrait, Tabs, TextArea, TextField, TrailBoxes, type PortraitCropValue } from "../../ui";
import {
  attributeCounts,
  CHARACTER_TABS,
  countStatus,
  distinctDesc,
  fieldId,
  plainTextOfHtml,
  wordCount,
  type CharacterForm,
  type CharacterTab,
  type CountStatus,
  type OptionalField,
} from "./model";
import { CardPane, QTip, tabItems } from "./parts";

const id = (path: string) => fieldId("c", path);
const TABS_ID = "nj-hero";

export interface PortraitDraft {
  file: File;
  /** URL local (`blob:`) da imagem escolhida, para a prévia. */
  url: string | null;
  crop: PortraitCropValue;
}

export interface CharacterStepProps {
  rules: CreationRules;
  form: CharacterForm;
  onChange: (form: CharacterForm) => void;
  /** Erros do servidor (todos). */
  errors: FieldError[];
  derived: DerivedPreview | null;
  /** Mostra os erros nos campos (depois da primeira tentativa de avançar). */
  showErrors: boolean;
  validationError: string | null;
  tab: CharacterTab;
  onTab: (tab: CharacterTab) => void;
  counts: Record<CharacterTab, number>;
  onRandomAttributes: () => void;
  onRandomSkills: () => void;
  portrait: PortraitDraft | null;
  onPortrait: () => void;
}

/** Resumo à esquerda (retrato, nome, Conceito e trilhas) e o cartão do Protagonista em quatro abas. */
export function CharacterStep(props: CharacterStepProps) {
  const { rules, form, derived, tab, onTab, counts, portrait } = props;
  const name = form.name.trim();
  return (
    <div className="nj-split nj-split--hero">
      <aside className="nj-side nj-box nj-hero-side" aria-label="Resumo do personagem">
        <div className="nj-hero-top">
          <Portrait
            name={name}
            src={portrait?.url ?? null}
            crop={portrait?.crop ?? null}
            size="lg"
            onClick={props.onPortrait}
            actionLabel={portrait ? "Trocar o retrato" : "Escolher o retrato"}
            className="tip-below"
          />
          <div className="nj-hero-name">
            <b>{name || "Sem nome ainda"}</b>
            <span>{form.concept.trim() || "Conceito em branco"}</span>
          </div>
        </div>
        <div className="nj-box nj-trails">
          <h4 className="nj-box__title">Trilhas</h4>
          {rules.derived.map((d) => (
            <div key={d.id} className="derived__item">
              <TrailBoxes label={d.name} size={derived?.[d.id] ?? null} />
              <p className="hint">{d.formula}</p>
            </div>
          ))}
        </div>
      </aside>
      <div className="nj-main">
        <section className="nj-card surface-parchment" aria-label="Protagonista">
          <Tabs items={tabItems(CHARACTER_TABS, counts)} value={tab} onChange={onTab} label="Partes do Protagonista" idPrefix={TABS_ID} className="nj-tabs" />
          <CardPane key={tab} idPrefix={TABS_ID} id={tab} className={tab === "hist" ? "nj-pane--fill" : undefined}>
            {props.validationError ? <p className="callout callout--warn">{props.validationError}</p> : null}
            {tab === "ident" ? <IdentityTab {...props} /> : null}
            {tab === "hist" ? <HistoryTab {...props} /> : null}
            {tab === "obj" ? <ObjectivesTab {...props} /> : null}
            {tab === "status" ? <StatusTab {...props} /> : null}
          </CardPane>
        </section>
      </div>
    </div>
  );
}

function useErr(errors: FieldError[], show: boolean) {
  const byField = errorsByField(errors);
  return (path: string) => {
    const list = byField.get(path);
    return show && list?.length ? list.join(" ") : undefined;
  };
}

function IdentityTab({ rules, form, onChange, errors, showErrors }: CharacterStepProps) {
  const err = useErr(errors, showErrors);
  const set = (patch: Partial<CharacterForm>) => onChange({ ...form, ...patch });
  const text = (key: "name" | "concept" | "appearance" | OptionalField) => ({
    id: id(key),
    value: form[key],
    error: err(key),
    onChange: (e: { target: { value: string } }) => set({ [key]: e.target.value } as Partial<CharacterForm>),
  });
  const optionalFilled = [form.age, form.height, form.origin, form.personality].some((v) => v.trim());
  return (
    <>
      <div className="nj-grid2">
        <TextField label="Nome" autoComplete="off" {...text("name")} />
        <TextField label="Conceito" hint={HELP.concept} autoComplete="off" {...text("concept")} />
      </div>
      <TextArea label="Aparência" hint={HELP.appearance} rows={3} {...text("appearance")} />
      <details className="nj-more" open={optionalFilled || undefined}>
        <summary>Descrição opcional (idade, altura, origem, personalidade)</summary>
        <p className="hint">{HELP.optionalDescription}</p>
        <div className="nj-grid3">
          <TextField label="Idade (opcional)" autoComplete="off" maxLength={rules.text_limits.age} {...text("age")} />
          <TextField label="Altura (opcional)" autoComplete="off" maxLength={rules.text_limits.height} {...text("height")} />
          <TextField label="Origem (opcional)" autoComplete="off" maxLength={rules.text_limits.origin} {...text("origin")} />
        </div>
        <TextArea label="Personalidade (opcional)" rows={2} maxLength={rules.text_limits.personality} {...text("personality")} />
      </details>
    </>
  );
}

function HistoryTab({ rules, form, onChange, errors, showErrors }: CharacterStepProps) {
  const err = useErr(errors, showErrors);
  return (
    <HistoryEditor
      id={id("history")}
      label="História do personagem"
      value={form.history}
      onChange={(history) => onChange({ ...form, history })}
      limit={rules.text_limits.history ?? 4000}
      plainText={plainTextOfHtml}
      countWords={wordCount}
      placeholder="Conte de onde o personagem vem e o que viveu até aqui…"
      error={err("history")}
      className="nj-rte"
    />
  );
}

function ObjectivesTab({ form, onChange, errors, showErrors, rules }: CharacterStepProps) {
  const err = useErr(errors, showErrors);
  const set = (patch: Partial<CharacterForm>) => onChange({ ...form, ...patch });
  return (
    <>
      <div className="nj-sub">
        <h5>Ambição e Desejo</h5>
      </div>
      <div className="nj-grid2">
        <TextField
          id={id("ambition")}
          label="Ambição"
          hint={HELP.ambition}
          value={form.ambition}
          error={err("ambition")}
          onChange={(e) => set({ ambition: e.target.value })}
        />
        <TextField
          id={id("desire")}
          label="Desejo"
          hint={HELP.desire}
          value={form.desire}
          error={err("desire")}
          onChange={(e) => set({ desire: e.target.value })}
        />
      </div>
      <div className="nj-sub">
        <h5 id={id("convictions")} tabIndex={-1}>
          Convicções ({rules.convictions.count})
        </h5>
      </div>
      <p className="hint">
        {HELP.conviction} {HELP.pillar}
      </p>
      {err("convictions") ? <p className="callout callout--danger">{err("convictions")}</p> : null}
      {form.convictions.map((c, i) => {
        const update = (patch: Partial<{ text: string; pillar: string }>) =>
          set({ convictions: form.convictions.map((item, j) => (j === i ? { ...item, ...patch } : item)) });
        return (
          <div key={i} className="nj-item">
            <div className="nj-item__top">
              <b className="nj-item__name">Convicção {i + 1}</b>
            </div>
            <div className="nj-grid2">
              <TextField
                id={id(`convictions[${i}].text`)}
                label="Convicção"
                value={c.text}
                error={err(`convictions[${i}].text`)}
                onChange={(e) => update({ text: e.target.value })}
              />
              <TextField
                id={id(`convictions[${i}].pillar`)}
                label="Pilar"
                value={c.pillar}
                error={err(`convictions[${i}].pillar`)}
                onChange={(e) => update({ pillar: e.target.value })}
              />
            </div>
          </div>
        );
      })}
    </>
  );
}

function Tally({ status, label }: { status: CountStatus[]; label: string }) {
  return (
    <p className="nj-tally" aria-live="polite">
      <span>{label}:</span>
      {status.map((s) => (
        <span
          key={s.value}
          className={`nj-tally__t${s.used === s.expected ? " nj-tally__t--full" : s.used > s.expected ? " nj-tally__t--over" : ""}`}
        >
          <b>{s.value}</b> {s.used}/{s.expected}
          <span className="visually-hidden">{s.used === s.expected ? " (completo)" : s.used > s.expected ? " (passou da conta)" : ""}</span>
        </span>
      ))}
    </p>
  );
}

function StatusTab({ rules, form, onChange, errors, showErrors, onRandomAttributes, onRandomSkills }: CharacterStepProps) {
  const err = useErr(errors, showErrors);
  const set = (patch: Partial<CharacterForm>) => onChange({ ...form, ...patch });

  // Atributos: valores do catálogo e quantos de cada já foram usados.
  const attrValues = Object.values(form.attributes).filter((v): v is number => v !== null);
  const attrStatus = countStatus(attributeCounts(rules), attrValues);
  const attrOptions = [...distinctDesc(rules.attribute_distribution)].reverse();
  const attrAvailable = (v: number) => {
    const s = attrStatus.find((x) => x.value === v);
    return !!s && s.used < s.expected;
  };

  // Perícias: perfil escolhido e as vagas de cada valor.
  const profile: SkillProfile | null = rules.skill_profiles.find((p) => p.id === form.skill_profile) ?? null;
  const skillValues = Object.values(form.skills).filter((v) => v > 0);
  const skillStatus = profile ? countStatus(profile.distribution, skillValues) : [];
  const skillAvailable = (v: number) => {
    const s = skillStatus.find((x) => x.value === v);
    return !!s && s.used < s.expected;
  };
  const pips = Array.from({ length: rules.creation_max }, (_, i) => i + 1);
  const attrName = new Map(rules.attributes.map((a) => [a.id, a.name]));

  const derivedOf = (attribute: string) =>
    rules.derived.filter((d) => d.attribute === attribute).map((d) => ` · define a ${d.name} (${d.formula})`).join("");

  return (
    <>
      <div className="nj-sub">
        <h5 id={id("attributes")} tabIndex={-1}>
          Atributos
        </h5>
      </div>
      <div className="nj-tbar">
        <p className="hint">
          Distribua os valores {joinList(rules.attribute_distribution.map(String))} entre os {rules.attributes.length} Atributos, um
          para cada.
        </p>
        <span className="nj-tbtns">
          <Button size="sm" onClick={onRandomAttributes}>
            <PixelIcon name="dice" /> Sortear Atributos
          </Button>
        </span>
      </div>
      <Tally status={attrStatus} label="Valores usados" />
      {err("attributes") ? <p className="callout callout--danger">{err("attributes")}</p> : null}
      <div className="nj-acats">
        {rules.categories.map((category) => (
          <section key={category.id} className="nj-acat" aria-label={category.name}>
            <h6 className="nj-cat">{category.name}</h6>
            {rules.attributes
              .filter((a) => a.category === category.id)
              .map((a) => {
                const value = form.attributes[a.id] ?? null;
                const linked = a.skills.map((s) => rules.skills.find((k) => k.id === s)?.name ?? s);
                const tip = `${a.description}${derivedOf(a.id)}${linked.length ? `. Perícias: ${linked.join(", ")}` : ""}`;
                const bad = err(`attributes.${a.id}`);
                return (
                  <div key={a.id} className={`nj-arow${value !== null ? " nj-arow--set" : ""}${bad ? " nj-arow--bad" : ""}`}>
                    <span className="nj-arow__name">
                      <b>{a.name}</b>
                      <QTip text={tip} />
                    </span>
                    <span className="nj-vals" role="group" aria-label={a.name} id={id(`attributes.${a.id}`)}>
                      {attrOptions.map((v) => {
                        const on = value === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            className="nj-val"
                            aria-pressed={on}
                            aria-label={`${a.name}: valor ${v}`}
                            disabled={!on && !attrAvailable(v)}
                            onClick={() => set({ attributes: { ...form.attributes, [a.id]: on ? null : v } })}
                          >
                            {v}
                          </button>
                        );
                      })}
                    </span>
                    <em className="nj-arow__value" aria-hidden="true">
                      {value ?? "–"}
                    </em>
                    {bad ? <span className="field__error nj-arow__error">{bad}</span> : null}
                  </div>
                );
              })}
          </section>
        ))}
      </div>

      <div className="nj-sub">
        <h5 id={id("skill_profile")} tabIndex={-1}>
          Perícias
        </h5>
      </div>
      <div className="nj-tbar">
        <p className="hint">O perfil diz quantas Perícias recebem cada valor. As demais ficam em 0. Trocar de perfil zera as Perícias.</p>
        <span className="nj-tbtns">
          <Button size="sm" onClick={onRandomSkills}>
            <PixelIcon name="dice" /> Sortear Perícias
          </Button>
        </span>
      </div>
      <div className="nj-profiles" role="group" aria-label="Perfil de Perícias">
        {rules.skill_profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            className="nj-prof"
            aria-pressed={form.skill_profile === p.id}
            onClick={() => {
              if (form.skill_profile !== p.id) set({ skill_profile: p.id, skills: {} });
            }}
          >
            <b>{p.name}</b>
            <small>
              {p.total_skills} Perícias: {describeCounts(p.distribution)}
            </small>
          </button>
        ))}
      </div>
      {err("skill_profile") ? <p className="callout callout--danger">{err("skill_profile")}</p> : null}
      {profile ? (
        <Tally status={skillStatus} label="Valores usados" />
      ) : (
        <p className="callout callout--warn">Escolha um perfil para distribuir os valores.</p>
      )}
      {err("skills") ? (
        <p className="callout callout--danger" id={id("skills")} tabIndex={-1}>
          {err("skills")}
        </p>
      ) : null}
      <div className="nj-skflat">
        {rules.skills.map((s) => {
          const value = form.skills[s.id] ?? 0;
          const attribute = form.attributes[s.attribute] ?? null;
          return (
            <div key={s.id} className={`nj-srow${value > 0 ? " nj-srow--has" : ""}`}>
              <span className="nj-srow__name">
                {s.name}
                <QTip text={`${attrName.get(s.attribute) ?? s.attribute} (${attribute ?? "–"}) · ${s.description}`} />
              </span>
              <span className="nj-pips" role="group" aria-label={s.name}>
                {pips.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`nj-pip${v <= value ? " nj-pip--on" : ""}`}
                    aria-pressed={value === v}
                    aria-label={`${s.name}: valor ${v}`}
                    disabled={value !== v && !skillAvailable(v)}
                    onClick={() => {
                      const skills = { ...form.skills };
                      if (value === v) delete skills[s.id];
                      else skills[s.id] = v;
                      set({ skills });
                    }}
                  />
                ))}
              </span>
              <em aria-hidden="true">{value || ""}</em>
            </div>
          );
        })}
      </div>
    </>
  );
}
