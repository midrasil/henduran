import { useState } from "react";

import type { Arc } from "../../api/journeyScreen";
import type { CharacterSheet, CreationRules } from "../../api/journeys";
import { Button, CrackIcon, Dialog, PixelIcon, Portrait, TabPanel, Tabs, type PixelIconName, type PortraitCropValue } from "../../ui";
import { plural } from "./journeyText";
import { AttributePlates, SheetTracks, SkillRows } from "./SheetSummary";

type SheetTab = "geral" | "pericias" | "objetivos" | "conviccoes" | "descricao";

const TABS: { id: SheetTab; label: string; icon: PixelIconName }[] = [
  { id: "geral", label: "Visão geral", icon: "tab-sheet" },
  { id: "pericias", label: "Perícias", icon: "tab-skills" },
  { id: "objetivos", label: "Objetivos", icon: "tab-goal" },
  { id: "conviccoes", label: "Convicções", icon: "tab-conviction" },
  { id: "descricao", label: "Descrição", icon: "tab-description" },
];

/** Espaços de Fratura desenhados por Convicção: o teto do banco e de rules/06 (íntegra, 1 Fratura, rompida). */
const FRACTURE_SLOTS = 2;

const PREFIX = "ficha-completa";

export interface FullSheetDialogProps {
  open: boolean;
  onClose: () => void;
  character: CharacterSheet;
  rules: CreationRules | null;
  arcs: Arc[];
  portraitUrl: string | null;
  crop: PortraitCropValue | null;
  onPortrait: () => void;
}

function Fractures({ count }: { count: number }) {
  return (
    <span className="cracks" role="img" aria-label={`${count} de ${FRACTURE_SLOTS} Fraturas`}>
      {Array.from({ length: Math.max(FRACTURE_SLOTS, count) }, (_, i) => (
        <CrackIcon key={i} on={i < count} />
      ))}
    </span>
  );
}

function fractureText(n: number) {
  if (n === 0) return "íntegra";
  if (n >= FRACTURE_SLOTS) return "rompida";
  return plural(n, "Fratura", "Fraturas");
}

/** Ficha completa (09, item 2.6): abas na lateral e conteúdo em pergaminho. Somente leitura. */
export function FullSheetDialog({ open, onClose, character, rules, arcs, portraitUrl, crop, onPortrait }: FullSheetDialogProps) {
  const [tab, setTab] = useState<SheetTab>("geral");
  const activeArcIndex = arcs.findIndex((a) => a.objective_id !== null && a.objective_id === character.ambition?.id);
  const activeArc = activeArcIndex >= 0 ? arcs[activeArcIndex] : undefined;

  const optional: [string, string | null | undefined][] = [
    ["Idade", character.age],
    ["Altura", character.height],
    ["Origem", character.origin],
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Ficha completa"
      size="wide"
      actions={<Button onClick={onClose}>Fechar</Button>}
    >
      <div className="fsheet">
        <div className="fsheet__side">
          <Portrait name={character.name} src={portraitUrl} crop={crop} size="lg" onClick={onPortrait} />
          <div>
            <p className="fsheet__name">{character.name}</p>
            <p className="fsheet__concept">{character.concept}</p>
          </div>
          <Tabs
            items={TABS.map((t) => ({ id: t.id, label: t.label, icon: <PixelIcon name={t.icon} /> }))}
            value={tab}
            onChange={setTab}
            label="Seções da ficha"
            idPrefix={PREFIX}
            orientation="vertical"
            className="fsheet__tabs"
          />
        </div>
        {TABS.map((t) => (
          <TabPanel key={t.id} idPrefix={PREFIX} id={t.id} selected={tab === t.id} className="fsheet__main surface-parchment">
            {tab === t.id ? (
              <>
                <h3 className="fsheet__heading">{t.label}</h3>
                {t.id === "geral" ? (
                  <>
                    <h4 className="sheet-sec__title">Trilhas</h4>
                    <SheetTracks character={character} rules={rules} />
                    <h4 className="sheet-sec__title">Atributos</h4>
                    {rules ? <AttributePlates character={character} rules={rules} /> : <p className="hint">Carregando as regras…</p>}
                  </>
                ) : null}
                {t.id === "pericias" ? (
                  rules ? (
                    <SkillRows character={character} rules={rules} all columns={2} />
                  ) : (
                    <p className="hint">Carregando as regras…</p>
                  )
                ) : null}
                {t.id === "objetivos" ? (
                  <>
                    <div className="goalcard">
                      <small>Ambição · longo prazo</small>
                      <p>{character.ambition?.text ?? "Nenhuma Ambição ativa."}</p>
                      {activeArc ? (
                        <span className="goalcard__meta">
                          Arco {activeArcIndex + 1} · {plural(activeArc.scenes.length, "Cena", "Cenas")}
                        </span>
                      ) : null}
                    </div>
                    <div className="goalcard">
                      <small>Desejo · curto prazo</small>
                      <p>{character.desire?.text ?? "Nenhum Desejo ativo."}</p>
                    </div>
                  </>
                ) : null}
                {t.id === "conviccoes" ? (
                  <ol className="convcards">
                    {character.convictions.map((c) => (
                      <li key={c.position} className="convcard">
                        <p className="convcard__text">{c.text}</p>
                        <Fractures count={c.fractures} />
                        <p className="convcard__pillar">
                          Pilar: {c.pillar} · {fractureText(c.fractures)}
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : null}
                {t.id === "descricao" ? (
                  <>
                    <dl className="kv">
                      <div className="kv__row">
                        <dt>Conceito</dt>
                        <dd>{character.concept}</dd>
                      </div>
                      {optional.map(([label, value]) => (
                        <div key={label} className="kv__row">
                          <dt>{label}</dt>
                          <dd>{value ? value : <span className="kv__empty">não informado</span>}</dd>
                        </div>
                      ))}
                      <div className="kv__row">
                        <dt>Aparência</dt>
                        <dd className="prose">{character.appearance ? character.appearance : <span className="kv__empty">não informada</span>}</dd>
                      </div>
                      <div className="kv__row">
                        <dt>Personalidade</dt>
                        <dd className="prose">
                          {character.personality ? character.personality : <span className="kv__empty">não informada</span>}
                        </dd>
                      </div>
                    </dl>
                    <h4 className="sheet-sec__title">Histórico</h4>
                    <p className="prose fsheet__history">{character.history}</p>
                  </>
                ) : null}
              </>
            ) : null}
          </TabPanel>
        ))}
      </div>
    </Dialog>
  );
}
