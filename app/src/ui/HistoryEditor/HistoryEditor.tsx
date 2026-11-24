import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, type ReactNode } from "react";

import { describedBy } from "../TextField/TextField";

import "./HistoryEditor.css";

/**
 * Editor da História do personagem (ADR-077, item 1): TipTap (ProseMirror) num conjunto enxuto.
 *
 * Recursos: parágrafo, Título (h2) e Subtítulo (h3), negrito, itálico, sublinhado, tachado,
 * listas com marcadores e numerada, citação, alinhamento, desfazer e refazer, limpar formatação
 * e placeholder. Fora do conjunto (e desligados no StarterKit): links, código, bloco de código,
 * linha horizontal e quebra de linha manual. Colar passa pelo esquema do editor: o que não
 * pertence ao conjunto é descartado.
 *
 * O HTML que sai daqui não é confiável por si: o servidor sanea com lista permitida e deriva o
 * texto puro (o limite conta o texto puro; o contador usa a mesma derivação, `plainText`).
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
  /** Ações extras no fim da barra (os botões Escrever e Continuar do Narrador). */
  toolbarExtra?: ReactNode;
  className?: string;
}

type Align = "left" | "center" | "right" | "justify";

interface ToolButton {
  key: string;
  glyph: string;
  label: string;
  /** Estado ligado/desligado (`aria-pressed`); ausente nos botões de ação. */
  active?: (e: Editor) => boolean;
  run: (e: Editor) => void;
  enabled?: (e: Editor) => boolean;
  className?: string;
}

const chain = (e: Editor) => e.chain().focus();
const align = (a: Align): Pick<ToolButton, "active" | "run"> => ({
  active: (e) => e.isActive({ textAlign: a }),
  run: (e) => chain(e).setTextAlign(a).run(),
});

const GROUPS: ToolButton[][] = [
  [
    { key: "bold", glyph: "N", label: "Negrito (Ctrl+B)", active: (e) => e.isActive("bold"), run: (e) => chain(e).toggleBold().run(), className: "rte__btn--bold" },
    { key: "italic", glyph: "I", label: "Itálico (Ctrl+I)", active: (e) => e.isActive("italic"), run: (e) => chain(e).toggleItalic().run(), className: "rte__btn--italic" },
    { key: "underline", glyph: "S", label: "Sublinhado (Ctrl+U)", active: (e) => e.isActive("underline"), run: (e) => chain(e).toggleUnderline().run(), className: "rte__btn--underline" },
    { key: "strike", glyph: "T", label: "Tachado", active: (e) => e.isActive("strike"), run: (e) => chain(e).toggleStrike().run(), className: "rte__btn--strike" },
  ],
  [
    { key: "bullet", glyph: "•", label: "Lista com marcadores", active: (e) => e.isActive("bulletList"), run: (e) => chain(e).toggleBulletList().run() },
    { key: "ordered", glyph: "1.", label: "Lista numerada", active: (e) => e.isActive("orderedList"), run: (e) => chain(e).toggleOrderedList().run() },
    { key: "quote", glyph: "❝", label: "Citação", active: (e) => e.isActive("blockquote"), run: (e) => chain(e).toggleBlockquote().run() },
  ],
  [
    { key: "left", glyph: "⇤", label: "Alinhar à esquerda", ...align("left") },
    { key: "center", glyph: "↔", label: "Centralizar", ...align("center") },
    { key: "right", glyph: "⇥", label: "Alinhar à direita", ...align("right") },
    { key: "justify", glyph: "☰", label: "Justificar", ...align("justify") },
  ],
  [
    { key: "undo", glyph: "↶", label: "Desfazer (Ctrl+Z)", run: (e) => chain(e).undo().run(), enabled: (e) => e.can().undo() },
    { key: "redo", glyph: "↷", label: "Refazer (Ctrl+Y)", run: (e) => chain(e).redo().run(), enabled: (e) => e.can().redo() },
    { key: "clear", glyph: "✕", label: "Limpar formatação", run: (e) => chain(e).unsetAllMarks().clearNodes().unsetTextAlign().run() },
  ],
];

