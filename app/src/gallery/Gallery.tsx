/**
 * Galeria de componentes (prova visual do ADR-017/ADR-069). Só em
 * desenvolvimento: `npm run dev` e abra /gallery.html. `?secao=<id>` mostra uma
 * seção só (usado nas capturas de tela); `&aberto=1` abre o diálogo de exemplo.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import tokensCss from "../styles/tokens.css?raw";
import {
  Badge,
  Button,
  ChatBubble,
  Dialog,
  FieldGroup,
  ListCard,
  Panel,
  PeriodLabel,
  PERIOD_LABEL,
  PERIODS,
  PixelIcon,
  ProgressBar,
  RadioGroup,
  Select,
  SkyBackdrop,
  StatusIndicator,
  Stepper,
  TabPanel,
  Tabs,
  TextArea,
  TextField,
  TrailBoxes,
  type DayPeriod,
} from "../ui";
import { contrastRatio, parseContrastPairs, parseCustomProperties } from "../ui/contrast";

const SECTIONS = [
  { id: "cores", title: "Cores e contraste" },
  { id: "tipografia", title: "Tipografia" },
  { id: "botoes", title: "Botões" },
  { id: "paineis", title: "Painéis" },
  { id: "abas", title: "Abas" },
  { id: "progresso", title: "Barras de progresso" },
  { id: "listas", title: "Itens de lista" },
  { id: "campos", title: "Campos de texto" },
  { id: "escolhas", title: "Seleção, opções e grupos" },
  { id: "passos", title: "Passos (assistente)" },
  { id: "trilhas", title: "Trilhas de Vida e Vontade" },
  { id: "etiquetas", title: "Etiquetas e estados" },
  { id: "chat", title: "Balões de chat" },
  { id: "dialogo", title: "Diálogo" },
  { id: "ceu", title: "Céu (dia e noite)" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const params = new URLSearchParams(window.location.search);
const ONLY = params.get("secao") as SectionId | null;

const LONG_TEXT =
  "Você entra na oficina do ferreiro. O som ritmado do martelo contra a bigorna ecoa no ambiente, misturado ao calor da forja e ao cheiro de metal aquecido. Brann, um homem robusto de barba grisalha, ergue o olhar e o cumprimenta com um aceno — «Ah, é você de novo!», diz ele, enxugando a testa. Lá fora, a tarde cai devagar sobre Varrenk; as lanternas da praça começam a acender, uma a uma, e o vento traz o som distante dos sinos do mosteiro. Há uma espada de lâmina estreita pendurada na parede: o cabo é envolto em couro gasto, e na guarda há um brasão que você não reconhece…";

const GLYPHS = "áàâãéêíóôõúüç ÁÀÂÃÉÊÍÓÔÕÚÜÇ ªº «» — …";

/** Aplica custom properties por CSSOM (permitido pela CSP), sem atributo style no HTML. */
function useCssVars(vars: Record<string, string>) {
  const ref = useRef<HTMLElement | null>(null);
  const key = JSON.stringify(vars);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    for (const [name, value] of Object.entries(vars)) el.style.setProperty(name, value);
    // `key` resume `vars`
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return ref;
}

