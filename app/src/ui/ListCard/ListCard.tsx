import type { ReactNode } from "react";

import "./ListCard.css";

export interface ListCardProps {
  /** `li` (padrão, dentro de uma lista) ou `div`. */
  as?: "li" | "div";
  /** Título do item; pode ser texto ou um botão que abre o item. */
  title: ReactNode;
  /** Id do elemento do título, para `aria-describedby` das ações. */
  titleId?: string;
  /** Linha de detalhes logo abaixo do título. */
  meta?: ReactNode;
  /** Etiquetas (Badge) ao lado do título. */
  tags?: ReactNode;
  /** Botões de ação no rodapé do item. */
  actions?: ReactNode;
  /** Destaca o item (por exemplo, o modelo ativo). Não muda a semântica. */
  selected?: boolean;
  className?: string;
  children?: ReactNode;
}

/** Item de lista com moldura: título, detalhes, etiquetas, conteúdo e ações. */
export function ListCard({
  as: Tag = "li",
  title,
  titleId,
  meta,
  tags,
  actions,
  selected = false,
  className,
  children,
}: ListCardProps) {
  return (
    <Tag className={["list-card", "px-frame", selected ? "list-card--selected" : "", className ?? ""].filter(Boolean).join(" ")}>
      <div className="list-card__head">
        <p className="list-card__title" id={titleId}>
          {title}
        </p>
        {tags ? <div className="list-card__tags">{tags}</div> : null}
      </div>
      {meta ? <p className="list-card__meta">{meta}</p> : null}
      {children}
      {actions ? <div className="list-card__actions">{actions}</div> : null}
    </Tag>
  );
}
