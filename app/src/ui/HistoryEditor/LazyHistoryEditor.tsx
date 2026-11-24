import { lazy, Suspense } from "react";

import type { HistoryEditorProps } from "./HistoryEditor";

/**
 * O TipTap (com o ProseMirror) quase dobra o pacote JavaScript do app; ele só é carregado
 * quando o editor da História aparece pela primeira vez (pacote separado, do próprio app).
 */
const Editor = lazy(() => import("./HistoryEditor").then((m) => ({ default: m.HistoryEditor })));

/** Editor da História, carregado sob demanda; mesma interface do `HistoryEditor`. */
export function HistoryEditor(props: HistoryEditorProps) {
  return (
    <Suspense
      fallback={
        <div className={["rte-loading", props.className ?? ""].filter(Boolean).join(" ")} role="status">
          Carregando o editor…
        </div>
      }
    >
      <Editor {...props} />
    </Suspense>
  );
}

export type { HistoryEditorProps };
