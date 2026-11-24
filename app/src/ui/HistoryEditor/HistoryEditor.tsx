import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type DragEvent, type ReactNode } from "react";

import { describedBy } from "../TextField/TextField";

import "./HistoryEditor.css";

/**
 * Editor da História do personagem (ADR-077, item 1).
 *
 * **PROVISÓRIO.** O ADR-077 aprovou o TipTap (ProseMirror) para este editor, mas ele é uma
 * dependência nova que ainda espera a aprovação da instalação (AGENTS.md). Até lá, esta
 * implementação usa `contenteditable` e `document.execCommand`, com a barra do protótipo.
 * A interface abaixo é a que o componente TipTap vai manter: trocar o editor é mudar só
 * este arquivo (e o CSS dele).
 *
 * O HTML que sai daqui não é confiável por si: o servidor sanea com lista permitida e
 * deriva o texto puro (o limite conta o texto puro). Colar e soltar inserem só texto.
 */
export interface HistoryEditorProps {
  /** Id do campo editável (para foco e rótulos). */
  id: string;
  /** Rótulo acessível do campo. */
  label: string;
  /** HTML atual. */
  value: string;
  onChange: (html: string) => void;
  /** Limite de caracteres do texto puro (do servidor, `text_limits.history`). */
  limit: number;
  /** Conta o texto puro do HTML (a mesma derivação do servidor, para o contador). */
  plainText: (html: string) => string;
  /** Conta as palavras do texto puro. */
  countWords: (plain: string) => number;
  placeholder?: string;
  disabled?: boolean;
  /** Mensagem de erro (marca o campo como inválido). */
  error?: string | undefined;
  /** Ações extras no fim da barra (os botões Escrever e Continuar do Narrador, rodada 2). */
  toolbarExtra?: ReactNode;
  className?: string;
}

type Command =
  | "bold"
  | "italic"
  | "underline"
  | "strikeThrough"
  | "insertUnorderedList"
  | "insertOrderedList"
  | "justifyLeft"
  | "justifyCenter"
  | "justifyRight"
  | "justifyFull"
  | "undo"
  | "redo"
  | "removeFormat";

interface ToolButton {
  command: Command | "blockquote";
  glyph: string;
  label: string;
  /** Tem estado ligado/desligado (`aria-pressed`). */
  toggle: boolean;
  className?: string;
}

const GROUPS: ToolButton[][] = [
  [
    { command: "bold", glyph: "N", label: "Negrito (Ctrl+B)", toggle: true, className: "rte__btn--bold" },
    { command: "italic", glyph: "I", label: "Itálico (Ctrl+I)", toggle: true, className: "rte__btn--italic" },
    { command: "underline", glyph: "S", label: "Sublinhado (Ctrl+U)", toggle: true, className: "rte__btn--underline" },
    { command: "strikeThrough", glyph: "T", label: "Tachado", toggle: true, className: "rte__btn--strike" },
  ],
  [
    { command: "insertUnorderedList", glyph: "•", label: "Lista com marcadores", toggle: true },
    { command: "insertOrderedList", glyph: "1.", label: "Lista numerada", toggle: true },
    { command: "blockquote", glyph: "❝", label: "Citação", toggle: false },
  ],
  [
    { command: "justifyLeft", glyph: "⇤", label: "Alinhar à esquerda", toggle: true },
    { command: "justifyCenter", glyph: "↔", label: "Centralizar", toggle: true },
    { command: "justifyRight", glyph: "⇥", label: "Alinhar à direita", toggle: true },
    { command: "justifyFull", glyph: "☰", label: "Justificar", toggle: true },
  ],
  [
    { command: "undo", glyph: "↶", label: "Desfazer (Ctrl+Z)", toggle: false },
    { command: "redo", glyph: "↷", label: "Refazer (Ctrl+Y)", toggle: false },
    { command: "removeFormat", glyph: "✕", label: "Limpar formatação", toggle: false },
  ],
];

const BLOCKS = [
  { value: "p", label: "Parágrafo" },
  { value: "h2", label: "Título" },
  { value: "h3", label: "Subtítulo" },
] as const;

type BlockValue = (typeof BLOCKS)[number]["value"];

/** `execCommand` existe nos navegadores (e no WebView2); no jsdom dos testes, não. */
function exec(command: string, value?: string): boolean {
  if (typeof document.execCommand !== "function") return false;
  try {
    return document.execCommand(command, false, value);
  } catch {
    return false;
  }
}

function queryState(command: string): boolean {
  if (typeof document.queryCommandState !== "function") return false;
  try {
    return document.queryCommandState(command);
  } catch {
    return false;
  }
}

function currentBlock(): BlockValue {
  if (typeof document.queryCommandValue !== "function") return "p";
  try {
    const value = document.queryCommandValue("formatBlock").toLowerCase();
    return value === "h2" || value === "h3" ? value : "p";
  } catch {
    return "p";
  }
}

