import { PixelIcon, type PixelIconName } from "../icons";

import "./StatusIndicator.css";

export type StatusTone = "ok" | "busy" | "error" | "idle";

const ICON: Record<StatusTone, PixelIconName> = {
  ok: "check",
  busy: "hourglass",
  error: "cross",
  idle: "hollow",
};

export interface StatusIndicatorProps {
  tone: StatusTone;
  label: string;
  /** `status` anuncia mudanças com educação; omita quando outro elemento já anuncia. */
  role?: "status";
  className?: string;
}

/** Estado com ícone de forma própria para cada tom e texto: não depende só da cor. */
export function StatusIndicator({ tone, label, role, className }: StatusIndicatorProps) {
  return (
    <p className={["status-indicator", `status-indicator--${tone}`, className ?? ""].filter(Boolean).join(" ")} role={role}>
      <PixelIcon name={ICON[tone]} className="status-indicator__icon" />
      <span>{label}</span>
    </p>
  );
}
