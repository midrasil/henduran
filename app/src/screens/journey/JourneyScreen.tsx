import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import type { BackendInfo } from "../../api/backend";
import { ENGINE_ERROR_CODES } from "../../api/chatStream";
import type { EngineStatus } from "../../api/engine";
import { fetchPortraitImage, fetchScene, portraitErrorMessage, uploadPortrait, type ArcScene, type JourneyMessage } from "../../api/journeyScreen";
import type { CreationRules, JourneySnapshot, MessageChannel, OpenJourneySummary, PortraitCrop, PortraitInfo, SceneView } from "../../api/journeys";
import { engineNoticeText } from "../../components/EngineNotice";
import { useJourneySession, type LiveStream } from "../../hooks/useJourneySession";
import { describeError, toPeriod } from "../../lib/format";
import { Button, Composer, Dialog, PERIOD_LABEL, PeriodIcon, PixelIcon, prefersReducedMotion, Tabs, type PixelIconName } from "../../ui";
import { ArcsColumn } from "./ArcsColumn";
import { EditJourneyDialog } from "./EditJourneyDialog";
import { EventLog } from "./EventLog";
import { FullSheetDialog } from "./FullSheetDialog";
import { JourneyTopBar, modelReady } from "./JourneyTopBar";
import { calendarText } from "./journeyText";
import { MessageList, type ViewMessage } from "./MessageList";
import { PortraitDialog } from "./PortraitDialog";
import { ProposalCard } from "./ProposalCard";
import { SheetSummary } from "./SheetSummary";
import { WorldDialog } from "./WorldDialog";

import "./JourneyScreen.css";

export interface JourneyScreenProps {
  info: BackendInfo;
  snapshot: JourneySnapshot;
  rules: CreationRules | null;
  engine: EngineStatus | null;
  onEngineProblem?: () => void;
  onOpenModels: () => void;
  onBackToMenu: () => void;
  copyText?: (text: string) => Promise<void>;
  /**
   * Retrato escolhido na Nova Jornada que não pôde ser enviado depois da criação: a tela
   * mostra um aviso com Tentar de novo e Escolher outro (o diálogo do retrato da ficha).
   */
  portraitRetry?: PortraitRetry | null;
  /** Nome ou descrição editados (Editar Jornada); quem chama atualiza o seu resumo. */
  onJourneyChanged?: (journey: OpenJourneySummary) => void;
}

export interface PortraitRetry {
  file: Blob;
  crop: PortraitCrop;
  /** Motivo da falha, já em texto para o jogador. */
  reason: string;
}

type Center = "cena" | "aduran" | "log";
type View = "loading" | "pending" | "cena" | "aduran" | "log" | "readonly";
type Side = "arcos" | "chat" | "ficha";
type Modal = "world" | "sheet" | "portrait" | "close" | "menu" | "edit" | null;

const SIDE_PREFIX = "jornada-col";
const SIDES: { id: Side; label: string }[] = [
  { id: "arcos", label: "Arcos" },
  { id: "chat", label: "Chat" },
  { id: "ficha", label: "Ficha" },
];

export const journeyTitle = (snapshot: JourneySnapshot) => snapshot.journey.name ?? "Jornada sem nome";

const defaultCopy = (text: string) =>
  navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject(new Error("sem área de transferência"));

function toView(m: JourneyMessage): ViewMessage {
  return { key: `m${m.id}`, id: m.id, role: m.role, content: m.content, interrupted: m.status === "cancelada", streaming: false };
}

const separated = (previous: string, addition: string) =>
  !previous || !addition || /\s$/.test(previous) || /^\s/.test(addition) ? previous + addition : `${previous} ${addition}`;

