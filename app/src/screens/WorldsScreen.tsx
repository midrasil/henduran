import { useCallback, useEffect, useRef, useState } from "react";

import { BackendError, type BackendInfo, type FieldError } from "../api/backend";
import {
  deleteWorld,
  fetchWorld,
  generateWorld,
  listWorlds,
  saveWorld,
  validateWorld,
  type SavedWorld,
  type WorldContent,
  type WorldSchema,
} from "../api/journeys";
import { useServerValidation } from "../hooks/useServerValidation";
import { describeError } from "../lib/format";
import { Button, Dialog, PixelIcon } from "../ui";
import { blankWorld, cloneWorld, countByTab, focusFirstError, randomSeed, stripPrefix, WORLD_TABS, worldTabOf, type WorldTab } from "./newJourney/model";
import { plural } from "./newJourney/parts";
import { WorldStep, type WorldDraft, type WorldSelection } from "./newJourney/WorldStep";

import "./newJourney/NewJourney.css";

/**
 * Tela de Mundos do menu inicial — implementada sem protótipo por decisão do responsável em 2026-11-24 e aprovada como
 * está (docs/ui-ux/13-mundos.md; o protótipo de registro está em prototipos/mundos.html).
 *
 * Reaproveita o passo Mundo da Nova Jornada (`WorldStep`, em modo `library`): a lista de Mundos
 * salvos, os detalhes somente leitura em abas, Gerar mundo (com semente ou aleatório), Criar do
 * zero e Duplicar e editar. Aqui o Mundo novo é gravado por **Salvar Mundo** (`POST /worlds`), e um
 * Mundo salvo pode ser **excluído** (`DELETE /worlds/{id}`), o que o serviço recusa se alguma
 * Jornada o usa.
 */
export interface WorldsScreenProps {
  info: BackendInfo;
  schema: WorldSchema;
  /** Semente sorteada no cliente (injetável nos testes). */
  makeSeed?: (max: number) => number;
  /** Atraso da validação ao vivo, em ms (os testes usam 0). */
  validationDelayMs?: number;
}