const BLOCKS = [
  { value: "p", label: "Parágrafo" },
  { value: "h2", label: "Título" },
  { value: "h3", label: "Subtítulo" },
] as const;

type BlockValue = (typeof BLOCKS)[number]["value"];

const currentBlock = (e: Editor): BlockValue =>
  e.isActive("heading", { level: 2 }) ? "h2" : e.isActive("heading", { level: 3 }) ? "h3" : "p";

/** HTML emitido: vazio quando não há texto (o placeholder aparece e o campo conta como em branco). */
const htmlOf = (e: Editor) => (e.isEmpty ? "" : e.getHTML());

/** Editor de texto com barra de formatação (TipTap). */
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
  /** O último HTML que este editor emitiu (para não reescrever o documento a cada tecla). */
  const emitted = useRef<string>(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const countId = `${id}-count`;
  const errorId = `${id}-error`;
  const attributes = (): Record<string, string> => {
    const attrs: Record<string, string> = {
      id,
      class: "rte__doc",
      role: "textbox",
      "aria-multiline": "true",
      "aria-label": label,
    };
    const described = describedBy(countId, error !== undefined && errorId);
    if (described) attrs["aria-describedby"] = described;
    if (error) attrs["aria-invalid"] = "true";
    if (disabled) attrs["aria-disabled"] = "true";
    return attrs;
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        link: false,
        horizontalRule: false,
        hardBreak: false,
        // Sem parágrafo vazio automático no fim (depois de listas e citações).
        trailingNode: false,
      }),
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right", "justify"] }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: value,
    editable: !disabled,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: { attributes: attributes() },
    onUpdate: ({ editor: e }) => {
      const html = htmlOf(e);
      if (html === emitted.current) return;
      emitted.current = html;
      onChangeRef.current(html);
    },
  });

  // Valor vindo de fora (rascunho, Desfazer, Narrador): troca o documento sem emitir.
  useEffect(() => {
    if (!editor || value === emitted.current) return;
    emitted.current = value;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled, false);
    editor.setOptions({ editorProps: { attributes: attributes() } });
    // `attributes` depende só dos valores abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, disabled, error, label, id]);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null;
      const pressed: Record<string, boolean> = {};
      const enabled: Record<string, boolean> = {};
      for (const group of GROUPS)
        for (const b of group) {
          if (b.active) pressed[b.key] = b.active(e);
          if (b.enabled) enabled[b.key] = b.enabled(e);
        }
      return { pressed, enabled, block: currentBlock(e) };
    },
  });

  const setBlock = (next: BlockValue) => {
    if (!editor || disabled) return;
    const c = chain(editor);
    if (next === "p") c.setParagraph().run();
    else c.setHeading({ level: next === "h2" ? 2 : 3 }).run();
  };

  const plain = plainText(value);
  const chars = plain.length;
  const words = countWords(plain);
  const over = chars > limit;

  return (
    <div
      className={["rte", error ? "rte--invalid" : "", disabled ? "rte--disabled" : "", className ?? ""].filter(Boolean).join(" ")}
    >
      <div className="rte__bar" role="toolbar" aria-label="Formatação do texto" aria-controls={id}>
        <select
          className="rte__select"
          aria-label="Estilo do parágrafo"
          value={state?.block ?? "p"}
          disabled={disabled || !editor}
          onChange={(e) => setBlock(e.target.value as BlockValue)}
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
                key={b.key}
                type="button"
                className={["rte__btn", b.className ?? ""].filter(Boolean).join(" ")}
                aria-label={b.label}
                title={b.label}
                aria-pressed={b.active ? Boolean(state?.pressed[b.key]) : undefined}
                disabled={disabled || !editor || (b.enabled ? !state?.enabled[b.key] : false)}
                // Não tira o foco (nem a seleção) do texto ao clicar.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor && b.run(editor)}
              >
                <span aria-hidden="true">{b.glyph}</span>
              </button>
            ))}
          </span>
        ))}
        {toolbarExtra ? <span className="rte__extra">{toolbarExtra}</span> : null}
      </div>
      <EditorContent editor={editor} className="rte__area" />
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
