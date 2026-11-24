import type { WorldContent } from "../../api/journeys";
import { Portrait, TextArea, TextField } from "../../ui";
import type { PortraitDraft } from "./CharacterStep";
import type { CharacterForm } from "./model";

/** Limite da descrição da Jornada (ADR-077, item 4); o serviço confere de novo. */
export const JOURNEY_DESCRIPTION_MAX = 2000;

export interface StartStepProps {
  world: WorldContent;
  startPlaceId: string | null;
  form: CharacterForm;
  portrait: PortraitDraft | null;
  name: string;
  defaultName: string;
  description: string;
  nameError: string | null;
  descriptionError: string | null;
  onName: (value: string) => void;
  onDescription: (value: string) => void;
  disabled: boolean;
}

/** Tela Iniciar Jornada: nome e descrição da Jornada (os dois opcionais). */
export function StartStep(props: StartStepProps) {
  const { world, form, portrait } = props;
  const start = world.places.find((p) => p.id === props.startPlaceId);
  return (
    <div className="nj-split nj-split--hero">
      <aside className="nj-side nj-box nj-hero-side" aria-label="Onde tudo começa">
        <div className="nj-hero-top">
          <Portrait name={form.name} src={portrait?.url ?? null} crop={portrait?.crop ?? null} size="lg" />
          <div className="nj-hero-name">
            <b>{form.name}</b>
            <span>{form.concept}</span>
          </div>
        </div>
        <div className="nj-box">
          <h4 className="nj-box__title">Onde tudo começa</h4>
          <dl className="nj-sfacts">
            <dt>Mundo</dt>
            <dd>{world.name}</dd>
            <dt>Lugar</dt>
            <dd>{start ? `${start.name} (${start.type})` : "—"}</dd>
            <dt>Abertura</dt>
            <dd>Em Cena, em um período sorteado pelo jogo</dd>
          </dl>
        </div>
      </aside>
      <div className="nj-main">
        <section className="nj-card surface-parchment" aria-labelledby="nj-start-title">
          <div className="nj-pane nj-startpane">
            <div className="nj-sub">
              <h5 id="nj-start-title">Dê vida à sua Jornada</h5>
            </div>
            <p className="hint">
              O nome e a descrição são seus. O Narrador lê a descrição para conduzir a história; os dois podem ser mudados
              depois, dentro da Jornada.
            </p>
            <TextField
              id="s-name"
              label="Nome da Jornada (opcional)"
              autoComplete="off"
              placeholder={props.defaultName}
              hint={`Se ficar em branco, será “${props.defaultName}”.`}
              value={props.name}
              error={props.nameError ?? undefined}
              disabled={props.disabled}
              onChange={(e) => props.onName(e.target.value)}
            />
            <TextArea
              id="s-description"
              label="Descrição (opcional)"
              rows={6}
              maxLength={JOURNEY_DESCRIPTION_MAX}
              placeholder="Em poucas linhas: o ponto de partida, o clima e o que está em jogo."
              hint={`Por exemplo: de onde o personagem parte, o que o espera e o tom que você quer. ${props.description.length.toLocaleString("pt-BR")}/${JOURNEY_DESCRIPTION_MAX.toLocaleString("pt-BR")} caracteres.`}
              value={props.description}
              error={props.descriptionError ?? undefined}
              disabled={props.disabled}
              onChange={(e) => props.onDescription(e.target.value)}
            />
            <p className="callout callout--warn">
              Ao iniciar, o Mundo e o personagem são gravados e o Aduran abre a primeira Cena em{" "}
              {start ? start.name : "o lugar inicial"}.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
