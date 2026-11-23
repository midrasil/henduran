import type { FieldError } from "../../api/backend";
import type { WorldContent, WorldSchema } from "../../api/journeys";
import { errorsByField } from "../../lib/format";
import { Button, FieldGroup, Panel, PixelIcon, RadioGroup, TextArea, TextField } from "../../ui";
import { canAdd, canRemove, cloneWorld, fieldId, nextPlaceId } from "./model";

const id = (path: string) => fieldId("w", path);

export interface WorldStepProps {
  schema: WorldSchema;
  world: WorldContent | null;
  seed: string;
  seedError: string | null;
  generating: boolean;
  generateError: string | null;
  onSeedChange: (seed: string) => void;
  /** Gera com a semente digitada. */
  onGenerateWithSeed: () => void;
  /** Gera com uma semente nova sorteada. */
  onGenerateRandom: () => void;
  onChange: (world: WorldContent) => void;
  startPlaceId: string | null;
  onStartPlace: (id: string) => void;
  /** Erros do Mundo (caminhos relativos ao conteúdo) e do lugar inicial. */
  errors: FieldError[];
  startError: string | null;
  validating: boolean;
  validationError: string | null;
}

/** Passo 1: gerar o Mundo, editar o conteúdo e escolher o lugar inicial. */
export function WorldStep(props: WorldStepProps) {
  const { schema, world, seed, seedError, generating, generateError, onSeedChange } = props;

  return (
    <div className="step step--world">
      <Panel title="Gerar o Mundo" titleLevel={4}>
        <p className="hint">
          O jogo sorteia um Mundo simples (era, tom, calendário, religiões e lugares) a partir de uma semente. A mesma
          semente gera o mesmo Mundo. Depois, edite o que quiser.
        </p>
        <div className="world-gen">
          <TextField
            id="w-seed"
            label="Semente"
            inputMode="numeric"
            value={seed}
            hint={`Número inteiro de 0 a ${schema.seed_max.toLocaleString("pt-BR")}.`}
            error={seedError ?? undefined}
            onChange={(e) => onSeedChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                props.onGenerateWithSeed();
              }
            }}
            action={
              <Button onClick={props.onGenerateWithSeed} disabled={generating || seed.trim() === ""}>
                Usar esta semente
              </Button>
            }
          />
          <div className="actions">
            <Button variant="primary" onClick={props.onGenerateRandom} loading={generating}>
              {world ? "Gerar outro" : "Gerar mundo"}
            </Button>
          </div>
        </div>
        {generateError ? (
          <p className="callout callout--danger" role="alert">
            {generateError}
          </p>
        ) : null}
      </Panel>

      {world ? (
        <WorldEditor {...props} world={world} />
      ) : (
        <div className="empty px-frame surface-parchment">
          <p>Nenhum Mundo ainda. Use “Gerar mundo” para sortear um.</p>
        </div>
      )}
    </div>
  );
}

