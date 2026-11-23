import { FIT_LABEL, type ModelFit } from "../api/engine";
import { Badge, PixelIcon, type BadgeTone, type PixelIconName } from "../ui";

const TONE: Record<ModelFit, BadgeTone> = { gpu: "success", cpu_lento: "warn", pesado_demais: "danger" };
const ICON: Record<ModelFit, PixelIconName> = { gpu: "check", cpu_lento: "hourglass", pesado_demais: "cross" };

/** Compatibilidade do modelo com o PC, com texto, ícone e cor. */
export function FitBadge({ fit }: { fit: ModelFit }) {
  return (
    <Badge tone={TONE[fit]} icon={<PixelIcon name={ICON[fit]} />}>
      {FIT_LABEL[fit]}
    </Badge>
  );
}
