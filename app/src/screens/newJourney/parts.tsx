/** Peças pequenas do assistente de Nova Jornada (selos das abas, dica "?", texto formatado, retrato). */
import { Fragment, type ReactNode } from "react";

import { PixelIcon, tabPanelId, type TabItem } from "../../ui";
import type { TabDef } from "./model";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
export { plural };

/** Itens das `Tabs` com o selo de pendências (ou o ✓ verde, quando `showDone`). */
export function tabItems<T extends string>(tabs: TabDef<T>[], counts: Record<T, number> | null, showDone = true): TabItem<T>[] {
  return tabs.map((t) => {
    const n = counts?.[t.id] ?? 0;
    return {
      id: t.id,
      label: (
        <>
          {t.label}
          {counts !== null && (n > 0 || showDone) ? " " : null}
          {counts === null ? null : n > 0 ? (
            <span className="nj-tab-badge" title={plural(n, "pendência", "pendências")}>
              <span aria-hidden="true">{n}</span>
              <span className="visually-hidden">({plural(n, "pendência", "pendências")})</span>
            </span>
          ) : showDone ? (
            <span className="nj-tab-tick">
              <PixelIcon name="check" />
              <span className="visually-hidden">(completa)</span>
            </span>
          ) : null}
        </>
      ),
    };
  });
}

/** Painel de uma aba do cartão (rotulado pela aba). */
export function CardPane({
  idPrefix,
  id,
  className,
  children,
}: {
  idPrefix: string;
  id: string;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div role="tabpanel" id={tabPanelId(idPrefix, id)} aria-labelledby={`${idPrefix}-tab-${id}`} className={["nj-pane", className ?? ""].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

/** Dica "?" com a descrição (mouse e foco do teclado). */
export function QTip({ text }: { text: string }) {
  return (
    <span className="nj-q" tabIndex={0} role="img" aria-label={text} data-q={text}>
      ?
    </span>
  );
}

/** Etiqueta curta (chips do Mundo e da Revisão). */
export function Chip({ children, tone }: { children: ReactNode; tone?: "gold" }) {
  return <span className={`nj-chip${tone ? ` nj-chip--${tone}` : ""}`}>{children}</span>;
}

/* -------------------------------------------------------------- texto formatado */

const VIEW_TAGS: Record<string, string> = {
  P: "p",
  H2: "h4",
  H3: "h5",
  STRONG: "strong",
  B: "strong",
  EM: "em",
  I: "em",
  U: "u",
  S: "s",
  UL: "ul",
  OL: "ol",
  LI: "li",
  BLOCKQUOTE: "blockquote",
};
const ALIGN = new Set(["left", "center", "right", "justify"]);

function renderNodes(nodes: NodeListOf<ChildNode>, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  nodes.forEach((node, i) => {
    const k = `${key}-${i}`;
    if (node.nodeType === Node.TEXT_NODE) {
      out.push(<Fragment key={k}>{node.textContent}</Fragment>);
      return;
    }
    if (!(node instanceof Element)) return;
    const tag = VIEW_TAGS[node.tagName];
    const children = renderNodes(node.childNodes, k);
    if (!tag) {
      if (!["SCRIPT", "STYLE", "TEMPLATE"].includes(node.tagName)) out.push(...children);
      return;
    }
    const align = (node as HTMLElement).style?.textAlign;
    const Tag = tag as "p";
    out.push(
      <Tag key={k} className={align && ALIGN.has(align) ? `nj-align-${align}` : undefined}>
        {children}
      </Tag>,
    );
  });
  return out;
}

/**
 * História formatada só para leitura: o HTML vira elementos React por lista permitida
 * (nunca `innerHTML`); tags fora da lista somem, e o texto delas fica.
 */
export function RichTextView({ html, className }: { html: string; className?: string }) {
  if (!html.trim() || typeof DOMParser === "undefined") return null;
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, "text/html");
  return <div className={["nj-richtext", className ?? ""].filter(Boolean).join(" ")}>{renderNodes(doc.body.childNodes, "r")}</div>;
}

/* --------------------------------------------------------------------- retrato */

/** Formatos e tamanho que o serviço aceita para o retrato (services/portrait.py; ele confere de novo pelos bytes). */
export const PORTRAIT_MAX_BYTES = 20 * 1024 * 1024;

function looksLikeImage(head: Uint8Array): boolean {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((b, i) => head[i] === b)) return true;
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return true;
  const ascii = (from: number, to: number) => String.fromCharCode(...head.slice(from, to));
  return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
}

/**
 * Conferência antecipada do arquivo escolhido, para avisar já no assistente (o retrato só é
 * enviado depois de criar a Jornada, e quem decide é o serviço). Mensagem de erro ou `null`.
 */
export async function checkPortraitFile(file: File): Promise<string | null> {
  if (file.size > PORTRAIT_MAX_BYTES) return "A imagem passa de 20 MB. Escolha uma imagem menor.";
  const blob = file.slice(0, 12);
  if (typeof blob.arrayBuffer !== "function") return null;
  const head = new Uint8Array(await blob.arrayBuffer());
  return looksLikeImage(head) ? null : "Este arquivo não é uma imagem PNG, JPEG ou WebP. Escolha outra imagem.";
}

/* --------------------------------------------------------------------- semente */

/** Mundo editado à mão, criado do zero ou duplicado: sem semente (decisão de 2026-11-24). */
export const PERSONALIZED = "Mundo personalizado";

/** "semente N" ou "Mundo personalizado" (chips e listas de Mundos). */
export const seedLabel = (seed: number | null | undefined) => (seed == null ? PERSONALIZED : `semente ${seed}`);
