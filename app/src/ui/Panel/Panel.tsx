import { useId, type ComponentPropsWithoutRef, type ReactNode, type Ref } from "react";

import "./Panel.css";

export type PanelVariant = "dark" | "parchment";

export interface PanelProps extends Omit<ComponentPropsWithoutRef<"section">, "title"> {
  variant?: PanelVariant;
  /** Título na barra superior; com ele, a seção é rotulada pelo título. */
  title?: ReactNode;
  titleLevel?: 2 | 3 | 4;
  /** Id do título (para outros elementos se referirem a ele). */
  titleId?: string;
  /** Ref do título; com ela o título recebe foco programático (`tabIndex=-1`). */
  titleRef?: Ref<HTMLHeadingElement>;
  /** Elementos à direita da barra de título (por exemplo, uma etiqueta). */
  titleExtra?: ReactNode;
  /** `section` (padrão) ou `div`, quando não for uma região própria. */
  as?: "section" | "div";
}

/** Painel com moldura em pixel, escuro ou de pergaminho, com barra de título opcional. */
export function Panel({
  variant = "dark",
  title,
  titleLevel = 3,
  titleId,
  titleRef,
  titleExtra,
  as: Tag = "section",
  className,
  children,
  ...rest
}: PanelProps) {
  const autoId = useId();
  const headingId = titleId ?? `${autoId}-title`;
  const Heading = `h${titleLevel}` as const;
  const labelled = title && Tag === "section" && !rest["aria-label"] ? { "aria-labelledby": headingId } : {};
  return (
    <Tag
      className={["panel", `panel--${variant}`, `surface-${variant}`, "px-frame", className ?? ""].filter(Boolean).join(" ")}
      {...labelled}
      {...rest}
    >
      {title ? (
        <div className="panel__titlebar surface-dark">
          <Heading
            id={headingId}
            ref={titleRef}
            tabIndex={titleRef ? -1 : undefined}
            className="panel__title"
          >
            {title}
          </Heading>
          {titleExtra ? <div className="panel__title-extra">{titleExtra}</div> : null}
        </div>
      ) : null}
      <div className="panel__body">{children}</div>
    </Tag>
  );
}
