import { useEffect, useRef, useState } from "react";

import { BackendError, type BackendInfo } from "../../api/backend";
import { editJourney } from "../../api/journeyScreen";
import type { OpenJourneySummary } from "../../api/journeys";
import { describeError } from "../../lib/format";
import { Button, Dialog, TextArea, TextField } from "../../ui";
import { defaultJourneyName } from "../newJourney/model";
import { JOURNEY_DESCRIPTION_MAX } from "../newJourney/StartStep";

export interface EditJourneyDialogProps {
  open: boolean;
  onClose: () => void;
  info: BackendInfo;
  journey: OpenJourneySummary;
  characterName: string;
  onSaved: (journey: OpenJourneySummary) => void;
}

/**
 * Editar Jornada (menu ⚙; 09-tela-da-jornada.md, item 2.1): nome e descrição, opcionais como na
 * Nova Jornada. Nome em branco volta ao padrão "A Jornada de <nome>"; o serviço valida e grava.
 */
export function EditJourneyDialog({ open, onClose, info, journey, characterName, onSaved }: EditJourneyDialogProps) {
  const fallback = defaultJourneyName(characterName);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const nameRef = useRef<HTMLInputElement>(null);

  // Ao abrir, parte do que está gravado (o nome padrão aparece como campo em branco).
  useEffect(() => {
    if (!open) return;
    setName(journey.name && journey.name !== fallback ? journey.name : "");
    setDescription(journey.description ?? "");
    setError(null);
    setFieldErrors({});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      const { journey: saved } = await editJourney(info, { name: name.trim() ? name : null, description: description.trim() ? description : null });
      onSaved(saved);
      onClose();
    } catch (err) {
      if (err instanceof BackendError && err.errors.length) {
        setFieldErrors(Object.fromEntries(err.errors.map((e) => [e.field, e.message])));
      }
      setError(`Não foi possível salvar: ${describeError(err)} Nada mudou.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Editar Jornada"
      description="O nome aparece na barra da Jornada e no menu inicial. O Narrador lê a descrição para conduzir a história."
      dismissible={!saving}
      initialFocusRef={nameRef}
      actions={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            Salvar
          </Button>
        </>
      }
    >
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <TextField
          ref={nameRef}
          id="edit-journey-name"
          label="Nome da Jornada (opcional)"
          autoComplete="off"
          placeholder={fallback}
          hint={`Se ficar em branco, será “${fallback}”.`}
          value={name}
          error={fieldErrors.name}
          disabled={saving}
          onChange={(e) => setName(e.target.value)}
        />
        <TextArea
          id="edit-journey-description"
          label="Descrição (opcional)"
          rows={6}
          maxLength={JOURNEY_DESCRIPTION_MAX}
          hint={`${description.length.toLocaleString("pt-BR")}/${JOURNEY_DESCRIPTION_MAX.toLocaleString("pt-BR")} caracteres.`}
          value={description}
          error={fieldErrors.description}
          disabled={saving}
          onChange={(e) => setDescription(e.target.value)}
        />
        {error ? (
          <p className="callout callout--danger" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
