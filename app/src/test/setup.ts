import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// O jsdom não desenha em canvas; o céu (SkyBackdrop) simplesmente não pinta nos testes.
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
}

afterEach(() => {
  cleanup();
});
