import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// O jsdom não desenha em canvas; o céu (SkyBackdrop) simplesmente não pinta nos testes.
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
}

// O jsdom não tem layout: o ProseMirror (editor da História) pede retângulos ao rolar até a seleção.
const noRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
const zeroRect = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) }) as DOMRect;
if (typeof Range !== "undefined") {
  Range.prototype.getClientRects ??= noRects;
  Range.prototype.getBoundingClientRect ??= zeroRect;
}
if (typeof Element !== "undefined" && typeof Element.prototype.getClientRects !== "function") {
  Element.prototype.getClientRects = noRects;
}
if (typeof Text !== "undefined") {
  (Text.prototype as unknown as { getClientRects: () => DOMRectList }).getClientRects ??= noRects;
}
if (typeof document !== "undefined" && typeof document.elementFromPoint !== "function") {
  document.elementFromPoint = () => null;
}

afterEach(() => {
  cleanup();
});
