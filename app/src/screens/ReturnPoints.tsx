import { useEffect, useRef, useState } from "react";

import { BackendError, type BackendInfo } from "../api/backend";
import { deleteReturnPoint, listReturnPoints, loadReturnPoint, renameReturnPoint, replaceReturnPoint, saveReturnPoint,
  type JourneySnapshot, type ReturnPoint } from "../api/journeys";
import { formatSavedAt } from "../lib/format";
import { Badge, Button } from "../ui";
import "./ReturnPoints.css";

const ACTIONS = { load: "Carregar", rename: "Renomear", replace: "Salvar por cima", delete: "Excluir" } as const;
type Action = keyof typeof ACTIONS;

export interface CurrentSave {
  location: string | null;
  savedAt: string | null;
}

export function ReturnPoints({ info, journeyId, current = null, playing = false, disabled = false, onLoaded, onCurrent, onBusy }: {
  info: BackendInfo;
  journeyId: string;
  current?: CurrentSave | null;
  playing?: boolean;
  disabled?: boolean;
  onLoaded: (snapshot: JourneySnapshot) => void;
  onCurrent?: () => void;
  onBusy?: (busy: boolean) => void;
}) {
  const [points, setPoints] = useState<ReturnPoint[] | null>(null);
  const [form, setForm] = useState<{ action: Action; point: ReturnPoint } | null>(null);
  const [name, setName] = useState("");
  const [rename, setRename] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const confirmation = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    listReturnPoints(info, journeyId).then(({ points: list }) => {
      if (active) setPoints(list);
    }).catch(() => {
      if (active) setPoints(null);
    });
    return () => { active = false; };
  }, [info, journeyId, revision]);

  useEffect(() => {
    if (form) confirmation.current?.querySelector<HTMLElement>(form.action === "rename" ? "input" : "button")?.focus();
  }, [form]);

  const run = async () => {
    if (busy || disabled) return;
    setBusy(true);
    onBusy?.(true);
    setError(null);
    try {
      if (!form) {
        await saveReturnPoint(info, journeyId, name.trim() || undefined);
        setName("");
      } else {
        const { action, point } = form;
        if (action === "load") {
          onLoaded(await loadReturnPoint(info, journeyId, point.id));
          return;
        }
        if (action === "rename") await renameReturnPoint(info, journeyId, point.id, rename.trim());
        if (action === "replace") await replaceReturnPoint(info, journeyId, point.id);
        if (action === "delete") await deleteReturnPoint(info, journeyId, point.id);
      }
      setForm(null);
      setRevision((n) => n + 1);
    } catch (err) {
      if (form && err instanceof BackendError && err.status === 404) {
        setPoints((list) => list?.filter((point) => point.id !== form.point.id) ?? null);
        setForm(null);
      } else {
        const action = form ? ACTIONS[form.action].toLowerCase() : "salvar";
        setError(`Não foi possível ${action} este ponto.`);
      }
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  };

  const manualCount = points?.filter((p) => p.kind === "manual").length ?? 0;
  if (!current && !points?.length && !error && !(playing && points !== null)) return null;
  return (
    <div className="return-points" aria-busy={busy}>
      {!playing ? <h4>Pontos de retorno</h4> : null}
      {error ? <p className="callout callout--danger" role="alert">{error}</p> : null}
      {playing && points !== null && !form ? (
        <form className="return-points__actions" onSubmit={(event) => { event.preventDefault(); void run(); }}>
          <label className="field"><span className="field__label">Nome do ponto (opcional)</span>
            <input className="field__control px-frame" value={name} maxLength={60} disabled={busy || disabled}
              onChange={(e) => setName(e.target.value)} />
          </label>
          <Button type="submit" variant="primary" disabled={busy || disabled || manualCount >= 20}>Salvar agora</Button>
          <span>{manualCount}/20 manuais</span>
        </form>
      ) : null}
      {form ? (
        <div ref={confirmation} className="return-points__confirm callout callout--warn">
          <p><strong>{ACTIONS[form.action]} “{form.point.name}”?</strong></p>
          {form.action === "load" ? <p>O progresso atual será substituído. Você pode recuperá-lo pelo ponto “Antes de carregar” enquanto ele estiver entre os cinco automáticos mais recentes.</p> : null}
          {form.action === "delete" ? <p>O ponto será apagado. O progresso atual não muda.</p> : null}
          {form.action === "replace" ? <p>O ponto será substituído pelo progresso atual.</p> : null}
          <form className="return-points__actions" onSubmit={(event) => { event.preventDefault(); void run(); }}>
            {form.action === "rename" ? <label className="field"><span className="field__label">Novo nome</span>
              <input className="field__control px-frame" value={rename} maxLength={60} onChange={(e) => setRename(e.target.value)} />
            </label> : null}
            <Button disabled={busy} onClick={() => { setForm(null); setError(null); }}>Cancelar</Button>
            <Button type="submit" variant={form.action === "delete" ? "danger" : "primary"} loading={busy}
              disabled={disabled || (form.action === "rename" && !rename.trim())}>{ACTIONS[form.action]} ponto</Button>
          </form>
        </div>
      ) : null}
      {current || points?.length ? <ul className="return-points__list">
        {current ? (
          <li className="return-points__row return-points__row--current">
            <div><strong>{playing ? "Jogando agora" : "Jogo salvo"}</strong><p><Badge tone="accent">Atual</Badge>
              {" "}{formatSavedAt(current.savedAt)} · {current.location ?? "Lugar desconhecido"}</p></div>
            {!playing && onCurrent ? (
              <div className="return-points__actions">
                <Button size="sm" variant="primary" disabled={busy || disabled || form !== null}
                  aria-label="Continuar Jogo salvo" onClick={() => { setError(null); onCurrent(); }}>Continuar</Button>
              </div>
            ) : null}
          </li>
        ) : null}
        {points?.map((point) => (
          <li className="return-points__row" key={point.id}>
            <div><strong>{point.name}</strong><p><Badge>{point.kind === "manual" ? "Manual" : "Automático"}</Badge>
              {" "}{formatSavedAt(point.created_at)} · {point.location ?? "Lugar desconhecido"} · {point.message_count} {point.message_count === 1 ? "mensagem" : "mensagens"}</p></div>
            <div className="return-points__actions">
              {(["load", ...(point.kind === "manual" ? ["rename", ...(playing ? ["replace"] : []), "delete"] : [])] as Action[]).map((action) => (
                <Button key={action} size="sm" disabled={busy || disabled || form !== null}
                  variant={action === "load" ? "primary" : action === "delete" ? "danger" : "secondary"}
                  aria-label={`${ACTIONS[action]} ${point.name}`} onClick={() => { setError(null); setRename(point.name); setForm({ point, action }); }}>
                  {ACTIONS[action]}
                </Button>
              ))}
            </div>
          </li>
        ))}
      </ul> : null}
    </div>
  );
}
