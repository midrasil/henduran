import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BackendError, type BackendInfo, type FieldError } from "../../api/backend";
import {
  createJourney,
  fetchWorld,
  generateWorld,
  listWorlds,
  validateCharacter,
  validateWorld,
  type CharacterDraft,
  type CreationRules,
  type JourneySummary,
  type NewJourneyBody,
  type SavedWorld,
  type WorldContent,
  type WorldSchema,
} from "../../api/journeys";
import { useServerValidation } from "../../hooks/useServerValidation";
import { describeError } from "../../lib/format";
import { Button, Dialog, PixelIcon, SkyBackdrop, type PixelIconName, type PortraitCropValue } from "../../ui";
import { PortraitDialog } from "../journey/PortraitDialog";
import { CharacterStep, type PortraitDraft } from "./CharacterStep";
import {
  advanceMove,
  blankWorld,
  CHARACTER_TABS,
  characterTabOf,
  characterTouched,
  cloneWorld,
  countByTab,
  defaultJourneyName,
  emptyCharacter,
  focusFirstError,
  randomAttributes,
  randomSeed,
  randomSkills,
  stripPrefix,
  toDraft,
  WORLD_TABS,
  worldTabOf,
  type CharacterForm,
  type CharacterTab,
  type Random,
  type ReviewTab,
  type TabDef,
  type WorldTab,
} from "./model";
import { checkPortraitFile, plural } from "./parts";
import { ReviewStep } from "./ReviewStep";
import { StartStep } from "./StartStep";
import { WorldStep, type WorldDraft, type WorldSelection } from "./WorldStep";

import "./NewJourney.css";

interface StepMeta {
  label: string;
  title: string;
  subtitle: string;
  note: string;
  icon: PixelIconName;
}

const STEPS: StepMeta[] = [
  {
    label: "Mundo",
    title: "Passo 1 de 3: Escolha o Mundo",
    subtitle: "Gere o Mundo onde a sua Jornada vai acontecer e ajuste o que quiser.",
    note: "O Mundo define o cenário, a era, o tom e os lugares da sua história. É só ambientação, sem regras de jogo.",
    icon: "globe",
  },
  {
    label: "Protagonista",
    title: "Passo 2 de 3: Crie o Protagonista",
    subtitle: "Quem é o personagem, o que ele busca e no que ele acredita.",
    note: "Ambição é o que o personagem almeja a longo prazo. Desejo é o que ele quer agora. Convicções são princípios que ele recusa trair.",
    icon: "person",
  },
  {
    label: "Revisão",
    title: "Passo 3 de 3: Revise",
    subtitle: "Confira o Mundo e o Protagonista antes de seguir.",
    note: "Se algo estiver errado, use Editar. O nome e a descrição da Jornada vêm na próxima tela.",
    icon: "scroll",
  },
  {
    label: "Iniciar Jornada",
    title: "Pronto para começar",
    subtitle: "Dê um nome e uma descrição à sua Jornada.",
    note: "Ao iniciar, a Jornada começa em Cena no lugar inicial, com o Aduran abrindo a primeira Cena.",
    icon: "star",
  },
];
const FINAL = 3;

/** O que vai junto da Jornada criada (o retrato é enviado depois de abrir a Jornada). */
export interface CreatedExtras {
  portrait?: { file: File; crop: PortraitCropValue };
}

export interface NewJourneyWizardProps {
  info: BackendInfo;
  rules: CreationRules;
  schema: WorldSchema;
  /** Jornada criada; quem chama abre a Jornada (e envia o retrato). */
  onCreated: (journey: JourneySummary, extras: CreatedExtras) => Promise<void> | void;
  onCancel: () => void;
  /** Sorteio (injetável nos testes). */
  random?: Random;
  /** Semente sorteada no cliente (injetável nos testes). */
  makeSeed?: (max: number) => number;
  /** Atraso da validação ao vivo, em ms (os testes usam 0). */
  validationDelayMs?: number;
}