/** Insere texto simples na seleção (colar e soltar nunca trazem HTML de fora). */
function insertPlainText(text: string): void {
  if (exec("insertText", text)) return;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Editor de texto com barra de formatação (provisório; ver o comentário do módulo). */
export function HistoryEditor({
  id,
  label,
  value,
  onChange,
  limit,
  plainText,
  countWords,
  placeholder,
  disabled = false,
  error,
  toolbarExtra,
  className,
}: HistoryEditorProps) {
  const areaRef = useRef<HTMLDivElement>(null);
  /** O último HTML que este editor emitiu (para não reescrever o DOM a cada tecla). */
  const emitted = useRef<string | null>(null);
  const [pressed, setPressed] = useState<Record<string, boolean>>({});
  const [block, setBlock] = useState<BlockValue>("p");

  // Valor vindo de fora (rascunho, Desfazer, Narrador): reescreve o conteúdo.
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area || value === emitted.current) return;
    area.innerHTML = value;
    emitted.current = value;
  }, [value]);

  const emit = useCallback(() => {
    const area = areaRef.current;
    if (!area) return;
    // Sem texto, o editor fica vazio de verdade (e o placeholder aparece).
    const html = area.textContent?.trim() || area.querySelector("li") ? area.innerHTML : "";
    if (!html && area.innerHTML) area.innerHTML = "";
    emitted.current = html;
    onChange(html);
  }, [onChange]);

  const refreshState = useCallback(() => {
    const area = areaRef.current;
    const selection = typeof window.getSelection === "function" ? window.getSelection() : null;
    if (!area || !selection || !selection.anchorNode || !area.contains(selection.anchorNode)) return;
    const next: Record<string, boolean> = {};
    for (const group of GROUPS) for (const b of group) if (b.toggle) next[b.command] = queryState(b.command);
    setPressed(next);
    setBlock(currentBlock());
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", refreshState);
    return () => document.removeEventListener("selectionchange", refreshState);
  }, [refreshState]);

  const run = (command: ToolButton["command"]) => {
    const area = areaRef.current;
    if (!area || disabled) return;
    area.focus();
    exec("defaultParagraphSeparator", "p");
    if (command === "blockquote") exec("formatBlock", "blockquote");
    else exec(command);
    emit();
    refreshState();
  };

  const setBlockStyle = (next: BlockValue) => {
    const area = areaRef.current;
    if (!area || disabled) return;
    area.focus();
    exec("formatBlock", next);
    setBlock(next);
    emit();
  };

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    if (text) insertPlainText(text);
    emit();
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.dataTransfer.getData("text/plain");
    if (text) insertPlainText(text);
    emit();
  };

  const plain = plainText(value);
  const chars = plain.length;
  const words = countWords(plain);
  const over = chars > limit;
  const countId = `${id}-count`;
  const errorId = `${id}-error`;

  return (
    <div
      className={["rte", error ? "rte--invalid" : "", disabled ? "rte--disabled" : "", className ?? ""].filter(Boolean).join(" ")}
    >
      <div className="rte__bar" role="toolbar" aria-label="Formatação do texto" aria-controls={id}>
        <select
          className="rte__select"
          aria-label="Estilo do parágrafo"
          value={block}
          disabled={disabled}
          onChange={(e) => setBlockStyle(e.target.value as BlockValue)}
        >
          {BLOCKS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
        {GROUPS.map((group, i) => (
          <span key={i} className="rte__group">
            {group.map((b) => (
              <button
                key={b.command}
                type="button"
                className={["rte__btn", b.className ?? ""].filter(Boolean).join(" ")}
                aria-label={b.label}
                title={b.label}
                aria-pressed={b.toggle ? Boolean(pressed[b.command]) : undefined}
                disabled={disabled}
                // Não tira o foco (nem a seleção) do texto ao clicar.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => run(b.command)}
              >
                <span aria-hidden="true">{b.glyph}</span>
              </button>
            ))}
          </span>
        ))}
        {toolbarExtra ? <span className="rte__extra">{toolbarExtra}</span> : null}
      </div>
      <div
        ref={areaRef}
        id={id}
        className="rte__area"
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-disabled={disabled || undefined}
        aria-describedby={describedBy(countId, error !== undefined && errorId)}
        data-placeholder={placeholder}
        tabIndex={disabled ? -1 : 0}
        onInput={emit}
        onBlur={emit}
        onPaste={onPaste}
        onDrop={onDrop}
        onKeyUp={refreshState}
        onMouseUp={refreshState}
      />
      <div className="rte__foot">
        <span id={countId} className={`rte__count${over ? " rte__count--over" : ""}`} aria-live="polite">
          {words === 1 ? "1 palavra" : `${words} palavras`} · {chars.toLocaleString("pt-BR")}/{limit.toLocaleString("pt-BR")}{" "}
          caracteres
        </span>
        {error ? (
          <span id={errorId} className="rte__error">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