function Section({ id, title, children }: { id: SectionId; title: string; children: ReactNode }) {
  if (ONLY && ONLY !== id) return null;
  return (
    <section id={id} className="g-section" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="g-section__title">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="g-row">
      <p className="g-row__label">{label}</p>
      <div className="g-row__items">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------- cores */

const tokens = parseCustomProperties(tokensCss);
const pairs = parseContrastPairs(tokensCss);
const SEMANTIC = [...tokens.keys()].filter((name) => name.startsWith("--color-"));

function Swatch({ name }: { name: string }) {
  const value = tokens.get(name) ?? "";
  const ref = useCssVars({ "--swatch": value });
  return (
    <li className="g-swatch">
      <span ref={ref as React.RefObject<HTMLSpanElement>} className="g-swatch__chip" aria-hidden="true" />
      <code>{name}</code>
      <span className="g-swatch__hex">{value}</span>
    </li>
  );
}

function PairSample({ fg, bg, min }: { fg: string; bg: string; min: number }) {
  const fgv = tokens.get(fg) ?? "#000000";
  const bgv = tokens.get(bg) ?? "#000000";
  const ratio = contrastRatio(fgv, bgv);
  const ref = useCssVars({ "--pair-fg": fgv, "--pair-bg": bgv });
  return (
    <tr>
      <td>
        <span ref={ref as React.RefObject<HTMLSpanElement>} className="g-pair">
          Aa Texto
        </span>
      </td>
      <td>
        <code>{fg}</code>
        <br />
        <code>{bg}</code>
      </td>
      <td className={ratio >= min ? "text-ok" : "text-danger"}>
        {ratio.toFixed(2)}:1 {ratio >= min ? "✓" : "✗"} (mín. {min})
      </td>
    </tr>
  );
}

function Colors() {
  return (
    <Section id="cores" title="Cores e contraste">
      <ul className="g-swatches">
        {SEMANTIC.map((name) => (
          <Swatch key={name} name={name} />
        ))}
      </ul>
      <table className="g-table">
        <caption>Pares verificados (WCAG AA; o mesmo cálculo do teste automatizado)</caption>
        <thead>
          <tr>
            <th scope="col">Amostra</th>
            <th scope="col">Frente / fundo</th>
            <th scope="col">Razão</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((p) => (
            <PairSample key={`${p.fg}-${p.bg}`} {...p} />
          ))}
        </tbody>
      </table>
    </Section>
  );
}

/* --------------------------------------------------------- tipografia */

function Typography() {
  return (
    <Section id="tipografia" title="Tipografia">
      <div className="g-type">
        <p className="g-type__pixel g-type__pixel--2xl">Henduran — Pixelify Sans 32</p>
        <p className="g-type__pixel g-type__pixel--xl">Título de painel — 24</p>
        <p className="g-type__pixel">HUD: Conectado · Entardecer · 469 MB · Q4_K_M</p>
        <p className="g-type__pixel">{GLYPHS}</p>
        <p>Crimson Pro 18 (corpo): {GLYPHS}</p>
        <p>
          <em>Itálico: o ferreiro parece disposto a conversar.</em> <strong>Seminegrito: Ambição e Desejo.</strong>
        </p>
      </div>
      <div className="g-two">
        <Panel variant="parchment" title="Parágrafo longo sobre pergaminho">
          <p>{LONG_TEXT}</p>
        </Panel>
        <Panel title="Parágrafo longo sobre fundo escuro">
          <p>{LONG_TEXT}</p>
        </Panel>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------- botões */

const STATES = [
  { label: "Normal", props: {} },
  { label: "Hover", props: { "data-force": "hover" } },
  { label: "Foco", props: { "data-force": "focus" } },
  { label: "Ativo", props: { "data-force": "active" } },
  { label: "Desativado", props: { disabled: true } },
  { label: "Carregando", props: { loading: true } },
] as const;

function Buttons() {
  return (
    <Section id="botoes" title="Botões">
      {(["primary", "secondary", "danger", "ghost"] as const).map((variant) => (
        <Row key={variant} label={variant}>
          {STATES.map((s) => (
            <Button key={s.label} variant={variant} {...s.props}>
              {s.label}
            </Button>
          ))}
        </Row>
      ))}
      <Row label="pequeno (sm)">
        <Button size="sm">Tirar da lista</Button>
        <Button size="sm" variant="primary">
          Usar
        </Button>
        <Button size="sm" disabled>
          Desativado
        </Button>
      </Row>
      <div className="surface-parchment g-parchment-strip">
        <Row label="sobre pergaminho">
          <Button variant="primary">Primário</Button>
          <Button>Secundário</Button>
          <Button variant="ghost">Discreto</Button>
          <Button data-force="focus">Foco</Button>
        </Row>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------ painéis */

function Panels() {
  return (
    <Section id="paineis" title="Painéis">
      <div className="g-three">
        <Panel title="Contexto da Cena">
          <p>Oficina do ferreiro em Varrenk. Brann é um aliado conhecido, prático e direto.</p>
        </Panel>
        <Panel variant="parchment" title="Objetivos da Jornada" titleExtra={<Badge tone="accent">2</Badge>}>
          <p>Investigar os rumores na estrada. Obter informações em Varrenk.</p>
        </Panel>
        <Panel variant="parchment" as="div">
          <p>Painel de pergaminho sem barra de título.</p>
        </Panel>
      </div>
    </Section>
  );
}

/* --------------------------------------------------------------- abas */

function TabsDemo() {
  const [tab, setTab] = useState<"jornada" | "ficha" | "mundo">("jornada");
  const items = [
    { id: "jornada" as const, label: "Jornada", icon: <PixelIcon name="star" /> },
    { id: "ficha" as const, label: "Ficha" },
    { id: "mundo" as const, label: "Mundo" },
  ];
  return (
    <Section id="abas" title="Abas">
      <Tabs items={items} value={tab} onChange={setTab} label="Abas de exemplo" idPrefix="g" />
      {items.map((t) => (
        <TabPanel key={t.id} idPrefix="g" id={t.id} selected={tab === t.id} className="g-tabpanel">
          <p>Conteúdo da aba {t.label}. Use as setas, Home e End.</p>
        </TabPanel>
      ))}
      <Row label="estados forçados">
        <div className="tabs">
          <button type="button" className="tabs__tab px-frame">
            Normal
          </button>
          <button type="button" className="tabs__tab px-frame" data-force="hover">
            Hover
          </button>
          <button type="button" className="tabs__tab tabs__tab--active px-frame">
            Ativa
          </button>
          <button type="button" className="tabs__tab px-frame" data-force="focus">
            Foco
          </button>
        </div>
      </Row>
    </Section>
  );
}

/* ----------------------------------------------------------- progresso */

function Progress() {
  return (
    <Section id="progresso" title="Barras de progresso">
      <div className="g-stack">
        {[0, 0.25, 0.6, 1].map((v) => (
          <Row key={v} label={`${Math.round(v * 100)}%`}>
            <ProgressBar label={`Exemplo ${Math.round(v * 100)}%`} value={v} />
          </Row>
        ))}
        <Row label="roxo">
          <ProgressBar label="Exemplo roxo" value={0.45} tone="purple" />
        </Row>
        <Row label="indeterminado">
          <ProgressBar label="Carregando" value={null} />
        </Row>
      </div>
    </Section>
  );
}

/* --------------------------------------------------------------- listas */

function Lists() {
  return (
    <Section id="listas" title="Itens de lista">
      <ul className="card-list">
        <ListCard
          title="qwen2.5-0.5b-instruct-q4_k_m.gguf"
          titleId="g-l1"
          selected
          tags={
            <>
              <Badge tone="accent" icon={<PixelIcon name="star" />}>
                Ativo
              </Badge>
              <Badge tone="success" icon={<PixelIcon name="check" />}>
                Cabe na sua placa
              </Badge>
            </>
          }
          meta="469 MB · Q4_K_M"
          actions={
            <>
              <Button variant="primary" aria-describedby="g-l1">
                Usar este modelo
              </Button>
              <Button variant="danger" aria-describedby="g-l1">
                Remover
              </Button>
            </>
          }
        >
          <p className="list-card__meta">Pronto</p>
        </ListCard>
        <ListCard
          title="Medio-Q8_0.gguf"
          tags={
            <Badge tone="warn" icon={<PixelIcon name="hourglass" />}>
              Vai rodar no processador, mais lento
            </Badge>
          }
          meta="9,0 GB · Q8_0"
          actions={<Button disabled>Usar este modelo</Button>}
        />
        <ListCard
          title={<Button variant="ghost" className="result__button">Qwen/Qwen2.5-0.5B-Instruct-GGUF</Button>}
          meta="506.742 downloads · 173 curtidas · licença apache-2.0"
        />
      </ul>
    </Section>
  );
}

/* --------------------------------------------------------------- campos */

function Fields() {
  return (
    <Section id="campos" title="Campos de texto">
      <div className="g-two">
        <div className="g-stack">
          <TextField label="Nome do modelo" placeholder="Por exemplo: Qwen2.5 0.5B Instruct" hint="Só repositórios públicos." />
          <TextField label="Caminho completo da pasta" defaultValue="D:\Nada" error="A pasta não existe: D:\Nada" />
          <TextField label="Desativado" disabled defaultValue="Indisponível" />
          <TextField label="Com ação" action={<Button variant="primary">Buscar</Button>} />
        </div>
        <Panel variant="parchment" title="Sobre pergaminho">
          <TextField label="Nome do personagem" defaultValue="Lorian Valemont" hint="Como o Narrador vai chamá-lo." />
          <TextArea label="Histórico" rows={3} defaultValue="Filho de ferreiros, cresceu entre a forja e a estrada." />
        </Panel>
      </div>
      <TextArea label="Mensagem para o Narrador" hint="Enter envia; Shift+Enter quebra a linha." rows={3} />
    </Section>
  );
}

/* ------------------------------------------------- seleção, opções e grupos */

const VALUE_OPTIONS = ["4", "3", "2", "1"].map((v) => ({ value: v, label: v }));

function Choices() {
  const [profile, setProfile] = useState<string | null>("equilibrado");
  const [place, setPlace] = useState<string | null>(null);
  return (
    <Section id="escolhas" title="Seleção, opções e grupos">
      <div className="g-two">
        <div className="g-stack">
          <Select label="Força" hint="potência física" placeholder="—" options={VALUE_OPTIONS} defaultValue="" />
          <Select label="Agilidade" options={VALUE_OPTIONS} defaultValue="4" error="O valor 4 passou da conta." />
          <Select label="Lutar" options={VALUE_OPTIONS} disabled defaultValue="1" hint="Escolha um perfil primeiro." />
        </div>
        <Panel variant="parchment" title="Sobre pergaminho">
          <Select label="Vigor" placeholder="—" options={VALUE_OPTIONS} defaultValue="3" />
          <RadioGroup
            legend="Backups"
            value="b1"
            onChange={() => undefined}
            options={[
              { value: "b1", label: "22/11/2026 às 10:15:00", description: "journey-v2-20261122-101500.db · 40 KB" },
              { value: "b2", label: "20/11/2026 às 08:00:00", description: "journey-v1-20261120-080000.db · 20 KB" },
            ]}
          />
        </Panel>
      </div>
      <RadioGroup
        legend="Perfil de Perícias (caixas)"
        hint="O perfil diz quantas Perícias recebem cada valor."
        appearance="cards"
        value={profile}
        onChange={setProfile}
        options={[
          { value: "generalista", label: "Generalista", description: "1 em 3, 6 em 2 e 6 em 1 (13 Perícias)." },
          { value: "equilibrado", label: "Equilibrado", description: "2 em 3, 4 em 2 e 6 em 1 (12 Perícias)." },
          { value: "especialista", label: "Especialista", description: "1 em 4, 2 em 3, 2 em 2 e 2 em 1 (7 Perícias)." },
        ]}
      />
      <RadioGroup
        legend="Lugar inicial (com erro)"
        appearance="cards"
        value={place}
        onChange={setPlace}
        error={place ? undefined : "Escolha o lugar onde a Jornada começa."}
        options={[
          { value: "a", label: "Norilunde", description: "estalagem" },
          { value: "b", label: "Vinarunde", description: "cidade" },
          { value: "c", label: "Rosedor", description: "montanha" },
        ]}
      />
      <FieldGroup
        legend="Valores dos Atributos"
        hint="Distribua os valores 4, 3, 3, 2, 2 e 1 entre os 6 Atributos."
        error="Os Atributos devem ter 1 em 4, 2 em 3, 2 em 2, 1 em 1."
        extra={<Button size="sm">Distribuir ao acaso</Button>}
      >
        <p className="counts">
          <span className="counts__label">Ainda faltam:</span> 1 em 2.
          <span className="counts__extra"> Passou da conta: 1 em 3.</span>
        </p>
      </FieldGroup>
    </Section>
  );
}

/* ---------------------------------------------------------------- passos */

function StepsDemo() {
  const [current, setCurrent] = useState(1);
  const steps = [
    { id: "mundo", label: "Mundo" },
    { id: "protagonista", label: "Protagonista" },
    { id: "revisao", label: "Revisão" },
  ];
  return (
    <Section id="passos" title="Passos (assistente)">
      <div className="g-two">
        <Stepper steps={steps} current={current} label="Passos de exemplo" onSelect={setCurrent} />
        <div className="actions">
          <Button onClick={() => setCurrent((c) => Math.max(0, c - 1))}>Voltar</Button>
          <Button variant="primary" onClick={() => setCurrent((c) => Math.min(steps.length - 1, c + 1))}>
            Avançar
          </Button>
        </div>
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- trilhas */

function Trails() {
  return (
    <Section id="trilhas" title="Trilhas de Vida e Vontade">
      <div className="g-two">
        <Panel title="Sobre fundo escuro">
          <TrailBoxes label="Vida" size={7} legend />
          <TrailBoxes label="Vontade" size={6} superficial={2} agravada={1} />
          <TrailBoxes label="Vida (ainda sem Vigor)" size={null} />
        </Panel>
        <Panel variant="parchment" title="Sobre pergaminho">
          <TrailBoxes label="Vida" size={5} superficial={1} legend />
          <TrailBoxes label="Vontade" size={8} agravada={2} superficial={3} />
        </Panel>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------ etiquetas */

function Tags() {
  return (
    <Section id="etiquetas" title="Etiquetas e estados">
      <Row label="Badge">
        <Badge>Neutro</Badge>
        <Badge tone="accent">Destaque</Badge>
        <Badge tone="success" icon={<PixelIcon name="check" />}>
          Sucesso
        </Badge>
        <Badge tone="warn" icon={<PixelIcon name="hourglass" />}>
          Atenção
        </Badge>
        <Badge tone="danger" icon={<PixelIcon name="cross" />}>
          Perigo
        </Badge>
        <Badge tone="info">Info</Badge>
      </Row>
      <Row label="StatusIndicator">
        <StatusIndicator tone="ok" label="Conectado" />
        <StatusIndicator tone="busy" label="Iniciando serviço…" />
        <StatusIndicator tone="error" label="Erro: serviço indisponível" />
        <StatusIndicator tone="idle" label="Parado" />
      </Row>
      <Row label="Período (texto)">
        {PERIODS.map((p) => (
          <PeriodLabel key={p} period={p} />
        ))}
      </Row>
      <Row label="Ícones">
        {(
          [
            "sun", "moon", "check", "cross", "hourglass", "hollow", "chat", "gem", "star", "warning",
            "plus", "list", "door", "pin", "person", "clock", "globe", "sword", "back", "next",
          ] as const
        ).map((n) => (
          <span key={n} className="g-icon">
            <PixelIcon name={n} size={32} /> {n}
          </span>
        ))}
      </Row>
    </Section>
  );
}

/* ----------------------------------------------------------------- chat */

function Chat() {
  return (
    <Section id="chat" title="Balões de chat">
      <div className="chat__log px-frame g-chat">
        <ol className="chat__list">
          <li className="chat__item">
            <ChatBubble variant="system">Cena iniciada: A Oficina do Ferreiro.</ChatBubble>
          </li>
          <li className="chat__item">
            <ChatBubble variant="narrator" speaker="Narrador">
              {LONG_TEXT.slice(0, 260)}
            </ChatBubble>
          </li>
          <li className="chat__item">
            <ChatBubble variant="player" speaker="Você">
              Pergunto a Brann se ele ouviu falar de movimentações estranhas na estrada de Elmora.
            </ChatBubble>
          </li>
          <li className="chat__item">
            <ChatBubble variant="aside" speaker="Aduran">
              (Aparte do Narrador Geral, fora da Cena.) A estrada de Elmora fica a meio dia de caminhada daqui.
            </ChatBubble>
          </li>
          <li className="chat__item">
            <ChatBubble variant="narrator" speaker="Narrador" streaming>
              Brann pousa o martelo e coça a barba
            </ChatBubble>
          </li>
          <li className="chat__item">
            <ChatBubble variant="narrator" speaker="Narrador" notes={<p className="bubble__note">Resposta interrompida.</p>}>
              O ferreiro começa a responder, mas
            </ChatBubble>
          </li>
        </ol>
      </div>
    </Section>
  );
}

/* --------------------------------------------------------------- diálogo */

function DialogDemo() {
  const [open, setOpen] = useState(ONLY === "dialogo" && params.get("aberto") === "1");
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Section id="dialogo" title="Diálogo">
      <p>Confirmação modal: foco preso, Esc fecha, o foco volta ao botão que abriu.</p>
      <div className="actions">
        <Button variant="danger" onClick={() => setOpen(true)}>
          Remover modelo
        </Button>
      </div>
      <Dialog
        open={open}
        tone="danger"
        title="Apagar qwen2.5-0.5b-instruct-q4_k_m.gguf do disco?"
        description={
          <p>Isto apaga o arquivo do disco e não pode ser desfeito. Para usar de novo, será preciso baixar outra vez.</p>
        }
        onClose={() => setOpen(false)}
        initialFocusRef={cancelRef}
        actions={
          <>
            <Button ref={cancelRef} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => setOpen(false)}>
              Apagar do disco
            </Button>
          </>
        }
      />
    </Section>
  );
}

/* ------------------------------------------------------------------- céu */

function Sky() {
  const [period, setPeriod] = useState<DayPeriod>("entardecer");
  return (
    <Section id="ceu" title="Céu (dia e noite)">
      <div className="g-sky-grid">
        {PERIODS.map((p) => (
          <figure key={p} className="g-sky-tile">
            <SkyBackdrop period={p} className="g-sky-tile__sky" />
            <figcaption>
              <PeriodLabel period={p} />
            </figcaption>
          </figure>
        ))}
      </div>
      <fieldset className="variants g-sky-picker">
        <legend>Trocar o período (crossfade)</legend>
        {PERIODS.map((p) => (
          <label key={p} className="check">
            <input type="radio" name="g-period" checked={period === p} onChange={() => setPeriod(p)} />
            {PERIOD_LABEL[p]}
          </label>
        ))}
      </fieldset>
      <SkyBackdrop period={period} className="g-sky-big" />
    </Section>
  );
}

/* --------------------------------------------------------------- página */

export function Gallery() {
  const [reduced, setReduced] = useState(false);
  const [scale, setScale] = useState("1");

  useEffect(() => {
    document.documentElement.classList.toggle("motion-reduced", reduced);
  }, [reduced]);

  useEffect(() => {
    document.documentElement.style.setProperty("--text-scale", scale);
  }, [scale]);

  const nav = useMemo(
    () =>
      SECTIONS.map((s) => (
        <li key={s.id}>
          <a href={`#${s.id}`}>{s.title}</a>
        </li>
      )),
    [],
  );

  return (
    <div className="g-page">
      <header className="app-bar g-header">
        <h1 className="app-bar__brand">
          <PixelIcon name="star" size={24} className="app-bar__mark" />
          Galeria de componentes
        </h1>
        <div className="g-controls">
          <label className="check">
            <input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} />
            Movimento reduzido
          </label>
          <label className="g-select">
            Escala do texto
            <select value={scale} onChange={(e) => setScale(e.target.value)}>
              <option value="1">100%</option>
              <option value="1.25">125%</option>
              <option value="1.5">150%</option>
              <option value="2">200%</option>
            </select>
          </label>
        </div>
      </header>
      {ONLY ? null : (
        <nav aria-label="Seções da galeria" className="g-nav">
          <ul>{nav}</ul>
        </nav>
      )}
      <main className="g-main">
        <Colors />
        <Typography />
        <Buttons />
        <Panels />
        <TabsDemo />
        <Progress />
        <Lists />
        <Fields />
        <Choices />
        <StepsDemo />
        <Trails />
        <Tags />
        <Chat />
        <DialogDemo />
        <Sky />
      </main>
    </div>
  );
}
