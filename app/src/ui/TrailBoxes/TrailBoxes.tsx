import "./TrailBoxes.css";

export interface TrailBoxesProps {
  /** Nome da trilha (por exemplo, "Vida"). */
  label: string;
  /** Número de espaços; `null` quando ainda não dá para saber. */
  size: number | null;
  /** Espaços com dano agravado. */
  agravada?: number;
  /** Espaços com dano superficial. */
  superficial?: number;
  /** Mostra a legenda dos três tipos de caixa. */
  legend?: boolean;
  className?: string;
}

type BoxKind = "agravada" | "superficial" | "vazia";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Texto equivalente da trilha, para leitores de tela (e para quem não distingue as marcas). */
export function trailText(label: string, size: number | null, superficial = 0, agravada = 0): string {
  if (size === null) return `${label}: ainda sem tamanho`;
  const empty = Math.max(0, size - superficial - agravada);
  return `${label}: ${plural(size, "espaço", "espaços")}; ${plural(superficial, "superficial", "superficiais")}, ${plural(
    agravada,
    "agravado",
    "agravados",
  )}, ${plural(empty, "vazio", "vazios")}`;
}

/**
 * Trilha de Vida ou de Vontade desenhada como caixas: agravadas (X), superficiais (/)
 * e vazias. Só exibe; quem conta o dano é o motor. A imagem tem texto equivalente.
 */
export function TrailBoxes({ label, size, agravada = 0, superficial = 0, legend = false, className }: TrailBoxesProps) {
  const total = size ?? 0;
  const boxes: BoxKind[] = [];
  for (let i = 0; i < total; i++) {
    boxes.push(i < agravada ? "agravada" : i < agravada + superficial ? "superficial" : "vazia");
  }
  return (
    <div className={["trail", className ?? ""].filter(Boolean).join(" ")}>
      <div className="trail__head">
        <span className="trail__label">{label}</span>
        <span className="trail__count" aria-hidden="true">
          {size === null ? "—" : size}
        </span>
      </div>
      <div className="trail__boxes" role="img" aria-label={trailText(label, size, superficial, agravada)}>
        {size === null ? <span className="trail__unknown">—</span> : null}
        {boxes.map((kind, i) => (
          <span key={i} className={`trail__box trail__box--${kind}`} />
        ))}
      </div>
      {legend ? (
        <ul className="trail__legend" aria-hidden="true">
          <li>
            <span className="trail__box trail__box--vazia" /> vazia
          </li>
          <li>
            <span className="trail__box trail__box--superficial" /> superficial
          </li>
          <li>
            <span className="trail__box trail__box--agravada" /> agravada
          </li>
        </ul>
      ) : null}
    </div>
  );
}
