import type { FieldError } from "../../api/backend";
import type { SavedWorld, WorldContent, WorldSchema } from "../../api/journeys";
import { errorsByField } from "../../lib/format";
import { Button, PixelIcon, Tabs, TextArea, TextField } from "../../ui";
import { canAdd, canRemove, cloneWorld, fieldId, nextPlaceId, WORLD_TABS, type WorldTab } from "./model";
import { CardPane, Chip, plural, tabItems } from "./parts";

const id = (path: string) => fieldId("w", path);
const TABS_ID = "nj-world";

/** Um item da lista de Mundos: o Mundo novo em edição ou um Mundo salvo. */
export type WorldSelection = "draft" | string;

export interface WorldDraft {
  content: WorldContent;
  /** Semente do gerador; `null` quando o Mundo foi editado, criado do zero ou duplicado (gerada ao criar). */
  seed: number | null;
  edited: boolean;
}

export interface WorldStepProps {
  schema: WorldSchema;
  /** Mundos salvos (`null` enquanto carrega). */
  saved: SavedWorld[] | null;
  savedError: string | null;
  onReloadSaved: () => void;
  draft: WorldDraft | null;
  selection: WorldSelection | null;
  onSelect: (selection: WorldSelection) => void;
  /** Conteúdo do Mundo escolhido (o do rascunho ou o do Mundo salvo, quando já carregado). */
  world: WorldContent | null;
  /** Mundo salvo carregando ou com erro ao carregar. */
  worldLoading: boolean;
  worldLoadError: string | null;
  onRetryWorld: () => void;
  seed: string;
  seedError: string | null;
  generating: boolean;
  generateError: string | null;
  onSeedChange: (seed: string) => void;
  onUseSeed: () => void;
  onGenerate: () => void;
  onBlank: () => void;
  onDuplicate: () => void;
  onChange: (world: WorldContent) => void;
  startPlaceId: string | null;
  onStartPlace: (id: string) => void;
  tab: WorldTab;
  onTab: (tab: WorldTab) => void;
  /** Pendências por aba (`null` sem Mundo). */
  counts: Record<WorldTab, number> | null;
  /** Erros do Mundo (caminhos relativos ao conteúdo; `start` = lugar inicial). */
  errors: FieldError[];
  /** Mostra os erros nos campos (depois da primeira tentativa de avançar). */
  showErrors: boolean;
  validationError: string | null;
}

const usedText = (n: number | null) => (n ? `Usado em ${plural(n, "Jornada", "Jornadas")}` : "Ainda sem Jornadas");