/** Mensagens a mostrar num canal: as gravadas e, por cima, a resposta em andamento. */
export function composeMessages(saved: JourneyMessage[], live: LiveStream | null, channel: MessageChannel): ViewMessage[] {
  if (!live || live.channel !== channel) return saved.map(toView);
  const reply = (content: string): ViewMessage => ({ key: "live-reply", id: null, role: "narrador", content, interrupted: false, streaming: true });
  switch (live.kind) {
    case "opening":
    case "accept":
      return [reply(live.text)];
    case "send":
      return [
        ...saved.map(toView),
        { key: "live-user", id: null, role: "jogador", content: live.userText ?? "", interrupted: false, streaming: false },
        reply(live.text),
      ];
    case "regenerate":
      return saved.map((m) => (m.id === live.targetId ? { ...toView(m), content: live.text, interrupted: false, streaming: true } : toView(m)));
    case "continue":
      return saved.map((m) =>
        m.id === live.targetId ? { ...toView(m), content: separated(m.content, live.text), interrupted: false, streaming: true } : toView(m),
      );
  }
}

function HeadTool({
  icon,
  label,
  pressed,
  onClick,
  badge,
  danger,
}: {
  icon: PixelIconName;
  label: string;
  pressed?: boolean;
  onClick: () => void;
  badge?: number;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-btn tip-below${danger ? " icon-btn--danger" : ""}`}
      aria-pressed={pressed === undefined ? undefined : pressed}
      aria-label={badge ? `${label} (${badge} ${badge === 1 ? "mensagem nova" : "mensagens novas"})` : label}
      data-tip={label}
      onClick={onClick}
    >
      <PixelIcon name={icon} size={24} />
      {badge ? (
        <span className="icon-btn__badge" aria-hidden="true">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Tela da Jornada (docs/ui-ux/09-tela-da-jornada.md): barra com o céu, coluna
 * dos Arcos, centro (página da Cena ou margem do Aduran e do Log) e Ficha.
 * Abrir, encerrar e gravar são do serviço; a tela só pede e mostra.
 */
export function JourneyScreen({ info, snapshot, rules, engine, onEngineProblem, onOpenModels, onBackToMenu, copyText = defaultCopy, portraitRetry = null, onJourneyChanged }: JourneyScreenProps) {
  const session = useJourneySession(info, snapshot, { onEngineProblem: () => onEngineProblem?.() });
  const { history, live, arcs } = session;
  const character = snapshot.character;
  const characterName = character?.name ?? snapshot.journey.character_name ?? "o personagem";
  const journeyPeriod = toPeriod(snapshot.journey.day_period);
  const ready = modelReady(engine);

  const [center, setCenter] = useState<Center>("cena");
  const [viewing, setViewing] = useState<number | null>(null);
  const [readonly, setReadonly] = useState<{ scene: SceneView; messages: JourneyMessage[] } | null>(null);
  const [readonlyError, setReadonlyError] = useState<string | null>(null);
  const [side, setSide] = useState<Side>("chat");
  const [arcsCollapsed, setArcsCollapsed] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [drafts, setDrafts] = useState<Record<"cena" | "aduran", string>>({ cena: "", aduran: "" });
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [titleSaving, setTitleSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [pendingProposal, setPendingProposal] = useState<"accept" | null>(null);
  const [portrait, setPortrait] = useState<PortraitInfo | null>(character?.portrait ?? null);
  const [portraitVersion, setPortraitVersion] = useState(0);
  const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [retry, setRetry] = useState<PortraitRetry | null>(portraitRetry);
  const [summary, setSummary] = useState<OpenJourneySummary>(snapshot.journey);
  const [retrying, setRetrying] = useState(false);
  const [turn, setTurn] = useState(0);
  const [seenAduran, setSeenAduran] = useState<number | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  /* ------------------------------------------------------------ estado derivado */
  const mode = history?.mode ?? snapshot.mode ?? "fora_de_cena";
  const openScene = history?.scene ?? null;
  const messages = history?.messages ?? [];
  const sceneMessages = openScene ? messages.filter((m) => m.channel === "cena" && m.scene_id === openScene.id) : [];
  const aduranMessages = messages.filter((m) => m.channel === "fora_de_cena");
  const needsOpening = history !== null && messages.length === 0 && openScene === null && arcs.every((a) => a.scenes.length === 0);
  const liveScene = live && (live.kind === "opening" || live.kind === "accept") ? live : null;

  let view: View;
  if (viewing !== null) view = "readonly";
  else if (liveScene) view = "cena";
  else if (history === null) view = "loading";
  else if (needsOpening) view = "pending";
  else if (mode === "em_cena" && openScene) view = center;
  else view = center === "log" ? "log" : "aduran";
  const surface = view === "aduran" || view === "log" ? "margin" : "page";

  // Ao entrar numa Cena, o centro vai para a página; ao sair, para o Aduran.
  const lastMode = useRef(mode);
  useEffect(() => {
    if (lastMode.current === mode) return;
    lastMode.current = mode;
    setCenter(mode === "em_cena" ? "cena" : "aduran");
    setViewing(null);
    setEditingTitle(false);
  }, [mode]);

  // Virada de página curta quando a superfície muda (sem animação com movimento reduzido).
  const lastSurface = useRef(surface);
  useEffect(() => {
    if (lastSurface.current === surface) return;
    lastSurface.current = surface;
    if (!prefersReducedMotion()) setTurn((n) => n + 1);
  }, [surface]);

  // Aviso de mensagem nova do Aduran (durante a Cena, fora da margem).
  const aduranReplies = aduranMessages.filter((m) => m.role === "narrador").length;
  useEffect(() => {
    if (history === null) return;
    if (seenAduran === null || view === "aduran") setSeenAduran(aduranReplies);
  }, [history, view, aduranReplies, seenAduran]);
  const unread = seenAduran === null || view === "aduran" ? 0 : Math.max(0, aduranReplies - seenAduran);

  // Anúncios ao leitor de tela: começo e fim da resposta, nunca cada palavra.
  const liveSpeaker = live?.channel === "fora_de_cena" ? "Aduran" : "Narrador";
  const streamingNow = live !== null;
  const wasStreaming = useRef(false);
  useEffect(() => {
    if (!wasStreaming.current && streamingNow) setAnnouncement(`O ${liveSpeaker} está respondendo…`);
    wasStreaming.current = streamingNow;
  }, [streamingNow, liveSpeaker]);
  useEffect(() => {
    const f = session.finished;
    if (!f) return;
    const who = f.channel === "fora_de_cena" ? "Aduran" : "Narrador";
    setAnnouncement(f.interrupted ? `Resposta interrompida. ${who}: ${f.text}` : `${who}: ${f.text}`);
  }, [session.finished]);

  // Cena encerrada em leitura.
  useEffect(() => {
    if (viewing === null) {
      setReadonly(null);
      return;
    }
    let active = true;
    setReadonly(null);
    setReadonlyError(null);
    fetchScene(info, viewing)
      .then((r) => {
        if (active) setReadonly(r);
      })
      .catch((err: unknown) => {
        if (active) setReadonlyError(describeError(err, "Não foi possível abrir a Cena."));
      });
    return () => {
      active = false;
    };
  }, [info, viewing, session.revision]);

  // Retrato: a imagem exige o token, então vem como blob e vira uma URL local (revogada ao trocar ou sair).
  useEffect(() => {
    if (!portrait) {
      setPortraitUrl(null);
      return;
    }
    const controller = new AbortController();
    let url: string | null = null;
    fetchPortraitImage(info, controller.signal)
      .then((blob) => {
        if (!blob || controller.signal.aborted || typeof URL.createObjectURL !== "function") return;
        url = URL.createObjectURL(blob);
        setPortraitUrl(url);
      })
      .catch(() => {
        if (!controller.signal.aborted) setPortraitUrl(null);
      });
    return () => {
      controller.abort();
      if (url && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
    };
  }, [info, portrait !== null, portraitVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 1900);
    return () => clearTimeout(timer);
  }, [toast]);

  /* ------------------------------------------------------------------ ações */
  const goCenter = (next: Center) => {
    setViewing(null);
    setEditingTitle(false);
    setCenter(next);
    setSide("chat");
  };

  const selectScene = (scene: ArcScene) => {
    setEditingTitle(false);
    setSide("chat");
    if (scene.status === "aberta") {
      setViewing(null);
      setCenter("cena");
    } else setViewing(scene.id);
  };

  const copy = useCallback(
    (text: string) => {
      copyText(text).then(
        () => setToast("Mensagem copiada"),
        () => setToast("Não foi possível copiar"),
      );
    },
    [copyText],
  );

  const onPage = view === "cena" || view === "pending";
  const channel: MessageChannel = onPage ? "cena" : "fora_de_cena";
  const draftKey = onPage ? "cena" : "aduran";

  const submit = () => {
    const text = drafts[draftKey];
    if (!text.trim() || session.streaming) return;
    setDrafts((d) => ({ ...d, [draftKey]: "" }));
    void session.send(text, channel);
    composerRef.current?.focus();
  };

  const accept = async () => {
    setPendingProposal("accept");
    try {
      await session.acceptProposal();
    } finally {
      setPendingProposal(null);
    }
  };

  const confirmClose = async () => {
    setCloseError(null);
    const result = await session.closeScene();
    if (result) setModal(null);
  };

  useEffect(() => {
    if (modal === "close" && session.error && session.busy === null) setCloseError(session.error.message);
  }, [modal, session.error, session.busy]);

  const startRename = (scene: SceneView) => {
    setTitleDraft(scene.title ?? "");
    setTitleError(null);
    setEditingTitle(true);
  };

  const saveTitle = async (e: FormEvent, sceneId: number) => {
    e.preventDefault();
    const title = titleDraft.trim();
    if (!title) {
      setTitleError("Escreva um nome para a Cena.");
      return;
    }
    setTitleSaving(true);
    const err = await session.renameScene(sceneId, title);
    setTitleSaving(false);
    if (err) setTitleError(err);
    else setEditingTitle(false);
  };

  const onPortraitSaved = (saved: PortraitInfo | null, newImage: boolean) => {
    setPortrait(saved);
    if (newImage) setPortraitVersion((n) => n + 1);
    setToast(saved ? "Retrato salvo" : "Retrato removido");
    if (saved) setRetry(null);
  };

  const retryPortrait = async () => {
    if (!retry || retrying) return;
    setRetrying(true);
    try {
      const saved = await uploadPortrait(info, retry.file, retry.crop);
      onPortraitSaved(saved, true);
    } catch (err) {
      setRetry({ ...retry, reason: portraitErrorMessage(err) });
    } finally {
      setRetrying(false);
    }
  };

  /* ------------------------------------------------------------------ partes */
  const currentPlaceName = session.currentPlace?.name ?? snapshot.journey.location ?? "lugar desconhecido";

  const sceneTitle = (scene: SceneView | null, editable: boolean, fallback: string): ReactNode => {
    if (editable && scene?.id != null && editingTitle) {
      const id = scene.id;
      return (
        <form className="title-edit" onSubmit={(e) => void saveTitle(e, id)}>
          <label className="visually-hidden" htmlFor="titulo-cena">
            Nome da Cena
          </label>
          <input
            id="titulo-cena"
            className="title-edit__input"
            value={titleDraft}
            autoFocus
            aria-invalid={titleError ? true : undefined}
            aria-describedby={titleError ? "titulo-cena-erro" : undefined}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setEditingTitle(false);
              }
            }}
          />
          <Button type="submit" size="sm" variant="primary" loading={titleSaving}>
            Salvar
          </Button>
          <Button size="sm" onClick={() => setEditingTitle(false)} disabled={titleSaving}>
            Cancelar
          </Button>
          {titleError ? (
            <p id="titulo-cena-erro" className="title-edit__error" role="alert">
              {titleError}
            </p>
          ) : null}
        </form>
      );
    }
    return (
      <h2 className="stage__title">
        {scene?.title ?? fallback}
        {editable && scene?.id != null ? (
          <button type="button" className="pen-btn" aria-label="Renomear a Cena" data-tip="Renomear a Cena" onClick={() => startRename(scene)}>
            <PixelIcon name="pen" />
          </button>
        ) : null}
      </h2>
    );
  };

  const head = (eyebrow: ReactNode, title: ReactNode, sub: ReactNode, tools: ReactNode) => (
    <div className="stage__head">
      <div className="stage__where">
        <p className="stage__eyebrow">{eyebrow}</p>
        {title}
        {sub ? <p className="stage__sub">{sub}</p> : null}
      </div>
      {tools}
    </div>
  );

  const sceneTools = (kind: "cena" | "aduran" | "log") => (
    <div className="stage__tools" role="toolbar" aria-label="Ferramentas da Cena">
      {kind !== "cena" ? <HeadTool icon="back" label="Voltar à Cena" onClick={() => goCenter("cena")} /> : null}
      <HeadTool icon="quill" label="Aduran (não entra na Cena)" pressed={kind === "aduran"} badge={kind === "aduran" ? 0 : unread} onClick={() => goCenter("aduran")} />
      <HeadTool icon="scroll" label="Log desta Cena" pressed={kind === "log"} onClick={() => goCenter("log")} />
      <span className="stage__sep" aria-hidden="true" />
      <HeadTool
        icon="exit"
        label="Encerrar Cena"
        danger
        onClick={() => {
          session.clearError();
          setCloseError(null);
          setModal("close");
        }}
      />
    </div>
  );

  const outTools = (
    <div className="stage__tools" role="toolbar" aria-label="Ferramentas">
      <HeadTool icon="quill" label="Aduran" pressed={view !== "log"} onClick={() => goCenter("aduran")} />
      <HeadTool icon="scroll" label="Log da Jornada" pressed={view === "log"} onClick={() => goCenter("log")} />
    </div>
  );

  const errorBox = session.error ? (
    <div className="callout callout--danger stage__error" role="alert">
      <p>Erro: {session.error.message}</p>
      {session.error.code && ENGINE_ERROR_CODES.has(session.error.code) ? (
        <Button size="sm" onClick={onOpenModels}>
          Configurar modelo
        </Button>
      ) : null}
    </div>
  ) : null;

  const composer = (placeholder: string, disabled = false, hint?: string | null) => (
    <div className="stage__composer">
      <Composer
        id="jornada-mensagem"
        ref={composerRef}
        label={onPage ? "Mensagem para o Narrador da Cena" : "Mensagem para o Aduran"}
        value={disabled ? "" : drafts[draftKey]}
        onChange={(v) => setDrafts((d) => ({ ...d, [draftKey]: v }))}
        onSubmit={submit}
        onStop={session.cancel}
        streaming={session.streaming && !disabled}
        disabled={disabled}
        placeholder={placeholder}
        {...(hint !== undefined ? { hint } : {})}
      />
    </div>
  );

  const redo = (ch: MessageChannel) => ({
    onRegenerate: () => void session.regenerate(ch),
    onContinue: () => void session.continueReply(ch),
  });

  let body: ReactNode;
  if (view === "loading") {
    body = (
      <>
        {head("Jornada", <h2 className="stage__title">Abrindo a Jornada…</h2>, null, null)}
        <div className="stage__pad">
          {session.loadError ? (
            <div className="callout callout--danger" role="alert">
              <p>{session.loadError}</p>
              <Button size="sm" onClick={() => void session.reload()}>
                Tentar de novo
              </Button>
            </div>
          ) : (
            <p className="hint">Carregando o histórico…</p>
          )}
        </div>
      </>
    );
  } else if (view === "pending") {
    const engineText = engineNoticeText(engine);
    body = (
      <>
        {head(
          <>
            <PeriodIcon period={journeyPeriod} size={16} /> {PERIOD_LABEL[journeyPeriod]} · {currentPlaceName}
          </>,
          <h2 className="stage__title">A história ainda não começou</h2>,
          "A primeira mensagem da Jornada é do Narrador.",
          null,
        )}
        <div className="opening">
          <span className="opening__icon" aria-hidden="true">
            <PixelIcon name="quill" size={32} />
          </span>
          <h3 className="opening__title">{ready ? "O Narrador vai preparar a Cena inicial" : "Falta preparar o Narrador"}</h3>
          <p>
            {ready
              ? `Ele usa o Mundo, o lugar inicial e a história de ${characterName} para decidir onde e como tudo começa.`
              : "Carregue um modelo de IA para que o Narrador escreva a abertura."}
          </p>
          {!ready ? (
            <div className="opening__warn" role="status">
              {engineText} Clique no indicador de modelo, no alto da tela, ou no botão abaixo.
            </div>
          ) : null}
          {errorBox}
          <div className="opening__actions">
            {!ready ? <Button onClick={onOpenModels}>Configurar modelo</Button> : null}
            <Button variant="primary" disabled={!ready} onClick={() => void session.generateOpening()}>
              Gerar abertura
            </Button>
          </div>
        </div>
        {composer("Você poderá escrever depois que o Narrador abrir a Cena.", true)}
      </>
    );
  } else if (view === "readonly") {
    const scene = readonly?.scene ?? null;
    const period = toPeriod(scene?.day_period);
    body = (
      <>
        {head(
          <>
            <PeriodIcon period={period} size={16} /> {PERIOD_LABEL[period]} · encerrada
          </>,
          sceneTitle(scene, true, "Cena encerrada"),
          scene ? [scene.place_name, scene.motive].filter(Boolean).join(" · ") : null,
          null,
        )}
        <div className="readonly-bar">
          <span>Cena encerrada. Você pode ler, mas não escrever.</span>
          <Button variant="ghost" onClick={() => goCenter(mode === "em_cena" ? "cena" : "aduran")}>
            Voltar ao chat atual
          </Button>
        </div>
        {readonlyError ? (
          <p className="callout callout--danger stage__pad" role="alert">
            {readonlyError}
          </p>
        ) : !readonly ? (
          <p className="hint stage__pad">Abrindo a Cena…</p>
        ) : (
          <MessageList
            label="Conversa da Cena encerrada"
            messages={readonly.messages.map(toView)}
            narratorName="Narrador"
            playerName={characterName}
            capital
            readonly
            onCopy={copy}
            footer={
              readonly.scene.summary ? (
                <section className="summary-box" aria-label="Resumo da Cena">
                  <p className="stage__eyebrow">Resumo da Cena</p>
                  <p>{readonly.scene.summary}</p>
                </section>
              ) : null
            }
          />
        )}
      </>
    );
  } else if (view === "cena") {
    const scene = liveScene ? liveScene.scene : openScene;
    const period = toPeriod(scene?.day_period ?? snapshot.journey.day_period);
    const place = scene?.place_name ?? (liveScene?.kind === "opening" ? currentPlaceName : null);
    body = (
      <>
        {head(
          <>
            <PeriodIcon period={period} size={16} /> {PERIOD_LABEL[period]}
            {place ? ` · ${place}` : ""}
          </>,
          liveScene ? <h2 className="stage__title">{scene?.title ?? "O Narrador está preparando a Cena…"}</h2> : sceneTitle(scene, true, "Cena"),
          scene?.motive ?? null,
          liveScene ? null : sceneTools("cena"),
        )}
        <MessageList
          label="Conversa da Cena"
          messages={composeMessages(liveScene ? [] : sceneMessages, live, "cena")}
          narratorName="Narrador"
          playerName={characterName}
          capital
          busy={session.streaming}
          onCopy={copy}
          {...redo("cena")}
          footer={errorBox}
        />
        {composer(`O que ${characterName} faz?`, liveScene !== null)}
      </>
    );
  } else if (view === "aduran") {
    const inScene = mode === "em_cena" && openScene !== null;
    const proposal = !inScene ? (history?.proposal ?? null) : null;
    body = (
      <>
        {inScene
          ? head(
              `Durante a Cena · ${openScene.title ?? "Cena"}`,
              <h2 className="stage__title">Aduran</h2>,
              "Dúvidas e regras. O que você fala aqui não entra na Cena.",
              sceneTools("aduran"),
            )
          : head(
              `Fora de Cena · ${currentPlaceName} · ${PERIOD_LABEL[journeyPeriod]}`,
              <h2 className="stage__title">Aduran</h2>,
              `Diga o que ${characterName} fará a seguir. O Aduran decide se isso pede uma Cena.`,
              outTools,
            )}
        <MessageList
          label="Conversa com o Aduran"
          messages={composeMessages(aduranMessages, live, "fora_de_cena")}
          narratorName="Aduran"
          playerName={characterName}
          busy={session.streaming}
          onCopy={copy}
          {...redo("fora_de_cena")}
          empty={<p className="hint">Pergunte ao Aduran ou diga o que {characterName} vai fazer.</p>}
          footer={
            <>
              {session.proposalNotice ? (
                <p className="callout callout--warn" role="status">
                  {session.proposalNotice}
                </p>
              ) : null}
              {proposal ? (
                <ProposalCard
                  proposal={proposal}
                  onAccept={() => void accept()}
                  onReroll={() => void session.reroll()}
                  onDecline={() => void session.decline()}
                  pending={pendingProposal ?? (session.busy === "reroll" || session.busy === "decline" ? session.busy : null)}
                  disabled={session.streaming || session.busy !== null}
                />
              ) : null}
              {errorBox}
            </>
          }
        />
        {composer(inScene ? "Pergunte ao Aduran…" : `Pergunte ou diga o que ${characterName} vai fazer…`)}
      </>
    );
  } else {
    const inScene = mode === "em_cena" && openScene !== null;
    body = (
      <>
        {inScene
          ? head(
              `Cena · ${openScene.title ?? "Cena"}`,
              <h2 className="stage__title">Log da Cena</h2>,
              "Só o que aconteceu nesta Cena.",
              sceneTools("log"),
            )
          : head("Fora de Cena", <h2 className="stage__title">Log da Jornada</h2>, "Tudo o que o motor registrou, de todas as Cenas.", outTools)}
        <div className="stage__scroll">
          <EventLog info={info} sceneId={inScene ? openScene.id : null} characterName={characterName} revision={session.revision} />
        </div>
      </>
    );
  }

  const currentCardId = viewing ?? (view === "cena" && openScene ? openScene.id : null);
  const columnsId = (id: Side) => `${SIDE_PREFIX}-panel-${id}`;

  return (
    <div className="jscreen">
      <JourneyTopBar
        journeyName={summary.name ?? journeyTitle(snapshot)}
        characterName={characterName}
        worldName={snapshot.world.content?.name ?? null}
        period={journeyPeriod}
        dateText={calendarText(snapshot.calendar)}
        engine={engine}
        onOpenModels={onOpenModels}
        onOpenWorld={() => setModal("world")}
        onBackToMenu={() => setModal("menu")}
        onEditJourney={() => setModal("edit")}
      />
      {retry ? (
        <div className="callout callout--warn jscreen__notice" role="alert">
          <p>
            A Jornada foi criada, mas o retrato não foi enviado: {retry.reason} Tente de novo ou escolha outro retrato na
            ficha do personagem.
          </p>
          <div className="actions">
            <Button size="sm" variant="primary" loading={retrying} onClick={() => void retryPortrait()}>
              Tentar de novo
            </Button>
            <Button size="sm" disabled={retrying || !character} onClick={() => setModal("portrait")}>
              Escolher outro
            </Button>
            <Button size="sm" variant="ghost" disabled={retrying} onClick={() => setRetry(null)}>
              Fechar
            </Button>
          </div>
        </div>
      ) : null}
      <Tabs items={SIDES} value={side} onChange={setSide} label="Colunas da Jornada" idPrefix={SIDE_PREFIX} className="jscreen__sides" />
      <div className="jscreen__game" data-side={side} data-arcs={arcsCollapsed ? "min" : "max"}>
        <ArcsColumn
          id={columnsId("arcos")}
          arcs={arcs}
          currentId={currentCardId}
          collapsed={arcsCollapsed}
          onToggle={() => setArcsCollapsed((v) => !v)}
          onSelect={selectScene}
          pending={needsOpening && !liveScene}
        />
        <main
          id={columnsId("chat")}
          className={`col stage stage--${surface} ${surface === "page" ? "surface-parchment" : "surface-dark surface-margin"}`}
          aria-label={surface === "page" ? "Página da Cena" : "Margem do cronista"}
        >
          {body}
          {turn > 0 ? <span key={turn} className="stage__veil" aria-hidden="true" /> : null}
        </main>
        <SheetSummary
          id={columnsId("ficha")}
          character={character}
          rules={rules}
          portraitUrl={portraitUrl}
          crop={portrait?.crop ?? null}
          onOpenFull={() => setModal("sheet")}
          onPortrait={() => setModal("portrait")}
        />
      </div>

      <p className="visually-hidden" aria-live="polite" data-testid="chat-live">
        {announcement}
      </p>
      {toast ? (
        <p className="jscreen__toast" role="status">
          {toast}
        </p>
      ) : null}

      <Dialog
        open={modal === "close"}
        onClose={() => setModal(null)}
        title="Encerrar a Cena?"
        description="O Narrador escreve um resumo, a Cena fica só para leitura e você volta a conversar com o Aduran."
        dismissible={session.busy !== "close"}
        actions={
          <>
            <Button onClick={() => setModal(null)} disabled={session.busy === "close"}>
              Continuar na Cena
            </Button>
            <Button variant="primary" loading={session.busy === "close"} onClick={() => void confirmClose()}>
              Encerrar Cena
            </Button>
          </>
        }
      >
        {closeError ? (
          <p className="callout callout--danger" role="alert">
            Não foi possível encerrar: {closeError}
          </p>
        ) : null}
      </Dialog>

      <Dialog
        open={modal === "menu"}
        onClose={() => setModal(null)}
        title="Voltar ao menu?"
        description="A Jornada fica salva. Você pode continuar de onde parou pelo menu inicial."
        actions={
          <>
            <Button onClick={() => setModal(null)}>Ficar</Button>
            <Button
              variant="primary"
              onClick={() => {
                setModal(null);
                onBackToMenu();
              }}
            >
              Voltar ao menu
            </Button>
          </>
        }
      />

      <EditJourneyDialog
        open={modal === "edit"}
        onClose={() => setModal(null)}
        info={info}
        journey={summary}
        characterName={characterName}
        onSaved={(saved) => {
          setSummary(saved);
          setToast("Jornada atualizada");
          onJourneyChanged?.(saved);
        }}
      />

      <WorldDialog open={modal === "world"} onClose={() => setModal(null)} info={info} world={snapshot.world.content} characterName={characterName} />

      {character ? (
        <FullSheetDialog
          open={modal === "sheet"}
          onClose={() => setModal(null)}
          character={character}
          rules={rules}
          arcs={arcs}
          portraitUrl={portraitUrl}
          crop={portrait?.crop ?? null}
          onPortrait={() => setModal("portrait")}
        />
      ) : null}

      {character ? (
        <PortraitDialog
          open={modal === "portrait"}
          onClose={() => setModal(null)}
          info={info}
          name={character.name}
          currentUrl={portrait ? portraitUrl : null}
          currentCrop={portrait?.crop ?? null}
          onSaved={onPortraitSaved}
        />
      ) : null}
    </div>
  );
}
