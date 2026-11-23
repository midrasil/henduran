import type { CreationRules, DerivedPreview, WorldContent } from "../../api/journeys";
import { Panel, TextField, TrailBoxes } from "../../ui";
import { AttributeList, SkillList } from "../journey/SheetParts";
import type { CharacterForm } from "./model";

export interface ReviewStepProps {
  rules: CreationRules;
  world: WorldContent;
  startPlaceId: string | null;
  form: CharacterForm;
  derived: DerivedPreview | null;
  journeyName: string;
  defaultName: string;
  nameError: string | null;
  onNameChange: (name: string) => void;
}

/** Passo 3: resumo do Mundo e do personagem e o nome da Jornada. */
export function ReviewStep({
  rules,
  world,
  startPlaceId,
  form,
  derived,
  journeyName,
  defaultName,
  nameError,
  onNameChange,
}: ReviewStepProps) {
  const start = world.places.find((p) => p.id === startPlaceId);
  const attributes = Object.fromEntries(
    Object.entries(form.attributes).filter((entry): entry is [string, number] => entry[1] !== null),
  );
  const profile = rules.skill_profiles.find((p) => p.id === form.skill_profile);

  return (
    <div className="step step--review">
      <Panel title="Nome da Jornada" titleLevel={4}>
        <TextField
          id="r-name"
          label="Nome da Jornada (opcional)"
          hint={`Se ficar em branco, será “${defaultName}”.`}
          placeholder={defaultName}
          value={journeyName}
          error={nameError ?? undefined}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </Panel>

      <div className="form-grid">
        <Panel title="Mundo" titleLevel={4} variant="parchment">
          <dl className="facts">
            <dt>Nome</dt>
            <dd>{world.name}</dd>
            <dt>Era</dt>
            <dd>{world.era.name}</dd>
            <dt>Tom</dt>
            <dd>{world.tone.name}</dd>
            <dt>Calendário</dt>
            <dd>
              {world.calendar.name}, {world.calendar.era_label}
            </dd>
            <dt>Lugar inicial</dt>
            <dd>{start ? `${start.name} (${start.type})` : "não escolhido"}</dd>
          </dl>
        </Panel>

        <Panel title="Protagonista" titleLevel={4} variant="parchment">
          <dl className="facts">
            <dt>Nome</dt>
            <dd>{form.name}</dd>
            <dt>Conceito</dt>
            <dd>{form.concept}</dd>
            <dt>Ambição</dt>
            <dd>{form.ambition}</dd>
            <dt>Desejo</dt>
            <dd>{form.desire}</dd>
          </dl>
          <dl className="facts">
            <dt>Idade</dt>
            <dd>{form.age.trim() || "não informada"}</dd>
            <dt>Altura</dt>
            <dd>{form.height.trim() || "não informada"}</dd>
            <dt>Origem</dt>
            <dd>{form.origin.trim() || "não informada"}</dd>
            <dt>Personalidade</dt>
            <dd className="prose">{form.personality.trim() || "não informada"}</dd>
          </dl>
          <details className="details">
            <summary>Aparência e história</summary>
            <p className="prose">{form.appearance}</p>
            <p className="prose">{form.history}</p>
          </details>
        </Panel>
      </div>

      <Panel title="Convicções" titleLevel={4}>
        <ol className="convictions">
          {form.convictions.map((c, i) => (
            <li key={i}>
              <p>{c.text}</p>
              <p className="hint">Pilar: {c.pillar}</p>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="form-grid">
        <Panel title="Atributos" titleLevel={4}>
          <AttributeList rules={rules} attributes={attributes} />
          <div className="derived">
            {rules.derived.map((d) => (
              <TrailBoxes key={d.id} label={d.name} size={derived?.[d.id] ?? null} />
            ))}
          </div>
        </Panel>
        <Panel title="Perícias" titleLevel={4}>
          {profile ? <p className="hint">Perfil: {profile.name}</p> : null}
          <SkillList rules={rules} skills={form.skills} onlyPositive />
        </Panel>
      </div>
    </div>
  );
}