interface SubmitErrors {
  world: FieldError[];
  start: string | null;
  character: FieldError[];
  name: string | null;
  description: string | null;
}

const NO_SUBMIT_ERRORS: SubmitErrors = { world: [], start: null, character: [], name: null, description: null };
const START_MESSAGE = "Escolha o lugar onde a Jornada começa.";

const createUrl = (file: Blob): string | null =>
  typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null;
const revokeUrl = (url: string | null | undefined) => {
  if (url && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
};

const pendingLabels = <T extends string>(tabs: TabDef<T>[], counts: Record<T, number>) =>
  tabs.filter((t) => counts[t.id] > 0).map((t) => t.label);

export function NewJourneyWizard({
  info,
  rules,
  schema,
  onCreated,
  onCancel,
  random = Math.random,
  makeSeed = randomSeed,
  validationDelayMs,
}: NewJourneyWizardProps) {
  const [step, setStep] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const [shown, setShown] = useState([false, false, false, false]);

  // Passo 1: Mundos salvos, o Mundo novo em edição e o escolhido.
  const [saved, setSaved] = useState<SavedWorld[] | null>(null);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [savedContent, setSavedContent] = useState<Record<string, WorldContent>>({});
  const [worldLoading, setWorldLoading] = useState<string | null>(null);
  const [worldLoadError, setWorldLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<WorldDraft | null>(null);
  const [selection, setSelection] = useState<WorldSelection | null>(null);
  const [seedText, setSeedText] = useState("");
  const [seedError, setSeedError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [startPlaceId, setStartPlaceId] = useState<string | null>(null);
  const [worldTab, setWorldTab] = useState<WorldTab>("geral");
  const [confirmReplace, setConfirmReplace] = useState<(() => void) | null>(null);

  // Passo 2
  const [form, setForm] = useState<CharacterForm>(() => emptyCharacter(rules));
  const [charTab, setCharTab] = useState<CharacterTab>("ident");
  const [portrait, setPortrait] = useState<PortraitDraft | null>(null);
  const [portraitOpen, setPortraitOpen] = useState(false);

  // Passo 3 e Iniciar Jornada
  const [reviewTab, setReviewTab] = useState<ReviewTab>("mundo");
  const [journeyName, setJourneyName] = useState("");
  const [journeyDescription, setJourneyDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitErrors, setSubmitErrors] = useState<SubmitErrors>(NO_SUBMIT_ERRORS);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  const keepWorldRef = useRef<HTMLButtonElement>(null);

  /* ------------------------------------------------------------- Mundos salvos */
  const loadSaved = useCallback(async () => {
    setSavedError(null);
    try {
      const { worlds } = await listWorlds(info);
      setSaved(worlds);
    } catch (err) {
      setSaved([]);
      setSavedError(`Não foi possível listar os Mundos salvos: ${describeError(err)}`);
    }
  }, [info]);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  const loadWorld = useCallback(
    async (id: string) => {
      setWorldLoading(id);
      setWorldLoadError(null);
      try {
        const { content } = await fetchWorld(info, id);
        if (!content) throw new Error("O Mundo não pode ser lido.");
        setSavedContent((prev) => ({ ...prev, [id]: content }));
      } catch (err) {
        setWorldLoadError(`Não foi possível abrir o Mundo: ${describeError(err)}`);
      } finally {
        setWorldLoading((current) => (current === id ? null : current));
      }
    },
    [info],
  );

  // A URL local do retrato é revogada ao sair do assistente.
  const portraitUrl = useRef<string | null>(null);
  portraitUrl.current = portrait?.url ?? null;
  useEffect(() => () => revokeUrl(portraitUrl.current), []);

  /* ------------------------------------------------------------- validação */
  const world: WorldContent | null =
    selection === "draft" ? (draft?.content ?? null) : selection ? (savedContent[selection] ?? null) : null;
  const isDraft = selection === "draft";
  const characterDraft = useMemo<CharacterDraft>(() => toDraft(form), [form]);
  const runWorld = useCallback((content: WorldContent) => validateWorld(info, content), [info]);
  const runCharacter = useCallback((d: CharacterDraft) => validateCharacter(info, d), [info]);
  const worldCheck = useServerValidation(draft?.content ?? null, runWorld, validationDelayMs);
  const characterCheck = useServerValidation(characterDraft, runCharacter, validationDelayMs);

  const startOk = !!world && startPlaceId !== null && world.places.some((p) => p.id === startPlaceId);
  const startErrors = (ok: boolean): FieldError[] =>
    ok ? [] : [{ field: "start", code: "obrigatorio", message: submitErrors.start ?? START_MESSAGE }];
  const worldErrorsFrom = (serverErrors: FieldError[]): FieldError[] =>
    world ? [...(isDraft ? serverErrors : []), ...submitErrors.world, ...startErrors(startOk && !submitErrors.start)] : [];
  const worldErrors = worldErrorsFrom(worldCheck.result?.errors ?? []);
  const worldCounts = world ? countByTab(WORLD_TABS, worldErrors, worldTabOf) : null;
  const characterErrors = useMemo(
    () => [...(characterCheck.result?.errors ?? []), ...submitErrors.character],
    [characterCheck.result, submitErrors.character],
  );
  const charCounts = countByTab(CHARACTER_TABS, characterErrors, characterTabOf);

  /* ------------------------------------------------------------- passos */
  const focusAfterStep = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const pending = focusAfterStep.current;
    focusAfterStep.current = null;
    if (pending) pending();
    else titleRef.current?.focus();
  }, [step]);

  const markShown = (index: number) => setShown((prev) => prev.map((v, i) => (i === index ? true : v)));

  const goTo = (index: number) => {
    setCreateError(null);
    setStep(index);
  };

  /** Mostra os erros do passo e leva o foco ao primeiro campo com erro da aba (depois de desenhar). */
  const showAndFocus = (index: number, prefix: "w" | "c", errors: FieldError[]) => {
    markShown(index);
    setTimeout(() => focusFirstError(prefix, errors), 0);
  };

  const advance = async () => {
    if (step === 0) {
      if (!world) {
        markShown(0);
        return;
      }
      let errors = worldErrors;
      if (isDraft) {
        const result = await worldCheck.validateNow();
        if (!result) {
          markShown(0);
          return;
        }
        errors = worldErrorsFrom(result.errors);
      }
      const move = advanceMove(
        WORLD_TABS.map((t) => t.id),
        worldTab,
        countByTab(WORLD_TABS, errors, worldTabOf),
      );
      if (move.kind === "stay") showAndFocus(0, "w", errors.filter((e) => worldTabOf(e.field) === worldTab));
      else if (move.kind === "tab") setWorldTab(move.tab);
      else goTo(1);
      return;
    }
    if (step === 1) {
      const result = await characterCheck.validateNow();
      if (!result) {
        markShown(1);
        return;
      }
      const errors = [...result.errors, ...submitErrors.character];
      const move = advanceMove(
        CHARACTER_TABS.map((t) => t.id),
        charTab,
        countByTab(CHARACTER_TABS, errors, characterTabOf),
      );
      if (move.kind === "stay") showAndFocus(1, "c", errors.filter((e) => characterTabOf(e.field) === charTab));
      else if (move.kind === "tab") setCharTab(move.tab);
      else goTo(2);
      return;
    }
    if (step === 2) goTo(FINAL);
  };

  /* ------------------------------------------------------------- Mundo */
  /** Trocar o Mundo em edição pede confirmação só se ele foi editado. */
  const requestReplace = (action: () => void) => {
    if (draft?.edited) setConfirmReplace(() => action);
    else action();
  };

  const adoptDraft = (next: WorldDraft) => {
    setDraft(next);
    setSelection("draft");
    setStartPlaceId(null);
    setWorldTab("geral");
    setWorldLoadError(null);
    setSubmitErrors((prev) => ({ ...prev, world: [], start: null }));
  };

  const doGenerate = async (value: number) => {
    setGenerating(true);
    setGenerateError(null);
    setSeedError(null);
    setSeedText(String(value));
    try {
      const result = await generateWorld(info, value);
      setSeedText(String(result.seed));
      adoptDraft({ content: result.content, seed: result.seed, edited: false });
    } catch (err) {
      const seedField = err instanceof BackendError ? err.errors.find((e) => e.field === "seed") : undefined;
      if (seedField) setSeedError(seedField.message);
      else setGenerateError(`Não foi possível gerar o Mundo agora: ${describeError(err)} Tente de novo.`);
    } finally {
      setGenerating(false);
    }
  };

  const applySeed = () => {
    const text = seedText.trim();
    const value = Number(text);
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(value) || value > schema.seed_max) {
      setSeedError(`A semente deve ser um número inteiro de 0 a ${schema.seed_max.toLocaleString("pt-BR")}.`);
      return;
    }
    requestReplace(() => void doGenerate(value));
  };

  const selectWorld = (next: WorldSelection) => {
    if (next === selection) return;
    setSelection(next);
    setStartPlaceId(null);
    setWorldTab("geral");
    setWorldLoadError(null);
    setSubmitErrors((prev) => ({ ...prev, world: [], start: null }));
    if (next !== "draft" && !savedContent[next]) void loadWorld(next);
  };

  const duplicate = () => {
    if (!world || isDraft) return;
    const copy = cloneWorld(world);
    copy.name = `${copy.name} (cópia)`.slice(0, schema.name_max);
    requestReplace(() => {
      setSeedText("");
      adoptDraft({ content: copy, seed: null, edited: false });
    });
  };

  const onWorldChange = (next: WorldContent) => {
    // Mundo editado: a semente passa a ser gerada ao criar a Jornada (ADR-077, item 5).
    setDraft((prev) => (prev ? { content: next, seed: null, edited: true } : prev));
    if (submitErrors.world.length) setSubmitErrors((prev) => ({ ...prev, world: [] }));
    if (startPlaceId && !next.places.some((p) => p.id === startPlaceId)) setStartPlaceId(null);
  };

  /* ------------------------------------------------------------- personagem */
  const onFormChange = (next: CharacterForm) => {
    setForm(next);
    if (submitErrors.character.length) setSubmitErrors((prev) => ({ ...prev, character: [] }));
  };

  const randomizeAttributes = () => {
    onFormChange({ ...form, attributes: { ...form.attributes, ...randomAttributes(rules, random) } });
  };

  const randomizeSkills = () => {
    const profile =
      rules.skill_profiles.find((p) => p.id === form.skill_profile) ??
      rules.skill_profiles[Math.floor(random() * rules.skill_profiles.length)];
    if (!profile) return;
    onFormChange({ ...form, skill_profile: profile.id, skills: randomSkills(rules, profile, random) });
  };

  /* ------------------------------------------------------------- criação */
  const create = async () => {
    if (!world || !startPlaceId || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const name = journeyName.trim();
      const description = journeyDescription.trim();
      const body: NewJourneyBody = {
        ...(name ? { name } : {}),
        ...(description ? { description } : {}),
        world: isDraft ? { content: world, ...(draft?.seed != null ? { seed: draft.seed } : {}) } : { id: selection! },
        start_place_id: startPlaceId,
        character: characterDraft,
      };
      const { journey } = await createJourney(info, body);
      await onCreated(journey, portrait ? { portrait: { file: portrait.file, crop: portrait.crop } } : {});
    } catch (err) {
      setCreating(false);
      if (err instanceof BackendError && err.status === 422 && err.errors.length) {
        const worldLevel = err.errors
          .filter((e) => e.field === "world" || (e.field.startsWith("world.") && !e.field.startsWith("world.content.")))
          .map((e) => ({ ...e, field: "" }));
        const next: SubmitErrors = {
          world: [...stripPrefix(err.errors, "world.content."), ...worldLevel],
          start: err.errors.find((e) => e.field === "start_place_id")?.message ?? null,
          character: stripPrefix(err.errors, "character."),
          name: err.errors.find((e) => e.field === "name")?.message ?? null,
          description: err.errors.find((e) => e.field === "description")?.message ?? null,
        };
        setSubmitErrors(next);
        setCreateError(`${err.message} Os dados continuam no assistente.`);
        if (next.world.length || next.start) {
          const first = next.world[0];
          const tab = first ? worldTabOf(first.field) : "lugares";
          markShown(0);
          setWorldTab(tab);
          focusAfterStep.current = () => setTimeout(() => focusFirstError("w", first ? [first] : [{ field: "start", code: "", message: "" }]), 0);
          setStep(0);
        } else if (next.character.length) {
          const first = next.character[0]!;
          markShown(1);
          setCharTab(characterTabOf(first.field));
          focusAfterStep.current = () => setTimeout(() => focusFirstError("c", [first]), 0);
          setStep(1);
        } else {
          setTimeout(() => document.getElementById(next.name ? "s-name" : "s-description")?.focus(), 0);
        }
        return;
      }
      const where = err instanceof BackendError && err.step ? ` (etapa: ${err.step})` : "";
      setCreateError(
        `Não foi possível iniciar a Jornada${where}: ${describeError(err)} Nada foi gravado pela metade; os dados continuam no assistente. Tente de novo.`,
      );
    }
  };

  /* ------------------------------------------------------------- cancelar */
  const dirty = draft !== null || selection !== null || characterTouched(form) || portrait !== null;
  const requestCancel = () => {
    if (dirty) setConfirmCancel(true);
    else onCancel();
  };

  /* ------------------------------------------------------------- trilho e rodapé */
  const issues = [world ? worldErrors.length : 1, characterErrors.length, 0, 0];
  const railStatus = (i: number): { text: string; state: "current" | "done" | "warn" | "todo" } => {
    if (i === step) return { text: "Em andamento", state: "current" };
    const n = issues[i] ?? 0;
    if (i < step && n === 0) return { text: "Completo", state: "done" };
    if ((i < step || shown[i]) && n > 0) return { text: plural(n, "pendência", "pendências"), state: "warn" };
    if (i > step) return { text: "A fazer", state: "todo" };
    return { text: "Completo", state: "done" };
  };

  const footerStatus = (() => {
    if (step === 0) {
      if (!world) return "Escolha, gere ou crie um Mundo para continuar.";
      const labels = worldCounts ? pendingLabels(WORLD_TABS, worldCounts) : [];
      return labels.length ? `Faltam: ${labels.join(", ")}` : "Passo completo";
    }
    if (step === 1) {
      const labels = pendingLabels(CHARACTER_TABS, charCounts);
      return labels.length ? `Faltam: ${labels.join(", ")}` : "Passo completo";
    }
    if (step === 2) return "Tudo certo. Avance para dar nome à Jornada.";
    return creating ? "Criando a Jornada…" : "";
  })();

  const current = STEPS[step]!;
  const savedWorld = !isDraft && selection !== null;
  const seed = isDraft ? (draft?.seed ?? null) : (saved?.find((w) => w.id === selection)?.seed ?? null);

  return (
    <div className="nj">
      <aside className="nj-rail nj-frame surface-dark" aria-label="Nova Jornada">
        <div className="nj-rail__top">
          <PixelIcon name="star" size={32} className="nj-rail__mark" />
          <h2 className="nj-rail__title">Nova Jornada</h2>
          <p className="hint">Crie uma nova aventura em um Mundo gerado para você.</p>
        </div>
        <div className="nj-rail__sep" aria-hidden="true" />
        <nav aria-label="Passos da Nova Jornada">
          <ol className="nj-steps">
            {STEPS.map((s, i) => {
              const status = railStatus(i);
              return (
                <li key={s.label} className={i === FINAL ? "nj-steps__final" : undefined}>
                  <button
                    type="button"
                    className={`nj-step nj-step--${status.state}${i === FINAL ? " nj-step--final" : ""}`}
                    aria-current={i === step ? "step" : undefined}
                    disabled={i > step || creating}
                    onClick={() => goTo(i)}
                  >
                    <span className="nj-step__num" aria-hidden="true">
                      {status.state === "done" ? <PixelIcon name="check" /> : i === FINAL ? <PixelIcon name="star" /> : i + 1}
                    </span>
                    <span className="nj-step__label">
                      <b>{s.label}</b>
                      <small>{status.text}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <SkyBackdrop period="entardecer" className="nj-rail__art" />
      </aside>

      <section className="nj-panel nj-frame surface-dark" aria-labelledby="wizard-step-title">
        <header className="nj-head">
          <span className="nj-seal" aria-hidden="true">
            <PixelIcon name={current.icon} size={32} />
          </span>
          <div className="nj-head__titles">
            <h3 id="wizard-step-title" ref={titleRef} tabIndex={-1}>
              {current.title}
            </h3>
            <p className="hint">{current.subtitle}</p>
          </div>
          <p className="nj-note surface-parchment" role="note">
            <span className="nj-note__i" aria-hidden="true">
              i
            </span>
            <span>{current.note}</span>
          </p>
        </header>

        <div className="nj-body">
          {createError && step !== FINAL ? (
            <p className="callout callout--danger nj-body__alert" role="alert">
              {createError}
            </p>
          ) : null}
          {step === 0 ? (
            <WorldStep
              schema={schema}
              saved={saved}
              savedError={savedError}
              onReloadSaved={() => void loadSaved()}
              draft={draft}
              selection={selection}
              onSelect={selectWorld}
              world={world}
              worldLoading={worldLoading !== null && worldLoading === selection}
              worldLoadError={worldLoadError}
              onRetryWorld={() => selection && selection !== "draft" && void loadWorld(selection)}
              seed={seedText}
              seedError={seedError}
              generating={generating}
              generateError={generateError}
              onSeedChange={(value) => {
                setSeedText(value);
                setSeedError(null);
              }}
              onUseSeed={applySeed}
              onGenerate={() => requestReplace(() => void doGenerate(makeSeed(schema.seed_max)))}
              onBlank={() =>
                requestReplace(() => {
                  setSeedText("");
                  adoptDraft({ content: blankWorld(schema), seed: null, edited: false });
                })
              }
              onDuplicate={duplicate}
              onChange={onWorldChange}
              startPlaceId={startPlaceId}
              onStartPlace={(value) => {
                setStartPlaceId(value);
                setSubmitErrors((prev) => ({ ...prev, start: null }));
              }}
              tab={worldTab}
              onTab={setWorldTab}
              counts={worldCounts}
              errors={worldErrors}
              showErrors={shown[0] ?? false}
              validationError={worldCheck.error}
            />
          ) : null}

          {step === 1 ? (
            <CharacterStep
              rules={rules}
              form={form}
              onChange={onFormChange}
              errors={characterErrors}
              derived={characterCheck.result?.derived ?? null}
              showErrors={shown[1] ?? false}
              validationError={characterCheck.error}
              tab={charTab}
              onTab={setCharTab}
              counts={charCounts}
              onRandomAttributes={randomizeAttributes}
              onRandomSkills={randomizeSkills}
              portrait={portrait}
              onPortrait={() => setPortraitOpen(true)}
            />
          ) : null}

          {step === 2 && world ? (
            <ReviewStep
              rules={rules}
              world={world}
              savedWorld={savedWorld}
              seed={seed}
              startPlaceId={startPlaceId}
              form={form}
              derived={characterCheck.result?.derived ?? null}
              portrait={portrait}
              tab={reviewTab}
              onTab={setReviewTab}
              onEditWorld={() => goTo(0)}
              onEditCharacter={() => goTo(1)}
            />
          ) : null}

          {step === FINAL && world ? (
            <>
              {createError ? (
                <p className="callout callout--danger nj-body__alert" role="alert">
                  {createError}
                </p>
              ) : null}
              <StartStep
                world={world}
                startPlaceId={startPlaceId}
                form={form}
                portrait={portrait}
                name={journeyName}
                defaultName={defaultJourneyName(form.name)}
                description={journeyDescription}
                nameError={submitErrors.name}
                descriptionError={submitErrors.description}
                onName={(value) => {
                  setJourneyName(value);
                  setSubmitErrors((prev) => ({ ...prev, name: null }));
                }}
                onDescription={(value) => {
                  setJourneyDescription(value);
                  setSubmitErrors((prev) => ({ ...prev, description: null }));
                }}
                disabled={creating}
              />
            </>
          ) : null}
        </div>

        <footer className="nj-foot">
          <Button onClick={requestCancel} disabled={creating}>
            <PixelIcon name="cross" /> Cancelar
          </Button>
          <span className="nj-foot__status" aria-live="polite">
            {footerStatus}
          </span>
          <Button onClick={() => goTo(step - 1)} disabled={step === 0 || creating}>
            <PixelIcon name="back" /> Voltar
          </Button>
          {step < FINAL ? (
            <Button variant="primary" onClick={() => void advance()}>
              Avançar <PixelIcon name="next" />
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void create()} loading={creating}>
              <PixelIcon name="star" /> {creating ? "Criando…" : "Iniciar Jornada"}
            </Button>
          )}
        </footer>
      </section>

      <PortraitDialog
        open={portraitOpen}
        onClose={() => setPortraitOpen(false)}
        info={info}
        name={form.name.trim() || "Personagem"}
        currentUrl={portrait?.url ?? null}
        currentCrop={portrait?.crop ?? null}
        onSaved={() => undefined}
        local={{
          check: checkPortraitFile,
          onApply: (file, crop) => {
            if (file) {
              revokeUrl(portrait?.url);
              setPortrait({ file, url: createUrl(file), crop });
            } else if (portrait) {
              setPortrait({ ...portrait, crop });
            }
          },
          onRemove: () => {
            revokeUrl(portrait?.url);
            setPortrait(null);
          },
        }}
      />

      <Dialog
        open={confirmCancel}
        tone="danger"
        title="Descartar a Nova Jornada?"
        description={<p>O Mundo e o personagem preenchidos até aqui serão perdidos.</p>}
        onClose={() => setConfirmCancel(false)}
        initialFocusRef={keepRef}
        actions={
          <>
            <Button ref={keepRef} onClick={() => setConfirmCancel(false)}>
              Continuar editando
            </Button>
            <Button variant="danger" onClick={onCancel}>
              Descartar
            </Button>
          </>
        }
      />

      <Dialog
        open={confirmReplace !== null}
        title="Descartar o Mundo em edição?"
        description={<p>O Mundo novo que você editou ainda não foi salvo e será descartado.</p>}
        onClose={() => setConfirmReplace(null)}
        initialFocusRef={keepWorldRef}
        actions={
          <>
            <Button ref={keepWorldRef} onClick={() => setConfirmReplace(null)}>
              Manter este
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const action = confirmReplace;
                setConfirmReplace(null);
                action?.();
              }}
            >
              Descartar e continuar
            </Button>
          </>
        }
      />
    </div>
  );
}
