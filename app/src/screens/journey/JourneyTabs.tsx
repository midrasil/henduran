import type { CharacterSheet, CreationRules, JourneySnapshot, WorldContent } from "../../api/journeys";
import { HELP } from "../../lib/copy";
import { Panel, TrailBoxes } from "../../ui";
import { AttributeList, SkillList } from "./SheetParts";

/** Aba Ficha: identidade, Atributos, Perícias, trilhas e Convicções (somente leitura). */
export function SheetTab({ character, rules }: { character: CharacterSheet | null; rules: CreationRules | null }) {
  if (!character) return <p className="hint">Esta Jornada ainda não tem personagem.</p>;
  const derivedNames = new Map(rules?.derived.map((d) => [d.id, d]) ?? []);
  const zeroCount = Object.values(character.skills).filter((v) => v === 0).length;
  const profile = rules?.skill_profiles.find((p) => p.id === character.skill_profile);
  return (
    <div className="sheet">
      <h2 className="screen-title">Ficha de {character.name}</h2>
      <div className="form-grid">
        <Panel title="Identidade" titleLevel={3} variant="parchment">
          <dl className="facts">
            <dt>Nome</dt>
            <dd>{character.name}</dd>
            <dt>Conceito</dt>
            <dd>{character.concept}</dd>
            <dt>Aparência</dt>
            <dd className="prose">{character.appearance}</dd>
            <dt>História</dt>
            <dd className="prose">{character.history}</dd>
          </dl>
        </Panel>
        <Panel title="Vida e Vontade" titleLevel={3}>
          {Object.entries(character.tracks).map(([id, track]) => {
            const rule = derivedNames.get(id);
            return (
              <div key={id} className="derived__item">
                <TrailBoxes
                  label={rule?.name ?? id}
                  size={track.size}
                  superficial={track.superficial}
                  agravada={track.agravada}
                  legend
                />
                {rule ? (
                  <p className="hint">
                    {rule.name} = {rule.formula}
                  </p>
                ) : null}
              </div>
            );
          })}
        </Panel>
      </div>

      <div className="form-grid">
        <Panel title="Atributos" titleLevel={3}>
          {rules ? <AttributeList rules={rules} attributes={character.attributes} /> : <p className="hint">Carregando as regras…</p>}
        </Panel>
        <Panel title="Perícias" titleLevel={3}>
          {rules ? (
            <>
              {profile ? <p className="hint">Perfil da criação: {profile.name}</p> : null}
              <SkillList rules={rules} skills={character.skills} onlyPositive />
              {zeroCount ? (
                <details className="details">
                  <summary>Perícias em 0 ({zeroCount})</summary>
                  <SkillList rules={rules} skills={character.skills} onlyZero />
                </details>
              ) : null}
            </>
          ) : (
            <p className="hint">Carregando as regras…</p>
          )}
        </Panel>
      </div>

      <Panel title="Convicções" titleLevel={3}>
        <p className="hint">
          {HELP.conviction} {HELP.pillar}
        </p>
        <ol className="convictions">
          {character.convictions.map((c) => (
            <li key={c.position}>
              <p>{c.text}</p>
              <p className="hint">Pilar: {c.pillar}</p>
              <p className="hint">Fraturas: {c.fractures}</p>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

/**
 * Aba Mundo: era, tom, calendário, religiões e lugares. O lugar onde o personagem
 * está (`location` do resumo; ao criar, o lugar inicial) aparece marcado.
 */
export function WorldTab({ world, location }: { world: WorldContent | null; location: string | null }) {
  if (!world) return <p className="hint">O conteúdo do Mundo não está disponível.</p>;
  const totalDays = world.calendar.months.reduce((sum, m) => sum + (m.days ?? 0), 0);
  return (
    <div className="world-view">
      <h2 className="screen-title">{world.name}</h2>
      <div className="form-grid">
        <Panel title={`Era: ${world.era.name}`} titleLevel={3} variant="parchment">
          <p className="prose">{world.era.description}</p>
        </Panel>
        <Panel title={`Tom: ${world.tone.name}`} titleLevel={3} variant="parchment">
          <p className="prose">{world.tone.description}</p>
        </Panel>
      </div>
      <Panel title={`Calendário: ${world.calendar.name}`} titleLevel={3}>
        <p>
          {world.calendar.era_label} (ano {world.calendar.year}). {world.calendar.months.length} meses, {totalDays} dias no ano.
        </p>
        <h4 className="attr-category__title">Meses</h4>
        <ol className="month-list">
          {world.calendar.months.map((m) => (
            <li key={m.name}>
              {m.name} <span className="hint">({m.days} dias)</span>
            </li>
          ))}
        </ol>
        <h4 className="attr-category__title">Dias da semana</h4>
        <ol className="month-list">
          {world.calendar.weekdays.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ol>
      </Panel>
      <Panel title="Religiões" titleLevel={3}>
        <ul className="card-list">
          {world.religions.map((r, i) => (
            <li key={i} className="list-card px-frame">
              <p className="list-card__title">
                {r.name} <span className="hint">— {r.domain}</span>
              </p>
              <p className="prose">{r.description}</p>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Lugares" titleLevel={3}>
        <ul className="card-list">
          {world.places.map((p) => {
            const here = p.name === location;
            return (
              <li key={p.id} className={`list-card px-frame${here ? " list-card--selected" : ""}`}>
                <p className="list-card__title">
                  {p.name} <span className="hint">— {p.type}</span>
                  {here ? <span className="badge badge--accent place-here">Você está aqui</span> : null}
                </p>
                <p className="prose">{p.description}</p>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}

/** Aba Objetivos: a Ambição e o Desejo ativos (a troca virá depois, ADR-073). */
export function ObjectivesTab({ character }: { character: CharacterSheet | null }) {
  return (
    <div className="objectives">
      <h2 className="screen-title">Objetivos</h2>
      <p className="hint">{HELP.objectives}</p>
      <div className="form-grid">
        <Panel title="Ambição" titleLevel={3} variant="parchment">
          <p className="objective__text">{character?.ambition?.text ?? "Nenhuma Ambição ativa."}</p>
          <p className="hint">{HELP.ambition}</p>
        </Panel>
        <Panel title="Desejo" titleLevel={3} variant="parchment">
          <p className="objective__text">{character?.desire?.text ?? "Nenhum Desejo ativo."}</p>
          <p className="hint">{HELP.desire}</p>
        </Panel>
      </div>
    </div>
  );
}

export type JourneyTab = "chat" | "ficha" | "mundo" | "objetivos";

export const JOURNEY_TABS: { id: JourneyTab; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "ficha", label: "Ficha" },
  { id: "mundo", label: "Mundo" },
  { id: "objetivos", label: "Objetivos" },
];

export const journeyTitle = (snapshot: JourneySnapshot) => snapshot.journey.name ?? "Jornada sem nome";
