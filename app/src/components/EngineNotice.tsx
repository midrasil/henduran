import type { EngineStatus } from "../api/engine";

/** Texto do aviso no Chat, ou `null` quando o Narrador pode responder. */
export function engineNoticeText(status: EngineStatus | null): string | null {
  if (!status || status.provider !== "local" || status.state === "ready") return null;
  if (status.state === "downloading") return "O motor de IA está sendo baixado. O Narrador responde quando um modelo estiver pronto.";
  if (status.state === "starting") return "O modelo está carregando. Espere ficar pronto para conversar.";
  if (!status.installed) return "O motor de IA ainda não foi baixado. Baixe-o na aba Modelos.";
  if (!status.active_model) return "Nenhum modelo de IA escolhido. Escolha um na aba Modelos.";
  if (status.state === "error") return "O motor de IA teve um erro. Veja os detalhes na aba Modelos.";
  return "O motor de IA não está pronto. Carregue um modelo na aba Modelos.";
}

export function EngineNotice({ status, onOpenModels }: { status: EngineStatus | null; onOpenModels: () => void }) {
  const text = engineNoticeText(status);
  if (!text) return null;
  return (
    <div className="notice" role="status">
      <p className="notice__text">{text}</p>
      <button type="button" className="button button--secondary" onClick={onOpenModels}>
        Ir para a aba Modelos
      </button>
    </div>
  );
}
