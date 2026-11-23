import "../styles/index.css";
import "./gallery.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Gallery } from "./Gallery";

const root = document.getElementById("root");
if (!root) throw new Error("elemento #root não encontrado");

createRoot(root).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