/** Passo 1: lista de Mundos (salvos e o novo em edição), gerador e o Mundo escolhido em abas. */
export function WorldStep(props: WorldStepProps) {
  const { saved, savedError, draft, selection, world } = props;
  const items = saved?.filter((w) => w.status === "ok") ?? [];
  const unreadable = saved?.filter((w) => w.status !== "ok") ?? [];
  const total = items.length + (draft ? 1 : 0);

  return (
    <div className="nj-split nj-split--world">
      <aside className="nj-side nj-box" aria-labelledby="nj-worlds-title">
        <h4 id="nj-worlds-title" className="nj-box__title">
          Mundos <Chip>{total}</Chip>
        </h4>
        <div className="nj-wlist" role="listbox" aria-labelledby="nj-worlds-title">
          {draft ? (
            <button
              type="button"
              role="option"
              aria-selected={selection === "draft"}
              className={`nj-wi${selection === "draft" ? " nj-wi--on" : ""}`}
              onClick={() => props.onSelect("draft")}
            >
              <b>{draft.content.name.trim() || "Mundo sem nome"}</b>
              <span>
                {draft.content.era.name.trim() || "sem era"} · {draft.content.tone.name.trim() || "sem tom"}
              </span>
              <span className="nj-wi__new">Novo · salvo ao criar a Jornada</span>
            </button>
          ) : null}
          {items.map((w) => (
            <button
              key={w.id}
              type="button"
              role="option"
              aria-selected={selection === w.id}
              className={`nj-wi${selection === w.id ? " nj-wi--on" : ""}`}
              onClick={() => props.onSelect(w.id)}
            >
              <b>{w.name ?? "Mundo sem nome"}</b>
              <span>
                {w.era ?? "sem era"} · {w.tone ?? "sem tom"}
              </span>
              <span>
                {w.seed === null ? "sem semente" : `semente ${w.seed}`} · {usedText(w.journey_count)}
              </span>
            </button>
          ))}
          {saved === null && !savedError ? <p className="hint nj-wlist__empty">Carregando os Mundos salvos…</p> : null}
          {saved !== null && total === 0 ? (
            <p className="hint nj-wlist__empty">
              Você ainda não tem Mundos salvos. Gere um ou crie do zero; ele é salvo quando a Jornada for criada.
            </p>
          ) : null}
          {unreadable.length ? (
            <p className="hint nj-wlist__empty">
              {plural(unreadable.length, "Mundo salvo não pode ser lido", "Mundos salvos não podem ser lidos")} e não
              aparece{unreadable.length === 1 ? "" : "m"} aqui.
            </p>
          ) : null}
        </div>
        {savedError ? (
          <div className="callout callout--danger" role="alert">
            <p>{savedError}</p>
            <Button size="sm" onClick={props.onReloadSaved}>
              Tentar de novo
            </Button>
          </div>
        ) : null}
        <div className="nj-genbox">
          <TextField
            id="w-seed"
            label="Semente"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Ex.: 476"
            value={props.seed}
            error={props.seedError ?? undefined}
            onChange={(e) => props.onSeedChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                props.onUseSeed();
              }
            }}
            action={
              <Button onClick={props.onUseSeed} disabled={props.generating || props.seed.trim() === ""}>
                Usar
              </Button>
            }
          />
          <div className="nj-gbtns">
            <Button variant="primary" onClick={props.onGenerate} loading={props.generating}>
              <PixelIcon name="dice" /> Gerar mundo
            </Button>
            <Button onClick={props.onBlank} disabled={props.generating}>
              <PixelIcon name="plus" /> Criar do zero
            </Button>
          </div>
          {props.generateError ? (
            <p className="callout callout--danger" role="alert">
              {props.generateError}
            </p>
          ) : null}
        </div>
      </aside>

      <div className="nj-main">
        {world ? (
          <WorldCard {...props} world={world} />
        ) : props.worldLoading ? (
          <div className="nj-empty surface-parchment">
            <p>Carregando o Mundo…</p>
          </div>
        ) : props.worldLoadError ? (
          <div className="nj-empty surface-parchment">
            <p className="callout callout--danger" role="alert">
              {props.worldLoadError}
            </p>
            <Button onClick={props.onRetryWorld}>Tentar de novo</Button>
          </div>
        ) : (
          <div className={`nj-empty surface-parchment${props.showErrors ? " nj-empty--bad" : ""}`}>
            <PixelIcon name="globe" size={32} />
            <p>Escolha um Mundo da lista, gere um novo com uma semente ou crie um do zero preenchendo os campos.</p>
            {props.showErrors ? (
              <p className="callout callout--danger" role="alert">
                Gere um Mundo para continuar.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function WorldCard(props: WorldStepProps & { world: WorldContent }) {
  const { schema, world, onChange, startPlaceId, onStartPlace, errors, showErrors, tab, onTab, counts, selection, draft, saved } = props;
  const readOnly = selection !== "draft";
  const savedWorld = readOnly ? (saved?.find((w) => w.id === selection) ?? null) : null;
  const byField = errorsByField(errors);
  const err = (path: string, ...extra: string[]) => {
    if (!showErrors) return undefined;
    const list = [path, ...extra].flatMap((p) => byField.get(p) ?? []);
    return list.length ? list.join(" ") : undefined;
  };
  const patch = (fn: (w: WorldContent) => void) => {
    if (readOnly) return;
    const next = cloneWorld(world);
    fn(next);
    onChange(next);
  };
  const start = world.places.find((p) => p.id === startPlaceId);
  const seed = readOnly ? savedWorld?.seed ?? null : draft?.seed ?? null;
  const countHint = (key: "months" | "weekdays" | "religions" | "places", noun: string) =>
    `De ${schema[key].min} a ${schema[key].max} ${noun}.`;
  const text = (path: string, value: string, onValue: (w: WorldContent, v: string) => void) => ({
    id: id(path),
    value,
    readOnly,
    error: err(path),
    onChange: (e: { target: { value: string } }) => patch((w) => onValue(w, e.target.value)),
  });

  return (
    <section className="nj-card surface-parchment" aria-label={`Mundo: ${world.name.trim() || "sem nome"}`}>
      <div className="nj-card__head">
        <input
          id={id("name")}
          className={`nj-wname${err("name") ? " nj-wname--bad" : ""}`}
          aria-label="Nome do Mundo"
          aria-invalid={err("name") ? true : undefined}
          aria-describedby={err("name") ? "w-name-error" : undefined}
          placeholder="Nome do Mundo"
          value={world.name}
          readOnly={readOnly}
          autoComplete="off"
          onChange={(e) => patch((w) => void (w.name = e.target.value))}
        />
        {err("name") ? (
          <p id="w-name-error" className="field__error">
            {err("name")}
          </p>
        ) : null}
        <div className="nj-chips">
          <Chip>{world.era.name.trim() || "sem era"}</Chip>
          <Chip>Tom: {world.tone.name.trim() || "sem tom"}</Chip>
          <Chip>{world.calendar.era_label.trim() || "sem ano"}</Chip>
          <Chip>
            <PixelIcon name="pin" /> Começa em {start ? start.name.trim() || "(sem nome)" : "(escolha)"}
          </Chip>
          <Chip tone="gold">{seed === null ? "semente gerada ao criar a Jornada" : `semente ${seed}`}</Chip>
        </div>
      </div>
      <Tabs items={tabItems(WORLD_TABS, counts, false)} value={tab} onChange={onTab} label="Partes do Mundo" idPrefix={TABS_ID} className="nj-tabs" />
      <CardPane key={tab} idPrefix={TABS_ID} id={tab}>
        {readOnly ? (
          <div className="callout callout--warn nj-readonly">
            <span>
              Este Mundo já está salvo
              {savedWorld?.journey_count ? ` e é usado em ${plural(savedWorld.journey_count, "Jornada", "Jornadas")}` : ""}, então
              não muda. O lugar inicial você escolhe aqui. Para alterar o Mundo, duplique.
            </span>
            <Button size="sm" onClick={props.onDuplicate}>
              Duplicar e editar
            </Button>
          </div>
        ) : null}
        {props.validationError && !readOnly ? <p className="callout callout--warn">{props.validationError}</p> : null}
        {err("") ? (
          <p className="callout callout--danger" id={id("")} tabIndex={-1}>
            {err("")}
          </p>
        ) : null}

        {tab === "geral" ? (
          <div className="nj-grid2">
            <div className="nj-stack">
              <TextField label="Nome da era" {...text("era.name", world.era.name, (w, v) => void (w.era.name = v))} />
              <TextArea
                label="Descrição da era"
                rows={4}
                hint="A época em que a história se passa (texto de ambientação, sem mecânica)."
                {...text("era.description", world.era.description, (w, v) => void (w.era.description = v))}
              />
            </div>
            <div className="nj-stack">
              <TextField label="Nome do tom" {...text("tone.name", world.tone.name, (w, v) => void (w.tone.name = v))} />
              <TextArea
                label="Descrição do tom"
                rows={4}
                hint="O clima das histórias neste Mundo."
                {...text("tone.description", world.tone.description, (w, v) => void (w.tone.description = v))}
              />
            </div>
          </div>
        ) : null}

        {tab === "calendario" ? (
          <>
            <div className="nj-grid3">
              <TextField label="Nome do calendário" {...text("calendar.name", world.calendar.name, (w, v) => void (w.calendar.name = v))} />
              <NumberField
                id={id("calendar.year")}
                label="Ano atual"
                value={world.calendar.year}
                readOnly={readOnly}
                hint={`De ${schema.year.min} a ${schema.year.max.toLocaleString("pt-BR")}.`}
                error={err("calendar.year")}
                onChange={(v) => patch((w) => void (w.calendar.year = v))}
              />
              <TextField
                label="Nome do ano"
                hint="Por exemplo: Ano 476 da Fundação."
                {...text("calendar.era_label", world.calendar.era_label, (w, v) => void (w.calendar.era_label = v))}
              />
            </div>
            <div className="nj-sub">
              <h5 id={id("calendar.months")} tabIndex={-1}>
                Meses ({world.calendar.months.length})
              </h5>
              <small>
                {countHint("months", "meses")} Cada mês tem de {schema.month_days.min} a {schema.month_days.max} dias.
              </small>
            </div>
            {err("calendar.months") ? <p className="callout callout--danger">{err("calendar.months")}</p> : null}
            <ol className="edit-list">
              {world.calendar.months.map((month, i) => (
                <li key={i} className="edit-row">
                  <TextField
                    id={id(`calendar.months[${i}].name`)}
                    hideLabel
                    label={`Nome do mês ${i + 1}`}
                    placeholder="Nome do mês"
                    value={month.name}
                    readOnly={readOnly}
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
                    readOnly={readOnly}
                    error={err(`calendar.months[${i}].days`)}
                    onChange={(v) => patch((w) => void (w.calendar.months[i]!.days = v))}
                  />
                  <RemoveButton
                    label={`Remover o mês ${i + 1}`}
                    disabled={readOnly || !canRemove(schema, "months", world)}
                    onClick={() => patch((w) => void w.calendar.months.splice(i, 1))}
                  />
                </li>
              ))}
            </ol>
            <AddButton
              label="Adicionar mês"
              disabled={readOnly || !canAdd(schema, "months", world)}
              onClick={() => patch((w) => void w.calendar.months.push({ name: "", days: null }))}
            />
            <div className="nj-sub">
              <h5 id={id("calendar.weekdays")} tabIndex={-1}>
                Dias da semana ({world.calendar.weekdays.length})
              </h5>
              <small>{countHint("weekdays", "dias")}</small>
            </div>
            {err("calendar.weekdays") ? <p className="callout callout--danger">{err("calendar.weekdays")}</p> : null}
            <ol className="edit-list edit-list--grid">
              {world.calendar.weekdays.map((day, i) => (
                <li key={i} className="edit-row">
                  <TextField
                    id={id(`calendar.weekdays[${i}]`)}
                    hideLabel
                    label={`Dia ${i + 1} da semana`}
                    placeholder="Nome do dia"
                    value={day}
                    readOnly={readOnly}
                    error={err(`calendar.weekdays[${i}]`)}
                    onChange={(e) => patch((w) => void (w.calendar.weekdays[i] = e.target.value))}
                  />
                  <RemoveButton
                    label={`Remover o dia ${i + 1} da semana`}
                    disabled={readOnly || !canRemove(schema, "weekdays", world)}
                    onClick={() => patch((w) => void w.calendar.weekdays.splice(i, 1))}
                  />
                </li>
              ))}
            </ol>
            <AddButton
              label="Adicionar dia da semana"
              disabled={readOnly || !canAdd(schema, "weekdays", world)}
              onClick={() => patch((w) => void w.calendar.weekdays.push(""))}
            />
          </>
        ) : null}

        {tab === "religioes" ? (
          <>
            <div className="nj-sub">
              <h5 id={id("religions")} tabIndex={-1}>
                Religiões ({world.religions.length})
              </h5>
              <small>{countHint("religions", "religiões")}</small>
            </div>
            {err("religions") ? <p className="callout callout--danger">{err("religions")}</p> : null}
            {world.religions.map((religion, i) => (
              <div key={i} className="nj-item">
                <div className="nj-item__top">
                  <b className="nj-item__name">{religion.name.trim() || `Religião ${i + 1}`}</b>
                  <RemoveButton
                    label={`Remover a religião ${i + 1}`}
                    disabled={readOnly || !canRemove(schema, "religions", world)}
                    onClick={() => patch((w) => void w.religions.splice(i, 1))}
                  />
                </div>
                {err(`religions[${i}]`) ? <p className="callout callout--danger">{err(`religions[${i}]`)}</p> : null}
                <div className="nj-grid2">
                  <TextField label="Nome" {...text(`religions[${i}].name`, religion.name, (w, v) => void (w.religions[i]!.name = v))} />
                  <TextField
                    label="Domínio"
                    hint="Do que a divindade cuida (por exemplo, Colheita)."
                    {...text(`religions[${i}].domain`, religion.domain, (w, v) => void (w.religions[i]!.domain = v))}
                  />
                </div>
                <TextArea
                  label="Descrição"
                  rows={3}
                  {...text(`religions[${i}].description`, religion.description, (w, v) => void (w.religions[i]!.description = v))}
                />
              </div>
            ))}
            <AddButton
              label="Adicionar religião"
              disabled={readOnly || !canAdd(schema, "religions", world)}
              onClick={() => patch((w) => void w.religions.push({ name: "", domain: "", description: "" }))}
            />
          </>
        ) : null}

        {tab === "lugares" ? (
          <>
            <div className="nj-sub">
              <h5 id={id("places")} tabIndex={-1}>
                Lugares ({world.places.length})
              </h5>
              <small>{countHint("places", "lugares")} Escolha onde a Jornada começa.</small>
            </div>
            {err("places") ? <p className="callout callout--danger">{err("places")}</p> : null}
            {err("start") ? (
              <p className="callout callout--danger" id={id("start")} tabIndex={-1}>
                {err("start")}
              </p>
            ) : null}
            {world.places.map((place, i) => {
              const isStart = place.id === startPlaceId;
              const label = place.name.trim() || `Lugar ${i + 1}`;
              return (
                <div key={place.id || i} className={`nj-item${isStart ? " nj-item--start" : ""}`}>
                  <div className="nj-item__top">
                    <b className="nj-item__name">
                      {label} <small>{place.type}</small>
                    </b>
                    <button
                      type="button"
                      className="nj-startbtn"
                      aria-pressed={isStart}
                      aria-label={isStart ? `A Jornada começa em ${label}` : `Começar em ${label}`}
                      onClick={() => onStartPlace(place.id)}
                    >
                      <PixelIcon name="pin" /> {isStart ? "A Jornada começa aqui" : "Começar aqui"}
                    </button>
                    <RemoveButton
                      label={`Remover o lugar ${label}`}
                      disabled={readOnly || !canRemove(schema, "places", world)}
                      onClick={() => patch((w) => void w.places.splice(i, 1))}
                    />
                  </div>
                  {err(`places[${i}]`, `places[${i}].id`) ? (
                    <p className="callout callout--danger">{err(`places[${i}]`, `places[${i}].id`)}</p>
                  ) : null}
                  <div className="nj-grid2">
                    <TextField label="Nome" {...text(`places[${i}].name`, place.name, (w, v) => void (w.places[i]!.name = v))} />
                    <TextField
                      label="Tipo"
                      hint="Livre: vila, porto, ruína…"
                      {...text(`places[${i}].type`, place.type, (w, v) => void (w.places[i]!.type = v))}
                    />
                  </div>
                  <TextArea
                    label="Descrição"
                    rows={3}
                    {...text(`places[${i}].description`, place.description, (w, v) => void (w.places[i]!.description = v))}
                  />
                </div>
              );
            })}
            <AddButton
              label="Adicionar lugar"
              disabled={readOnly || !canAdd(schema, "places", world)}
              onClick={() => patch((w) => void w.places.push({ id: nextPlaceId(w.places), name: "", type: "", description: "" }))}
            />
          </>
        ) : null}
      </CardPane>
    </section>
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
  readOnly,
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
  readOnly: boolean;
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
      readOnly={readOnly}
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
