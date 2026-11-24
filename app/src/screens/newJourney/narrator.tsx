/**
 * Peças do Narrador que preenche dados na Nova Jornada (ADR-077, item 3; protótipo, estado
 * "Narrador (preenchimento)"): botão Sugerir, barra "Ideia para o Narrador" com Preencher o
 * que falta e o aviso com Desfazer. A chamada e a aplicação ficam no `NewJourneyWizard`.
 */
import { Button, PixelIcon, TextField } from "../../ui";

export const NO_MODEL_HINT = "Carregue um modelo em Modelos";

/** O que os passos recebem do assistente para os botões do Narrador. */
export interface NarratorControls {
  /** Há modelo pronto (senão os botões ficam desabilitados, com a dica). */
  ready: boolean;
  /** Chave da ação em andamento (`field:name`, `missing:ident`, `attributes`...), ou `null`. */
  busy: string | null;
  idea: string;
  onIdea: (idea: string) => void;
  /** Sugerir um campo (sobrescreve só ele). */
  suggest: (path: string) => void;
  /** Preencher o que falta numa aba (só os campos em branco). */
  fillMissing: (tab: "ident" | "obj") => void;
  suggestAttributes: () => void;
  suggestSkills: () => void;
  /** Escrever (desenvolver o que está escrito) ou Continuar a História. */
  history: (mode: "write" | "continue") => void;
}

export function AiButton({
  label,
  busyKey,
  narrator,
  onClick,
  big = false,
  title,
  ariaLabel,
  unavailable = false,
}: {
  /** Desabilita por outro motivo que não a falta de modelo (o `title` explica). */
  unavailable?: boolean;
  label: string;
  busyKey: string;
  narrator: Pick<NarratorControls, "ready" | "busy">;
  onClick: () => void;
  big?: boolean;
  title?: string;
  ariaLabel?: string;
}) {
  const busy = narrator.busy === busyKey;
  const disabled = !narrator.ready || narrator.busy !== null || unavailable;
  return (
    <button
      type="button"
      className={`nj-aibtn${big ? " nj-aibtn--big" : ""}${busy ? " nj-aibtn--busy" : ""}`}
      disabled={disabled}
      aria-busy={busy || undefined}
      aria-label={ariaLabel}
      title={narrator.ready ? (title ?? "Pedir uma sugestão ao Narrador") : NO_MODEL_HINT}
      onClick={onClick}
    >
      {busy ? <span className="nj-spin" aria-hidden="true" /> : <PixelIcon name="spark" />}
      {busy && big ? "Pensando…" : label}
    </button>
  );
}

/** Botão Sugerir de um campo de texto (vai na linha do rótulo). */
export function SuggestButton({ path, label, narrator }: { path: string; label: string; narrator: NarratorControls }) {
  return (
    <AiButton
      label="Sugerir"
      ariaLabel={`Sugerir ${label}`}
      busyKey={`field:${path}`}
      narrator={narrator}
      onClick={() => narrator.suggest(path)}
    />
  );
}

/** Topo das abas Identidade e Objetivos: a ideia opcional e Preencher o que falta. */
export function AiBar({ tab, narrator, idPrefix }: { tab: "ident" | "obj"; narrator: NarratorControls; idPrefix: string }) {
  return (
    <div className="nj-aibar">
      <TextField
        id={`${idPrefix}-idea`}
        label="Ideia para o Narrador (opcional)"
        placeholder="Ex.: mercenária endividada em busca de redenção"
        autoComplete="off"
        maxLength={500}
        value={narrator.idea}
        title="O Narrador só preenche o que está em branco; você confere tudo antes de seguir."
        onChange={(e) => narrator.onIdea(e.target.value)}
      />
      <AiButton
        big
        label="Preencher o que falta"
        busyKey={`missing:${tab}`}
        narrator={narrator}
        title="O Narrador só preenche os campos em branco desta aba"
        onClick={() => narrator.fillMissing(tab)}
      />
      {!narrator.ready ? (
        <p className="nj-aibar__hint">
          Nenhum modelo carregado. Abra <b>Modelos</b> no menu para o Narrador poder ajudar.
        </p>
      ) : null}
    </div>
  );
}

export interface AiNotice {
  message: string;
  error?: boolean;
  undo?: boolean;
}

/** Aviso depois de uma ação do Narrador (com Desfazer quando algo foi aplicado). */
export function AiToast({ notice, onUndo, onClose }: { notice: AiNotice; onUndo: () => void; onClose: () => void }) {
  return (
    <div className={`nj-toast${notice.error ? " nj-toast--error" : ""}`} role={notice.error ? "alert" : "status"}>
      <PixelIcon name={notice.error ? "warning" : "spark"} />
      <span>{notice.message}</span>
      {notice.undo ? (
        <Button size="sm" onClick={onUndo}>
          Desfazer
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" aria-label="Fechar o aviso" onClick={onClose}>
        <PixelIcon name="cross" />
      </Button>
    </div>
  );
}
