import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BackendError, type BackendInfo, type FieldError } from "../../api/backend";
import {
  createJourney,
  generateWorld,
  validateCharacter,
  validateWorld,
  type CharacterDraft,
  type CreationRules,
  type JourneySummary,
  type WorldContent,
  type WorldSchema,
} from "../../api/journeys";
import { useServerValidation } from "../../hooks/useServerValidation";
import { describeError } from "../../lib/format";
import { Button, Dialog, PixelIcon, Stepper } from "../../ui";
import { CharacterStep } from "./CharacterStep";
import {
  characterTouched,
  defaultJourneyName,
  emptyCharacter,
  focusFirstError,
  randomAttributes,
  randomSeed,
  randomSkills,
  stripPrefix,
  toDraft,
  type CharacterForm,
  type Random,
} from "./model";
import { PendingList } from "./PendingList";
import { ReviewStep } from "./ReviewStep";
import { WorldStep } from "./WorldStep";

const STEPS = [
  { id: "mundo", label: "Mundo", title: "Mundo", subtitle: "Gere o Mundo onde a Jornada acontece e ajuste o que quiser." },
  { id: "protagonista", label: "Protagonista", title: "Protagonista", subtitle: "Quem é o seu personagem." },
  { id: "revisao", label: "Revisão", title: "Revisão", subtitle: "Confira tudo antes de criar a Jornada." },
];

/** Rótulo das Convicções na lista de pendências (as mensagens do servidor são iguais para as três). */
function characterFieldLabel(field: string): string | null {
  const m = /^convictions\[(\d+)\]\.(text|pillar)$/.exec(field);
  if (!m) return null;
  return `${m[2] === "pillar" ? "Pilar da Convicção" : "Convicção"} ${Number(m[1]) + 1}`;
}


export interface NewJourneyWizardProps {
  info: BackendInfo;
  rules: CreationRules;
  schema: WorldSchema;
  /** Jornada criada; quem chama abre a Jornada. */
  onCreated: (journey: JourneySummary) => Promise<void> | void;
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
}

