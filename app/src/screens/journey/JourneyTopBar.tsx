import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import type { EngineStatus } from "../../api/engine";
import { engineNoticeText } from "../../components/EngineNotice";
import { PERIOD_LABEL, PeriodIcon, PixelIcon, SkyBackdrop, type DayPeriod } from "../../ui";

export interface JourneyTopBarProps {
  journeyName: string;
  characterName: string;
  worldName: string | null;
  period: DayPeriod;
  /** "12 de Alvorim, Solário · Ano 476", ou `null` sem calendário. */
  dateText: string | null;
  engine: EngineStatus | null;
  onOpenModels: () => void;
  onOpenWorld: () => void;
  onBackToMenu: () => void;
}

/** O modelo está pronto para o Narrador? O provedor falso está sempre pronto. */
export function modelReady(engine: EngineStatus | null): boolean {
  return engineNoticeText(engine) === null;
}

/**
 * Barra superior da Jornada (09, item 2.1): o céu do período ao fundo (o mesmo
 * desenho do menu), o nome da Jornada, o personagem e o Mundo, o período e a
 * data, o indicador do modelo e o menu ⚙.
 */
export function JourneyTopBar({ journeyName, characterName, worldName, period, dateText, engine, onOpenModels, onOpenWorld, onBackToMenu }: JourneyTopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const cogRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const ready = modelReady(engine);
  const modelName = engine?.active_model_name ?? (engine?.provider && engine.provider !== "local" ? `provedor ${engine.provider}` : null);

  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !cogRef.current?.contains(target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const close = (refocus = true) => {
    setMenuOpen(false);
    if (refocus) cogRef.current?.focus();
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? []);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  const pick = (action: () => void) => {
    close(false);
    action();
  };

  return (
    <header className="jbar">
      <SkyBackdrop period={period} className="jbar__sky" />
      <div className="jbar__name">
        <h1 className="jbar__title">{journeyName}</h1>
        <span className="jbar__sub">
          {characterName}
          {worldName ? ` · ${worldName}` : ""}
        </span>
      </div>
      <p className="jbar__period">
        <PeriodIcon period={period} size={28} />
        <span>
          <b>{PERIOD_LABEL[period]}</b>
          <span className="visually-hidden"> · </span>
          {dateText ? <span className="jbar__date">{dateText}</span> : null}
        </span>
      </p>
      <button type="button" className="jbar__model tip-below" data-state={ready ? "ok" : "off"} data-tip="Configurar o modelo" onClick={onOpenModels}>
        <span className="jbar__led" aria-hidden="true" />
        <span className="jbar__model-text">
          {ready ? "Modelo pronto" : "Sem modelo"}
          <span className="visually-hidden">: </span>
          <small>{ready ? (modelName ?? "pronto para narrar") : "clique para configurar"}</small>
        </span>
      </button>
      <div className="jbar__cog">
        <button
          ref={cogRef}
          type="button"
          className="icon-btn tip-below tip-end"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls="jornada-menu"
          aria-label="Opções"
          data-tip="Opções"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <PixelIcon name="cog" size={24} />
        </button>
        {menuOpen ? (
          <div ref={menuRef} id="jornada-menu" className="cog-menu" role="menu" aria-label="Opções da Jornada" onKeyDown={onMenuKey}>
            <button type="button" role="menuitem" onClick={() => pick(onOpenWorld)}>
              Mundo<span className="visually-hidden">: </span><small>Dados do Mundo e lugares</small>
            </button>
            <button type="button" role="menuitem" onClick={() => pick(onOpenModels)}>
              Modelos<span className="visually-hidden">: </span><small>IA local e configuração</small>
            </button>
            <button type="button" role="menuitem" onClick={() => pick(onBackToMenu)}>
              Voltar ao menu<span className="visually-hidden">: </span><small>A Jornada fica salva</small>
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
