import type { SceneProposal } from "../../api/journeys";
import { joinList } from "../../lib/format";
import { Button } from "../../ui";

export interface ProposalCardProps {
  proposal: SceneProposal;
  onAccept: () => void;
  onReroll: () => void;
  onDecline: () => void;
  /** Qual ação está em curso (desabilita as outras). */
  pending?: "accept" | "reroll" | "decline" | null;
  disabled?: boolean;
}

/** Cartão da proposta de Cena do Aduran (ADR-076, itens 12 e 17): o jogador aceita, pede outra ou recusa. */
export function ProposalCard({ proposal, onAccept, onReroll, onDecline, pending = null, disabled = false }: ProposalCardProps) {
  const off = disabled || pending !== null;
  return (
    <section className="proposal" aria-labelledby={`proposal-${proposal.id}-title`}>
      <h3 id={`proposal-${proposal.id}-title`} className="proposal__eyebrow">
        Proposta de Cena
      </h3>
      <dl className="proposal__facts">
        <dt>Título</dt>
        <dd>{proposal.title ?? "Sem título"}</dd>
        <dt>Lugar</dt>
        <dd>
          {proposal.place.name ?? "Lugar desconhecido"}
          {proposal.place.kind === "novo" ? <span className="proposal__new">lugar novo</span> : null}
          {proposal.place.kind === "novo" && proposal.place.description ? (
            <span className="proposal__place-desc">{proposal.place.description}</span>
          ) : null}
        </dd>
        <dt>Motivo</dt>
        <dd>{proposal.motive ?? "—"}</dd>
        <dt>Quem</dt>
        <dd>{proposal.participants.length ? joinList(proposal.participants) : "Ninguém além do personagem"}</dd>
      </dl>
      <div className="proposal__actions">
        <Button variant="primary" onClick={onAccept} disabled={off} loading={pending === "accept"}>
          Começar a Cena
        </Button>
        <Button onClick={onReroll} disabled={off} loading={pending === "reroll"}>
          Pedir outra
        </Button>
        <Button variant="ghost" onClick={onDecline} disabled={off} loading={pending === "decline"}>
          Agora não
        </Button>
      </div>
    </section>
  );
}
