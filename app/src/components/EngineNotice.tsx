import type { EngineStatus } from "../api/engine";
import { Button, PixelIcon } from "../ui";

/** Texto do aviso no Chat, ou `null` quando o Narrador pode responder. */
export function engineNoticeText(status: EngineStatus | null): string | null {
  if (!status || status.provider !== "local" || status.state === "ready") return null;
  if (status.state === "downloading") return "O motor de IA está sendo baixado. O Narrador responde quando um modelo estiver pronto.";
  if (status.state === "starting") return "O modelo está carregando. Espere ficar pronto para conversar.";
  if (!status.installed) return "O motor de IA ainda não foi baixado. Baixe-o na tela Modelos.";
  if (!status.active_model) return "Nenhum modelo de IA escolhido. Escolha um na tela Modelos.";
  if (status.state === "error") return "O motor de IA teve um erro. Veja os detalhes na tela Modelos.";
  return "O motor de IA não está pronto. Carregue um modelo na tela Modelos.";
}

export function EngineNotice({ status, onOpenModels }: { status: EngineStatus | null; onOpenModels: () => void }) {
  const text = engineNoticeText(status);
  if (!text) return null;
  return (
    <div className="notice surface-parchment px-frame" role="status">
      <PixelIcon name="warning" size={24} className="notice__icon" />
      <p className="notice__text">{text}</p>
      <Button variant="primary" onClick={onOpenModels}>
        Ir para Modelos
      </Button>
    </div>
  );
}
