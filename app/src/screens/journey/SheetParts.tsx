import type { CreationRules } from "../../api/journeys";

/** Atributos agrupados pela categoria do catálogo; ids que o catálogo não conhece aparecem ao fim. */
export function AttributeList({ rules, attributes }: { rules: CreationRules; attributes: Record<string, number> }) {
  const known = new Set(rules.attributes.map((a) => a.id));
  const unknown = Object.keys(attributes).filter((id) => !known.has(id));
  return (
    <div className="attr-list">
      {rules.categories.map((category) => (
        <div key={category.id} className="attr-list__group">
          <h5 className="attr-category__title">{category.name}</h5>
          <dl className="stat-list">
            {rules.attributes
              .filter((a) => a.category === category.id)
              .map((a) => (
                <div key={a.id} className="stat-list__row">
                  <dt>{a.name}</dt>
                  <dd>{attributes[a.id] ?? "—"}</dd>
                </div>
              ))}
          </dl>
        </div>
      ))}
      {unknown.length ? (
        <dl className="stat-list">
          {unknown.map((id) => (
            <div key={id} className="stat-list__row">
              <dt>{id}</dt>
              <dd>{attributes[id]}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/** Perícias com o nome do catálogo e o Atributo ligado; `onlyPositive` mostra só as acima de 0. */
export function SkillList({
  rules,
  skills,
  onlyPositive = false,
  onlyZero = false,
}: {
  rules: CreationRules;
  skills: Record<string, number>;
  onlyPositive?: boolean;
  onlyZero?: boolean;
}) {
  const attributeName = new Map(rules.attributes.map((a) => [a.id, a.name]));
  const known = rules.skills.map((s) => ({ id: s.id, name: s.name, attribute: attributeName.get(s.attribute) ?? s.attribute }));
  const knownIds = new Set(known.map((s) => s.id));
  const rows = [
    ...known,
    ...Object.keys(skills)
      .filter((id) => !knownIds.has(id))
      .map((id) => ({ id, name: id, attribute: "" })),
  ]
    .map((s) => ({ ...s, value: skills[s.id] ?? 0 }))
    .filter((s) => (onlyPositive ? s.value > 0 : onlyZero ? s.value === 0 : true))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "pt-BR"));
  if (rows.length === 0) return <p className="hint">Nenhuma.</p>;
  return (
    <dl className="stat-list stat-list--columns">
      {rows.map((s) => (
        <div key={s.id} className={`stat-list__row${s.value > 0 ? " stat-list__row--strong" : ""}`}>
          <dt>
            {s.name}
            {s.attribute ? <span className="stat-list__sub"> ({s.attribute})</span> : null}
          </dt>
          <dd>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}
