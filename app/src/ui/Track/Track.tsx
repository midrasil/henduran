import { TrackCellIcon, type TrackCellState, type TrackIconKind } from "../PixelArt/PixelArt";

import "./Track.css";

export interface TrackProps {
  /** Nome da trilha (do catálogo: "Vida", "Vontade"). */
  label: string;
  /** Coração vermelho (Vida) ou chama azul (Vontade). */
  kind: TrackIconKind;
  /** Número de espaços; `null` quando ainda não dá para saber. */
  size: number | null;
  agravada?: number;
  superficial?: number;
  /** Estado já calculado pelo serviço (por exemplo, "Debilitado"); a interface não o deduz. */
  status?: string | null;
  /** Mostra a legenda com as contagens. */
  legend?: boolean;
  className?: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Texto equivalente da trilha, na ordem da regra: agravado, superficial, livres. */
export function trackText(label: string, size: number | null, superficial = 0, agravada = 0): string {
  if (size === null) return `${label}: ainda sem tamanho`;
  const free = Math.max(0, size - superficial - agravada);
  return `${label}: ${plural(agravada, "agravado", "agravados")}, ${plural(superficial, "superficial", "superficiais")}, ${plural(
    free,
    "livre",
    "livres",
  )} de ${size}`;
}

/** Espaços na ordem da regra (rules/04 e 05): agravado à esquerda, superficial depois, livres à direita. */
export function trackCells(size: number | null, superficial = 0, agravada = 0): TrackCellState[] {
  const total = size ?? 0;
  const cells: TrackCellState[] = [];
  for (let i = 0; i < total; i++) cells.push(i < agravada ? "agravado" : i < agravada + superficial ? "superficial" : "livre");
  return cells;
}

/**
 * Trilha de Vida ou de Vontade em ícones de pixel art soltos, sem caixa. Só
 * exibe o que o motor contou; o estado (Debilitado etc.) só aparece se vier pronto.
 */
export function Track({ label, kind, size, agravada = 0, superficial = 0, status, legend = true, className }: TrackProps) {
  const cells = trackCells(size, superficial, agravada);
  const free = cells.filter((c) => c === "livre").length;
  return (
    <div className={["track", `track--${kind}`, className ?? ""].filter(Boolean).join(" ")}>
      <div className="track__head">
        <span className="track__label">{label}</span>
        <span className="track__count" aria-hidden="true">
          {size === null ? "—" : `${free}/${size}`}
        </span>
      </div>
      <div className="track__cells" role="img" aria-label={trackText(label, size, superficial, agravada)}>
        {size === null ? <span className="track__unknown">—</span> : null}
        {cells.map((state, i) => (
          <span key={i} className={`track__cell track__cell--${state}`}>
            <TrackCellIcon kind={kind} state={state} />
          </span>
        ))}
      </div>
      {legend ? (
        <div className="track__legend" aria-hidden="true">
          {agravada ? (
            <span>
              <TrackCellIcon kind={kind} state="agravado" width={kind === "heart" ? 14 : 12} /> {plural(agravada, "agravado", "agravados")}
            </span>
          ) : null}
          {superficial ? (
            <span>
              <TrackCellIcon kind={kind} state="superficial" width={kind === "heart" ? 14 : 12} />{" "}
              {plural(superficial, "superficial", "superficiais")}
            </span>
          ) : null}
          {!agravada && !superficial && size !== null ? <span>sem dano</span> : null}
          {status ? <span className="track__status">{status}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