function WorldEditor({
  schema,
  world,
  onChange,
  startPlaceId,
  onStartPlace,
  errors,
  startError,
  validating,
  validationError,
}: WorldStepProps & { world: WorldContent }) {
  const byField = errorsByField(errors);
  const err = (path: string, ...extra: string[]) => {
    const list = [path, ...extra].flatMap((p) => byField.get(p) ?? []);
    return list.length ? list.join(" ") : undefined;
  };
  const patch = (fn: (w: WorldContent) => void) => {
    const next = cloneWorld(world);
    fn(next);
    onChange(next);
  };
  const countHint = (key: "months" | "weekdays" | "religions" | "places", noun: string) =>
    `De ${schema[key].min} a ${schema[key].max} ${noun}.`;

  return (
    <>
      <p className="hint wizard__status" aria-live="polite">
        {validating ? "Conferindo o Mundo…" : errors.length ? `${errors.length} pendência(s) no Mundo.` : "Mundo válido."}
      </p>
      {validationError ? <p className="callout callout--warn">{validationError}</p> : null}
      {err("") ? (
        <p className="callout callout--danger" id={id("")} tabIndex={-1}>
          {err("")}
        </p>
      ) : null}

      <Panel title="Identidade do Mundo" titleLevel={4}>
        <TextField
          id={id("name")}
          label="Nome do Mundo"
          value={world.name}
          error={err("name")}
          onChange={(e) => patch((w) => void (w.name = e.target.value))}
        />
        <div className="form-grid">
          <FieldGroup legend="Era" hint="A época em que a história se passa (texto de ambientação, sem mecânica).">
            <TextField
              id={id("era.name")}
              label="Nome da era"
              value={world.era.name}
              error={err("era.name", "era")}
              onChange={(e) => patch((w) => void (w.era.name = e.target.value))}
            />
            <TextArea
              id={id("era.description")}
              label="Descrição da era"
              rows={3}
              value={world.era.description}
              error={err("era.description")}
              onChange={(e) => patch((w) => void (w.era.description = e.target.value))}
            />
          </FieldGroup>
          <FieldGroup legend="Tom" hint="O clima das histórias neste Mundo.">
            <TextField
              id={id("tone.name")}
              label="Nome do tom"
              value={world.tone.name}
              error={err("tone.name", "tone")}
              onChange={(e) => patch((w) => void (w.tone.name = e.target.value))}
            />
            <TextArea
              id={id("tone.description")}
              label="Descrição do tom"
              rows={3}
              value={world.tone.description}
              error={err("tone.description")}
              onChange={(e) => patch((w) => void (w.tone.description = e.target.value))}
            />
          </FieldGroup>
        </div>
      </Panel>

      <Panel title="Calendário" titleLevel={4}>
        <div className="form-grid form-grid--3">
          <TextField
            id={id("calendar.name")}
            label="Nome do calendário"
            value={world.calendar.name}
            error={err("calendar.name", "calendar")}
            onChange={(e) => patch((w) => void (w.calendar.name = e.target.value))}
          />
          <NumberField
            id={id("calendar.year")}
            label="Ano atual"
            value={world.calendar.year}
            hint={`De ${schema.year.min} a ${schema.year.max.toLocaleString("pt-BR")}.`}
            error={err("calendar.year")}
            onChange={(v) => patch((w) => void (w.calendar.year = v))}
          />
          <TextField
            id={id("calendar.era_label")}
            label="Nome do ano"
            hint="Por exemplo: Ano 476 da Fundação."
            value={world.calendar.era_label}
            error={err("calendar.era_label")}
            onChange={(e) => patch((w) => void (w.calendar.era_label = e.target.value))}
          />
        </div>

        <FieldGroup
          legend={`Meses (${world.calendar.months.length})`}
          legendId={id("calendar.months")}
          hint={`${countHint("months", "meses")} Cada mês tem de ${schema.month_days.min} a ${schema.month_days.max} dias.`}
          error={err("calendar.months")}
        >
          <ol className="edit-list">
            {world.calendar.months.map((month, i) => (
              <li key={i} className="edit-row">
                <TextField
                  id={id(`calendar.months[${i}].name`)}
                  hideLabel
                  label={`Nome do mês ${i + 1}`}
                  placeholder="Nome do mês"
                  value={month.name}
                  error={err(`calendar.months[${i}].name`, `calendar.months[${i}]`)}
                  onChange={(e) => patch((w) => void (w.calendar.months[i]!.name = e.target.value))}
                />
                <NumberField
                  id={id(`calendar.months[${i}].days`)}
                  label={`Dias do mês ${i + 1}`}
                  hideLabel
                  placeholder="Dias"
                  className="edit-row__narrow"
                  value={month.days}
                  error={err(`calendar.months[${i}].days`)}
                  onChange={(v) => patch((w) => void (w.calendar.months[i]!.days = v))}
                />
                <RemoveButton
                  label={`Remover o mês ${i + 1}`}
                  disabled={!canRemove(schema, "months", world)}
                  onClick={() => patch((w) => void w.calendar.months.splice(i, 1))}
                />
              </li>
            ))}
          </ol>
          <AddButton
            label="Adicionar mês"
            disabled={!canAdd(schema, "months", world)}
            onClick={() => patch((w) => void w.calendar.months.push({ name: "", days: null }))}
          />
        </FieldGroup>

        <FieldGroup
          legend={`Dias da semana (${world.calendar.weekdays.length})`}
          legendId={id("calendar.weekdays")}
          hint={countHint("weekdays", "dias")}
          error={err("calendar.weekdays")}
        >
          <ol className="edit-list edit-list--grid">
            {world.calendar.weekdays.map((day, i) => (
              <li key={i} className="edit-row">
                <TextField
                  id={id(`calendar.weekdays[${i}]`)}
                  hideLabel
                  label={`Dia ${i + 1} da semana`}
                  placeholder="Nome do dia"
                  value={day}
                  error={err(`calendar.weekdays[${i}]`)}
                  onChange={(e) => patch((w) => void (w.calendar.weekdays[i] = e.target.value))}
                />
                <RemoveButton
                  label={`Remover o dia ${i + 1} da semana`}
                  disabled={!canRemove(schema, "weekdays", world)}
                  onClick={() => patch((w) => void w.calendar.weekdays.splice(i, 1))}
                />
              </li>
            ))}
          </ol>
          <AddButton
            label="Adicionar dia da semana"
            disabled={!canAdd(schema, "weekdays", world)}
            onClick={() => patch((w) => void w.calendar.weekdays.push(""))}
          />
        </FieldGroup>
      </Panel>

      <Panel title={`Religiões (${world.religions.length})`} titleLevel={4}>
        <p className="hint" id={id("religions")} tabIndex={-1}>
          {countHint("religions", "religiões")}
        </p>
        {err("religions") ? <p className="callout callout--danger">{err("religions")}</p> : null}
        {world.religions.map((religion, i) => (
          <FieldGroup
            key={i}
            legend={`Religião ${i + 1}`}
            error={err(`religions[${i}]`)}
            extra={
              <RemoveButton
                label={`Remover a religião ${i + 1}`}
                disabled={!canRemove(schema, "religions", world)}
                onClick={() => patch((w) => void w.religions.splice(i, 1))}
              />
            }
          >
            <div className="form-grid">
              <TextField
                id={id(`religions[${i}].name`)}
                label="Nome"
                value={religion.name}
                error={err(`religions[${i}].name`)}
                onChange={(e) => patch((w) => void (w.religions[i]!.name = e.target.value))}
              />
              <TextField
                id={id(`religions[${i}].domain`)}
                label="Domínio"
                hint="Do que a divindade cuida (por exemplo, Colheita)."
                value={religion.domain}
                error={err(`religions[${i}].domain`)}
                onChange={(e) => patch((w) => void (w.religions[i]!.domain = e.target.value))}
              />
            </div>
            <TextArea
              id={id(`religions[${i}].description`)}
              label="Descrição"
              rows={2}
              value={religion.description}
              error={err(`religions[${i}].description`)}
              onChange={(e) => patch((w) => void (w.religions[i]!.description = e.target.value))}
            />
          </FieldGroup>
        ))}
        <AddButton
          label="Adicionar religião"
          disabled={!canAdd(schema, "religions", world)}
          onClick={() => patch((w) => void w.religions.push({ name: "", domain: "", description: "" }))}
        />
      </Panel>

      <Panel title={`Lugares iniciais (${world.places.length})`} titleLevel={4}>
        <p className="hint" id={id("places")} tabIndex={-1}>
          {countHint("places", "lugares")} O tipo é livre (vila, porto, ruína…).
        </p>
        {err("places") ? <p className="callout callout--danger">{err("places")}</p> : null}
        {world.places.map((place, i) => (
          <FieldGroup
            key={place.id || i}
            legend={place.name.trim() || `Lugar ${i + 1}`}
            error={err(`places[${i}]`, `places[${i}].id`)}
            extra={
              <RemoveButton
                label={`Remover o lugar ${place.name.trim() || i + 1}`}
                disabled={!canRemove(schema, "places", world)}
                onClick={() => patch((w) => void w.places.splice(i, 1))}
              />
            }
          >
            <div className="form-grid">
              <TextField
                id={id(`places[${i}].name`)}
                label="Nome"
                value={place.name}
                error={err(`places[${i}].name`)}
                onChange={(e) => patch((w) => void (w.places[i]!.name = e.target.value))}
              />
              <TextField
                id={id(`places[${i}].type`)}
                label="Tipo"
                value={place.type}
                error={err(`places[${i}].type`)}
                onChange={(e) => patch((w) => void (w.places[i]!.type = e.target.value))}
              />
            </div>
            <TextArea
              id={id(`places[${i}].description`)}
              label="Descrição"
              rows={2}
              value={place.description}
              error={err(`places[${i}].description`)}
              onChange={(e) => patch((w) => void (w.places[i]!.description = e.target.value))}
            />
          </FieldGroup>
        ))}
        <AddButton
          label="Adicionar lugar"
          disabled={!canAdd(schema, "places", world)}
          onClick={() =>
            patch((w) => void w.places.push({ id: nextPlaceId(w.places), name: "", type: "", description: "" }))
          }
        />
      </Panel>

      <Panel title="Lugar inicial" titleLevel={4}>
        <div id={id("start")} tabIndex={-1} className="focus-anchor">
          <RadioGroup
            legend="Onde a Jornada começa"
            hint="O personagem começa a Jornada neste lugar."
            appearance="cards"
            value={startPlaceId}
            onChange={onStartPlace}
            error={startError ?? undefined}
            options={world.places.map((p, i) => ({
              value: p.id,
              label: p.name.trim() || `Lugar ${i + 1}`,
              description: p.type.trim() || undefined,
            }))}
          />
        </div>
      </Panel>
    </>
  );
}

function NumberField({
  id: fieldIdValue,
  label,
  value,
  hint,
  error,
  className,
  hideLabel = false,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: number | null;
  hint?: string;
  error: string | undefined;
  className?: string;
  hideLabel?: boolean;
  placeholder?: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <TextField
      id={fieldIdValue}
      label={label}
      hideLabel={hideLabel}
      type="number"
      inputMode="numeric"
      step={1}
      {...(className ? { className } : {})}
      {...(placeholder ? { placeholder } : {})}
      hint={hint}
      error={error}
      value={value ?? ""}
      onChange={(e) => {
        const raw = e.target.value.trim();
        const n = Number(raw);
        onChange(raw === "" || !Number.isFinite(n) ? null : n);
      }}
    />
  );
}

function AddButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <div className="actions">
      <Button size="sm" onClick={onClick} disabled={disabled}>
        <PixelIcon name="plus" /> {label}
      </Button>
    </div>
  );
}

function RemoveButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <Button size="sm" variant="ghost" className="edit-row__remove" aria-label={label} disabled={disabled} onClick={onClick}>
      Remover
    </Button>
  );
}
