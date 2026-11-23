import { useState } from "react";

import type { CharacterSheet, CreationRules } from "../../api/journeys";
import { PixelIcon, Portrait, Track, TrailBoxes, type PortraitCropValue, type TrackIconKind } from "../../ui";
import { attributeAbbrev } from "./journeyText";

/** Ícone de cada trilha derivada do catálogo: Vida é coração, Vontade é chama (09, item 2.5). */
const TRACK_ICON: Record<string, TrackIconKind> = { vida: "heart", vontade: "flame" };

/** Trilhas de Vida e Vontade, na ordem do catálogo; os números vêm da ficha do serviço. */
export function SheetTracks({ character, rules }: { character: CharacterSheet; rules: CreationRules | null }) {
  const ids = rules ? rules.derived.map((d) => d.id) : Object.keys(character.tracks);
  return (
    <div className="sheet-tracks">
      {ids.map((id) => {
        const track = character.tracks[id];
        if (!track) return null;
        const label = rules?.derived.find((d) => d.id === id)?.name ?? id;
        const kind = TRACK_ICON[id];
        return kind ? (
          <Track key={id} label={label} kind={kind} size={track.size} superficial={track.superficial} agravada={track.agravada} />
        ) : (
          <TrailBoxes key={id} label={label} size={track.size} superficial={track.superficial} agravada={track.agravada} />
        );
      })}
    </div>
  );
}

function Pips({ value, max }: { value: number; max: number }) {
  return (
    <span className="pips" aria-hidden="true">
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={i < value ? "pips__on" : undefined} />
      ))}
    </span>
  );
}

/** Atributos em placas, na ordem do catálogo; a cor segue a categoria do catálogo (a 1ª dourada, a 2ª roxa). */
export function AttributePlates({ character, rules }: { character: CharacterSheet; rules: CreationRules }) {
  const max = rules.ranges.attribute.max;
  const categoryIndex = new Map(rules.categories.map((c, i) => [c.id, i]));
  return (
    <ul className="attr-plates">
      {rules.attributes.map((a) => {
        const value = character.attributes[a.id] ?? 0;
        const category = rules.categories.find((c) => c.id === a.category);
        return (
          <li key={a.id} className={`attr-plate attr-plate--cat${categoryIndex.get(a.category) ?? 0}`}>
            <span className="attr-plate__value" aria-hidden="true">
              {value}
            </span>
            <span className="attr-plate__text">
              <span className="attr-plate__name">
                {a.name}
                <span className="visually-hidden">
                  : {value} de {max}
                  {category ? ` (${category.name})` : ""}
                </span>
              </span>
              <Pips value={value} max={max} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Perícias em lista, com o Atributo ligado e marcadores; `all` mostra as do catálogo inteiro. */
export function SkillRows({ character, rules, all, columns = 1 }: { character: CharacterSheet; rules: CreationRules; all: boolean; columns?: 1 | 2 }) {
  const max = rules.ranges.skill.max;
  const attrs = new Map(rules.attributes.map((a) => [a.id, a]));
  const rows = rules.skills
    .map((s) => ({ ...s, value: character.skills[s.id] ?? 0 }))
    .filter((s) => all || s.value > 0);
  if (rows.length === 0) return <p className="hint">Nenhuma Perícia treinada.</p>;
  return (
    <ul className={`skill-rows${columns === 2 ? " skill-rows--two" : ""}`}>
      {rows.map((s) => {
        const attr = attrs.get(s.attribute);
        return (
          <li key={s.id} className={s.value ? undefined : "skill-rows__zero"}>
            <span className="skill-rows__name">{s.name}</span>
            <span className="skill-rows__attr" title={attr?.name}>
              <span aria-hidden="true">{attributeAbbrev(attr, s.attribute)}</span>
              <span className="visually-hidden">({attr?.name ?? s.attribute})</span>
            </span>
            <span className="skill-rows__value">
              <span className="visually-hidden">{s.value} de {max}</span>
              <Pips value={s.value} max={max} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export interface SheetSummaryProps {
  character: CharacterSheet | null;
  rules: CreationRules | null;
  portraitUrl: string | null;
  crop: PortraitCropValue | null;
  onOpenFull: () => void;
  onPortrait: () => void;
  id?: string;
}

/** Ficha resumida (coluna direita): retrato, trilhas, Atributos e Perícias. Objetivos e Convicções ficam na ficha completa. */
export function SheetSummary({ character, rules, portraitUrl, crop, onOpenFull, onPortrait, id }: SheetSummaryProps) {
  const [allSkills, setAllSkills] = useState(false);
  return (
    <aside className="col col--sheet" aria-label="Ficha resumida" id={id}>
      <div className="col__head">
        <h2 className="col__title">Ficha</h2>
        <button type="button" className="mini-btn tip-end" aria-label="Abrir a ficha completa" data-tip="Ficha completa" onClick={onOpenFull} disabled={!character}>
          <PixelIcon name="expand" />
        </button>
      </div>
      <div className="col__scroll" data-testid="ficha-rolagem">
        {!character ? (
          <p className="col__note">Esta Jornada ainda não tem personagem.</p>
        ) : (
          <>
            <div className="sheet-hero">
              <Portrait name={character.name} src={portraitUrl} crop={crop} onClick={onPortrait} />
              <div>
                <p className="sheet-hero__name">{character.name}</p>
                <p className="sheet-hero__concept">{character.concept}</p>
              </div>
            </div>
            <section className="sheet-sec" aria-labelledby="sheet-tracks-title">
              <h3 id="sheet-tracks-title" className="sheet-sec__title">
                Trilhas
              </h3>
              <SheetTracks character={character} rules={rules} />
            </section>
            {rules ? (
              <>
                <section className="sheet-sec" aria-labelledby="sheet-attrs-title">
                  <h3 id="sheet-attrs-title" className="sheet-sec__title">
                    Atributos
                  </h3>
                  <AttributePlates character={character} rules={rules} />
                </section>
                <section className="sheet-sec" aria-labelledby="sheet-skills-title">
                  <h3 id="sheet-skills-title" className="sheet-sec__title">
                    Perícias
                  </h3>
                  <SkillRows character={character} rules={rules} all={allSkills} />
                  <button type="button" className="link-btn" onClick={() => setAllSkills((v) => !v)}>
                    {allSkills ? "Mostrar só as treinadas" : `Mostrar as ${rules.skills.length} Perícias`}
                  </button>
                </section>
              </>
            ) : (
              <p className="col__note">Carregando as regras…</p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