export function WorldsScreen({ info, schema, makeSeed = randomSeed, validationDelayMs }: WorldsScreenProps) {
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
  const [tab, setTab] = useState<WorldTab>("geral");
  const [showErrors, setShowErrors] = useState(false);
  const [submitErrors, setSubmitErrors] = useState<FieldError[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState<(() => void) | null>(null);
  const [removing, setRemoving] = useState<{ world: SavedWorld; sending: boolean; error: string | null } | null>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const keepWorldRef = useRef<HTMLButtonElement>(null);

  const loadSaved = useCallback(async () => {
    setSavedError(null);
    try {
      const { worlds } = await listWorlds(info);
      setSaved(worlds);
      return worlds;
    } catch (err) {
      setSaved([]);
      setSavedError(`Não foi possível listar os Mundos salvos: ${describeError(err)}`);
      return null;
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

  const isDraft = selection === "draft";
  const world: WorldContent | null = isDraft ? (draft?.content ?? null) : selection ? (savedContent[selection] ?? null) : null;
  const runWorld = useCallback((content: WorldContent) => validateWorld(info, content), [info]);
  const check = useServerValidation(draft?.content ?? null, runWorld, validationDelayMs);
  const errors = isDraft ? [...(check.result?.errors ?? []), ...submitErrors] : [];
  const counts = world ? countByTab(WORLD_TABS, isDraft ? errors : [], worldTabOf) : null;

  /* ------------------------------------------------------------- Mundo novo */
  const requestReplace = (action: () => void) => {
    if (draft?.edited) setConfirmReplace(() => action);
    else action();
  };

  const adoptDraft = (next: WorldDraft) => {
    setDraft(next);
    setSelection("draft");
    setTab("geral");
    setShowErrors(false);
    setSubmitErrors([]);
    setSaveError(null);
    setNotice(null);
    setWorldLoadError(null);
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

  const select = (next: WorldSelection) => {
    if (next === selection) return;
    setSelection(next);
    setTab("geral");
    setWorldLoadError(null);
    setNotice(null);
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

  const onChange = (next: WorldContent) => {
    // Editado à mão: vira Mundo personalizado, sem semente.
    setDraft((prev) => (prev ? { content: next, seed: null, edited: true } : prev));
    if (submitErrors.length) setSubmitErrors([]);
  };

  /* ------------------------------------------------------------- salvar */
  const save = async () => {
    if (!draft || saving) return;
    setSaving(true);
    setSaveError(null);
    const result = await check.validateNow();
    if (!result) {
      setSaving(false);
      setSaveError("Não foi possível conferir o Mundo agora. Tente de novo.");
      return;
    }
    if (result.errors.length) {
      setSaving(false);
      setShowErrors(true);
      const first = result.errors[0]!;
      setTab(worldTabOf(first.field));
      setTimeout(() => focusFirstError("w", [first]), 0);
      return;
    }
    try {
      const { world: savedWorld } = await saveWorld(info, draft.content, draft.seed);
      setSavedContent((prev) => ({ ...prev, [savedWorld.id]: draft.content }));
      setDraft(null);
      setSeedText("");
      setSelection(savedWorld.id);
      setShowErrors(false);
      setNotice(`Mundo “${savedWorld.name ?? "sem nome"}” salvo.`);
      await loadSaved();
    } catch (err) {
      if (err instanceof BackendError && err.status === 422 && err.errors.length) {
        const next = stripPrefix(err.errors, "content.");
        setSubmitErrors(next);
        setShowErrors(true);
        const first = next[0];
        if (first) {
          setTab(worldTabOf(first.field));
          setTimeout(() => focusFirstError("w", [first]), 0);
        }
      }
      setSaveError(`Não foi possível salvar o Mundo: ${describeError(err)} Nada foi gravado.`);
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------------------------------------- excluir */
  const savedWorld = !isDraft && selection ? (saved?.find((w) => w.id === selection) ?? null) : null;
  const confirmDelete = async () => {
    if (!removing) return;
    setRemoving({ ...removing, sending: true, error: null });
    try {
      await deleteWorld(info, removing.world.id);
      const name = removing.world.name ?? "sem nome";
      setRemoving(null);
      setSelection(null);
      setNotice(`Mundo “${name}” excluído.`);
      await loadSaved();
    } catch (err) {
      const message =
        err instanceof BackendError && err.code === "mundo_em_uso"
          ? "Este Mundo é usado por Jornadas e não pode ser excluído. Exclua as Jornadas que o usam antes."
          : err instanceof BackendError && err.code === "uso_indeterminado"
            ? "Há Jornadas que não puderam ser lidas e talvez usem este Mundo; por segurança ele não foi excluído."
            : `Não foi possível excluir o Mundo: ${describeError(err)}`;
      setRemoving({ ...removing, sending: false, error: message });
    }
  };

  const inUse = (savedWorld?.journey_count ?? 0) > 0;

  return (
    <div className="nj nj--single">
      <section className="nj-panel nj-frame surface-dark" aria-labelledby="worlds-title">
        <header className="nj-head">
          <span className="nj-seal" aria-hidden="true">
            <PixelIcon name="globe" size={32} />
          </span>
          <div className="nj-head__titles">
            <h2 id="worlds-title" tabIndex={-1}>
              Mundos
            </h2>
            <p className="hint">Os Mundos salvos ficam disponíveis para novas Jornadas. Crie, duplique ou exclua aqui.</p>
          </div>
        </header>
        <div className="nj-body">
          {notice ? (
            <p className="callout callout--ok nj-body__alert" role="status">
              {notice}
            </p>
          ) : null}
          {saveError ? (
            <p className="callout callout--danger nj-body__alert" role="alert">
              {saveError}
            </p>
          ) : null}
          <WorldStep
            library
            schema={schema}
            saved={saved}
            savedError={savedError}
            onReloadSaved={() => void loadSaved()}
            draft={draft}
            selection={selection}
            onSelect={select}
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
            onChange={onChange}
            startPlaceId={null}
            onStartPlace={() => undefined}
            tab={tab}
            onTab={setTab}
            counts={counts}
            errors={errors}
            showErrors={showErrors}
            validationError={check.error}
            savedActions={
              <span className="nj-tbtns">
                <Button size="sm" onClick={duplicate}>
                  Duplicar e editar
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => savedWorld && setRemoving({ world: savedWorld, sending: false, error: null })}
                  disabled={!savedWorld}
                >
                  <PixelIcon name="cross" /> Excluir
                </Button>
              </span>
            }
            draftActions={
              <>
                <span>
                  Mundo novo, ainda não salvo. {draft?.seed != null ? `Gerado com a semente ${draft.seed}.` : "Mundo personalizado (sem semente)."}
                </span>
                <Button size="sm" variant="primary" loading={saving} onClick={() => void save()}>
                  <PixelIcon name="check" /> Salvar Mundo
                </Button>
              </>
            }
          />
        </div>
      </section>

      <Dialog
        open={removing !== null}
        tone="danger"
        title={`Excluir “${removing?.world.name ?? "Mundo sem nome"}”?`}
        description={
          <p>
            {removing && (removing.world.journey_count ?? 0) > 0
              ? `Este Mundo é usado em ${plural(removing.world.journey_count ?? 0, "Jornada", "Jornadas")} e não pode ser excluído enquanto elas existirem.`
              : "Isto apaga o Mundo do disco e não pode ser desfeito. Jornadas futuras não poderão usá-lo."}
          </p>
        }
        onClose={() => setRemoving(null)}
        dismissible={!removing?.sending}
        initialFocusRef={keepRef}
        actions={
          <>
            <Button ref={keepRef} onClick={() => setRemoving(null)} disabled={removing?.sending}>
              Cancelar
            </Button>
            <Button variant="danger" loading={removing?.sending ?? false} onClick={() => void confirmDelete()} disabled={inUse && removing?.world.id === savedWorld?.id}>
              Excluir do disco
            </Button>
          </>
        }
      >
        {removing?.error ? (
          <p className="callout callout--danger" role="alert">
            {removing.error}
          </p>
        ) : null}
      </Dialog>

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
