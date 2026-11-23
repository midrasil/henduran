import type { FieldError } from "../../api/backend";
import type { CreationRules, DerivedPreview } from "../../api/journeys";
import { HELP } from "../../lib/copy";
import { describeCounts, errorsByField, joinList } from "../../lib/format";
import { Badge, Button, FieldGroup, Panel, PixelIcon, RadioGroup, Select, TextArea, TextField, TrailBoxes } from "../../ui";
import { attributeCounts, countStatus, distinctDesc, fieldId, overused, type CharacterForm, type CountStatus } from "./model";

const id = (path: string) => fieldId("c", path);

export interface CharacterStepProps {
  rules: CreationRules;
  form: CharacterForm;
  onChange: (form: CharacterForm) => void;
  /** Erros do servidor (todos); a tela decide quais mostrar. */
  errors: FieldError[];
  derived: DerivedPreview | null;
  touched: ReadonlySet<string>;
  onTouch: (path: string) => void;
  /** Mostra todos os erros (depois de tentar avançar). */
  showAll: boolean;
  validating: boolean;
  validationError: string | null;
  onRandomAttributes: () => void;
  onRandomSkills: () => void;
}

/** Seções do resumo de pendências e os campos de cada uma. */
const SECTIONS: { label: string; match: (field: string) => boolean }[] = [
  { label: "Identidade", match: (f) => ["name", "concept", "appearance", "history"].includes(f) },
  { label: "Objetivos", match: (f) => f === "ambition" || f === "desire" },
  { label: "Convicções", match: (f) => f.startsWith("convictions") },
  { label: "Atributos", match: (f) => f.startsWith("attributes") },
  { label: "Perícias", match: (f) => f.startsWith("skill") },
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function describeStatus(status: CountStatus[]): { missing: string; extra: string } {
  const missing = status.filter((s) => s.expected > s.used).map((s) => ({ value: s.value, count: s.expected - s.used }));
  const extra = status.filter((s) => s.used > s.expected).map((s) => ({ value: s.value, count: s.used - s.expected }));
  return { missing: describeCounts(missing), extra: describeCounts(extra) };
}

/** Passo 2: identidade, Convicções, Atributos, Perícias e as trilhas derivadas. */
export function CharacterStep({
  rules,
  form,
  onChange,
  errors,
  derived,
  touched,
  onTouch,
  showAll,
  validating,
  validationError,
  onRandomAttributes,
  onRandomSkills,
}: CharacterStepProps) {
  const byField = errorsByField(errors);
  const anyTouched = (prefix: string) => [...touched].some((t) => t.startsWith(prefix));
  const err = (path: string, visible = showAll || touched.has(path)) => {
    const list = byField.get(path);
    return visible && list?.length ? list.join(" ") : undefined;
  };
  const set = (patch: Partial<CharacterForm>) => onChange({ ...form, ...patch });
  const text = (key: "name" | "concept" | "appearance" | "history" | "ambition" | "desire") => ({
    id: id(key),
    value: form[key],
    error: err(key),
    onChange: (e: { target: { value: string } }) => set({ [key]: e.target.value } as Partial<CharacterForm>),
    onBlur: () => onTouch(key),
  });

  // Atributos: o que falta da distribuição do catálogo e o que passou da conta.
  const attrValues = Object.values(form.attributes).filter((v): v is number => v !== null);
  const attrStatus = countStatus(attributeCounts(rules), attrValues);
  const attrOver = overused(attrStatus);
  const attrInfo = describeStatus(attrStatus);
  const attrOptions = distinctDesc(rules.attribute_distribution).map((v) => ({ value: String(v), label: String(v) }));

  // Perícias: contagens do perfil escolhido.
  const profile = rules.skill_profiles.find((p) => p.id === form.skill_profile) ?? null;
  const skillValues = Object.values(form.skills).filter((v) => v > 0);
  const skillStatus = profile ? countStatus(profile.distribution, skillValues) : [];
  const skillOver = overused(skillStatus);
  const skillInfo = describeStatus(skillStatus);
  const skillOptions = [
    { value: "0", label: "0" },
    ...distinctDesc(profile ? profile.distribution.map((d) => d.value) : []).map((v) => ({ value: String(v), label: String(v) })),
  ];
  const skillsByAttribute = rules.attributes
    .map((a) => ({ attribute: a, skills: rules.skills.filter((s) => s.attribute === a.id) }))
    .filter((g) => g.skills.length > 0);

  const sectionCounts = SECTIONS.map((s) => ({ label: s.label, count: errors.filter((e) => s.match(e.field)).length }));

  return (
    <div className="step step--character">
      <section className="summary px-frame" aria-labelledby="c-summary-title">
        <h4 id="c-summary-title" className="summary__title">
          O que falta
        </h4>
        <ul className="summary__list">
          {sectionCounts.map((s) => (
            <li key={s.label} className="summary__item">
              <span>{s.label}</span>
              {s.count === 0 ? (
                <Badge tone="success" icon={<PixelIcon name="check" />}>
                  Completo
                </Badge>
              ) : (
                <Badge tone="warn" icon={<PixelIcon name="hourglass" />}>
                  {plural(s.count, "pendência", "pendências")}
                </Badge>
              )}
            </li>
          ))}
        </ul>
        <p className="hint" aria-live="polite">
          {validating ? "Conferindo a ficha…" : errors.length === 0 ? "Tudo certo. Pode avançar." : ""}
        </p>
        {validationError ? <p className="callout callout--warn">{validationError}</p> : null}
      </section>

      <Panel title="Identidade" titleLevel={4}>
        <TextField label="Nome" autoComplete="off" {...text("name")} />
        <TextField label="Conceito" hint={HELP.concept} {...text("concept")} />
        <div className="form-grid">
          <TextArea label="Aparência" hint={HELP.appearance} rows={3} {...text("appearance")} />
          <TextArea label="História" hint={HELP.history} rows={3} {...text("history")} />
        </div>
      </Panel>

      <Panel title="Ambição e Desejo" titleLevel={4}>
        <div className="form-grid">
          <TextField label="Ambição" hint={HELP.ambition} {...text("ambition")} />
          <TextField label="Desejo" hint={HELP.desire} {...text("desire")} />
        </div>
      </Panel>

      <Panel title={`Convicções (${rules.convictions.count})`} titleLevel={4}>
        <p className="hint" id={id("convictions")} tabIndex={-1}>
          {HELP.conviction} {HELP.pillar}
        </p>
        {err("convictions") ? <p className="callout callout--danger">{err("convictions")}</p> : null}
        <div className="form-grid form-grid--3">
          {form.convictions.map((c, i) => {
            const update = (patch: Partial<{ text: string; pillar: string }>) =>
              set({ convictions: form.convictions.map((item, j) => (j === i ? { ...item, ...patch } : item)) });
            return (
              <FieldGroup key={i} legend={`Convicção ${i + 1}`}>
                <TextArea
                  id={id(`convictions[${i}].text`)}
                  label="Convicção"
                  rows={2}
                  value={c.text}
                  error={err(`convictions[${i}].text`)}
                  onChange={(e) => update({ text: e.target.value })}
                  onBlur={() => onTouch(`convictions[${i}].text`)}
                />
                <TextField
                  id={id(`convictions[${i}].pillar`)}
                  label="Pilar"
                  value={c.pillar}
                  error={err(`convictions[${i}].pillar`)}
                  onChange={(e) => update({ pillar: e.target.value })}
                  onBlur={() => onTouch(`convictions[${i}].pillar`)}
                />
              </FieldGroup>
            );
          })}
        </div>
      </Panel>

      <Panel title="Atributos" titleLevel={4}>
        <FieldGroup
          legend="Valores dos Atributos"
          legendId={id("attributes")}
          hint={`Distribua os valores ${joinList(rules.attribute_distribution.map(String))} entre os ${rules.attributes.length} Atributos, um valor por Atributo.`}
          error={err("attributes", showAll || anyTouched("attributes."))}
          extra={
            <Button size="sm" onClick={onRandomAttributes}>
              Distribuir ao acaso
            </Button>
          }
        >
          <p className="counts" aria-live="polite">
            {attrInfo.missing ? (
              <>
                <span className="counts__label">Ainda faltam:</span> {attrInfo.missing}.
              </>
            ) : (
              <span className="text-ok">Todos os valores foram usados.</span>
            )}
            {attrInfo.extra ? <span className="counts__extra"> Passou da conta: {attrInfo.extra}.</span> : null}
          </p>
          {rules.categories.map((category) => (
            <div key={category.id} className="attr-category">
              <h5 className="attr-category__title">{category.name}</h5>
              <div className="form-grid form-grid--3">
                {rules.attributes
                  .filter((a) => a.category === category.id)
                  .map((a) => {
                    const value = form.attributes[a.id] ?? null;
                    const conflict = value !== null && attrOver.has(value) ? `O valor ${value} passou da conta.` : undefined;
                    return (
                      <Select
                        key={a.id}
                        id={id(`attributes.${a.id}`)}
                        label={a.name}
                        hint={a.description}
                        placeholder="—"
                        options={attrOptions}
                        value={value === null ? "" : String(value)}
                        error={conflict ?? err(`attributes.${a.id}`)}
                        onChange={(e) => {
                          set({
                            attributes: { ...form.attributes, [a.id]: e.target.value === "" ? null : Number(e.target.value) },
                          });
                          onTouch(`attributes.${a.id}`);
                        }}
                        onBlur={() => onTouch(`attributes.${a.id}`)}
                      />
                    );
                  })}
              </div>
            </div>
          ))}
        </FieldGroup>

        <div className="derived">
          {rules.derived.map((d) => (
            <div key={d.id} className="derived__item">
              <TrailBoxes label={d.name} size={derived?.[d.id] ?? null} />
              <p className="hint">
                {d.name} = {d.formula}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Perícias" titleLevel={4}>
        <div id={id("skill_profile")} tabIndex={-1} className="focus-anchor">
          <RadioGroup
            legend="Perfil de Perícias"
            hint="O perfil diz quantas Perícias recebem cada valor. As demais ficam em 0."
            appearance="cards"
            value={form.skill_profile}
            error={err("skill_profile")}
            onChange={(value) => {
              const next = rules.skill_profiles.find((p) => p.id === value);
              const allowed = new Set(next ? next.distribution.map((d) => d.value) : []);
              // Valores que o novo perfil não usa voltam a 0.
              const skills = Object.fromEntries(Object.entries(form.skills).filter(([, v]) => allowed.has(v)));
              set({ skill_profile: value, skills });
              onTouch("skill_profile");
            }}
            options={rules.skill_profiles.map((p) => ({
              value: p.id,
              label: p.name,
              description: `${describeCounts(p.distribution)} (${p.total_skills} Perícias com pontos).`,
            }))}
          />
        </div>

        <FieldGroup
          legend="Valores das Perícias"
          legendId={id("skills")}
          hint={profile ? undefined : "Escolha um perfil para distribuir os valores."}
          error={err("skills")}
          extra={
            <Button size="sm" onClick={onRandomSkills}>
              Distribuir ao acaso
            </Button>
          }
        >
          {profile ? (
            <p className="counts" aria-live="polite">
              {skillInfo.missing ? (
                <>
                  <span className="counts__label">Ainda faltam:</span> {skillInfo.missing}.
                </>
              ) : (
                <span className="text-ok">Todos os valores do perfil foram usados.</span>
              )}
              {skillInfo.extra ? <span className="counts__extra"> Passou da conta: {skillInfo.extra}.</span> : null}
            </p>
          ) : null}
          {skillsByAttribute.map(({ attribute, skills }) => (
            <div key={attribute.id} className="attr-category">
              <h5 className="attr-category__title">Ligadas a {attribute.name}</h5>
              <div className="form-grid form-grid--3">
                {skills.map((s) => {
                  const value = form.skills[s.id] ?? 0;
                  const conflict = value > 0 && skillOver.has(value) ? `O valor ${value} passou da conta.` : undefined;
                  return (
                    <Select
                      key={s.id}
                      id={id(`skills.${s.id}`)}
                      label={s.name}
                      hint={s.description}
                      options={skillOptions}
                      disabled={!profile}
                      value={String(value)}
                      error={conflict ?? err(`skills.${s.id}`)}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        const skills = { ...form.skills };
                        if (v > 0) skills[s.id] = v;
                        else delete skills[s.id];
                        set({ skills });
                        onTouch(`skills.${s.id}`);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </FieldGroup>
      </Panel>
    </div>
  );
}