const NO_SUBMIT_ERRORS: SubmitErrors = { world: [], start: null, character: [], name: null };

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  // Passo 1
  const [seed, setSeed] = useState("");
  const [seedError, setSeedError] = useState<string | null>(null);
  const [world, setWorld] = useState<WorldContent | null>(null);
  const [worldDirty, setWorldDirty] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState<number | null>(null);
  const [startPlaceId, setStartPlaceId] = useState<string | null>(null);

  // Passo 2
  const [form, setForm] = useState<CharacterForm>(() => emptyCharacter(rules));
  const [touched, setTouched] = useState<Set<string>>(() => new Set());

  // Passo 3
  const [journeyName, setJourneyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [showAll, setShowAll] = useState([false, false, false]);
  const [submitErrors, setSubmitErrors] = useState<SubmitErrors>(NO_SUBMIT_ERRORS);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);

  const draft = useMemo<CharacterDraft>(() => toDraft(form), [form]);
  const runWorld = useCallback((content: WorldContent) => validateWorld(info, content), [info]);
  const runCharacter = useCallback((d: CharacterDraft) => validateCharacter(info, d), [info]);
  const worldCheck = useServerValidation(world, runWorld, validationDelayMs);
  const characterCheck = useServerValidation(draft, runCharacter, validationDelayMs);

  // Ao trocar de passo, o foco vai para o título (ou para o campo com erro, depois de um 422).
  const focusAfterStep = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    // Cada passo começa do topo.
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    const pending = focusAfterStep.current;
    focusAfterStep.current = null;
    if (pending) pending();
    else titleRef.current?.focus();
  }, [step]);

  const worldErrors = useMemo(
    () => [...(worldCheck.result?.errors ?? []), ...submitErrors.world],
    [worldCheck.result, submitErrors.world],
  );
  const placeIds = new Set(world?.places.map((p) => p.id) ?? []);
  const startValid = startPlaceId !== null && placeIds.has(startPlaceId);
  const startError =
    submitErrors.start ?? (showAll[0] && !startValid ? "Escolha o lugar onde a Jornada começa." : null);
  const characterErrors = useMemo(
    () => [...(characterCheck.result?.errors ?? []), ...submitErrors.character],
    [characterCheck.result, submitErrors.character],
  );

  const dirty = world !== null || characterTouched(form);

  const markShowAll = (index: number, value = true) =>
    setShowAll((prev) => prev.map((v, i) => (i === index ? value : v)));

  /* ------------------------------------------------------------ gerar Mundo */
  const doGenerate = async (value: number) => {
    setGenerating(true);
    setGenerateError(null);
    setSeedError(null);
    setSeed(String(value));
    try {
      const result = await generateWorld(info, value);
      setWorld(result.content);
      setSeed(String(result.seed));
      setWorldDirty(false);
      setStartPlaceId(null);
      setSubmitErrors((prev) => ({ ...prev, world: [], start: null }));
    } catch (err) {
      const seedField = err instanceof BackendError ? err.errors.find((e) => e.field === "seed") : undefined;
      if (seedField) setSeedError(seedField.message);
      else setGenerateError(`Não foi possível gerar o Mundo: ${describeError(err)}`);
    } finally {
      setGenerating(false);
    }
  };

  const requestGenerate = (value: number) => {
    if (world && worldDirty) setConfirmRegenerate(value);
    else void doGenerate(value);
  };

  const generateWithSeed = () => {
    const text = seed.trim();
    const value = Number(text);
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(value) || value > schema.seed_max) {
      setSeedError(`A semente deve ser um número inteiro de 0 a ${schema.seed_max.toLocaleString("pt-BR")}.`);
      return;
    }
    requestGenerate(value);
  };

  /* ---------------------------------------------------------------- passos */
  const goTo = (index: number) => {
    setCreateError(null);
    setStep(index);
  };

  const advance = async () => {
    if (step === 0) {
      const result = world ? await worldCheck.validateNow() : null;
      const errors = [...(result?.errors ?? []), ...submitErrors.world];
      const startOk = startPlaceId !== null && placeIds.has(startPlaceId);
      if (!world || !result || !result.valid || errors.length || !startOk) {
        markShowAll(0);
        if (!world) {
          setGenerateError("Gere um Mundo antes de avançar.");
          return;
        }
        if (!focusFirstError("w", errors) && !startOk) document.getElementById("w-start")?.focus();
        return;
      }
      goTo(1);
      return;
    }
    if (step === 1) {
      const result = await characterCheck.validateNow();
      const errors = [...(result?.errors ?? []), ...submitErrors.character];
      if (!result || !result.valid || errors.length) {
        markShowAll(1);
        focusFirstError("c", errors);
        return;
      }
      goTo(2);
    }
  };

  const create = async () => {
    if (!world || !startPlaceId) return;
    setCreating(true);
    setCreateError(null);
    try {
      const name = journeyName.trim();
      const { journey } = await createJourney(info, {
        ...(name ? { name } : {}),
        world: { content: world },
        start_place_id: startPlaceId,
        character: draft,
      });
      await onCreated(journey);
    } catch (err) {
      setCreating(false);
      if (err instanceof BackendError && err.status === 422 && err.errors.length) {
        const next: SubmitErrors = {
          world: stripPrefix(err.errors, "world.content."),
          start: err.errors.find((e) => e.field === "start_place_id")?.message ?? null,
          character: stripPrefix(err.errors, "character."),
          name: err.errors.find((e) => e.field === "name")?.message ?? null,
        };
        const worldLevel = err.errors.filter((e) => e.field === "world" || (e.field.startsWith("world.") && !e.field.startsWith("world.content.")));
        next.world = [...next.world, ...worldLevel.map((e) => ({ ...e, field: "" }))];
        setSubmitErrors(next);
        const target = next.world.length || next.start ? 0 : next.character.length ? 1 : 2;
        markShowAll(target);
        setCreateError(err.message);
        const focusError = () => {
          if (target === 0 && !focusFirstError("w", next.world)) document.getElementById("w-start")?.focus();
          if (target === 1) focusFirstError("c", next.character);
          if (target === 2) document.getElementById("r-name")?.focus();
        };
        // Leva o foco ao primeiro erro depois que o passo certo estiver na tela.
        if (target !== step) {
          focusAfterStep.current = focusError;
          setStep(target);
        } else {
          setTimeout(focusError, 0);
        }
        return;
      }
      const step500 = err instanceof BackendError && err.step ? ` (etapa: ${err.step})` : "";
      setCreateError(`Não foi possível criar a Jornada${step500}: ${describeError(err)} Nada foi perdido; tente de novo.`);
    }
  };

  /* --------------------------------------------------------------- edições */
  const onWorldChange = (next: WorldContent) => {
    setWorld(next);
    setWorldDirty(true);
    if (submitErrors.world.length) setSubmitErrors((prev) => ({ ...prev, world: [] }));
    if (startPlaceId && !next.places.some((p) => p.id === startPlaceId)) setStartPlaceId(null);
  };

  const onFormChange = (next: CharacterForm) => {
    setForm(next);
    if (submitErrors.character.length) setSubmitErrors((prev) => ({ ...prev, character: [] }));
  };

  const touch = useCallback((path: string) => {
    setTouched((prev) => (prev.has(path) ? prev : new Set(prev).add(path)));
  }, []);

  const randomizeAttributes = () => {
    const values = randomAttributes(rules, random);
    onFormChange({ ...form, attributes: { ...form.attributes, ...values } });
    for (const id of Object.keys(values)) touch(`attributes.${id}`);
  };

  const randomizeSkills = () => {
    const profile =
      rules.skill_profiles.find((p) => p.id === form.skill_profile) ??
      rules.skill_profiles[Math.floor(random() * rules.skill_profiles.length)];
    if (!profile) return;
    onFormChange({ ...form, skill_profile: profile.id, skills: randomSkills(rules, profile, random) });
    touch("skill_profile");
  };

  const requestCancel = () => {
    if (dirty) setConfirmCancel(true);
    else onCancel();
  };

  const current = STEPS[step]!;
  const characterName = form.name;

  return (
    <div className="wizard">
      <aside className="wizard__side panel panel--dark surface-dark px-frame">
        <h2 className="wizard__heading">Nova Jornada</h2>
        <p className="hint">Crie um Mundo e um protagonista para começar.</p>
        <Stepper steps={STEPS} current={step} label="Passos da Nova Jornada" onSelect={goTo} />
      </aside>

      <section className="wizard__content" aria-labelledby="wizard-step-title">
        <header className="wizard__header panel panel--dark surface-dark px-frame">
          <h3 id="wizard-step-title" ref={titleRef} tabIndex={-1} className="wizard__title">
            Passo {step + 1} de {STEPS.length}: {current.title}
          </h3>
          <p className="hint">{current.subtitle}</p>
        </header>

        <div className="wizard__scroll" ref={scrollRef}>
          {step === 0 ? (
            <>
              {showAll[0] ? (
                <PendingList
                  prefix="w"
                  errors={[
                    ...worldErrors,
                    ...(startValid ? [] : [{ field: "start", code: "obrigatorio", message: "Escolha o lugar onde a Jornada começa." }]),
                  ]}
                />
              ) : null}
              <WorldStep
                schema={schema}
                world={world}
                seed={seed}
                seedError={seedError}
                generating={generating}
                generateError={generateError}
                onSeedChange={(value) => {
                  setSeed(value);
                  setSeedError(null);
                }}
                onGenerateWithSeed={generateWithSeed}
                onGenerateRandom={() => requestGenerate(makeSeed(schema.seed_max))}
                onChange={onWorldChange}
                startPlaceId={startPlaceId}
                onStartPlace={(value) => {
                  setStartPlaceId(value);
                  setSubmitErrors((prev) => ({ ...prev, start: null }));
                }}
                errors={worldErrors}
                startError={startError}
                validating={worldCheck.pending}
                validationError={worldCheck.error}
              />
            </>
          ) : null}

          {step === 1 ? (
            <>
              {showAll[1] ? <PendingList prefix="c" errors={characterErrors} labelFor={characterFieldLabel} /> : null}
              <CharacterStep
                rules={rules}
                form={form}
                onChange={onFormChange}
                errors={characterErrors}
                derived={characterCheck.result?.derived ?? null}
                touched={touched}
                onTouch={touch}
                showAll={showAll[1] ?? false}
                validating={characterCheck.pending}
                validationError={characterCheck.error}
                onRandomAttributes={randomizeAttributes}
                onRandomSkills={randomizeSkills}
              />
            </>
          ) : null}

          {step === 2 && world ? (
            <ReviewStep
              rules={rules}
              world={world}
              startPlaceId={startPlaceId}
              form={form}
              derived={characterCheck.result?.derived ?? null}
              journeyName={journeyName}
              defaultName={defaultJourneyName(characterName)}
              nameError={submitErrors.name}
              onNameChange={(value) => {
                setJourneyName(value);
                setSubmitErrors((prev) => ({ ...prev, name: null }));
              }}
            />
          ) : null}

          {createError ? (
            <p className="callout callout--danger" role="alert">
              {createError}
            </p>
          ) : null}
        </div>
      </section>

      <footer className="wizard__footer">
        <Button onClick={requestCancel} disabled={creating}>
          Cancelar
        </Button>
        <div className="wizard__nav">
          <Button onClick={() => goTo(step - 1)} disabled={step === 0 || creating}>
            <PixelIcon name="back" /> Voltar
          </Button>
          {step < STEPS.length - 1 ? (
            <Button variant="primary" onClick={() => void advance()}>
              Avançar <PixelIcon name="next" />
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void create()} loading={creating}>
              Criar Jornada
            </Button>
          )}
        </div>
      </footer>

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
            <Button ref={cancelRef} variant="danger" onClick={onCancel}>
              Descartar
            </Button>
          </>
        }
      />

      <Dialog
        open={confirmRegenerate !== null}
        title="Gerar outro Mundo?"
        description={<p>As suas edições neste Mundo serão substituídas pelo Mundo novo.</p>}
        onClose={() => setConfirmRegenerate(null)}
        actions={
          <>
            <Button onClick={() => setConfirmRegenerate(null)}>Manter este</Button>
            <Button
              variant="primary"
              onClick={() => {
                const value = confirmRegenerate;
                setConfirmRegenerate(null);
                if (value !== null) void doGenerate(value);
              }}
            >
              Gerar outro
            </Button>
          </>
        }
      />
    </div>
  );
}
